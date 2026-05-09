import AdmZip from "adm-zip";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runAnalysisJob } from "../server/analyzer/job-runner";
import { evaluateGeneratedSuiteQuality } from "../server/analyzer/generated-suite-gate";
import { normalizeZipEntryPath, redactUploadedCode, shouldIncludeCodePath } from "../server/_core/upload-security";
import type { CodeFile } from "../server/analyzer/code-parser";

type ExpectedSignal = {
  id: string;
  kind: "endpoint" | "proof" | "static" | "report_text";
  expected: string | RegExp;
  why: string;
  likelyWeak?: boolean;
};

const outDir = path.resolve("artifacts/adversarial-3000loc");
const inputDir = path.join(outDir, "input");
const outputDir = path.join(outDir, "output");

function lines(prefix: string, count: number): string {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return `export const ${prefix}_${n} = { id: ${n}, tenant: "org_" + (${n} % 7), amount: ${n * 13}, note: "generated domain noise ${n}" };`;
  }).join("\n");
}

function serviceMethods(prefix: string, count: number): string {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return [
      `  async ${prefix}${n}(ctx: any, input: any) {`,
      `    const candidate = { id: ${n}, orgId: input.orgId, userId: input.userId, amount: input.amount ?? ${n} };`,
      `    if (input.debugBypass === "yes-${n}") return { ...candidate, role: input.role ?? "admin" };`,
      `    return candidate;`,
      "  }",
    ].join("\n");
  }).join("\n");
}

