import { describe, expect, it } from "vitest";
import { runStaticAnalysis } from "./static-analyzer";

describe("STATIC-008-MISSING-TENANT-CHECK", () => {
  it("flags tenant-sensitive queries that do not scope by tenant in the actual query block", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/orders.ts",
        content: `
          export async function getOrder(ctx: any, input: { tenantId: number; orderId: number }) {
            return ctx.db.query.orders.findFirst({
              where: eq(orders.id, input.orderId),
            });
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-008-MISSING-TENANT-CHECK")).toBe(true);
  });

  it("does not flag queries that scope by tenant inside the query predicate", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/orders.ts",
        content: `
          export async function getOrder(ctx: any, input: { tenantId: number; orderId: number }) {
            return ctx.db.query.orders.findFirst({
              where: and(eq(orders.id, input.orderId), eq(orders.tenantId, input.tenantId)),
            });
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-008-MISSING-TENANT-CHECK")).toBe(false);
  });
});

describe("static analyzer regression rules", () => {
  it("flags open redirects that use raw request input", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/redirect.ts",
        content: `
          export function callback(req: any, res: any) {
            return res.redirect(req.query.next);
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-013-OPEN-REDIRECT")).toBe(true);
  });

  it("flags file uploads without MIME or size validation", () => {
    const findings = runStaticAnalysis([
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
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-012-FILE-UPLOAD-NO-VALIDATION")).toBe(true);
  });

  it("ignores lockfiles so dependency metadata cannot create noisy security findings", () => {
    const findings = runStaticAnalysis([
      {
        path: "package-lock.json",
        content: JSON.stringify({
          packages: {
            "node_modules/example": {
              resolved: "https://registry.npmjs.org/upload-without-validation/-/upload.tgz",
            },
          },
        }),
      },
    ]);

    expect(findings).toEqual([]);
  });

  it("flags mass assignment writes that spread protected input into model updates", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/profile.ts",
        content: `
          export async function updateProfile(ctx: any, input: any) {
            const role = input.role;
            const isAdmin = input.isAdmin;
            return ctx.db.users.update({
              where: eq(users.id, ctx.user.id),
              data: input,
            });
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-016-MASS-ASSIGNMENT")).toBe(true);
  });
});
