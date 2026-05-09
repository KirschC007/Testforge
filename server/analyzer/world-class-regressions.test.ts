import { describe, expect, it } from "vitest";
import { runStaticAnalysis } from "./static-analyzer";
import { assessSupportedScopeForCodebase } from "./supported-scope";
import type { CodeFile } from "./code-parser";

const basePackage = (dependencies: Record<string, string>): CodeFile => ({
  path: "package.json",
  content: JSON.stringify({ dependencies }),
});

const hasRule = (files: CodeFile[], rule: string) =>
  runStaticAnalysis(files).some((finding) => finding.rule === rule);

describe("world-class static security regressions", () => {
  it("flags tenant leaks for list queries without tenant scoping", () => {
    expect(
      hasRule(
        [
          {
            path: "server/orders.ts",
            content: `
              export async function listOrders(ctx: any, input: { tenantId: number }) {
                return ctx.db.query.orders.findMany({
                  where: eq(orders.status, "open"),
                });
              }
            `,
          },
        ],
        "STATIC-008-MISSING-TENANT-CHECK"
      )
    ).toBe(true);
  });

  it("does not flag tenant leaks when tenantId is present in object-style where clauses", () => {
    expect(
      hasRule(
        [
          {
            path: "server/orders.ts",
            content: `
              export async function listOrders(ctx: any, input: { tenantId: number }) {
                return ctx.db.query.orders.findMany({
                  where: { tenantId: input.tenantId, status: "open" },
                });
              }
            `,
          },
        ],
        "STATIC-008-MISSING-TENANT-CHECK"
      )
    ).toBe(false);
  });

  it("flags open redirects that forward query input directly", () => {
    expect(
      hasRule(
        [
          {
            path: "server/redirect.ts",
            content: `
              export function callback(req: any, res: any) {
                return res.redirect(req.query.returnTo);
              }
            `,
          },
        ],
        "STATIC-013-OPEN-REDIRECT"
      )
    ).toBe(true);
  });

  it("does not flag redirects that use a fixed allowlisted destination", () => {
    expect(
      hasRule(
        [
          {
            path: "server/redirect.ts",
            content: `
              export function callback(_req: any, res: any) {
                const safeUrl = "/dashboard";
                return res.redirect(safeUrl);
              }
            `,
          },
        ],
        "STATIC-013-OPEN-REDIRECT"
      )
    ).toBe(false);
  });

  it("flags webhook handlers without signature validation", () => {
    expect(
      hasRule(
        [
          {
            path: "server/webhook.ts",
            content: `
              export async function stripeWebhook(req: any, res: any) {
                await processEvent(req.body);
                return res.json({ ok: true });
              }
            `,
          },
        ],
        "STATIC-010-MISSING-WEBHOOK-SIGNATURE"
      )
    ).toBe(true);
  });

  it("does not flag webhook handlers that verify a signature header", () => {
    expect(
      hasRule(
        [
          {
            path: "server/webhook.ts",
            content: `
              export async function stripeWebhook(req: any, res: any) {
                const signature = req.headers["stripe-signature"];
                verify(signature, req.body);
                await processEvent(req.body);
                return res.json({ ok: true });
              }
            `,
          },
        ],
        "STATIC-010-MISSING-WEBHOOK-SIGNATURE"
      )
    ).toBe(false);
  });

  it("flags hardcoded JWT secrets", () => {
    expect(
      hasRule(
        [
          {
            path: "server/auth.ts",
            content: `const token = jwt.sign({ id: 1 }, "hardcoded-secret-value");`,
          },
        ],
        "STATIC-001-HARDCODED-SECRET"
      )
    ).toBe(true);
  });

  it("does not flag environment-backed JWT secrets", () => {
    expect(
      hasRule(
        [
          {
            path: "server/auth.ts",
            content: `const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);`,
          },
        ],
        "STATIC-001-HARDCODED-SECRET"
      )
    ).toBe(false);
  });

  it("flags JWT signing without expiresIn", () => {
    expect(
      hasRule(
        [
          {
            path: "server/auth.ts",
            content: `const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);`,
          },
        ],
        "STATIC-011-INSECURE-JWT"
      )
    ).toBe(true);
  });

  it("does not flag JWT signing with expiresIn", () => {
    expect(
      hasRule(
        [
          {
            path: "server/auth.ts",
            content: `const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: "15m" });`,
          },
        ],
        "STATIC-011-INSECURE-JWT"
      )
    ).toBe(false);
  });

  it("flags uploads without mime or size validation", () => {
    expect(
      hasRule(
        [
          {
            path: "server/upload.ts",
            content: `
              import multer from "multer";
              const upload = multer();
              export async function uploadAvatar(req: any, res: any) {
                await store(req.file);
                return res.json({ ok: true });
              }
            `,
          },
        ],
        "STATIC-012-FILE-UPLOAD-NO-VALIDATION"
      )
    ).toBe(true);
  });

  it("does not flag uploads with mimetype and size checks", () => {
    expect(
      hasRule(
        [
          {
            path: "server/upload.ts",
            content: `
              import multer from "multer";
              const upload = multer({ limits: { fileSize: 1024 * 1024 } });
              export async function uploadAvatar(req: any, res: any) {
                if (!req.file.mimetype.startsWith("image/")) throw new Error("bad mime");
                await store(req.file);
                return res.json({ ok: true });
              }
            `,
          },
        ],
        "STATIC-012-FILE-UPLOAD-NO-VALIDATION"
      )
    ).toBe(false);
  });

  it("flags mass assignment when protected fields are written via raw input", () => {
    expect(
      hasRule(
        [
          {
            path: "server/profile.ts",
            content: `
              export async function updateProfile(ctx: any, input: any) {
                const role = input.role;
                return ctx.db.users.update({
                  where: eq(users.id, ctx.user.id),
                  data: input,
                });
              }
            `,
          },
        ],
        "STATIC-016-MASS-ASSIGNMENT"
      )
    ).toBe(true);
  });

  it("does not flag mass assignment when only whitelisted fields are written", () => {
    expect(
      hasRule(
        [
          {
            path: "server/profile.ts",
            content: `
              export async function updateProfile(ctx: any, input: any) {
                const role = input.role;
                return ctx.db.users.update({
                  where: eq(users.id, ctx.user.id),
                  data: { displayName: input.displayName, bio: input.bio },
                });
              }
            `,
          },
        ],
        "STATIC-016-MASS-ASSIGNMENT"
      )
    ).toBe(false);
  });

  it("flags plaintext password comparisons", () => {
    expect(
      hasRule(
        [
          {
            path: "server/login.ts",
            content: `if (password === user.password) return { ok: true };`,
          },
        ],
        "STATIC-014-PLAINTEXT-PASSWORD"
      )
    ).toBe(true);
  });

  it("does not flag bcrypt password comparisons", () => {
    expect(
      hasRule(
        [
          {
            path: "server/login.ts",
            content: `if (await bcrypt.compare(password, user.passwordHash)) return { ok: true };`,
          },
        ],
        "STATIC-014-PLAINTEXT-PASSWORD"
      )
    ).toBe(false);
  });

  it("flags sensitive admin role changes without audit logging", () => {
    expect(
      hasRule(
        [
          {
            path: "server/admin.ts",
            content: `
              export async function promoteToAdmin(ctx: any, userId: number) {
                await ctx.db.users.update({ where: eq(users.id, userId), data: { role: "admin" } });
                return { ok: true };
              }
            `,
          },
        ],
        "STATIC-015-MISSING-AUDIT-LOG"
      )
    ).toBe(true);
  });

  it("does not flag sensitive admin role changes with audit logging", () => {
    expect(
      hasRule(
        [
          {
            path: "server/admin.ts",
            content: `
              export async function promoteToAdmin(ctx: any, userId: number) {
                await ctx.db.users.update({ where: eq(users.id, userId), data: { role: "admin" } });
                await auditLog("promoteToAdmin", { userId });
                return { ok: true };
              }
            `,
          },
        ],
        "STATIC-015-MISSING-AUDIT-LOG"
      )
    ).toBe(false);
  });
});

