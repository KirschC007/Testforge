import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runOutputExecutionSuite, summarizeOutputExecutionResults } from "../server/analyzer/evals/output-execution";

const asJson = process.argv.includes("--json");
const generatedAt = new Date().toISOString();
const results = runOutputExecutionSuite();
const summary = summarizeOutputExecutionResults(results);
const reportDir = path.resolve(process.cwd(), "artifacts", "quality");
const reportJsonPath = path.join(reportDir, "output-execution.json");

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, JSON.stringify({ generatedAt, summary, results }, null, 2));

if (asJson) {
  console.log(JSON.stringify({ generatedAt, summary, results, reportJsonPath }, null, 2));
} else {
  console.log("TestForge Output Execution Readiness");
  console.log("====================================");
  console.log(`Suites: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
  console.log(`Specs: ${summary.totalSpecs} | Security specs: ${summary.totalSecuritySpecs}`);
  console.log(`Artifact: ${reportJsonPath}`);
  for (const result of results) {
    console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
    console.log(`  Checked files: ${result.checkedFiles} | Specs: ${result.playwrightSpecs} | Security specs: ${result.securitySpecs}`);
    if (result.failures.length > 0) {
      console.log(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
}

if (summary.failed > 0) {
  process.exitCode = 1;
}
