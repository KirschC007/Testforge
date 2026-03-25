import * as fs from "fs";
import * as path from "path";
import { runAnalysisJob } from "./server/analyzer/job-runner";
import type { CodeFile } from "./server/analyzer/code-parser";

const OUTPUT_DIR = "/home/ubuntu/testforge-validation-meditrack-tests";

async function main() {
  const specText = fs.readFileSync("/home/ubuntu/testforge/meditrack-spec.md", "utf-8");
  const codeText = fs.readFileSync("/home/ubuntu/testforge/meditrack-code.ts", "utf-8");

  const codeFiles: CodeFile[] = [
    { path: "meditrack-code.ts", content: codeText }
  ];

  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== SZENARIO: MediTrack (Hybrid-Modus) ===`);
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
  const statesArr = ir.statusMachine?.states?.map((s: { name?: string } | string) =>
    typeof s === "string" ? s : s.name || ""
  ).filter(Boolean) || [];
  const states = statesArr.join(", ") || "—";
  const proofs = result.validatedSuite.proofs.length;
  const extFiles = result.extendedSuite.files.length;
  const e2eFiles = result.extendedSuite.files.filter((f: { layer?: string }) => f.layer === "e2e").length;
  const llm = result.llmCheckerStats;

  const parser = specText.length >= 8192 ? "Smart (> 8KB)" : "Standard (< 8KB)";
  console.log(`Parser: ${parser} + Code-Parser (Hybrid)`);
  console.log(`Elapsed: ${elapsed}s`);
  console.log(`Behaviors: ${behaviors}`);
  console.log(`Endpoints: ${endpoints} (${endpointNames})`);
  console.log(`TenantKey: ${tenantKey}`);
  console.log(`Rollen: ${ir.authModel?.roles?.length || 0} (${roles})`);
  console.log(`States: ${statesArr.length} (${states})`);
  console.log(`Proofs: ${proofs} raw`);
  console.log(`Extended files: ${extFiles} (E2E: ${e2eFiles})`);
  console.log(`LLM Checker: ${llm.approved} approved / ${llm.flagged} flagged / ${llm.rejected} rejected`);

  // Save test files
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }
  for (const tf of result.testFiles) {
    const safeName = tf.filename.replace(/\//g, "__");
    fs.writeFileSync(path.join(OUTPUT_DIR, safeName), tf.content);
  }
  for (const ef of result.extendedSuite.files) {
    const safeName = ef.filename.replace(/\//g, "__");
    const dest = path.join(OUTPUT_DIR, safeName);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, ef.content);
    }
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, "testforge-report.html"), result.htmlReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, "testforge-report.md"), result.report);

  console.log(`\nFiles saved to: ${OUTPUT_DIR}`);
  console.log(`HTML report: ${OUTPUT_DIR}/testforge-report.html`);
  console.log("\n=== DONE ===");
}

main().catch(e => { console.error("[ERROR]", e); process.exit(1); });
