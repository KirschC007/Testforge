import { fetchRepoCodeFiles, parseGitHubUrl, scanGitHubRepo } from "../repo-scanner";
import { runEvalCase, summarizeEvalResults, type EvalCase, type EvalCaseResult } from "../eval-harness";

export type ExternalRepoSourceKind = "public_snapshot" | "live_github";

export interface ExternalRepoBenchmarkCase extends EvalCase {
  repoUrl: string;
  sourceKind: ExternalRepoSourceKind;
  notes: string;
  liveOverrides?: Partial<Pick<EvalCase, "expectedTier" | "expectedEvidenceLevel" | "minGoldReadiness" | "requiredProofTypes" | "forbiddenProofTypes">>;
}

export interface ExternalRepoBenchmarkResult extends EvalCaseResult {
  repoUrl: string;
  sourceKind: ExternalRepoSourceKind;
  owner: string;
  repo: string;
  branch: string;
  notes: string;
}

export interface ExternalRepoBenchmarkRunOptions {
  githubToken?: string;
  sourceKind?: ExternalRepoSourceKind;
}

export interface ExternalRepoProofTypeSummary {
  proofType: string;
  reposExpecting: number;
  reposMatched: number;
  reposMissed: number;
  forbiddenHits: number;
  recallProxy: number;
  precisionProxy: number;
}

interface LiveRepoLoaders {
  fetchCodeFiles: typeof fetchRepoCodeFiles;
  scanRepo: typeof scanGitHubRepo;
  fetchText: (url: string, init?: RequestInit) => Promise<string>;
}