describe("world-class scope regressions", () => {
  it("keeps tRPC plus express transport adapter in the gold tier", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        "@trpc/server": "^11.0.0",
        express: "^4.0.0",
        zod: "^4.0.0",
        "drizzle-orm": "^0.45.0",
      }),
      {
        path: "src/server.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import * as trpcExpress from "@trpc/server/adapters/express";
          import express from "express";
          import { z } from "zod";
          import { pgTable } from "drizzle-orm/pg-core";
          const t = initTRPC.create();
          const appRouter = t.router({});
          const app = express();
          app.use("/trpc", trpcExpress.createExpressMiddleware({ router: appRouter }));
          export const users = pgTable("users", {});
          export const createUserSchema = z.object({ email: z.string().email() });
        `,
      },
    ]);

    expect(assessment.tier).toBe("gold");
    expect(assessment.primaryStack).toContain("tRPC");
    expect(assessment.primaryStack).not.toContain("Express");
  });

  it("keeps real mixed express plus tRPC route stacks below gold", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        "@trpc/server": "^11.0.0",
        express: "^4.0.0",
        zod: "^4.0.0",
        "drizzle-orm": "^0.45.0",
      }),
      {
        path: "src/server.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import express from "express";
          import { z } from "zod";
          const t = initTRPC.create();
          const app = express();
          const appRouter = t.router({});
          app.post("/users", (_req, res) => res.json({ ok: true }));
          export const schema = z.object({ email: z.string().email() });
          export { appRouter };
        `,
      },
    ]);

    expect(assessment.tier).toBe("supported");
    expect(assessment.blockers.some((blocker) => blocker.includes("Mehrere Backend-Frameworks"))).toBe(true);
  });

  it("classifies next route handler plus zod source as supported even without package metadata", () => {
    const assessment = assessSupportedScopeForCodebase([
      {
        path: "app/api/orders/route.ts",
        content: `
          import { z } from "zod";
          const schema = z.object({ amount: z.number().min(1) });
          export async function POST(request: Request) {
            const body = await request.json();
            schema.parse(body);
            return Response.json({ ok: true });
          }
        `,
      },
    ]);

    expect(assessment.tier).toBe("supported");
    expect(assessment.evidenceLevel).toBe("heuristic");
    expect(assessment.primaryStack).toContain("Next.js");
  });

  it("recognizes source-only tRPC plus drizzle plus zod stacks as gold even without a package manifest", () => {
    const assessment = assessSupportedScopeForCodebase([
      {
        path: "src/server.ts",
        content: `
          import { initTRPC } from "@trpc/server";
          import { z } from "zod";
          import { createInsertSchema } from "drizzle-zod/pg";
          import { pgTable } from "drizzle-orm/pg-core";
          const t = initTRPC.create();
          export const users = pgTable("users", {});
          export const insertUser = createInsertSchema(users, { role: z.enum(["admin", "user"]) });
          export const appRouter = t.router({});
        `,
      },
    ]);

    expect(assessment.tier).toBe("gold");
    expect(assessment.evidenceLevel).toBe("heuristic");
    expect(assessment.matchedGoldSignals).toContain("tRPC router");
    expect(assessment.matchedGoldSignals).toContain("Drizzle schema");
  });
});
