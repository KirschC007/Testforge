import AdmZip from "adm-zip";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runAnalysisJob } from "../server/analyzer/job-runner";
import { evaluateGeneratedSuiteQuality } from "../server/analyzer/generated-suite-gate";
import { normalizeZipEntryPath, redactUploadedCode, shouldIncludeCodePath } from "../server/_core/upload-security";
import type { CodeFile } from "../server/analyzer/code-parser";

interface ZipFixture {
  name: string;
  files: CodeFile[];
  mustDetect: string[];
  mustNotContain: RegExp[];
}

const outDir = path.resolve("artifacts/self-test-zips");
const inputDir = path.join(outDir, "input");
const outputDir = path.join(outDir, "output");

const fixtures: ZipFixture[] = [
  {
    name: "customer-seo-next-auth-single-tenant",
    files: [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "next-auth": "^5.0.0", zod: "^4.0.0" } }, null, 2) },
      { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth'; import CredentialsProvider from 'next-auth/providers/credentials'; export const { handlers } = NextAuth({ providers: [CredentialsProvider({ authorize: async () => ({ id: '1', email: 'admin@example.com' }) })] }); export const { GET, POST } = handlers;" },
      { path: "app/login/actions.ts", content: "\"use server\"; export async function login(){ return { ok: true }; }" },
      { path: "app/api/settings/models/route.ts", content: "import { z } from 'zod'; const schema = z.object({ provider: z.string(), model: z.string().min(1) }); export async function GET(){ return Response.json({ models: [] }); } export async function POST(req: Request){ const input = schema.parse(await req.json()); return Response.json({ ok: true, input }); }" },
      { path: "app/api/settings/modules/route.ts", content: "import { z } from 'zod'; const schema = z.object({ module: z.enum(['crawler','recommendations']), enabled: z.boolean() }); export async function GET(){ return Response.json({ modules: [] }); } export async function POST(req: Request){ const input = schema.parse(await req.json()); return Response.json({ ok: true, input }); }" },
      { path: "app/api/cron/run/[name]/route.ts", content: "export async function POST(_req: Request, { params }: { params: { name: string } }){ return Response.json({ ok: true, name: params.name }); }" },
      { path: "app/api/executor/tasks/[id]/approve/route.ts", content: "import { z } from 'zod'; const schema = z.object({ previewApproved: z.boolean(), visibleSeoChange: z.boolean().optional() }); export async function POST(req: Request){ const input = schema.parse(await req.json()); if (input.visibleSeoChange) return Response.json({ error: 'visible_change_requires_manual_review' }, { status: 422 }); return Response.json({ ok: true }); }" },
      { path: "app/api/meta/route.ts", content: "export async function GET(req: Request){ if (!req.headers.get('authorization')?.startsWith('Bearer ')) return Response.json({ error: 'unauthorized' }, { status: 401 }); return Response.json({ service: 'seo-tool' }); }" },
      { path: "app/api/llm-visibility/route.ts", content: "import { z } from 'zod'; const schema = z.object({ targetDomain: z.string().url() }); export async function POST(req: Request){ const input = schema.parse(await req.json()); return Response.json({ targetDomain: input.targetDomain, score: 72 }); }" },
    ],
    mustDetect: [
      "POST /api/settings/models",
      "POST /api/settings/modules",
      "POST /api/cron/run/[name]",
      "POST /api/executor/tasks/[id]/approve",
      "GET /api/meta",
    ],
    mustNotContain: [
      /\/api\/auth\/login/,
      /\/api\/trpc\/executor\.create/,
      /\bexecutor\.create\b/,
      /\bsettings\.update\b/,
      /\{\s*tenantId\s*:|TEST_TENANT_ID\s*[,:=]/,
      /\/executor\/(?:new|create)\b/,
      /targetDomain[^;\n]*\b(?:0|1|100)\b/,
    ],
  },
  {
    name: "express-buggy-money-api",
    files: [
      { path: "package.json", content: JSON.stringify({ dependencies: { express: "^5.0.0", zod: "^4.0.0", jsonwebtoken: "^9.0.0" } }, null, 2) },
      { path: "src/server.ts", content: "import express from 'express'; const app = express(); app.use(express.json()); app.post('/api/transfers', async (req, res) => { const { amount, toAccountId } = req.body; await db.query(`update accounts set balance = balance - ${amount}`); res.json({ ok: true, toAccountId }); }); app.delete('/api/admin/users/:id', (req, res) => res.json({ ok: true })); app.listen(3000);" },
    ],
    mustDetect: ["POST /api/transfers", "DELETE /api/admin/users/:id"],
    mustNotContain: [/\/api\/trpc\/(?:executor|settings|cron|meta|modules|models)/, /\/executor\/(?:new|create)\b/],
  },
  {
    name: "trpc-drizzle-tenant-gold",
    files: [
      { path: "package.json", content: JSON.stringify({ dependencies: { "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" } }, null, 2) },
      { path: "server/db/schema.ts", content: "import { pgTable, integer, text } from 'drizzle-orm/pg-core'; export const orders = pgTable('orders', { id: integer('id'), tenantId: integer('tenant_id'), status: text('status') });" },
      { path: "server/routers/orders.ts", content: "import { z } from 'zod'; export const ordersRouter = createTRPCRouter({ create: protectedProcedure.input(z.object({ tenantId: z.number(), amount: z.number().min(1) })).mutation(async ({ input }) => ({ id: 1, ...input })), approve: protectedProcedure.input(z.object({ tenantId: z.number(), id: z.number() })).mutation(() => ({ ok: true })) });" },
    ],
    mustDetect: ["POST /api/trpc/orders.create", "POST /api/trpc/orders.approve"],
    mustNotContain: [/\/executor\/(?:new|create)\b/],
  },
  {
    name: "shopify-preview-approval",
    files: [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "@shopify/shopify-api": "^11.0.0", zod: "^4.0.0" } }, null, 2) },
      { path: "app/api/shopify/writeback/route.ts", content: "import { z } from 'zod'; const schema = z.object({ productId: z.string(), previewApproved: z.boolean(), title: z.string().optional() }); export async function POST(req: Request){ const input = schema.parse(await req.json()); if (!input.previewApproved) return Response.json({ error: 'preview_required' }, { status: 409 }); return Response.json({ ok: true }); }" },
      { path: "app/api/webhooks/shopify/route.ts", content: "export async function POST(req: Request){ const hmac = req.headers.get('x-shopify-hmac-sha256'); if (!hmac) return Response.json({ error: 'missing_signature' }, { status: 401 }); return Response.json({ ok: true }); }" },
    ],
    mustDetect: ["POST /api/shopify/writeback", "POST /api/webhooks/shopify"],
    mustNotContain: [/\/api\/auth\/login/, /\/api\/trpc\/(?:executor|settings|cron|meta|modules|models)/, /\/executor\/(?:new|create)\b/],
  },
  {
    name: "fastapi-python-api",
    files: [
      { path: "requirements.txt", content: "fastapi\npydantic\nuvicorn\n" },
      { path: "app/main.py", content: "from fastapi import FastAPI\nfrom pydantic import BaseModel\napp = FastAPI()\nclass Item(BaseModel):\n    name: str\n    price: float\n@app.post('/api/items')\ndef create_item(item: Item):\n    return item\n@app.get('/api/health')\ndef health():\n    return {'ok': True}\n" },
    ],
    mustDetect: ["POST /api/items", "GET /api/health"],
    mustNotContain: [/\/api\/trpc\/(?:executor|settings|cron|meta|modules|models)/, /\/executor\/(?:new|create)\b/],
  },
];

