import { runExternalRepoBenchmarkSuite, summarizeExternalRepoBenchmarks } from "../server/analyzer/evals/external-repo-benchmarks";

const asJson = process.argv.includes("--json");
const results = runExternalRepoBenchmarkSuite();
const summary = summarizeExternalRepoBenchmarks(results);

if (asJson) {
  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
  process.exit();
}

console.log("TestForge External Repo Benchmarks");
console.log("==================================");
console.log(`External repos: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
console.log("");

for (const result of results) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
  console.log(`  Repo: ${result.owner}/${result.repo}@${result.branch}`);
  console.log(`  Tier: ${result.tier} | Evidence: ${result.evidenceLevel} | Gold readiness: ${result.goldReadinessScore}`);
  console.log(`  Proof planning: ${result.proofPlanningMode}`);
  console.log(`  Notes: ${result.notes}`);
  console.log(`  Proof types: ${result.proofTypes.join(", ") || "-"}`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

if (summary.failed > 0) {
  process.exitCode = 1;
}