export const EXTERNAL_REPO_BENCHMARK_CASES: ExternalRepoBenchmarkCase[] = [
  {
    name: "public-trpc-saas-snapshot",
    repoUrl: "https://github.com/drizzle-team/drizzle-trpc-zod",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for a tRPC plus Drizzle plus Zod backend with Express transport adapter.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            zod: "^4.0.0",
            "drizzle-orm": "^0.45.0",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/server/api/routers/charges.ts",
        content: `
          import { z } from "zod";
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";

          export const chargesRouter = createTRPCRouter({
            createCharge: protectedProcedure
              .input(z.object({ tenantId: z.number(), amount: z.number().min(1) }))
              .mutation(async ({ input }) => ({ id: 1, ...input })),
          });
        `,
      },
    ],
    expectedTier: "gold",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 85,
    requiredProofTypes: ["negative_amount", "rate_limit", "mass_assignment"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-express-rest-snapshot",
    repoUrl: "https://github.com/Foundry376/express-zod-openapi-autogen",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for an Express plus Zod API toolkit.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            express: "^4.0.0",
            zod: "^4.0.0",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/server/app.ts",
        content: `
          import express from "express";
          import { z } from "zod";

          const app = express();
          const inputSchema = z.object({ email: z.string().email() });

          app.post("/users", (req, res) => {
            inputSchema.parse(req.body);
            res.json({ ok: true });
          });

          export { app };
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 20,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-next-route-handler-snapshot",
    repoUrl: "https://github.com/Melvynx/next-zod-route",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for a Next.js route-handler plus Zod library.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            next: "^16.0.0",
            zod: "^4.0.0",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "app/api/orders/route.ts",
        content: `
          import { z } from "zod";

          const createOrderSchema = z.object({
            amount: z.number().min(1),
          });

          export async function POST(request: Request) {
            const body = await request.json();
            createOrderSchema.parse(body);
            return Response.json({ ok: true });
          }
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 20,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-openapi-spec-snapshot",
    repoUrl: "https://github.com/OAI/OpenAPI-Specification",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized OpenAPI snapshot for spec-first evaluation.",
    mode: "spec",
    specText: `
      openapi: 3.1.0
      info:
        title: Public Payments API
        version: 1.0.0
      paths:
        /charges:
          post:
            summary: Create charge
            responses:
              '200':
                description: ok
    `,
    expectedTier: "gold",
    expectedEvidenceLevel: "detected",
    minGoldReadiness: 90,
  },
  {
    name: "public-trpc-express-example",
    repoUrl: "https://github.com/trpc/trpc/tree/main/examples/express-server",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the official tRPC Express server example.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            express: "^5.0.0",
            zod: "^4.2.1",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/server.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import * as trpcExpress from "@trpc/server/adapters/express";
          import express from "express";
          import { z } from "zod";

          const t = initTRPC.create();
          const router = t.router;
          const publicProcedure = t.procedure;

          const appRouter = router({
            createPost: publicProcedure
              .input(z.object({ title: z.string() }))
              .mutation(({ input }) => ({ id: 1, ...input })),
          });

          const app = express();
          app.use("/trpc", trpcExpress.createExpressMiddleware({ router: appRouter, createContext: () => ({}) }));
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 40,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-trpc-next-minimal-example",
    repoUrl: "https://github.com/trpc/trpc/tree/main/examples/next-minimal-starter",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the official tRPC Next.js minimal starter.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            next: "^16.0.0",
            zod: "^4.2.1",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/pages/api/trpc/[trpc].ts",
        content: `
          import * as trpcNext from "@trpc/server/adapters/next";
          import { initTRPC } from "@trpc/server";
          import { z } from "zod";

          const t = initTRPC.create();
          const publicProcedure = t.procedure;
          const router = t.router;

          const appRouter = router({
            greeting: publicProcedure.input(z.object({ name: z.string().nullish() })).query(({ input }) => ({
              text: \`hello \${input?.name ?? "world"}\`,
            })),
          });

          export default trpcNext.createNextApiHandler({
            router: appRouter,
            createContext: () => ({}),
          });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "detected",
    minGoldReadiness: 40,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-hono-node-starter",
    repoUrl: "https://github.com/honojs/starter/tree/main/templates/nodejs",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the Hono Node.js starter template.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            hono: "^4.12.14",
            "@hono/node-server": "^1.19.14",
            typescript: "^5.8.3",
          },
        }),
      },
      {
        path: "src/index.ts",
        content: `
          import { serve } from "@hono/node-server";
          import { Hono } from "hono";

          const app = new Hono();
          app.get("/", (c) => c.text("Hello Hono!"));

          serve({ fetch: app.fetch, port: 3000 });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 15,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret", "mass_assignment"],
  },
  {
    name: "public-trpc-standalone-server",
    repoUrl: "https://github.com/trpc/trpc/tree/main/examples/standalone-server",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the official tRPC standalone server example.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            zod: "^4.2.1",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/server.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import { createHTTPServer } from "@trpc/server/adapters/standalone";
          import { z } from "zod";

          const t = initTRPC.create();
          const publicProcedure = t.procedure;
          const router = t.router;

          const appRouter = router({
            greeting: router({
              hello: publicProcedure.input(z.object({ name: z.string() })).query(({ input }) => \`Hello, \${input.name}!\`),
            }),
          });

          createHTTPServer({ router: appRouter }).listen(2022);
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 40,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-trpc-minimal-server",
    repoUrl: "https://github.com/trpc/trpc/tree/main/examples/minimal",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the official minimal tRPC server example.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            zod: "^4.2.1",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/server/index.ts",
        content: `
          import { createHTTPServer } from "@trpc/server/adapters/standalone";
          import { z } from "zod";
          import { publicProcedure, router } from "./trpc";

          const appRouter = router({
            user: {
              create: publicProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => input),
              byId: publicProcedure.input(z.string()).query(async ({ input }) => ({ id: input })),
            },
          });

          createHTTPServer({ router: appRouter }).listen(3000);
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 40,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-trpc-cloudflare-workers",
    repoUrl: "https://github.com/trpc/trpc/tree/main/examples/cloudflare-workers",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the official tRPC Cloudflare Workers example.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            zod: "^4.2.1",
            typescript: "^5.9.0",
          },
        }),
      },
      {
        path: "src/router.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import { z } from "zod";

          const t = initTRPC.create();
          const publicProcedure = t.procedure;
          const router = t.router;

          export const appRouter = router({
            post: router({
              createPost: publicProcedure.input(z.object({ title: z.string() })).mutation(({ input }) => ({ id: 1, ...input })),
            }),
          });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 40,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
    liveOverrides: {
      requiredProofTypes: [],
    },
  },
  {
    name: "public-hono-nextjs-starter",
    repoUrl: "https://github.com/honojs/starter/tree/main/templates/nextjs",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the Hono Next.js starter template.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            hono: "^4.12.14",
            next: "^15.5.2",
            typescript: "^5.0.0",
          },
        }),
      },
      {
        path: "app/api/[...route]/route.ts",
        content: `
          import { Hono } from "hono";
          import { handle } from "hono/vercel";

          const app = new Hono().basePath("/api");
          app.get("/hello", (c) => c.json({ message: "Hello from Hono!" }));

          export const GET = handle(app);
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "detected",
    minGoldReadiness: 15,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret", "mass_assignment"],
  },
  {
    name: "public-hono-vercel-starter",
    repoUrl: "https://github.com/honojs/starter/tree/main/templates/vercel",
    sourceKind: "public_snapshot",
    notes: "Public-repo-style minimized snapshot for the Hono Vercel starter template.",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            hono: "^4.12.14",
            typescript: "^5.8.3",
          },
        }),
      },
      {
        path: "src/index.ts",
        content: `
          import { Hono } from "hono";

          const app = new Hono();
          app.get("/", (c) => c.text("Hello Hono!"));

          export default app;
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 20,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret", "mass_assignment"],
  },
];

