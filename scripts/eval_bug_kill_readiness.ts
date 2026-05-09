import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBugKillReadinessEval, summarizeBugKillReadiness } from "../server/analyzer/evals/bug-kill-readiness";

const asJson = process.argv.includes("--json");
const generatedAt = new Date().toISOString();
const results = await runBugKillReadinessEval();
const summary = summarizeBugKillReadiness(results);
const reportDir = path.resolve(process.cwd(), "artifacts", "quality");
const reportJsonPath = path.join(reportDir, "bug-kill-readiness.json");

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, JSON.stringify({ generatedAt, summary, results }, null, 2));

if (asJson) {
  console.log(JSON.stringify({ generatedAt, summary, results, reportJsonPath }, null, 2));
} else {
  console.log("TestForge Bug-Kill Readiness");
  console.log("============================");
  console.log(`Fixtures: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
  console.log(`Expected proof types: ${summary.totalExpectedProofTypes} | Missing: ${summary.missingProofTypes}`);
  console.log(`Validated proofs: ${summary.totalValidatedProofs} | Kill-comment proofs: ${summary.totalKillCommentProofs}`);
  console.log(`Average mutation score: ${summary.averageMutationScore}`);
  console.log(`Artifact: ${reportJsonPath}`);
  for (const result of results) {
    console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
    console.log(`  Expected: ${result.expectedProofTypes.join(", ") || "-"} | Validated: ${result.validatedProofTypes.join(", ") || "-"}`);
    if (result.failures.length > 0) {
      console.log(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
}

if (summary.failed > 0) {
  process.exitCode = 1;
}