const files: CodeFile[] = [
  {
    path: "package.json",
    content: JSON.stringify({
      dependencies: {
        "@nestjs/common": "^11.0.0",
        "@nestjs/core": "^11.0.0",
        "@prisma/client": "^6.0.0",
        "@trpc/server": "^11.0.0",
        express: "^5.0.0",
        fastapi: "^0.0.1",
        graphql: "^16.0.0",
        next: "^15.0.0",
        prisma: "^6.0.0",
        zod: "^4.0.0",
      },
    }, null, 2),
  },
  {
    path: "prisma/schema.prisma",
    content: `
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
model Organization { id Int @id @default(autoincrement()); slug String @unique; users User[]; orders Order[] }
model User { id Int @id @default(autoincrement()); orgId Int; organization Organization @relation(fields: [orgId], references: [id]); email String @unique; role String; passwordHash String; orders Order[] }
model Order { id Int @id @default(autoincrement()); orgId Int; organization Organization @relation(fields: [orgId], references: [id]); userId Int; user User @relation(fields: [userId], references: [id]); total Float; status String; approvedById Int? }
model AuditLog { id Int @id @default(autoincrement()); orgId Int; actorId Int; action String; entityId Int; createdAt DateTime @default(now()) }
model WebhookEvent { id Int @id @default(autoincrement()); provider String; eventId String; payload Json; processed Boolean @default(false) }
`.trim(),
  },
  {
    path: "apps/nest/src/orders.controller.ts",
    content: `
import { Body, Controller, Delete, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
const transferSchema = z.object({ orgId: z.number(), fromOrderId: z.number(), toOrderId: z.number(), amount: z.number(), approveImmediately: z.boolean().optional() });
const statusSchema = z.object({ orgId: z.number(), orderId: z.number(), status: z.enum(["draft", "paid", "shipped", "refunded"]), approvedById: z.number().optional() });

@Controller("/api/orders")
export class OrdersController {
  constructor(private readonly db: any) {}

  @Post("transfer")
  async transfer(@Body() body: unknown, @Req() req: any) {
    const input = transferSchema.parse(body);
    // BUG: amount can be negative, req.user.orgId is ignored, and approveImmediately bypasses approval.
    await this.db.order.update({ where: { id: input.fromOrderId }, data: { total: { decrement: input.amount } } });
    await this.db.order.update({ where: { id: input.toOrderId }, data: { total: { increment: input.amount }, status: input.approveImmediately ? "paid" : "draft" } });
    return { ok: true, actorOrg: req.user?.orgId, input };
  }

  @Post(":id/status")
  async status(@Param("id") id: string, @Body() body: unknown, @Req() req: any) {
    const input = statusSchema.parse(body);
    // BUG: no status transition guard; shipped -> draft and refund before payment are possible.
    return this.db.order.update({ where: { id: Number(id) }, data: { status: input.status, approvedById: input.approvedById ?? req.user?.id } });
  }

  @Get(":id")
  async read(@Param("id") id: string) {
    // BUG: IDOR, no orgId filter.
    return this.db.order.findUnique({ where: { id: Number(id) } });
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    // BUG: public destructive endpoint, no audit log.
    await this.db.order.delete({ where: { id: Number(id) } });
    return { ok: true };
  }
}
`.trim(),
  },
  {
    path: "apps/nest/src/admin.controller.ts",
    content: `
import { Body, Controller, Delete, Patch, Post } from "@nestjs/common";
@Controller("/api/admin")
export class AdminController {
  constructor(private readonly db: any) {}
  @Patch("users/:id")
  async updateUser(@Body() body: any) {
    // BUG: mass assignment; role, orgId and plan can be overwritten.
    return this.db.user.update({ where: { id: Number(body.id) }, data: body });
  }
  @Delete("users/:id")
  async deleteUser(@Body() body: any) {
    // BUG: body id beats route id and there is no authz.
    return this.db.user.delete({ where: { id: Number(body.id) } });
  }
  @Post("impersonate")
  async impersonate(@Body() body: any) {
    // BUG: no audit log, no admin guard.
    return { token: "impersonated-" + body.userId, role: "admin" };
  }
}
`.trim(),
  },
  {
    path: "apps/web/app/api/billing/charge/route.ts",
    content: `
import { z } from "zod";
const chargeSchema = z.object({ orgId: z.number(), customerId: z.number(), amount: z.number(), currency: z.enum(["EUR", "USD"]), coupon: z.string().optional() });
export async function POST(req: Request) {
  const input = chargeSchema.parse(await req.json());
  const auth = req.headers.get("authorization");
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
  // BUG: negative amount and cross-org customerId are accepted.
  return Response.json({ chargeId: "ch_" + Math.random(), ...input });
}
`.trim(),
  },
  {
    path: "apps/web/app/api/reports/export/route.ts",
    content: `
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = Number(url.searchParams.get("orgId"));
  const format = url.searchParams.get("format") || "json";
  // BUG: orgId comes from query string and no session ownership check is performed.
  return Response.json({ orgId, format, pii: [{ email: "victim@example.com", revenue: 12345 }] });
}
`.trim(),
  },
  {
    path: "apps/web/app/api/webhooks/stripe/route.ts",
    content: `
export async function POST(req: Request) {
  const event = await req.json();
  // BUG: no stripe-signature validation and duplicate event ids are not checked.
  if (event.type === "invoice.paid") return Response.json({ markedPaid: true, id: event.data?.object?.id });
  return Response.json({ ignored: true });
}
`.trim(),
  },
  {
    path: "apps/web/app/api/files/upload/route.ts",
    content: `
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File;
  // BUG: no content-type, size or extension validation.
  return Response.json({ storedAs: "/public/uploads/" + file.name });
}
`.trim(),
  },
  {
    path: "apps/graphql/src/resolvers.ts",
    content: `
export const resolvers = {
  Mutation: {
    updateProfile: async (_: any, args: any, ctx: any) => {
      // BUG: GraphQL mass assignment and role escalation.
      return ctx.db.user.update({ where: { id: ctx.user.id }, data: args.input });
    },
    applyDiscount: async (_: any, args: any, ctx: any) => {
      // BUG: percent can be negative or > 100, orgId is caller supplied.
      return ctx.db.order.update({ where: { id: args.orderId }, data: { discountPercent: args.percent, orgId: args.orgId } });
    },
    approveRefund: async (_: any, args: any, ctx: any) => {
      // BUG: user can approve own refund and no status precondition is checked.
      return ctx.db.order.update({ where: { id: args.orderId }, data: { status: "refunded", approvedById: ctx.user.id } });
    },
  },
  Query: {
    order: (_: any, args: any, ctx: any) => ctx.db.order.findUnique({ where: { id: args.id } }),
  },
};
`.trim(),
  },
  {
    path: "apps/express/src/dynamic-router.ts",
    content: `
import express from "express";
const router = express.Router();
const tableFor = (resource: string) => resource.replace(/[^a-z_]/g, "");
for (const resource of ["invoices", "customers", "secrets"]) {
  router.post("/api/dynamic/" + resource + "/search", async (req, res) => {
    // BUG: SQL injection hidden behind dynamic route construction.
    const rows = await db.query("select * from " + tableFor(resource) + " where org_id = " + req.body.orgId + " and q like '%" + req.body.q + "%'");
    res.json(rows);
  });
}
export default router;
`.trim(),
  },
  {
    path: "services/fastapi/main.py",
    content: `
from fastapi import FastAPI, Request
from pydantic import BaseModel
app = FastAPI()
class Refund(BaseModel):
    orgId: int
    orderId: int
    amount: float
    reason: str
@app.post("/api/refunds")
def create_refund(refund: Refund, request: Request):
    # BUG: amount can exceed original payment and caller org is trusted.
    return {"ok": True, "refund": refund}
@app.get("/api/internal/secrets")
def secrets():
    # BUG: public internal endpoint.
    return {"stripeKey": "sk_live_should_not_be_here"}
`.trim(),
  },
  {
    path: "libs/domain/src/noise.ts",
    content: [
      "export class DomainNoise {",
      serviceMethods("calculateRisk", 260),
      "}",
      lines("policy", 500),
    ].join("\n"),
  },
  {
    path: "libs/domain/src/more-noise.ts",
    content: [
      "export const featureFlags = { refunds: true, impersonation: true, graphqlAdmin: true };",
      lines("workflow", 700),
      lines("auditHint", 500),
    ].join("\n"),
  },
  {
    path: "apps/web/app/dashboard/page.tsx",
    content: [
      "export default function Dashboard(){ return <main><h1>Ops Console</h1><button>Approve refund</button><button>Export report</button></main>; }",
      ...Array.from({ length: 450 }, (_, index) => `export const dashboardCopy${index} = "operator workflow copy ${index}";`),
    ].join("\n"),
  },
];