function createInputZip(fixture: ZipFixture): string {
  mkdirSync(inputDir, { recursive: true });
  const zip = new AdmZip();
  for (const file of fixture.files) {
    zip.addFile(`repo/${file.path}`, Buffer.from(file.content, "utf-8"));
  }
  const zipPath = path.join(inputDir, `${fixture.name}.zip`);
  zip.writeZip(zipPath);
  return zipPath;
}

function extractLikeUpload(zipPath: string): CodeFile[] {
  const zip = new AdmZip(zipPath);
  const files: CodeFile[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const normalized = normalizeZipEntryPath(entry.entryName);
    if (!normalized || !shouldIncludeCodePath(normalized)) continue;
    files.push({ path: normalized, content: redactUploadedCode(normalized, entry.getData().toString("utf-8")) });
  }
  return files;
}

function zipGeneratedOutput(name: string, result: Awaited<ReturnType<typeof runAnalysisJob>>): string {
  mkdirSync(outputDir, { recursive: true });
  const zip = new AdmZip();
  for (const file of result.testFiles) zip.addFile(file.filename, Buffer.from(file.content, "utf-8"));
  for (const [filename, content] of Object.entries(result.helpers)) zip.addFile(filename, Buffer.from(content, "utf-8"));
  for (const file of result.extendedSuite.files) zip.addFile(file.filename, Buffer.from(file.content, "utf-8"));
  zip.addFile("README.md", Buffer.from(result.extendedSuite.readme, "utf-8"));
  zip.addFile("package.json", Buffer.from(result.extendedSuite.packageJson, "utf-8"));
  zip.addFile("testforge-report.md", Buffer.from(result.report, "utf-8"));
  const zipPath = path.join(outputDir, `${name}-testforge-output.zip`);
  zip.writeZip(zipPath);
  return zipPath;
}

