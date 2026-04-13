import * as fs from "fs";
import * as path from "path";
import { runAnalysisJob } from "./server/analyzer/job-runner";
import type { CodeFile } from "./server/analyzer/code-parser";

const OUTPUT_DIR = "/home/ubuntu/testforge-output-v84";

async function main() {
  const specText = fs.readFileSync("/home/ubuntu/testforge/meditrack-spec.md", "utf-8");
  const codeText = fs.readFileSync("/home/ubuntu/testforge/meditrack-code.ts", "utf-8");
  const codeFiles: CodeFile[] = [
    { path: "meditrack-code.ts", content: codeText }
  ];

  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== SZENARIO: MediTrack (Hybrid-Modus) — Full Output ===`);
  console.log(`Spec size: ${specText.length} bytes`);
  console.log(`Code size: ${codeText.length} bytes (${codeFiles.length} file)`);
  console.log("=".repeat(60));

  const t0 = Date.now();
  const result = await runAnalysisJob(
    specText,
    "MediTrack",
    undefined,
    undefined,
    { codeFiles }
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const ir = result.analysisResult.ir;
  const behaviors = ir.behaviors.length;
  const endpoints = ir.apiEndpoints.length;
  const endpointNames = ir.apiEndpoints.map((e: { name: string }) => e.name).sort().join(", ");
  const tenantKey = ir.tenantModel?.tenantIdField || "—";
  const roles = ir.authModel?.roles?.map((r: { name: string }) => r.name).join(", ") || "—";
  const proofs = result.validatedSuite.proofs.length;
  const extFiles = result.extendedSuite.files.length;
  const e2eFiles = result.extendedSuite.files.filter((f: { layer?: string }) => f.layer === "e2e").length;
  const llm = result.llmCheckerStats;

  console.log(`Elapsed: ${elapsed}s`);
  console.log(`Behaviors: ${behaviors}`);
  console.log(`Endpoints: ${endpoints} (${endpointNames})`);
  console.log(`TenantKey: ${tenantKey}`);
  console.log(`Rollen: ${ir.authModel?.roles?.length || 0} (${roles})`);
  console.log(`Proofs: ${proofs} raw`);
  console.log(`Extended files: ${extFiles} (E2E: ${e2eFiles})`);
  console.log(`LLM Checker: ${llm.approved} approved / ${llm.flagged} flagged / ${llm.rejected} rejected`);

  // Vollständige Playwright-Struktur aufbauen
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, "helpers"), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, "tests"), { recursive: true });

  // Helpers-Dateien (helpers/auth.ts, helpers/api.ts, etc.)
  const helpers = result.helpers as Record<string, string>;
  for (const [name, content] of Object.entries(helpers)) {
    const dest = path.join(OUTPUT_DIR, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content as string);
  }

  // playwright.config.ts aus helpers
  // (schon in helpers enthalten als "playwright.config.ts")

  // Core test files (security, compliance etc.)
  for (const tf of result.testFiles) {
    const dest = path.join(OUTPUT_DIR, tf.filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, tf.content);
  }

  // Extended test files (unit, integration, e2e)
  for (const ef of result.extendedSuite.files) {
    const dest = path.join(OUTPUT_DIR, ef.filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, ef.content);
    }
  }

  // Reports
  fs.writeFileSync(path.join(OUTPUT_DIR, "testforge-report.html"), result.htmlReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, "testforge-report.md"), result.report);

  // Dateiliste ausgeben
  const allFiles: string[] = [];
  function collectFiles(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectFiles(full);
      else allFiles.push(full.replace(OUTPUT_DIR + "/", ""));
    }
  }
  collectFiles(OUTPUT_DIR);
  console.log(`\nFiles saved to: ${OUTPUT_DIR}`);
  console.log(`Total files: ${allFiles.length}`);
  console.log(allFiles.map(f => `  ${f}`).join("\n"));
  console.log("\n=== DONE ===");
}

main().catch(e => { console.error("[ERROR]", e); process.exit(1); });
