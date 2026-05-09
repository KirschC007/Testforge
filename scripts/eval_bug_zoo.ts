import { runBugZooEval, summarizeBugZoo } from "../server/analyzer/evals/bug-zoo-eval";

const results = runBugZooEval();
const summary = summarizeBugZoo(results);
const asJson = process.argv.includes("--json");

if (asJson) {
  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
  process.exit();
}

console.log("TestForge Bug Zoo Evaluation");
console.log("============================");
for (const result of results) {
  console.log(`\n[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
  console.log(`  Static Rules: ${result.staticRules.join(", ") || "-"}`);
  console.log(`  Proof Types: ${result.proofTypes.join(", ") || "-"}`);
  console.log(`  Coverage: static ${result.staticCoveragePercent}% | proofs ${result.proofCoveragePercent}%`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

console.log(`\nSummary: ${summary.passed}/${summary.total} passed (${summary.passRate}%)`);
console.log(`Average coverage: static ${summary.averageStaticCoverage}% | proofs ${summary.averageProofCoverage}%`);
console.log(`Signal quality: recall ${summary.recallProxy}% | precision ${summary.precisionProxy}% | hallucinations ${summary.hallucinations}`);
console.log(`Total expectation failures: ${summary.totalFailures}`);

if (summary.failed > 0) {
  process.exitCode = 1;
}
