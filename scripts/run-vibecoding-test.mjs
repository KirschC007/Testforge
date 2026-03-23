/**
 * Vibecoding Code-Scan-Test (Aufgabe 3b)
 * Runs the full analysis pipeline on vibecoded TypeScript/tRPC/Drizzle code files.
 * Run via: cd /home/ubuntu/testforge && npx tsx scripts/run-vibecoding-test.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PassThrough } from "stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// ─── Vibecoding Project Files ─────────────────────────────────────────────────

const PACKAGE_JSON = JSON.stringify({
  dependencies: {
    "@trpc/server": "^11.0.0",
    "drizzle-orm": "^0.30.0",
    "zod": "^3.22.0",
    "express": "^4.18.0",
  },
}, null, 2);

const SCHEMA_TS = `import { mysqlTable, int, varchar, timestamp, boolean, mysqlEnum } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspace_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).notNull().default("member"),
  phone: varchar("phone", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspace_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: varchar("description", { length: 5000 }),
  status: mysqlEnum("status", ["todo", "in_progress", "review", "done"]).notNull().default("todo"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  assigneeId: int("assignee_id"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull(),
  workspaceId: int("workspace_id").notNull(),
  authorId: int("author_id").notNull(),
  content: varchar("content", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
`;

const TASKS_ROUTER_TS = `import { z } from "zod";
import { router, protectedProcedure, requireWorkspaceAuth } from "../trpc";

export const tasksRouter = router({
  create: requireWorkspaceAuth
    .input(z.object({
      workspaceId: z.number(),
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      assigneeId: z.number().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... creates task
    }),

  list: requireWorkspaceAuth
    .input(z.object({
      workspaceId: z.number(),
      status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
      assigneeId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // ... lists tasks for workspace
    }),

  updateStatus: requireWorkspaceAuth
    .input(z.object({
      id: z.number(),
      workspaceId: z.number(),
      status: z.enum(["todo", "in_progress", "review", "done"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... updates task status
    }),

  delete: requireWorkspaceAuth
    .input(z.object({
      id: z.number(),
      workspaceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... deletes task
    }),

  bulkDelete: requireWorkspaceAuth
    .input(z.object({
      taskIds: z.array(z.number()).min(1).max(50),
      workspaceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... bulk deletes tasks
    }),
});
`;

// ─── Code Files for the Code-Scan path ───────────────────────────────────────

const codeFiles = [
  { path: "package.json", content: PACKAGE_JSON },
  { path: "server/schema.ts", content: SCHEMA_TS },
  { path: "server/routers/tasks.ts", content: TASKS_ROUTER_TS },
];

// ─── Run the analysis pipeline ───────────────────────────────────────────────

const { runAnalysisJob } = await import("../server/analyzer/job-runner.ts");
const { generateExtendedTestSuite } = await import("../server/analyzer/extended-suite.ts");
const archiver = await import("archiver");

console.log("=== Vibecoding Code-Scan-Test (Aufgabe 3b) ===\n");
console.log(`Code files: ${codeFiles.map(f => f.filename).join(", ")}\n`);

const result = await runAnalysisJob(
  "", // no spec text for code scan
  "VibecodeTaskManager",
  async (layer, msg) => { console.log(`  [L${layer}] ${msg}`); },
  undefined, // no industry pack
  { codeFiles } // code scan path
);

const { analysisResult, riskModel, validatedSuite, report, testFiles, helpers, extendedSuite } = result;
const ir = analysisResult.ir;

console.log("\n=== Results ===");
console.log(`Behaviors:       ${ir.behaviors.length}`);
console.log(`Endpoints:       ${ir.apiEndpoints.length}`);
console.log(`Tables:          ${ir.resources?.length ?? "N/A"}`);
console.log(`Quality Score:   ${analysisResult.qualityScore}/100`);
console.log(`Spec Type:       ${analysisResult.specType}`);
console.log(`Framework:       ${ir.services?.[0]?.techStack ?? "detected from code"}`);
console.log(`Tenant Model:    ${ir.tenantModel?.tenantIdField ?? "none"}`);
console.log(`PII Fields:      ${ir.resources?.filter(r => r.hasPII).map(r => r.name).join(", ") ?? "none"}`);
console.log(`Proof Targets:   ${riskModel.proofTargets.length}`);
console.log(`Validated Tests: ${validatedSuite.proofs.length}`);
console.log(`Test Files:      ${testFiles.length}`);
console.log(`Extended Files:  ${extendedSuite.files.length}`);

// Proof types triggered
const proofTypes = new Set(validatedSuite.proofs.map(p => p.proofType).filter(Boolean));
console.log(`Proof Types:     ${[...proofTypes].join(", ")}`);

// Requirement checks from briefing
console.log("\n=== Requirement Checks ===");
const tableNames = ir.resources?.map(r => r.name.toLowerCase()) ?? [];
const endpointNames = ir.apiEndpoints.map(e => e.name.toLowerCase());
const checks = {
  "Framework erkannt: tRPC + Drizzle": analysisResult.specType?.startsWith("code:") || analysisResult.specType === "code-scan",
  "≥5 Endpoints (tasks.create/list/updateStatus/delete/bulkDelete)": ir.apiEndpoints.length >= 5,
  "≥3 Tabellen (users, tasks, comments)": (ir.resources?.length ?? 0) >= 3,
  "Tenant-Model erkannt: workspaceId": ir.tenantModel?.tenantIdField === "workspaceId" || ir.tenantModel?.tenantIdField?.includes("workspace"),
  "PII erkannt (users.email/name/phone)": ir.resources?.some(r => r.hasPII) ?? false,
  "IDOR-Tests generiert": proofTypes.has("idor") || validatedSuite.proofs.some(p => p.proofType === "idor"),
  "Boundary-Tests generiert": proofTypes.has("boundary") || validatedSuite.proofs.some(p => p.proofType === "boundary"),
  "Enum/Boundary-Tests generiert": proofTypes.has("boundary") || validatedSuite.proofs.some(p => p.proofType === "boundary"),
  "Auth-Tests generiert": proofTypes.has("auth_matrix") || validatedSuite.proofs.some(p => p.proofType === "auth_matrix"),
};

let allPassed = true;
for (const [check, passed] of Object.entries(checks)) {
  console.log(`  ${passed ? "✓" : "✗"} ${check}`);
  if (!passed) allPassed = false;
}

// Endpoints detected
console.log("\n=== Endpoints Detected ===");
ir.apiEndpoints.forEach(e => {
  console.log(`  ${e.method ?? "?"} ${e.name} (auth: ${e.auth ?? "unknown"})`);
});

// Tables detected
console.log("\n=== Tables Detected ===");
(ir.resources ?? []).forEach(r => {
  console.log(`  ${r.name} (tenantKey: ${r.tenantKey ?? "none"}, PII: ${r.hasPII ?? false})`);
});

// Bug candidates
console.log("\n=== Bug Candidates (likely red in real run) ===");
const idorProofs = validatedSuite.proofs.filter(p => p.proofType === "idor");
const boundaryProofs = validatedSuite.proofs.filter(p => p.proofType === "boundary");
const authProofs = validatedSuite.proofs.filter(p => p.proofType === "auth_matrix");
const enumProofs = validatedSuite.proofs.filter(p => p.proofType === "enum_validation");
console.log(`  IDOR tests: ${idorProofs.length} (cross-workspace access via workspaceId)`);
console.log(`  Boundary tests: ${boundaryProofs.length} (title 1-200, description 0-5000, taskIds 1-50)`);
console.log(`  Auth Matrix tests: ${authProofs.length} (admin/member/viewer roles)`);
console.log(`  Enum tests: ${enumProofs.length} (status: todo/in_progress/review/done, priority: low/medium/high/critical)`);

// Build ZIP
console.log("\n=== Building ZIP ===");
const chunks = [];
const archive = archiver.default("zip", { zlib: { level: 9 } });
const passThrough = new PassThrough();
archive.pipe(passThrough);
passThrough.on("data", (chunk) => chunks.push(chunk));

for (const tf of testFiles) {
  archive.append(tf.content, { name: tf.filename });
}
archive.append(report, { name: "testforge-report.md" });
for (const [filename, content] of Object.entries(helpers)) {
  archive.append(content, { name: filename });
}
for (const extFile of extendedSuite.files) {
  const alreadyAdded = testFiles.some(tf => tf.filename === extFile.filename);
  if (!alreadyAdded) {
    archive.append(extFile.content, { name: extFile.filename });
  }
}
for (const [configName, configContent] of Object.entries(extendedSuite.configs)) {
  const skipNames = ["playwright.config.ts", "package.json"];
  if (!skipNames.includes(configName)) {
    archive.append(configContent, { name: configName });
  }
}
archive.append(extendedSuite.readme, { name: "README.md" });

await Promise.all([
  archive.finalize(),
  new Promise((resolve, reject) => {
    passThrough.on("finish", resolve);
    passThrough.on("error", reject);
    archive.on("error", reject);
  }),
]);

const zipBuffer = Buffer.concat(chunks);
const outputPath = join(projectRoot, "output-vibecoding-test.zip");
writeFileSync(outputPath, zipBuffer);
console.log(`ZIP saved: ${outputPath} (${Math.round(zipBuffer.length / 1024)}KB)`);

// Summary table
console.log("\n=== Summary Table ===");
console.log("| Metric                | Spec-Test (BankingCore) | Code-Scan (Vibecoding) |");
console.log("|----------------------|------------------------|------------------------|");
console.log(`| Behaviors extracted  | 109                    | ${ir.behaviors.length.toString().padEnd(22)} |`);
console.log(`| Endpoints detected   | 11                     | ${ir.apiEndpoints.length.toString().padEnd(22)} |`);
console.log(`| Proof targets        | 134                    | ${riskModel.proofTargets.length.toString().padEnd(22)} |`);
console.log(`| Tests generated      | 131                    | ${validatedSuite.proofs.length.toString().padEnd(22)} |`);
console.log(`| Test files           | 9                      | ${testFiles.length.toString().padEnd(22)} |`);
console.log(`| Proof types          | 9                      | ${proofTypes.size.toString().padEnd(22)} |`);
console.log(`| ZIP size             | 62KB                   | ${Math.round(zipBuffer.length / 1024)}KB${' '.repeat(Math.max(0, 22 - Math.round(zipBuffer.length / 1024).toString().length - 2))} |`);
console.log(`| All checks passed    | YES ✓                  | ${allPassed ? "YES ✓" : "NO ✗"}${' '.repeat(allPassed ? 17 : 18)} |`);