export function runExternalRepoBenchmarkCase(input: ExternalRepoBenchmarkCase): ExternalRepoBenchmarkResult {
  const parsed = parseGitHubUrl(input.repoUrl);
  const base = runEvalCase(input);

  return {
    ...base,
    repoUrl: input.repoUrl,
    sourceKind: input.sourceKind,
    owner: parsed?.owner || "unknown",
    repo: parsed?.repo || "unknown",
    branch: parsed?.branch || "main",
    notes: input.notes,
  };
}

export function runExternalRepoBenchmarkSuite(): ExternalRepoBenchmarkResult[] {
  return EXTERNAL_REPO_BENCHMARK_CASES.map(runExternalRepoBenchmarkCase);
}

export function summarizeExternalRepoBenchmarks(results: ExternalRepoBenchmarkResult[]) {
  return summarizeEvalResults(results);
}

export function summarizeExternalRepoBenchmarksByProofType(
  results: ExternalRepoBenchmarkResult[]
): ExternalRepoProofTypeSummary[] {
  const proofTypes = new Set<string>();

  for (const benchmark of EXTERNAL_REPO_BENCHMARK_CASES) {
    for (const proofType of benchmark.requiredProofTypes || []) proofTypes.add(proofType);
    for (const proofType of benchmark.forbiddenProofTypes || []) proofTypes.add(proofType);
  }

  return Array.from(proofTypes)
    .map((proofType) => {
      const reposExpecting = EXTERNAL_REPO_BENCHMARK_CASES.filter((benchmark) =>
        (benchmark.requiredProofTypes || []).includes(proofType as never)
      ).length;
      const reposMatched = EXTERNAL_REPO_BENCHMARK_CASES.reduce((sum, benchmark, index) => {
        if (!(benchmark.requiredProofTypes || []).includes(proofType as never)) return sum;
        return sum + (results[index]?.proofTypes.includes(proofType) ? 1 : 0);
      }, 0);
      const forbiddenHits = EXTERNAL_REPO_BENCHMARK_CASES.reduce((sum, benchmark, index) => {
        if (!(benchmark.forbiddenProofTypes || []).includes(proofType as never)) return sum;
        return sum + (results[index]?.proofTypes.includes(proofType) ? 1 : 0);
      }, 0);

      return {
        proofType,
        reposExpecting,
        reposMatched,
        reposMissed: reposExpecting - reposMatched,
        forbiddenHits,
        recallProxy: reposExpecting > 0 ? Math.round((reposMatched / reposExpecting) * 100) : 100,
        precisionProxy: reposMatched + forbiddenHits > 0
          ? Math.round((reposMatched / (reposMatched + forbiddenHits)) * 100)
          : 100,
      };
    })
    .sort((a, b) => a.proofType.localeCompare(b.proofType));
}

