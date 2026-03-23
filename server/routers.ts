import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createAnalysis,
  getAnalysisById,
  getAnalysesByUserId,
  updateAnalysis,
  countAnalysesToday,
} from "./db";
import { runAnalysisJob, assessSpecHealth, type AnalysisIR } from "./analyzer";
import { diffAnalysisIR } from "./analyzer/spec-diff";
import { buildPRComment, postGitHubPRComment } from "./github-pr";
import { scanGitHubRepo, parseGitHubUrl } from "./analyzer/repo-scanner";
import { listProofPacks, getProofPack, type IndustryPack } from "./analyzer/industry-proof-packs";
import { generatePlaywrightConfig, generateCIWorkflow } from "./analyzer/playwright-mcp";
import { DEMO_ANALYSIS } from "./demo-data";
import { runTests } from "./test-runner";
import { emitTestResult, emitRunComplete, emitRunError } from "./test-run-sse";
import { testRuns } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";

// ─── In-memory job queue (simple, no Redis needed for MVP) ────────────────────
const runningJobs = new Set<number>();
const cancelledJobs = new Set<number>(); // Jobs that should stop at next checkpoint

async function startAnalysisJobFromKey(analysisId: number, specKey: string, projectName: string, industryPack?: IndustryPack) {
  if (runningJobs.has(analysisId)) return;
  runningJobs.add(analysisId);

  // Goldstandard: 8-minute job timeout — prevents permanently stuck jobs after server restarts
  const JOB_TIMEOUT_MS = 8 * 60 * 1000;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  setImmediate(async () => {
    // Set timeout: if job doesn't complete in 8 minutes, mark as failed
    timeoutHandle = setTimeout(async () => {
      if (runningJobs.has(analysisId)) {
        console.error(`[Job ${analysisId}] Timeout after 8 minutes — marking as failed`);
        cancelledJobs.add(analysisId); // Signal the job to stop at next checkpoint
        await updateAnalysis(analysisId, {
          status: "failed",
          errorMessage: "Job timed out after 8 minutes. Please try again.",
        }).catch(() => {});
        runningJobs.delete(analysisId);
      }
    }, JOB_TIMEOUT_MS);

    try {
      await updateAnalysis(analysisId, { status: "running" });
      // Fetch spec text from S3
      const { url } = await storageGet(specKey);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch spec from S3: ${resp.status}`);
      const specText = await resp.text();

      const result = await runAnalysisJob(specText, projectName, async (layer, message, data) => {
        // Check if job was cancelled between layers
        if (cancelledJobs.has(analysisId)) {
          cancelledJobs.delete(analysisId);
          throw new Error("Job cancelled by user");
        }
        // Update DB with live progress after each layer
        const update: Record<string, unknown> = {
          progressLayer: layer,
          progressMessage: message,
        };
        if (data?.analysisResult) update.layer1Json = data.analysisResult as any;
        if (data?.riskModel) update.layer2Json = data.riskModel as any;
        await updateAnalysis(analysisId, update as any);
      }, industryPack);

      // Store report and test files in S3
      const reportKey = `analyses/${analysisId}/testforge-report.md`;
      const { url: reportUrl } = await storagePut(reportKey, Buffer.from(result.report), "text/markdown");

      // Build ZIP with all test files + report
      const archiver = await import("archiver");
      const { PassThrough } = await import("stream");

      const chunks: Buffer[] = [];
      const archive = archiver.default("zip", { zlib: { level: 9 } });
      const passThrough = new PassThrough();

      // Pipe archive output into passthrough so we can collect chunks
      archive.pipe(passThrough);
      passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));

      // Add test files
      for (const tf of result.testFiles) {
        archive.append(tf.content, { name: tf.filename });
      }
      // Add report
      archive.append(result.report, { name: "testforge-report.md" });
      // Add all generated helper files (api.ts, auth.ts, factories.ts, schemas.ts, etc.)
      const helpers = result.helpers;
      for (const [filename, content] of Object.entries(helpers)) {
        archive.append(content, { name: filename });
      }
      // README.md from helpers already included above; if not present, use legacy buildReadme
      if (!helpers["README.md"]) {
        archive.append(buildReadme(result), { name: "README.md" });
      }

      // Add extended 6-layer test suite files
      const extended = result.extendedSuite;
      for (const extFile of extended.files) {
        // Skip security files already added above (avoid duplicates)
        const alreadyAdded = result.testFiles.some(tf => tf.filename === extFile.filename);
        if (!alreadyAdded) {
          archive.append(extFile.content, { name: extFile.filename });
        }
      }
      // Add extended configs (vitest.config.ts, cucumber.config.ts, etc.)
      for (const [configName, configContent] of Object.entries(extended.configs)) {
        // Don't overwrite existing playwright.config.ts or package.json from helpers
        const skipNames = ["playwright.config.ts", "package.json", ".github/workflows/testforge.yml"];
        if (!skipNames.includes(configName)) {
          archive.append(configContent, { name: configName });
        }
      }
      // Add extended README (overwrites helpers README with full 6-layer version)
      archive.append(extended.readme, { name: "README.md" });
      // Add Playwright feedback CI workflow (S5-3) — posts results back to TestForge
      const feedbackCI = generateCIWorkflow(analysisId, "https://testforge.dev");
      archive.append(feedbackCI, { name: ".github/workflows/testforge-feedback.yml" });
      // Wait for both finalize and stream finish
      await Promise.all([
        archive.finalize(),
        new Promise<void>((resolve, reject) => {
          passThrough.on("finish", resolve);
          passThrough.on("error", reject);
          archive.on("error", reject);
        }),
      ]);

      const zipBuffer = Buffer.concat(chunks);
      const zipKey = `analyses/${analysisId}/testforge-output.zip`;
      const { url: zipUrl } = await storagePut(zipKey, zipBuffer, "application/zip");

      const suite = result.validatedSuite;
      await updateAnalysis(analysisId, {
        status: "completed",
        resultJson: {
          analysisResult: result.analysisResult,
          riskModel: result.riskModel,
          validatedSuite: suite,
          report: result.report,
          testFileCount: result.testFiles.length,
        } as any,
        outputZipUrl: zipUrl,
        outputZipKey: zipKey,
        verdictScore: Math.round(suite.verdict.score * 10),
        coveragePercent: suite.coverage.coveragePercent,
        validatedProofCount: suite.verdict.passed,
        discardedProofCount: suite.verdict.failed,
        behaviorCount: result.analysisResult.ir.behaviors.length,
        completedAt: new Date(),
      });
    } catch (err: any) {
      console.error(`[Job ${analysisId}] Failed:`, err);
      const isCancelled = err?.message === "Job cancelled by user";
      await updateAnalysis(analysisId, {
        status: isCancelled ? "cancelled" : "failed",
        errorMessage: isCancelled ? "Cancelled by user" : (err?.message || "Unknown error"),
      });
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      runningJobs.delete(analysisId);
      cancelledJobs.delete(analysisId);
    }
  });
}

function buildReadme(result: Awaited<ReturnType<typeof runAnalysisJob>>): string {
  return `# TestForge Generated Test Suite

Generated by TestForge — Quality Compiler for SaaS

## Files

${result.testFiles.map(f => `- \`${f.filename}\``).join("\n")}
- \`testforge-report.md\` — Full analysis report

## Setup

\`\`\`bash
npm install -D @playwright/test
npx playwright install
\`\`\`

Copy the test files into your project and configure \`playwright.config.ts\`.

## Environment Variables

\`\`\`env
BASE_URL=http://localhost:3000
TEST_TENANT_ID=1
TEST_TENANT_B_ID=2
E2E_ADMIN_USER=admin@your-tenant.com
E2E_ADMIN_PASS=yourpassword
E2E_TENANT_B_USER=admin@other-tenant.com
E2E_TENANT_B_PASS=otherpassword
CRON_SECRET=your-cron-secret
DEBUG_API_TOKEN=your-debug-token
\`\`\`

## Verdict

- Score: ${result.validatedSuite.verdict.score.toFixed(1)}/10.0
- Validated Proofs: ${result.validatedSuite.verdict.passed}
- Coverage: ${result.validatedSuite.coverage.coveragePercent}%
`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  analyses: router({
    // Create a new analysis job
    create: protectedProcedure
      .input(z.object({
        projectName: z.string().min(1).max(255),
        specKey: z.string().min(1),   // S3 key from /api/upload-spec or /api/upload-spec-text
        specFileName: z.string().optional(),
        githubUrl: z.string().url().optional(),
        industryPack: z.enum(["fintech", "healthtech", "ecommerce", "saas"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // ─── Plan-Based Rate Limit ────────────────────────────────────────────────────
        const PLAN_LIMITS: Record<string, number> = {
          free: 3,
          pro: 50,
          team: 200,
          enterprise: Infinity,
        };
        const userPlan = (ctx.user as any).plan || "free";
        const DAILY_LIMIT = ctx.user.role === "admin" ? Infinity : (PLAN_LIMITS[userPlan] ?? 3);
        if (DAILY_LIMIT !== Infinity) {
          const todayCount = await countAnalysesToday(ctx.user.id);
          if (todayCount >= DAILY_LIMIT) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: `Daily limit reached: ${DAILY_LIMIT} analyses/day on ${userPlan} plan. Upgrade for more.`,
            });
          }
        }
        // ──────────────────────────────────────────────────────────────────────────────
        const analysisId = await createAnalysis({
          userId: ctx.user.id,
          projectName: input.projectName,
          status: "pending",
          specFileName: input.specFileName,
          githubUrl: input.githubUrl,
        });

        // Start async job — fetch spec text from S3 inside the job
        startAnalysisJobFromKey(analysisId, input.specKey, input.projectName, input.industryPack as IndustryPack | undefined);

        return { id: analysisId };
      }),

    // Get status of a single analysis
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return analysis;
      }),

    // List all analyses for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return getAnalysesByUserId(ctx.user.id);
    }),

    // Get download URL for completed analysis
    getDownloadUrl: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (analysis.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis not completed yet" });
        return { url: analysis.outputZipUrl };
      }),

    // Retry a failed or cancelled analysis with the same spec
    retry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (!['failed', 'cancelled'].includes(analysis.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed or cancelled analyses can be retried" });
        }
        if (!analysis.specFileKey) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No spec file found for this analysis" });
        }
        // Reset status and clear previous results
        await updateAnalysis(input.id, {
          status: "pending",
          errorMessage: null,
          progressLayer: null,
          progressMessage: null,
          resultJson: null,
          outputZipUrl: null,
          outputZipKey: null,
          verdictScore: null,
          coveragePercent: null,
          validatedProofCount: null,
          discardedProofCount: null,
          behaviorCount: null,
          completedAt: null,
        } as any);
        // Restart the job
        startAnalysisJobFromKey(input.id, analysis.specFileKey, analysis.projectName);
        return { id: input.id };
      }),

    // Quick spec health check — parses the IR from layer1Json and returns specHealth
    getSpecHealth: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        // Try resultJson first (completed jobs), then layer1Json (in-progress)
        const resultJson = (analysis.resultJson as any);
        const layer1Json = (analysis.layer1Json as any);
        const analysisResult = resultJson?.analysisResult || layer1Json;
        if (!analysisResult?.ir) return null;
        // Return cached specHealth if available, otherwise compute on the fly
        if (analysisResult.specHealth) return analysisResult.specHealth;
        return assessSpecHealth(analysisResult.ir as AnalysisIR);
      }),

    // Cancel a running or pending analysis
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (!['pending', 'running'].includes(analysis.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis is not running" });
        }
        // Signal the in-memory job to stop at next layer checkpoint
        cancelledJobs.add(input.id);
        // Immediately update DB so UI reflects cancellation
        await updateAnalysis(input.id, {
          status: "cancelled",
          errorMessage: "Cancelled by user",
        });
        return { success: true };
      }),
  }),

  // ─── Spec Diff (S4-1) ────────────────────────────────────────────────────
  diff: router({
    // Compare two analyses: returns a structured diff of behaviors, endpoints, status machine
    compare: protectedProcedure
      .input(z.object({ baseId: z.number(), headId: z.number() }))
      .query(async ({ ctx, input }) => {
        const [base, head] = await Promise.all([
          getAnalysisById(input.baseId),
          getAnalysisById(input.headId),
        ]);
        if (!base || !head) throw new TRPCError({ code: "NOT_FOUND" });
        if (base.userId !== ctx.user.id || head.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (base.status !== "completed" || head.status !== "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Both analyses must be completed" });
        }
        const baseIR = (base.resultJson as any)?.analysisResult?.ir || (base.layer1Json as any)?.ir;
        const headIR = (head.resultJson as any)?.analysisResult?.ir || (head.layer1Json as any)?.ir;
        if (!baseIR || !headIR) throw new TRPCError({ code: "BAD_REQUEST", message: "IR not available for diff" });
        return diffAnalysisIR(baseIR as AnalysisIR, headIR as AnalysisIR);
      }),
  }),

  // ─── Feedback Loop (S4-2) ─────────────────────────────────────────────────
  feedback: router({
    // Submit test execution results back to TestForge for re-analysis
    submitResults: protectedProcedure
      .input(z.object({
        analysisId: z.number(),
        results: z.array(z.object({
          proofId: z.string(),
          passed: z.boolean(),
          errorMessage: z.string().optional(),
          actualResponse: z.string().optional(),
          durationMs: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        // Store feedback in resultJson
        const existing = (analysis.resultJson as any) || {};
        const feedbackEntry = {
          submittedAt: new Date().toISOString(),
          results: input.results,
          passRate: input.results.length > 0
            ? Math.round(input.results.filter(r => r.passed).length / input.results.length * 100)
            : 0,
        };
        const feedbackHistory = existing.feedbackHistory || [];
        feedbackHistory.push(feedbackEntry);
        await updateAnalysis(input.analysisId, {
          resultJson: { ...existing, feedbackHistory, latestFeedback: feedbackEntry },
        } as any);
        return {
          received: input.results.length,
          passRate: feedbackEntry.passRate,
          failedProofs: input.results.filter(r => !r.passed).map(r => r.proofId),
        };
      }),
    // Get feedback history for an analysis
    getHistory: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const existing = (analysis.resultJson as any) || {};
        return {
          history: existing.feedbackHistory || [],
          latest: existing.latestFeedback || null,
        };
      }),
  }),

  // ─── Repo Scanner (S5-1) ─────────────────────────────────────────────────
  repoScan: router({
    scan: protectedProcedure
      .input(z.object({
        githubUrl: z.string().url(),
        githubToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const parsed = parseGitHubUrl(input.githubUrl);
        if (!parsed) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid GitHub URL" });
        return scanGitHubRepo(parsed.owner, parsed.repo, parsed.branch, input.githubToken);
      }),
  }),

  // ─── Industry Proof Packs (S5-2) ─────────────────────────────────────────
  proofPacks: router({
    list: publicProcedure.query(() => listProofPacks()),
    get: publicProcedure
      .input(z.object({ industry: z.enum(["fintech", "healthtech", "ecommerce", "saas"]) }))
      .query(({ input }) => getProofPack(input.industry as IndustryPack)),
  }),

  // ─── Playwright MCP (S5-3) ────────────────────────────────────────────────
  playwright: router({
    // Generate Playwright config for a completed analysis
    generateConfig: protectedProcedure
      .input(z.object({
        analysisId: z.number(),
        baseUrl: z.string().url(),
        authToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const config = generatePlaywrightConfig({
          baseUrl: input.baseUrl,
          authToken: input.authToken,
          timeout: 30000,
          workers: 1,
        });
        const ciWorkflow = generateCIWorkflow(input.analysisId, "https://testforge.dev");
        return { config, ciWorkflow };
      }),
  }),

  // ─── GitHub PR Integration (S4-3) ────────────────────────────────────────
  github: router({
    // Post a PR comment with analysis results
    postPRComment: protectedProcedure
      .input(z.object({
        analysisId: z.number(),
        prUrl: z.string().url(),
        githubToken: z.string().min(1),
        baseAnalysisId: z.number().optional(), // For spec diff
      }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        // Build diff if base analysis provided
        let diff = null;
        if (input.baseAnalysisId) {
          const base = await getAnalysisById(input.baseAnalysisId);
          if (base && base.status === "completed" && analysis.status === "completed") {
            const baseIR = (base.resultJson as any)?.analysisResult?.ir;
            const headIR = (analysis.resultJson as any)?.analysisResult?.ir;
            if (baseIR && headIR) {
              diff = diffAnalysisIR(baseIR as AnalysisIR, headIR as AnalysisIR);
            }
          }
        }
        const reportUrl = `${input.prUrl.split("/pull/")[0].replace("github.com", "testforge.dev")}/analysis/${input.analysisId}`;
        const comment = buildPRComment({ analysis, reportUrl, diff });
        const result = await postGitHubPRComment(input.prUrl, comment, input.githubToken);
        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }
        return { commentUrl: result.commentUrl };
      }),
    // Generate PR comment markdown (without posting)
    generateComment: protectedProcedure
      .input(z.object({
        analysisId: z.number(),
        baseAnalysisId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        if (analysis.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        let diff = null;
        if (input.baseAnalysisId) {
          const base = await getAnalysisById(input.baseAnalysisId);
          if (base && base.status === "completed" && analysis.status === "completed") {
            const baseIR = (base.resultJson as any)?.analysisResult?.ir;
            const headIR = (analysis.resultJson as any)?.analysisResult?.ir;
            if (baseIR && headIR) {
              diff = diffAnalysisIR(baseIR as AnalysisIR, headIR as AnalysisIR);
            }
          }
        }
        const reportUrl = `https://testforge.dev/analysis/${input.analysisId}`;
        return { markdown: buildPRComment({ analysis, reportUrl, diff }) };
      }),
  }),

  // ─── Test Runner ─────────────────────────────────────────────────────────
  testRuns: router({
    start: protectedProcedure
      .input(z.object({
        analysisId: z.number(),
        baseUrl: z.string().url(),
        authToken: z.string().min(1),
        roleTokens: z.record(z.string(), z.string()).optional(),
        timeout: z.number().min(1000).max(30000).optional(),
        concurrency: z.number().min(1).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the analysis belongs to this user
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis || analysis.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }
        if (analysis.status !== "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis must be completed before running tests" });
        }
        // Extract test files from the analysis result
        const resultJson = analysis.resultJson as any;
        const testFiles = resultJson?.extendedSuite?.files || [];
        if (testFiles.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No test files found in analysis" });
        }
        // Create a pending test run record
        const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await dbConn.insert(testRuns).values({
          analysisId: input.analysisId,
          userId: ctx.user.id,
          runId,
          baseUrl: input.baseUrl,
          status: "running",
        });
        const [inserted] = await dbConn.select().from(testRuns).where(eq(testRuns.runId, runId)).limit(1);
        const testRunId = inserted.id;
        // Run tests asynchronously (fire and forget, results stored in DB)
        const config = {
          baseUrl: input.baseUrl,
          authToken: input.authToken,
          roleTokens: input.roleTokens as Record<string, string> | undefined,
          timeout: input.timeout || 10000,
          concurrency: input.concurrency || 5,
        };
        // Count total test cases for progress reporting
        const { extractTestCases } = await import("./test-runner");
        let totalTestCount = 0;
        for (const file of testFiles) {
          const proofType = (file as any).proofType ||
            (file as any).filename?.replace(/\.spec\.ts$/, "").split("/").pop() || "unknown";
          totalTestCount += extractTestCases((file as any).content, proofType, input.baseUrl, config).length;
        }

        // Run in background with SSE streaming
        let completedCount = 0;
        runTests(testFiles, config, (result) => {
          // Called after each individual test completes — emit to SSE clients
          completedCount++;
          emitTestResult(runId, result, { completed: completedCount, total: totalTestCount });
        }).then(async (result) => {
          // Persist final results to DB
          const db2 = await getDb();
          if (db2) {
            await db2.update(testRuns)
              .set({
                status: "completed",
                totalTests: result.totalTests,
                passed: result.passed,
                failed: result.failed,
                errors: result.errors,
                passRate: result.passRate,
                mutationScore: result.mutationScore,
                resultsJson: result.results as any,
                summary: result.summary,
                completedAt: new Date(),
              })
              .where(eq(testRuns.id, testRunId));
          }
          // Emit completion event to all SSE clients
          emitRunComplete(runId, result);
        }).catch(async (err) => {
          const db2 = await getDb();
          if (db2) {
            await db2.update(testRuns)
              .set({ status: "failed", summary: String(err) })
              .where(eq(testRuns.id, testRunId));
          }
          // Emit error event to all SSE clients
          emitRunError(runId, String(err));
        });
        return { testRunId, runId, message: "Test run started. Connect to /api/test-runs/" + runId + "/stream for live results." };
      }),
    getResults: protectedProcedure
      .input(z.object({ testRunId: z.number() }))
      .query(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [run] = await dbConn.select().from(testRuns)
          .where(eq(testRuns.id, input.testRunId))
          .limit(1);
        if (!run || run.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Test run not found" });
        }
        return run;
      }),
    listByAnalysis: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getAnalysisById(input.analysisId);
        if (!analysis || analysis.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn.select().from(testRuns)
          .where(eq(testRuns.analysisId, input.analysisId))
          .orderBy(testRuns.startedAt);
      }),
  }),
  // ─── Analytics / Usage Stats ──────────────────────────────────────────────
  analytics: router({
    getUsage: protectedProcedure.query(async ({ ctx }) => {
      const PLAN_LIMITS: Record<string, number> = { free: 3, pro: 50, team: 200, enterprise: Infinity };
      const userPlan = (ctx.user as any).plan || "free";
      const dailyLimit = ctx.user.role === "admin" ? Infinity : (PLAN_LIMITS[userPlan] ?? 3);
      const todayCount = await countAnalysesToday(ctx.user.id);
      const allAnalyses = await getAnalysesByUserId(ctx.user.id);
      const completed = allAnalyses.filter((a: any) => a.status === "completed");
      const totalProofs = completed.reduce((s: number, a: any) => s + (a.validatedProofCount || 0), 0);
      const avgScore = completed.length > 0
        ? Math.round(completed.reduce((s: number, a: any) => s + (a.verdictScore || 0), 0) / completed.length)
        : 0;
      return {
        plan: userPlan,
        dailyLimit,
        todayCount,
        remaining: dailyLimit === Infinity ? null : Math.max(0, dailyLimit - todayCount),
        totalAnalyses: allAnalyses.length,
        completedAnalyses: completed.length,
        totalProofsGenerated: totalProofs,
        avgVerdictScore: avgScore,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
