import * as fs from "fs";
import * as path from "path";
import { runAnalysisJob } from "./server/analyzer/job-runner";
import type { CodeFile } from "./server/analyzer/code-parser";

const OUTPUT_DIR = "/home/ubuntu/testforge-enterprise-output";

async function main() {
  const specText = fs.readFileSync("/home/ubuntu/testforge/enterprise-hardening-spec.md", "utf-8");
  const codeText = fs.readFileSync("/home/ubuntu/testforge/enterprise-hardening-code.ts", "utf-8");
  const codeFiles: CodeFile[] = [
    { path: "bankcore-api.ts", content: codeText }
  ];

  console.log(`\n${"=".repeat(70)}`);
  console.log(`=== ENTERPRISE HARDENING TEST — BankCore API ===`);
  console.log(`Spec: ${specText.length} chars | Code: ${codeText.length} chars`);
  console.log(`Intentional bugs: 12 (SQL-Injection, IDOR, Race Condition, Auth-Bypass, etc.)`);
  console.log("=".repeat(70));

  const t0 = Date.now();
  const result = await runAnalysisJob(
    specText,
    "BankCore",
    undefined,
    undefined,
    { codeFiles }
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const ir = result.analysisResult.ir;
  const behaviors = ir.behaviors.length;
  const endpoints = ir.apiEndpoints.length;
  const proofs = result.validatedSuite.proofs.length;
  const extFiles = result.extendedSuite.files.length;
  const e2eFiles = result.extendedSuite.files.filter((f: { layer?: string }) => f.layer === "e2e").length;
  const llm = result.llmCheckerStats;

  console.log(`\n--- RESULTS ---`);
  console.log(`Elapsed:        ${elapsed}s`);
  console.log(`Behaviors:      ${behaviors}`);
  console.log(`Endpoints:      ${endpoints} (${ir.apiEndpoints.map((e: { name: string }) => e.name).sort().join(", ")})`);
  console.log(`TenantKey:      ${ir.tenantModel?.tenantIdField || "—"}`);
  console.log(`Roles:          ${ir.authModel?.roles?.map((r: { name: string }) => r.name).join(", ") || "—"}`);
  console.log(`States:         ${ir.statusMachine?.states?.join(", ") || "—"}`);
  console.log(`Proofs:         ${proofs} raw`);
  console.log(`Extended files: ${extFiles} (E2E: ${e2eFiles})`);
  console.log(`LLM Checker:    ${llm.approved} approved / ${llm.flagged} flagged / ${llm.rejected} rejected`);

  // Save full Playwright structure
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const helpers = result.helpers as Record<string, string>;
  for (const [name, content] of Object.entries(helpers)) {
    const dest = path.join(OUTPUT_DIR, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content as string);
  }

  for (const tf of result.testFiles) {
    const dest = path.join(OUTPUT_DIR, tf.filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, tf.content);
  }

  for (const ef of result.extendedSuite.files) {
    const dest = path.join(OUTPUT_DIR, ef.filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, ef.content);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "testforge-report.html"), result.htmlReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, "testforge-report.md"), result.report);

  // Count files
  const allFiles: string[] = [];
  function collectFiles(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectFiles(full);
      else allFiles.push(full.replace(OUTPUT_DIR + "/", ""));
    }
  }
  collectFiles(OUTPUT_DIR);

  console.log(`\nFiles saved: ${allFiles.length} → ${OUTPUT_DIR}`);
  console.log(allFiles.map(f => `  ${f}`).join("\n"));

  // Check which bugs were detected
  const allContent = [...result.testFiles, ...result.extendedSuite.files]
    .map(f => f.content).join("\n");

  const bugChecks: Record<string, { pattern: RegExp; desc: string }> = {
    "BUG-01 SQL-Injection":    { pattern: /sql.inject|string.concat|parameteriz|injection/i, desc: "SQL Injection via string concatenation" },
    "BUG-02 IDOR":             { pattern: /idor|cross.tenant|bank.?id.*check|tenant.*isolation/i, desc: "IDOR — no bankId check in accounts.get" },
    "BUG-03 Race Condition":   { pattern: /race.condition|concurrent|atomic|select.*for.*update|double.spend/i, desc: "Race condition in balance check" },
    "BUG-04 CSRF":             { pattern: /csrf/i, desc: "Missing CSRF on transfers.initiate" },
    "BUG-05 Role Bypass":      { pattern: /teller.*approv|approv.*teller|role.*check|aml.*approv/i, desc: "Teller can approve AML transfers" },
    "BUG-06 Negative Amount":  { pattern: /negative.*amount|amount.*negative|min.*amount|amount.*min/i, desc: "Negative amount allowed" },
    "BUG-07 In-Memory Lockout":{ pattern: /lockout|in.memory|persist.*lock|lock.*persist/i, desc: "Lockout not persisted to DB" },
    "BUG-08 Audit Log":        { pattern: /audit.*log|log.*audit|audit.*fail|fail.*audit/i, desc: "Audit log skipped on error" },
    "BUG-09 GDPR Leak":        { pattern: /gdpr.*bank|bank.*gdpr|export.*bank.?id|bank.?id.*export/i, desc: "GDPR export missing bankId filter" },
    "BUG-10 Idempotency":      { pattern: /idempoten|duplicate.*booking|double.*book/i, desc: "Idempotency key not checked" },
    "BUG-11 Hardcoded Secret": { pattern: /hardcod.*secret|secret.*hardcod|jwt.*secret/i, desc: "JWT secret hardcoded" },
    "BUG-12 DoS pageSize":     { pattern: /page.?size.*cap|cap.*page.?size|max.*page|unlimited.*row/i, desc: "pageSize not capped" },
  };

  console.log(`\n--- BUG DETECTION ANALYSIS ---`);
  let detected = 0;
  for (const [bug, { pattern, desc }] of Object.entries(bugChecks)) {
    const found = pattern.test(allContent);
    if (found) detected++;
    console.log(`${found ? "✓ DETECTED" : "✗ MISSED  "} ${bug}: ${desc}`);
  }
  console.log(`\nDetection rate: ${detected}/${Object.keys(bugChecks).length} bugs covered by generated tests`);
  console.log("\n=== DONE ===");
}

main().catch(e => { console.error("[ERROR]", e); process.exit(1); });
