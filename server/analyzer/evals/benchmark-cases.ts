import type { EvalCase } from "../eval-harness";

export const BENCHMARK_CASES: EvalCase[] = [
  {
    name: "gold-trpc-zod-drizzle",
    promotedFromLiveRepo: "public-trpc-saas-snapshot",
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
        path: "server/orders.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";

          export const ordersRouter = createTRPCRouter({
            create: protectedProcedure
              .input(z.object({ tenantId: z.number(), amount: z.number().min(1) }))
              .mutation(async ({ input }) => ({ id: 1, ...input })),
          });
        `,
      },
    ],
    expectedTier: "gold",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 85,
    requiredProofTypes: ["negative_amount"],
  },
  {
    name: "supported-express-zod",
    promotedFromLiveRepo: "public-express-rest-snapshot",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            express: "^4.0.0",
            zod: "^4.0.0",
          },
        }),
      },
      {
        path: "server/app.ts",
        content: `
          import express from "express";
          import { z } from "zod";
          const app = express();
          const inputSchema = z.object({ email: z.string().email() });
          app.post("/users", (req, res) => {
            inputSchema.parse(req.body);
            res.json({ ok: true });
          });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 45,
  },
  {
    name: "experimental-weak-js",
    mode: "code",
    codeFiles: [
      {
        path: "server/index.js",
        content: `
          function handler(input) {
            return { ok: true, input };
          }
          module.exports = { handler };
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "heuristic",
    minGoldReadiness: 0,
    forbiddenProofTypes: ["concurrent_write", "flow"],
  },
  {
    name: "openapi-spec-gold",
    promotedFromLiveRepo: "public-openapi-spec-snapshot",
    mode: "spec",
    specText: `
      openapi: 3.1.0
      info:
        title: Payments API
        version: 1.0.0
      paths:
        /payments:
          post:
            summary: Create payment
            responses:
              '200':
                description: ok
    `,
    expectedTier: "gold",
    expectedEvidenceLevel: "detected",
    minGoldReadiness: 90,
  },
  {
    name: "live-trpc-express-anchor",
    promotedFromLiveRepo: "public-trpc-express-example",
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
          const publicProcedure = t.procedure;
          const router = t.router;

          const appRouter = router({
            greeting: publicProcedure
              .input(z.object({ name: z.string().nullish() }))
              .query(({ input }) => ({ text: \`hello \${input?.name ?? "world"}\` })),
          });

          const app = express();
          app.use("/trpc", trpcExpress.createExpressMiddleware({ router: appRouter, createContext: () => ({}) }));
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 80,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "live-trpc-minimal-boundary",
    promotedFromLiveRepo: "public-trpc-minimal-server",
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
          import { z } from "zod";

          const t = initTRPC.create();
          const publicProcedure = t.procedure;
          const router = t.router;

          export const appRouter = router({
            greeting: publicProcedure
              .input(z.object({ name: z.string().min(1).max(32).nullish() }))
              .query(({ input }) => ({ text: \`hello \${input?.name ?? "world"}\` })),
          });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 75,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "live-trpc-cloudflare-boundary",
    promotedFromLiveRepo: "public-trpc-cloudflare-workers",
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
        path: "src/worker.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import { z } from "zod";

          const t = initTRPC.create();
          const publicProcedure = t.procedure;
          const router = t.router;

          export const appRouter = router({
            lookupPost: publicProcedure
              .input(z.object({ postId: z.number().int().min(1).max(1000) }))
              .query(({ input }) => ({ id: input.postId, ok: true })),
          });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 75,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "live-trpc-standalone-anchor",
    promotedFromLiveRepo: "public-trpc-standalone-server",
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
          import { z } from "zod";

          const t = initTRPC.create();
          const publicProcedure = t.procedure;
          const router = t.router;

          export const appRouter = router({
            hello: publicProcedure
              .input(z.object({ name: z.string().min(1).max(64).nullish() }))
              .query(({ input }) => ({ greeting: \`hello \${input?.name ?? "world"}\` })),
          });
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 75,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "live-next-route-handler-anchor",
    promotedFromLiveRepo: "public-next-route-handler-snapshot",
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
            amount: z.number().min(1).max(10000),
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
    minGoldReadiness: 45,
    requiredProofTypes: ["boundary"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "live-trpc-next-minimal-anchor",
    promotedFromLiveRepo: "public-trpc-next-minimal-example",
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
            greeting: publicProcedure
              .input(z.object({ name: z.string().min(1).max(64).nullish() }))
              .query(({ input }) => ({ text: \`hello \${input?.name ?? "world"}\` })),
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
    minGoldReadiness: 45,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "live-hono-node-anchor",
    promotedFromLiveRepo: "public-hono-node-starter",
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
    name: "live-hono-nextjs-anchor",
    promotedFromLiveRepo: "public-hono-nextjs-starter",
    mode: "code",
    codeFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            hono: "^4.12.14",
            next: "^16.0.0",
            typescript: "^5.8.3",
          },
        }),
      },
      {
        path: "app/api/[[...route]]/route.ts",
        content: `
          import { Hono } from "hono";

          const app = new Hono();
          app.get("/", (c) => c.json({ ok: true }));

          export const GET = async (request: Request) => app.fetch(request);
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "detected",
    minGoldReadiness: 15,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret", "mass_assignment"],
  },
  {
    name: "live-hono-vercel-anchor",
    promotedFromLiveRepo: "public-hono-vercel-starter",
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
        path: "api/index.ts",
        content: `
          import { Hono } from "hono";

          const app = new Hono();
          app.get("/", (c) => c.json({ ok: true }));

          export default app;
        `,
      },
    ],
    expectedTier: "supported",
    expectedEvidenceLevel: "inferred",
    minGoldReadiness: 15,
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret", "mass_assignment"],
  },
];
