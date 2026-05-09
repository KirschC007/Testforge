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

  it("does not treat awaited calls as unhandled promises", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/router.ts",
        content: `
          export const route = protectedProcedure.mutation(async ({ ctx }) => {
            const db = await getDb();
            await db.insert(users).values({ id: ctx.user.id });
            return { ok: true };
          });
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-007-UNHANDLED-PROMISE")).toBe(false);
  });

  it("flags likely floating side-effect promises", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/router.ts",
        content: `
          export function sendWelcomeEmail(user: any) {
            sendMailAsync(user.email);
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-007-UNHANDLED-PROMISE")).toBe(true);
  });

  it("does not report logger stack metadata as a response leak", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/index.ts",
        content: `
          process.on("uncaughtException", (err) => {
            logger.fatal({ err: { message: err.message, stack: err.stack } }, "fatal");
          });
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-009-STACK-TRACE-LEAK")).toBe(false);
  });

  it("does not report audit findings for re-exported auth service names", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/auth/authService.ts",
        content: `
          import { resetPassword } from "./reset";
          export { resetPassword };
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-015-MISSING-AUDIT-LOG")).toBe(false);
  });

  it("does not flag parameterized SQL executes as interpolation injection", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/sql.ts",
        content: `
          export async function deleteSlug(conn: any, slug: string) {
            await conn.execute("DELETE FROM integration_types WHERE slug = ?", [slug]);
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-003-SQL-INJECTION")).toBe(false);
  });

  it("ignores migration and tool artifact files in customer scans", () => {
    const findings = runStaticAnalysis([
      {
        path: "scripts/migrate_0048_encrypt_secrets.mjs",
        content: "await conn.execute(`UPDATE ${table} SET value = ${secret}`);",
      },
      {
        path: ".manus/db/db-query.json",
        content: JSON.stringify({ query: "DELETE FROM users WHERE email='x@example.com'" }),
      },
    ]);

    expect(findings).toEqual([]);
  });

  it("does not flag outbound storage client helpers as upload endpoints", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/storage.ts",
        content: `
          function buildUploadUrl(baseUrl: string, relKey: string) {
            return new URL("v1/storage/upload", baseUrl);
          }
          export async function putObject(formData: FormData) {
            await fetch(buildUploadUrl("https://storage.example", "x"), { method: "POST", body: formData });
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-012-FILE-UPLOAD-NO-VALIDATION")).toBe(false);
  });

  it("treats user-owned queries as scoped when the app has no tenant field in that query", () => {
    const findings = runStaticAnalysis([
      {
        path: "server/numberRequests.ts",
        content: `
          export async function listMine(ctx: any) {
            return db.select().from(numberRequests)
              .where(eq(numberRequests.userId, ctx.user.id));
          }
        `,
      },
    ]);

    expect(findings.some((finding) => finding.rule === "STATIC-008-MISSING-TENANT-CHECK")).toBe(false);
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
