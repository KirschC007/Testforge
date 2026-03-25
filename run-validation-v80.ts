import * as fs from "fs";
import * as path from "path";
import { runAnalysisJob } from "./server/analyzer/job-runner";

const SCENARIOS = [
  { name: "KitaManager", specFile: "kita-spec.md", outputDir: "/home/ubuntu/testforge-validation-kitamanager-tests" },
  { name: "PetClinic", specFile: "petclinic-spec.md", outputDir: "/home/ubuntu/testforge-validation-petclinic-tests" },
  { name: "CoworkSpace", specFile: "cowork-spec.md", outputDir: "/home/ubuntu/testforge-validation-coworkspace-tests" },
  { name: "ResearchLab", specFile: "research-spec.md", outputDir: "/home/ubuntu/testforge-validation-researchlab-tests" },
  { name: "LogisticsHub", specFile: "logistics-spec.md", outputDir: "/home/ubuntu/testforge-validation-logisticshub-tests" },
];

async function runScenario(scenario: typeof SCENARIOS[0]) {
  const specPath = path.join("/home/ubuntu/testforge", scenario.specFile);
  if (!fs.existsSync(specPath)) {
    console.log(`[SKIP] ${scenario.name}: spec file not found at ${specPath}`);
    return;
  }
  const specText = fs.readFileSync(specPath, "utf-8");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== SZENARIO: ${scenario.name} ===`);
  console.log(`Spec size: ${specText.length} bytes`);
  console.log("=".repeat(60));

  const t0 = Date.now();
  const result = await runAnalysisJob(specText, scenario.name);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const parser = specText.length >= 8192 ? "Smart (> 8KB)" : "Standard (< 8KB)";
  const behaviors = result.analysisResult.ir.behaviors.length;
  const endpoints = result.analysisResult.ir.apiEndpoints.length;
  const endpointNames = result.analysisResult.ir.apiEndpoints.map(e => e.name).sort().join(", ");
  const tenantKey = result.analysisResult.ir.tenantModel?.tenantIdField || "—";
  const roles = result.analysisResult.ir.authModel?.roles?.map((r: { name: string }) => r.name).join(", ") || "—";
  const states = result.analysisResult.ir.statusMachine?.states?.map((s: { name?: string } | string) =>
    typeof s === "string" ? s : s.name || ""
  ).filter(Boolean).join(", ") || "—";
  const proofs = result.validatedSuite.proofs.length;
  const extFiles = result.extendedSuite.files.length;
  const e2eFiles = result.extendedSuite.files.filter((f: { layer?: string }) => f.layer === "e2e").length;
  const llm = result.llmCheckerStats;

  console.log(`Parser: ${parser}`);
  console.log(`Elapsed: ${elapsed}s`);
  console.log(`Behaviors: ${behaviors}`);
  console.log(`Endpoints: ${endpoints} (${endpointNames})`);
  console.log(`TenantKey: ${tenantKey}`);
  console.log(`Rollen: ${result.analysisResult.ir.authModel?.roles?.length || 0} (${roles})`);
  console.log(`States: ${result.analysisResult.ir.statusMachine?.states?.length || 0} (${states})`);
  console.log(`Proofs: ${proofs} raw`);
  console.log(`Extended files: ${extFiles} (E2E: ${e2eFiles})`);
  console.log(`LLM Checker: ${llm.approved} approved / ${llm.flagged} flagged / ${llm.rejected} rejected`);

  // Save test files
  fs.mkdirSync(scenario.outputDir, { recursive: true });
  // Clear old files
  for (const f of fs.readdirSync(scenario.outputDir)) {
    fs.unlinkSync(path.join(scenario.outputDir, f));
  }

  // Save core test files
  for (const tf of result.testFiles) {
    const safeName = tf.filename.replace(/\//g, "__");
    fs.writeFileSync(path.join(scenario.outputDir, safeName), tf.content);
  }
  // Save extended suite files
  for (const ef of result.extendedSuite.files) {
    const safeName = ef.filename.replace(/\//g, "__");
    const dest = path.join(scenario.outputDir, safeName);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, ef.content);
    }
  }
  // Save HTML report
  fs.writeFileSync(path.join(scenario.outputDir, "testforge-report.html"), result.htmlReport);
  // Save markdown report
  fs.writeFileSync(path.join(scenario.outputDir, "testforge-report.md"), result.report);

  console.log(`Files saved to: ${scenario.outputDir}`);
  console.log(`HTML report: ${scenario.outputDir}/testforge-report.html`);
}

(async () => {
  for (const scenario of SCENARIOS) {
    try {
      await runScenario(scenario);
    } catch (e) {
      console.error(`[ERROR] ${scenario.name}:`, e);
    }
  }
  console.log("\n=== ALL SCENARIOS DONE ===");
})();
