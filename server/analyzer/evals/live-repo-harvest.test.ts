import { describe, expect, it } from "vitest";
import { runExternalRepoBenchmarkSuiteLive } from "./external-repo-benchmarks";
import {
  buildLiveRepoFixtureBacklog,
  buildLiveRepoHarvest,
  renderLiveRepoFixtureBacklogMarkdown,
  renderLiveRepoHarvestMarkdown,
} from "./live-repo-harvest";

describe("live repo harvest", () => {
  it("builds hit and watch records from a green live suite", async () => {
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
              content: "import { z } from 'zod'; import { createTRPCRouter, protectedProcedure } from '@trpc/server'; export const chargesRouter = createTRPCRouter({ createCharge: protectedProcedure.input(z.object({ tenantId: z.number(), amount: z.number().min(1) })).mutation(async ({ input }) => ({ id: 1, ...input })) });",
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
            { path: "package.json", content: JSON.stringify({ dependencies: { "@trpc/server": "^11.0.0", express: "^5.0.0", zod: "^4.2.1", typescript: "^5.9.0" } }) },
            { path: "src/server.ts", content: "import { initTRPC } from '@trpc/server'; import * as trpcExpress from '@trpc/server/adapters/express'; import express from 'express'; import { z } from 'zod'; const t = initTRPC.create(); const appRouter = t.router({ createPost: t.procedure.input(z.object({ title: z.string() })).mutation(({ input }) => ({ id: 1, ...input })) }); const app = express(); app.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext: () => ({}) }));" },
          ];
        }
        if (repo.includes("trpc") && subpath?.includes("examples/next-minimal-starter")) {
          return [
            { path: "package.json", content: JSON.stringify({ dependencies: { "@trpc/server": "^11.0.0", next: "^16.0.0", zod: "^4.2.1", typescript: "^5.9.0" } }) },
            { path: "src/pages/api/trpc/[trpc].ts", content: "import * as trpcNext from '@trpc/server/adapters/next'; import { initTRPC } from '@trpc/server'; import { z } from 'zod'; const t = initTRPC.create(); const appRouter = t.router({ greeting: t.procedure.input(z.object({ name: z.string().nullish() })).query(({ input }) => ({ text: `hello ${input?.name ?? 'world'}` })) }); export default trpcNext.createNextApiHandler({ router: appRouter, createContext: () => ({}) });" },
          ];
        }
        if (repo.includes("starter") && subpath?.includes("templates/nodejs")) {
          return [
            { path: "package.json", content: JSON.stringify({ dependencies: { hono: "^4.12.14", "@hono/node-server": "^1.19.14", typescript: "^5.8.3" } }) },
            { path: "src/index.ts", content: "import { serve } from '@hono/node-server'; import { Hono } from 'hono'; const app = new Hono(); app.get('/', (c) => c.text('Hello Hono!')); serve({ fetch: app.fetch, port: 3000 });" },
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
    const harvest = buildLiveRepoHarvest(results);
    const backlog = buildLiveRepoFixtureBacklog(harvest);
    const markdown = renderLiveRepoHarvestMarkdown(harvest, "2026-04-23T12:00:00.000Z");
    const backlogMarkdown = renderLiveRepoFixtureBacklogMarkdown(backlog, "2026-04-23T12:00:00.000Z");

    expect(harvest.summary.total).toBeGreaterThanOrEqual(12);
    expect(harvest.summary.candidateMisses).toBeGreaterThanOrEqual(0);
    expect(harvest.summary.confirmedHits).toBeGreaterThanOrEqual(1);
    expect(harvest.summary.watchList).toBeGreaterThanOrEqual(1);
    expect(harvest.records.every((record) => record.priorityScore > 0)).toBe(true);
    expect(harvest.records.every((record) => record.suggestedFixtureName.startsWith("live-"))).toBe(true);
    expect(harvest.records.some((record) => record.promotionStatus === "promoted")).toBe(true);
    expect(harvest.records.every((record) => ["promoted", "uncovered"].includes(record.promotionStatus))).toBe(true);
    expect(backlog.topCandidates.length).toBeGreaterThanOrEqual(3);
    expect(backlog.topCandidates[0].priorityScore).toBeGreaterThanOrEqual(backlog.topCandidates[1].priorityScore);
    expect(markdown).toContain("# TestForge Live Repo Harvest");
    expect(markdown).toContain("## Confirmed Hits");
    expect(markdown).toContain("## Watch List");
    expect(backlogMarkdown).toContain("# TestForge Live Repo Fixture Backlog");
    expect(backlogMarkdown).toContain("## Top Candidates");
    expect(backlogMarkdown).toContain("promotion=");
  });
});