function allGeneratedContent(result: Awaited<ReturnType<typeof runAnalysisJob>>, executableOnly = false): string {
  const allFiles = [
    ...result.testFiles.map((file) => ({ filename: file.filename, content: file.content })),
    ...Object.entries(result.helpers).map(([filename, content]) => ({ filename, content })),
    ...result.extendedSuite.files.map((file) => ({ filename: file.filename, content: file.content })),
  ];
  const generated = executableOnly
    ? allFiles.filter((file) => /\.(ts|tsx|js|mjs)$/.test(file.filename))
    : allFiles;
  return [
    ...(executableOnly ? [] : [result.report, result.extendedSuite.readme, result.extendedSuite.packageJson]),
    ...generated.map((file) => file.content),
  ].join("\n\n");
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const summaries = [];

for (const fixture of fixtures) {
  const inputZip = createInputZip(fixture);
  const codeFiles = extractLikeUpload(inputZip);
  const result = await runAnalysisJob("", fixture.name, undefined, undefined, { codeFiles });
  const outputZip = zipGeneratedOutput(fixture.name, result);
  const gate = evaluateGeneratedSuiteQuality(
    result.analysisResult,
    result.extendedSuite.files,
    { ...result.helpers, "README.md": result.extendedSuite.readme, "package.json": result.extendedSuite.packageJson } as never,
    codeFiles,
  );
  const endpoints = new Set(result.analysisResult.ir.apiEndpoints.map((endpoint) => endpoint.method || endpoint.name));
  const content = allGeneratedContent(result, true);
  const failures = [
    ...fixture.mustDetect.filter((endpoint) => !endpoints.has(endpoint)).map((endpoint) => `missing endpoint ${endpoint}`),
    ...fixture.mustNotContain.filter((pattern) => pattern.test(content)).map((pattern) => `forbidden generated content ${pattern}`),
    ...gate.failures,
  ];

  summaries.push({
    name: fixture.name,
    passed: failures.length === 0,
    inputZip,
    outputZip,
    fileCount: codeFiles.length,
    endpointCount: endpoints.size,
    behaviorCount: result.analysisResult.ir.behaviors.length,
    proofCount: result.validatedSuite.length,
    readiness: gate.readiness,
    failures,
    warnings: gate.warnings,
  });
}

const passed = summaries.filter((summary) => summary.passed).length;
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: summaries.length,
    passed,
    failed: summaries.length - passed,
    passRate: Math.round((passed / summaries.length) * 100),
  },
  results: summaries,
};

writeFileSync(path.join(outDir, "self-test-code-zips.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (report.summary.failed > 0) process.exit(1);
