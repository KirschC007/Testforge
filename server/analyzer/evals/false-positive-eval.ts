import { parseCodeToIR, type CodeFile } from "../code-parser";
import { buildRiskModel } from "../risk-model";
import { runStaticAnalysis } from "../static-analyzer";
import type { ProofType } from "../types";

export interface FalsePositiveFixture {
  name: string;
  files: CodeFile[];
  forbiddenStaticRules: string[];
  forbiddenProofTypes?: ProofType[];
}

export interface FalsePositiveEvalResult {
  name: string;
  passed: boolean;
  staticRules: string[];
  proofTypes: string[];
  forbiddenHits: string[];
}

const basePkg = (dependencies: Record<string, string>): CodeFile => ({
  path: "package.json",
  content: JSON.stringify({ dependencies }),
});

export const FALSE_POSITIVE_FIXTURES: FalsePositiveFixture[] = [
  {
    name: "safe-tenant-query",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }),
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
    ],
    forbiddenStaticRules: ["STATIC-008-MISSING-TENANT-CHECK"],
  },
  {
    name: "safe-open-redirect",
    files: [
      basePkg({ express: "^4.0.0" }),
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
    forbiddenStaticRules: ["STATIC-013-OPEN-REDIRECT"],
  },
  {
    name: "safe-webhook-signature",
    files: [
      basePkg({ express: "^4.0.0" }),
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
    forbiddenStaticRules: ["STATIC-010-MISSING-WEBHOOK-SIGNATURE"],
    forbiddenProofTypes: ["webhook"],
  },
  {
    name: "safe-upload-validation",
    files: [
      basePkg({ express: "^4.0.0", multer: "^2.1.1" }),
      {
        path: "server/upload.ts",
        content: `
          import multer from "multer";
          const upload = multer({ limits: { fileSize: 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")) });
          export async function handleAvatar(req: any, res: any) {
            if (!req.file.mimetype.startsWith("image/")) throw new Error("bad mime");
            await store(req.file);
            return res.json({ ok: true });
          }
        `,
      },
    ],
    forbiddenStaticRules: ["STATIC-012-FILE-UPLOAD-NO-VALIDATION"],
  },
  {
    name: "safe-jwt-config",
    files: [
      basePkg({ jsonwebtoken: "^9.0.0" }),
      {
        path: "server/auth.ts",
        content: `
          const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: "15m" });
          export { token };
        `,
      },
    ],
    forbiddenStaticRules: ["STATIC-001-HARDCODED-SECRET", "STATIC-011-INSECURE-JWT"],
  },
  {
    name: "safe-password-hash",
    files: [
      basePkg({ bcrypt: "^5.0.0" }),
      {
        path: "server/login.ts",
        content: `
          export async function login(password: string, user: any) {
            return await bcrypt.compare(password, user.passwordHash);
          }
        `,
      },
    ],
    forbiddenStaticRules: ["STATIC-014-PLAINTEXT-PASSWORD"],
  },
  {
    name: "safe-audit-log",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0" }),
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
    forbiddenStaticRules: ["STATIC-015-MISSING-AUDIT-LOG"],
  },
  {
    name: "safe-mass-assignment",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }),
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
    forbiddenStaticRules: ["STATIC-016-MASS-ASSIGNMENT"],
    forbiddenProofTypes: ["mass_assignment"],
  },
  {
    name: "safe-auth-rate-limit",
    files: [
      basePkg({ express: "^4.0.0", "express-rate-limit": "^7.0.0" }),
      {
        path: "server/auth-login.ts",
        content: `
          const rateLimit = createRateLimit();
          export async function login(req: any, res: any) {
            rateLimit(req, res, () => undefined);
            return res.json({ ok: true });
          }
        `,
      },
    ],
    forbiddenStaticRules: ["STATIC-002-NO-RATE-LIMIT"],
    forbiddenProofTypes: ["rate_limit"],
  },
  {
    name: "safe-sql-parameterized",
    files: [
      basePkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0" }),
      {
        path: "server/search.ts",
        content: `
          export async function search(ctx: any, input: { q: string }) {
            return ctx.db.execute("SELECT * FROM orders WHERE note LIKE $1", [input.q]);
          }
        `,
      },
    ],
    forbiddenStaticRules: ["STATIC-003-SQL-INJECTION"],
    forbiddenProofTypes: ["sql_injection"],
  },
];

export function runFalsePositiveEval(): FalsePositiveEvalResult[] {
  return FALSE_POSITIVE_FIXTURES.map((fixture) => {
    const staticFindings = runStaticAnalysis(fixture.files);
    const analysis = parseCodeToIR(fixture.files) as ReturnType<typeof parseCodeToIR> & { staticFindings?: typeof staticFindings };
    analysis.staticFindings = staticFindings;
    const riskModel = buildRiskModel(analysis);
    const staticRules = Array.from(new Set(staticFindings.map((finding) => finding.rule)));
    const proofTypes = Array.from(new Set(riskModel.proofTargets.map((target) => target.proofType)));
    const forbiddenHits = [
      ...fixture.forbiddenStaticRules.filter((rule) => staticRules.includes(rule)),
      ...(fixture.forbiddenProofTypes || []).filter((proofType) => proofTypes.includes(proofType)),
    ];

    return {
      name: fixture.name,
      passed: forbiddenHits.length === 0,
      staticRules,
      proofTypes,
      forbiddenHits,
    };
  });
}

export function summarizeFalsePositiveEval(results: FalsePositiveEvalResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const falsePositiveHits = results.reduce((sum, result) => sum + result.forbiddenHits.length, 0);
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    falsePositiveHits,
  };
}
