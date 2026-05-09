import { runFalsePositiveEval, summarizeFalsePositiveEval } from "../server/analyzer/evals/false-positive-eval";

const asJson = process.argv.includes("--json");
const results = runFalsePositiveEval();
const summary = summarizeFalsePositiveEval(results);

if (asJson) {
  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
  process.exit();
}

console.log("TestForge False Positive Eval");
console.log("=============================");
console.log(`Safe fixtures: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
console.log(`False positive hits: ${summary.falsePositiveHits}`);
console.log("");

for (const result of results) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
  if (result.forbiddenHits.length > 0) {
    console.log(`  Forbidden hits: ${result.forbiddenHits.join(", ")}`);
  }
}

if (summary.failed > 0) {
  process.exitCode = 1;
}