const expectedSignals: ExpectedSignal[] = [
  { id: "next-charge-endpoint", kind: "endpoint", expected: "POST /api/billing/charge", why: "Next route handler with money bug should be discovered." },
  { id: "next-export-endpoint", kind: "endpoint", expected: "GET /api/reports/export", why: "Report export exposes PII via query orgId." },
  { id: "stripe-webhook-endpoint", kind: "endpoint", expected: "POST /api/webhooks/stripe", why: "Webhook without signature should be discovered." },
  { id: "file-upload-endpoint", kind: "endpoint", expected: "POST /api/files/upload", why: "Unsafe upload route should be discovered." },
  { id: "fastapi-refund-endpoint", kind: "endpoint", expected: "POST /api/refunds", why: "FastAPI route should be discovered." },
  { id: "fastapi-secrets-endpoint", kind: "endpoint", expected: "GET /api/internal/secrets", why: "FastAPI public secrets route should be discovered." },
  { id: "nest-transfer-endpoint", kind: "endpoint", expected: /transfer/i, why: "NestJS decorator route should be discovered.", likelyWeak: true },
  { id: "graphql-mass-assignment", kind: "proof", expected: "mass_assignment", why: "GraphQL updateProfile assigns arbitrary input.", likelyWeak: true },
  { id: "negative-money-proof", kind: "proof", expected: "negative_amount", why: "Charge/refund/transfer accept negative or unbounded amounts." },
  { id: "webhook-proof", kind: "proof", expected: "webhook", why: "Stripe webhook has no signature validation." },
  { id: "idor-proof", kind: "proof", expected: "idor", why: "Order/report reads trust caller supplied ids." },
  { id: "sql-injection-static", kind: "static", expected: "STATIC-003-SQL-INJECTION", why: "Dynamic Express query concatenates req.body.q.", likelyWeak: true },
  { id: "file-upload-static", kind: "static", expected: "STATIC-012-FILE-UPLOAD-NO-VALIDATION", why: "Upload route stores file by original name." },
  { id: "hardcoded-secret-static", kind: "static", expected: "STATIC-001-HARDCODED-SECRET", why: "FastAPI internal endpoint returns live-looking secret." },
];

function createInputZip(): string {
  mkdirSync(inputDir, { recursive: true });
  const zip = new AdmZip();
  for (const file of files) zip.addFile(`adversarial-saas/${file.path}`, Buffer.from(file.content, "utf8"));
  const zipPath = path.join(inputDir, "adversarial-3000loc-saas.zip");
  zip.writeZip(zipPath);
  return zipPath;
}

function extractLikeUpload(zipPath: string): CodeFile[] {
  const zip = new AdmZip(zipPath);
  const extracted: CodeFile[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const normalized = normalizeZipEntryPath(entry.entryName);
    if (!normalized || !shouldIncludeCodePath(normalized)) continue;
    extracted.push({ path: normalized, content: redactUploadedCode(normalized, entry.getData().toString("utf8")) });
  }
  return extracted;
}

function writeOutputZip(result: Awaited<ReturnType<typeof runAnalysisJob>>): string {
  mkdirSync(outputDir, { recursive: true });
  const zip = new AdmZip();
  for (const file of result.testFiles) zip.addFile(file.filename, Buffer.from(file.content, "utf8"));
  for (const [filename, content] of Object.entries(result.helpers)) zip.addFile(filename, Buffer.from(content, "utf8"));
  for (const file of result.extendedSuite.files) zip.addFile(file.filename, Buffer.from(file.content, "utf8"));
  zip.addFile("README.md", Buffer.from(result.extendedSuite.readme, "utf8"));
  zip.addFile("package.json", Buffer.from(result.extendedSuite.packageJson, "utf8"));
  zip.addFile("testforge-report.md", Buffer.from(result.report, "utf8"));
  const zipPath = path.join(outputDir, "adversarial-3000loc-testforge-output.zip");
  zip.writeZip(zipPath);
  return zipPath;
}

