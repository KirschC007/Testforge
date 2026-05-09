import { describe, expect, it } from "vitest";
import {
  EXTERNAL_REPO_BENCHMARK_CASES,
  resolveExternalRepoBenchmarkCase,
  runExternalRepoBenchmarkSuite,
  runExternalRepoBenchmarkSuiteLive,
  summarizeExternalRepoBenchmarks,
  summarizeExternalRepoBenchmarksByProofType,
} from "./external-repo-benchmarks";

describe("external repo benchmarks", () => {
  it("keeps the public snapshot suite green", () => {
    const results = runExternalRepoBenchmarkSuite();
    const summary = summarizeExternalRepoBenchmarks(results);
    const proofTypes = summarizeExternalRepoBenchmarksByProofType(results);

    expect(EXTERNAL_REPO_BENCHMARK_CASES.length).toBeGreaterThanOrEqual(4);
    expect(results.every((result) => result.owner !== "unknown" && result.repo !== "unknown")).toBe(true);
    expect(summary.failed).toBe(0);
    expect(summary.passRate).toBe(100);
    expect(proofTypes.length).toBeGreaterThanOrEqual(4);
    expect(proofTypes.every((entry) => entry.reposMissed === 0)).toBe(true);
    expect(proofTypes.every((entry) => entry.forbiddenHits === 0)).toBe(true);
  });

  it("resolves code and spec fixtures through the live github loader path", async () => {
    const codeCase = EXTERNAL_REPO_BENCHMARK_CASES.find((entry) => entry.mode === "code");
    const specCase = EXTERNAL_REPO_BENCHMARK_CASES.find((entry) => entry.mode === "spec");
    expect(codeCase).toBeTruthy();
    expect(specCase).toBeTruthy();

    const loaders = {
      fetchCodeFiles: async () => [{ path: "package.json", content: JSON.stringify({ dependencies: { express: "^4.0.0" } }) }],
      scanRepo: async () => ({
        owner: "OAI",
        repo: "OpenAPI-Specification",
        branch: "main",
        totalFiles: 1,
        scannedAt: new Date().toISOString(),
        specs: [
          {
            path: "openapi.yaml",
            name: "openapi.yaml",
            type: "openapi3" as const,
            sizeBytes: 120,
            downloadUrl: "https://example.test/openapi.yaml",
            sha: "abc123",
          },
        ],
      }),
      fetchText: async () => "openapi: 3.1.0\ninfo:\n  title: Mock API\n  version: 1.0.0\npaths: {}\n",
    };

    const resolvedCode = await resolveExternalRepoBenchmarkCase(codeCase!, { sourceKind: "live_github" }, loaders);
    expect(resolvedCode.sourceKind).toBe("live_github");
    expect(resolvedCode.codeFiles?.length).toBe(1);

    const resolvedSpec = await resolveExternalRepoBenchmarkCase(specCase!, { sourceKind: "live_github" }, loaders);
    expect(resolvedSpec.sourceKind).toBe("live_github");
    expect(resolvedSpec.specText).toContain("openapi: 3.1.0");
  });

  it("can execute the live github suite with injected loaders", async () => {
    const loaders = {
      fetchCodeFiles: async (_owner: string, repo: string, _branch?: string, _token?: string, subpath?: string) => {
        if (repo.includes("drizzle-trpc-zod")) {
          return [
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
          ];
        }
        if (repo.includes("express-zod-openapi-autogen")) {
          return [
            { path: "package.json", content: JSON.stringify({ dependencies: { express: "^4.0.0", zod: "^4.0.0", typescript: "^5.9.0" } }) },
            { path: "src/server/app.ts", content: "import express from 'express'; import { z } from 'zod'; const app = express(); const schema = z.object({ email: z.string().email() }); app.post('/users', (req, res) => { schema.parse(req.body); res.json({ ok: true }); });" },
          ];
        }
        if (repo.includes("trpc") && subpath?.includes("examples/express-server")) {
          return [
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
              content: "import { initTRPC } from '@trpc/server'; import * as trpcExpress from '@trpc/server/adapters/express'; import express from 'express'; import { z } from 'zod'; const t = initTRPC.create(); const appRouter = t.router({ createPost: t.procedure.input(z.object({ title: z.string() })).mutation(({ input }) => ({ id: 1, ...input })) }); const app = express(); app.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext: () => ({}) }));",
            },
          ];
        }
        if (repo.includes("trpc") && subpath?.includes("examples/next-minimal-starter")) {
          return [
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
              content: "import * as trpcNext from '@trpc/server/adapters/next'; import { initTRPC } from '@trpc/server'; import { z } from 'zod'; const t = initTRPC.create(); const appRouter = t.router({ greeting: t.procedure.input(z.object({ name: z.string().nullish() })).query(({ input }) => ({ text: `hello ${input?.name ?? 'world'}` })) }); export default trpcNext.createNextApiHandler({ router: appRouter, createContext: () => ({}) });",
            },
          ];
        }
        if (repo.includes("trpc") && subpath?.includes("examples/standalone-server")) {
          return [
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
              content: "import { initTRPC } from '@trpc/server'; import { createHTTPServer } from '@trpc/server/adapters/standalone'; import { z } from 'zod'; const t = initTRPC.create(); const appRouter = t.router({ greeting: t.router({ hello: t.procedure.input(z.object({ name: z.string() })).query(({ input }) => `Hello, ${input.name}!`) }) }); createHTTPServer({ router: appRouter }).listen(2022);",
            },
          ];
        }
        if (repo.includes("trpc") && subpath?.includes("examples/minimal")) {
          return [
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
              content: "import { createHTTPServer } from '@trpc/server/adapters/standalone'; import { z } from 'zod'; import { publicProcedure, router } from './trpc'; const appRouter = router({ user: { create: publicProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => input), byId: publicProcedure.input(z.string()).query(async ({ input }) => ({ id: input })) } }); createHTTPServer({ router: appRouter }).listen(3000);",
            },
          ];
        }
        if (repo.includes("trpc") && subpath?.includes("examples/cloudflare-workers")) {
          return [
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
              content: "import { initTRPC } from '@trpc/server'; import { z } from 'zod'; const t = initTRPC.create(); export const appRouter = t.router({ post: t.router({ createPost: t.procedure.input(z.object({ title: z.string() })).mutation(({ input }) => ({ id: 1, ...input })) }) });",
            },
          ];
        }
        if (repo.includes("starter") && subpath?.includes("templates/nodejs")) {
          return [
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
              content: "import { serve } from '@hono/node-server'; import { Hono } from 'hono'; const app = new Hono(); app.get('/', (c) => c.text('Hello Hono!')); serve({ fetch: app.fetch, port: 3000 });",
            },
          ];
        }
        if (repo.includes("starter") && subpath?.includes("templates/nextjs")) {
          return [
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
              content: "import { Hono } from 'hono'; import { handle } from 'hono/vercel'; const app = new Hono().basePath('/api'); app.get('/hello', (c) => c.json({ message: 'Hello from Hono!' })); export const GET = handle(app);",
            },
          ];
        }
        if (repo.includes("starter") && subpath?.includes("templates/vercel")) {
          return [
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
              content: "import { Hono } from 'hono'; const app = new Hono(); app.get('/', (c) => c.text('Hello Hono!')); export default app;",
            },
          ];
        }
        return [
          { path: "package.json", content: JSON.stringify({ dependencies: { next: "^16.0.0", zod: "^4.0.0", typescript: "^5.9.0" } }) },
          { path: "app/api/orders/route.ts", content: "import { z } from 'zod'; const schema = z.object({ amount: z.number().min(1) }); export async function POST(request: Request) { const body = await request.json(); schema.parse(body); return Response.json({ ok: true }); }" },
        ];
      },
      scanRepo: async () => ({
        owner: "OAI",
        repo: "OpenAPI-Specification",
        branch: "main",
        totalFiles: 1,
        scannedAt: new Date().toISOString(),
        specs: [
          {
            path: "openapi.yaml",
            name: "openapi.yaml",
            type: "openapi3" as const,
            sizeBytes: 120,
            downloadUrl: "https://example.test/openapi.yaml",
            sha: "abc123",
          },
        ],
      }),
      fetchText: async () => "openapi: 3.1.0\ninfo:\n  title: Mock API\n  version: 1.0.0\npaths:\n  /charges:\n    post:\n      responses:\n        '200':\n          description: ok\n",
    };

    const results = await runExternalRepoBenchmarkSuiteLive({ sourceKind: "live_github" }, loaders);
    const summary = summarizeExternalRepoBenchmarks(results);

    expect(results.every((result) => result.sourceKind === "live_github")).toBe(true);
    expect(summary.failed).toBe(0);
  });
});