function defaultFetchText(url: string, init?: RequestInit): Promise<string> {
  return fetch(url, init).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status}) for ${url}`);
    }
    return response.text();
  });
}

function toResult(
  input: ExternalRepoBenchmarkCase,
  parsed: { owner: string; repo: string; branch: string; subpath?: string } | null,
  base: EvalCaseResult
): ExternalRepoBenchmarkResult {
  return {
    ...base,
    repoUrl: input.repoUrl,
    sourceKind: input.sourceKind,
    owner: parsed?.owner || "unknown",
    repo: parsed?.repo || "unknown",
    branch: parsed?.branch || "main",
    notes: input.notes,
  };
}

export async function resolveExternalRepoBenchmarkCase(
  input: ExternalRepoBenchmarkCase,
  options: ExternalRepoBenchmarkRunOptions = {},
  loaders: LiveRepoLoaders = {
    fetchCodeFiles: fetchRepoCodeFiles,
    scanRepo: scanGitHubRepo,
    fetchText: defaultFetchText,
  }
): Promise<ExternalRepoBenchmarkCase> {
  const sourceKind = options.sourceKind || input.sourceKind;
  if (sourceKind !== "live_github") {
    return input;
  }

  const parsed = parseGitHubUrl(input.repoUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub URL for external benchmark: ${input.repoUrl}`);
  }

  if (input.mode === "code") {
    const codeFiles = await loaders.fetchCodeFiles(parsed.owner, parsed.repo, parsed.branch, options.githubToken, parsed.subpath);
    return {
      ...input,
      sourceKind,
      ...(input.liveOverrides || {}),
      codeFiles,
    };
  }

  const scan = await loaders.scanRepo(parsed.owner, parsed.repo, parsed.branch, options.githubToken, parsed.subpath);
  const spec = scan.specs.find((entry) => entry.type === "openapi3" || entry.type === "swagger2") || scan.specs[0];
  if (!spec) {
    throw new Error(`No API spec discovered for ${input.repoUrl}`);
  }

  const specText = await loaders.fetchText(spec.downloadUrl, {
    headers: options.githubToken ? { Authorization: `Bearer ${options.githubToken}` } : undefined,
  });

  return {
    ...input,
    sourceKind,
    ...(input.liveOverrides || {}),
    specText,
  };
}

export async function runExternalRepoBenchmarkCaseLive(
  input: ExternalRepoBenchmarkCase,
  options: ExternalRepoBenchmarkRunOptions = {},
  loaders?: LiveRepoLoaders
): Promise<ExternalRepoBenchmarkResult> {
  const parsed = parseGitHubUrl(input.repoUrl);
  const resolved = await resolveExternalRepoBenchmarkCase(
    { ...input, sourceKind: options.sourceKind || "live_github" },
    { ...options, sourceKind: options.sourceKind || "live_github" },
    loaders
  );
  return toResult(resolved, parsed, runEvalCase(resolved));
}

export async function runExternalRepoBenchmarkSuiteLive(
  options: ExternalRepoBenchmarkRunOptions = {},
  loaders?: LiveRepoLoaders
): Promise<ExternalRepoBenchmarkResult[]> {
  const results: ExternalRepoBenchmarkResult[] = [];
  for (const input of EXTERNAL_REPO_BENCHMARK_CASES) {
    results.push(await runExternalRepoBenchmarkCaseLive(input, options, loaders));
  }
  return results;
}