function countLoc(codeFiles: CodeFile[]): number {
  return codeFiles.reduce((sum, file) => sum + file.content.split(/\r?\n/).length, 0);
}

function matches(value: string, expected: string | RegExp): boolean {
  return typeof expected === "string" ? value === expected || value.includes(expected) : expected.test(value);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const inputZip = createInputZip();
const codeFiles = extractLikeUpload(inputZip);
const result = await runAnalysisJob("", "adversarial-3000loc-saas", undefined, undefined, { codeFiles });
const outputZip = writeOutputZip(result);
const gate = evaluateGeneratedSuiteQuality(
  result.analysisResult,
  result.extendedSuite.files,
  { ...result.helpers, "README.md": result.extendedSuite.readme, "package.json": result.extendedSuite.packageJson } as never,
  codeFiles,
);

const endpoints = result.analysisResult.ir.apiEndpoints.map((endpoint) => endpoint.method || endpoint.name);
const validatedProofs = result.validatedSuite.proofs || [];
const proofTypes = Array.from(new Set(validatedProofs.map((proof) => proof.proofType)));
const staticRules = Array.from(new Set((result.analysisResult.staticFindings || []).map((finding) => finding.rule)));
const reportText = result.report;

const signalResults = expectedSignals.map((signal) => {
  const haystack = signal.kind === "endpoint"
    ? endpoints.join("\n")
    : signal.kind === "proof"
      ? proofTypes.join("\n")
      : signal.kind === "static"
        ? staticRules.join("\n")
        : reportText;
  return {
    ...signal,
    expected: String(signal.expected),
    detected: matches(haystack, signal.expected),
  };
});

const detected = signalResults.filter((signal) => signal.detected).length;
const likelyWeak = signalResults.filter((signal) => signal.likelyWeak);
const weakDetected = likelyWeak.filter((signal) => signal.detected).length;
const missed = signalResults.filter((signal) => !signal.detected);

const report = {
  generatedAt: new Date().toISOString(),
  inputZip,
  outputZip,
  loc: countLoc(codeFiles),
  filesIncluded: codeFiles.length,
  parserSummary: {
    endpoints,
    endpointCount: endpoints.length,
    behaviorCount: result.analysisResult.ir.behaviors.length,
    proofTypes,
    proofCount: validatedProofs.length,
    staticRules,
    staticFindingCount: result.analysisResult.staticFindings?.length || 0,
    supportedScope: result.analysisResult.supportedScope,
    executionProfile: result.analysisResult.executionProfile,
  },
  generatedSuiteGate: gate,
  adversarialScore: {
    expectedSignals: signalResults.length,
    detected,
    missed: missed.length,
    detectionRate: Math.round((detected / signalResults.length) * 100),
    likelyWeakSignals: likelyWeak.length,
    likelyWeakDetected: weakDetected,
    likelyWeakDetectionRate: likelyWeak.length > 0 ? Math.round((weakDetected / likelyWeak.length) * 100) : 0,
  },
  signalResults,
  misses: missed,
};

writeFileSync(path.join(outDir, "adversarial-3000loc-result.json"), JSON.stringify(report, null, 2));
writeFileSync(
  path.join(outDir, "adversarial-3000loc-result.md"),
  [
    "# Adversarial 3000 LOC Evaluation",
    "",
    `LOC: ${report.loc}`,
    `Files included: ${report.filesIncluded}`,
    `Endpoints detected: ${report.parserSummary.endpointCount}`,
    `Proof types: ${proofTypes.join(", ") || "-"}`,
    `Static rules: ${staticRules.join(", ") || "-"}`,
    `Detection rate: ${report.adversarialScore.detectionRate}% (${detected}/${signalResults.length})`,
    `Likely-weak detection rate: ${report.adversarialScore.likelyWeakDetectionRate}% (${weakDetected}/${likelyWeak.length})`,
    "",
    "## Misses",
    "",
    ...missed.map((signal) => `- ${signal.id}: ${signal.why}`),
    "",
    "## Detected Endpoints",
    "",
    ...endpoints.map((endpoint) => `- ${endpoint}`),
    "",
  ].join("\n")
);

console.log(JSON.stringify(report, null, 2));
