import type { CodeFile } from "../code-parser";
import type { ProofType } from "../types";

export interface BugZooFixture {
  name: string;
  category: string;
  files: CodeFile[];
  expectedStaticRules: string[];
  expectedProofTypes: ProofType[];
  forbiddenStaticRules?: string[];
  forbiddenProofTypes?: ProofType[];
}

const basePkg = (dependencies: Record<string, string>): CodeFile => ({
  path: "package.json",
  content: JSON.stringify({ dependencies }),
});

export const BUG_ZOO_FIXTURES: BugZooFixture[] = [
  {
    name: "tenant-leak-trpc",
    category: "data-isolation",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }),
      {
        path: "server/router.ts",
        content: `
          import { createTRPCRouter, publicProcedure } from "@trpc/server";
          import { z } from "zod";
          export const router = createTRPCRouter({
            getOrder: publicProcedure.input(z.object({ tenantId: z.number(), orderId: z.number(), seats: z.number().min(1).max(4) })).query(async ({ ctx, input }) => {
              return ctx.db.query.orders.findFirst({
                where: eq(orders.id, input.orderId),
              });
            }),
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-008-MISSING-TENANT-CHECK"],
    expectedProofTypes: ["idor", "boundary"],
    forbiddenStaticRules: ["STATIC-001-HARDCODED-SECRET"],
  },
  {
    name: "hardcoded-auth",
    category: "auth",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0", jsonwebtoken: "^9.0.0" }),
      {
        path: "server/auth.ts",
        content: `
          import jwt from "jsonwebtoken";
          import { createTRPCRouter, publicProcedure } from "@trpc/server";
          export const authRouter = createTRPCRouter({
            login: publicProcedure.mutation(async ({ ctx, input }) => {
              const token = jwt.sign({ id: 1 }, "super-secret-value");
              return { token, error: input?.err?.stack };
            }),
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-001-HARDCODED-SECRET", "STATIC-002-NO-RATE-LIMIT", "STATIC-011-INSECURE-JWT"],
    expectedProofTypes: ["csrf", "rate_limit", "auth_matrix"],
    forbiddenProofTypes: ["sql_injection"],
  },
  {
    name: "raw-sql-query",
    category: "injection",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }),
      {
        path: "server/search.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";
          export const searchRouter = createTRPCRouter({
            search: protectedProcedure.input(z.object({ tenantId: z.number(), q: z.string() })).query(async ({ ctx, input }) => {
              return ctx.db.execute(\`SELECT * FROM orders WHERE tenant_id = \${input.tenantId} AND note LIKE '%\${input.q}%'\`);
            }),
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-003-SQL-INJECTION"],
    expectedProofTypes: ["sql_injection"],
    forbiddenStaticRules: ["STATIC-014-PLAINTEXT-PASSWORD"],
  },
  {
    name: "unsigned-webhook",
    category: "webhook",
    files: [
      basePkg({ express: "^4.0.0" }),
      {
        path: "server/webhook.ts",
        content: `
          import express from "express";
          const app = express();
          app.post("/webhook/stripe", async (req, res) => {
            await processEvent(req.body);
            res.json({ ok: true });
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-010-MISSING-WEBHOOK-SIGNATURE"],
    expectedProofTypes: ["webhook"],
    forbiddenProofTypes: ["sql_injection", "hardcoded_secret"],
  },
  {
    name: "plaintext-password-auth",
    category: "auth",
    files: [
      basePkg({ express: "^4.0.0" }),
      {
        path: "server/login.ts",
        content: `
          export async function login(req: any, res: any) {
            const user = await db.users.findFirst({ where: eq(users.email, req.body.email) });
            if (req.body.password === user.password) {
              return res.json({ ok: true });
            }
            return res.status(401).json({ ok: false });
          }
        `,
      },
    ],
    expectedStaticRules: ["STATIC-014-PLAINTEXT-PASSWORD"],
    expectedProofTypes: [],
    forbiddenProofTypes: ["sql_injection"],
  },
  {
    name: "open-redirect-handler",
    category: "redirects",
    files: [
      basePkg({ express: "^4.0.0" }),
      {
        path: "server/redirect.ts",
        content: `
          import express from "express";
          const app = express();

          app.get("/redirect", (req, res) => {
            return res.redirect(req.query.next);
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-013-OPEN-REDIRECT"],
    expectedProofTypes: [],
    forbiddenStaticRules: ["STATIC-003-SQL-INJECTION", "STATIC-010-MISSING-WEBHOOK-SIGNATURE"],
    forbiddenProofTypes: ["webhook"],
  },
  {
    name: "unsafe-file-upload",
    category: "file-upload",
    files: [
      basePkg({ express: "^4.0.0", multer: "^2.1.1" }),
      {
        path: "server/upload.ts",
        content: `
          import express from "express";
          import multer from "multer";

          const app = express();
          const upload = multer();

          app.post("/avatars/upload", upload.single("avatar"), async (req, res) => {
            await storeAvatar(req.file);
            res.json({ ok: true });
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-012-FILE-UPLOAD-NO-VALIDATION"],
    expectedProofTypes: [],
    forbiddenStaticRules: ["STATIC-013-OPEN-REDIRECT"],
  },
  {
    name: "missing-audit-log-admin-change",
    category: "governance",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0" }),
      {
        path: "server/admin.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";

          export const adminRouter = createTRPCRouter({
            promoteToAdmin: protectedProcedure
              .input(z.object({ userId: z.number() }))
              .mutation(async ({ ctx, input }) => {
                await ctx.db.users.update({
                  where: eq(users.id, input.userId),
                  data: { role: "admin" },
                });
                return { ok: true };
              }),
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-015-MISSING-AUDIT-LOG"],
    expectedProofTypes: [],
    forbiddenStaticRules: ["STATIC-001-HARDCODED-SECRET"],
  },
  {
    name: "negative-amount-transfer",
    category: "financial",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }),
      {
        path: "server/payments.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";

          export const paymentRouter = createTRPCRouter({
            transferFunds: protectedProcedure
              .input(z.object({ tenantId: z.number(), amount: z.number(), destinationUserId: z.number() }))
              .mutation(async ({ ctx, input }) => {
                await ctx.db.transfers.create({
                  data: {
                    tenantId: input.tenantId,
                    amount: input.amount,
                    destinationUserId: input.destinationUserId,
                  },
                });
                return { ok: true };
              }),
          });
        `,
      },
    ],
    expectedStaticRules: [],
    expectedProofTypes: ["negative_amount"],
    forbiddenProofTypes: ["sql_injection"],
  },
  {
    name: "mass-assignment-profile-update",
    category: "privilege-escalation",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }),
      {
        path: "server/profile.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";

          export const profileRouter = createTRPCRouter({
            updateProfile: protectedProcedure
              .input(z.object({
                tenantId: z.number(),
                displayName: z.string(),
                role: z.string().optional(),
                isAdmin: z.boolean().optional(),
              }))
              .mutation(async ({ ctx, input }) => {
                await ctx.db.users.update({
                  where: eq(users.id, ctx.user.id),
                  data: input,
                });
                return { ok: true };
              }),
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-016-MASS-ASSIGNMENT"],
    expectedProofTypes: ["mass_assignment"],
    forbiddenProofTypes: ["sql_injection"],
  },
  {
    name: "public-admin-delete",
    category: "auth",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0" }),
      {
        path: "server/admin-delete.ts",
        content: `
          import { createTRPCRouter, publicProcedure } from "@trpc/server";
          import { z } from "zod";

          export const adminDeleteRouter = createTRPCRouter({
            deleteUser: publicProcedure
              .input(z.object({ userId: z.number() }))
              .mutation(async ({ ctx, input }) => {
                await ctx.db.users.delete({ where: eq(users.id, input.userId) });
                return { ok: true };
              }),
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-005-MISSING-AUTH"],
    expectedProofTypes: [],
    forbiddenProofTypes: ["sql_injection"],
  },
  {
    name: "stack-trace-leak-handler",
    category: "error-handling",
    files: [
      basePkg({ express: "^4.0.0" }),
      {
        path: "server/error-handler.ts",
        content: `
          export function createProject(req: any, res: any) {
            try {
              throw new Error("boom");
            } catch (error: any) {
              return res.status(500).json({ error: error.stack });
            }
          }
        `,
      },
    ],
    expectedStaticRules: ["STATIC-009-STACK-TRACE-LEAK"],
    expectedProofTypes: [],
  },
  {
    name: "jwt-without-expiry",
    category: "auth",
    files: [
      basePkg({ jsonwebtoken: "^9.0.0" }),
      {
        path: "server/jwt.ts",
        content: `
          import jwt from "jsonwebtoken";

          export function signLoginToken(userId: number) {
            return jwt.sign({ userId }, process.env.JWT_SECRET || "fallback-secret");
          }
        `,
      },
    ],
    expectedStaticRules: ["STATIC-011-INSECURE-JWT"],
    expectedProofTypes: [],
    forbiddenProofTypes: ["sql_injection"],
  },
  {
    name: "login-without-rate-limit",
    category: "auth",
    files: [
      basePkg({ express: "^4.0.0" }),
      {
        path: "server/login.ts",
        content: `
          import express from "express";
          const app = express();

          app.post("/login", async (req, res) => {
            const user = await db.users.findFirst({ where: eq(users.email, req.body.email) });
            if (!user) return res.status(401).json({ ok: false });
            if (req.body.password !== user.passwordHash) return res.status(401).json({ ok: false });
            return res.json({ ok: true });
          });
        `,
      },
    ],
    expectedStaticRules: ["STATIC-002-NO-RATE-LIMIT"],
    expectedProofTypes: ["rate_limit"],
    forbiddenProofTypes: ["sql_injection"],
  },
];
