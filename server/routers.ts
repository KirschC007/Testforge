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
} from "./db";
import { runAnalysisJob } from "./analyzer";
import { storagePut, storageGet } from "./storage";

// ─── In-memory job queue (simple, no Redis needed for MVP) ────────────────────
const runningJobs = new Set<number>();
const cancelledJobs = new Set<number>(); // Jobs that should stop at next checkpoint

async function startAnalysisJobFromKey(analysisId: number, specKey: string, projectName: string) {
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
      });

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
      // Add README
      archive.append(buildReadme(result), { name: "README.md" });

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
      }))
      .mutation(async ({ ctx, input }) => {
        const analysisId = await createAnalysis({
          userId: ctx.user.id,
          projectName: input.projectName,
          status: "pending",
          specFileName: input.specFileName,
          githubUrl: input.githubUrl,
        });

        // Start async job — fetch spec text from S3 inside the job
        startAnalysisJobFromKey(analysisId, input.specKey, input.projectName);

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
});

export type AppRouter = typeof appRouter;
