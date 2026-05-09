import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildEvalScoreboard } from "../server/analyzer/evals/scoreboard";
import { renderEvalScoreboardMarkdown } from "../server/analyzer/evals/scoreboard-report";

function getTopProofSignals() {
  return [
    ...scoreboard.bugZooProofTypes.map((entry) => ({ scope: "bug-zoo", matched: entry.fixturesMatched, expected: entry.fixturesExpecting, ...entry })),
    ...scoreboard.externalRepoProofTypes.map((entry) => ({ scope: "external", matched: entry.reposMatched, expected: entry.reposExpecting, ...entry })),
  ]
    .sort((a, b) => {
      if (a.forbiddenHits !== b.forbiddenHits) return b.forbiddenHits - a.forbiddenHits;
      const aWorst = Math.min(a.recallProxy, a.precisionProxy);
      const bWorst = Math.min(b.recallProxy, b.precisionProxy);
      if (aWorst !== bWorst) return aWorst - bWorst;
      return a.proofType.localeCompare(b.proofType);
    })
    .slice(0, 8);
}

const asJson = process.argv.includes("--json");
const scoreboard = await buildEvalScoreboard();
const generatedAt = new Date().toISOString();
const reportDir = path.resolve(process.cwd(), "artifacts", "quality");
const reportJsonPath = path.join(reportDir, "scoreboard.json");
const reportMdPath = path.join(reportDir, "scoreboard.md");

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, JSON.stringify({ generatedAt, scoreboard }, null, 2));
writeFileSync(reportMdPath, renderEvalScoreboardMarkdown(scoreboard, generatedAt));

if (asJson) {
  console.log(JSON.stringify({ generatedAt, scoreboard, reportJsonPath, reportMdPath }, null, 2));
  if (scoreboard.overall.failedSuites > 0) {
    process.exitCode = 1;
  }
  process.exit();
}

console.log("TestForge Eval Scoreboard");
console.log("=========================");
console.log(`Bug Zoo: ${scoreboard.bugZoo.passed}/${scoreboard.bugZoo.total} (${scoreboard.bugZoo.passRate}%)`);
console.log(`  Recall proxy: ${scoreboard.bugZoo.recallProxy}% | Precision proxy: ${scoreboard.bugZoo.precisionProxy}% | Hallucinations: ${scoreboard.bugZoo.hallucinations}`);
console.log(`False positives: ${scoreboard.falsePositives.passed}/${scoreboard.falsePositives.total} (${scoreboard.falsePositives.passRate}%)`);
console.log(`  Forbidden hits: ${scoreboard.falsePositives.falsePositiveHits}`);
console.log(`Benchmarks: ${scoreboard.benchmarks.passed}/${scoreboard.benchmarks.total} (${scoreboard.benchmarks.passRate}%)`);
console.log(`Golden benchmarks: ${scoreboard.goldenBenchmarks.passed}/${scoreboard.goldenBenchmarks.total} (${scoreboard.goldenBenchmarks.passRate}%)`);
console.log(`Generated suite quality: ${scoreboard.generatedSuiteQuality.passed}/${scoreboard.generatedSuiteQuality.total} (${scoreboard.generatedSuiteQuality.passRate}%)`);
console.log(`Sales-proof demo: ${scoreboard.salesProofDemo.passed}/${scoreboard.salesProofDemo.total} (${scoreboard.salesProofDemo.passRate}%) | phases ${scoreboard.salesProofDemoResult.phasesProved}/${scoreboard.salesProofDemoResult.totalPhases} | readiness ${scoreboard.salesProofDemoResult.readiness}`);
console.log(`External repos: ${scoreboard.externalRepos.passed}/${scoreboard.externalRepos.total} (${scoreboard.externalRepos.passRate}%)`);
console.log(`External promotion coverage: ${scoreboard.externalPromotionCoverage.promotedContracts}/${scoreboard.externalPromotionCoverage.totalContracts} (${scoreboard.externalPromotionCoverage.coverageRate}%)`);
console.log(`Output snapshots: ${scoreboard.outputSnapshots.passed}/${scoreboard.outputSnapshots.total} (${scoreboard.outputSnapshots.passRate}%)`);
console.log(`Output execution: ${scoreboard.outputExecution.passed}/${scoreboard.outputExecution.total} (${scoreboard.outputExecution.passRate}%) | specs ${scoreboard.outputExecution.totalSpecs} | security ${scoreboard.outputExecution.totalSecuritySpecs}`);
console.log(`Bug-kill readiness: ${scoreboard.bugKillReadiness.passed}/${scoreboard.bugKillReadiness.total} (${scoreboard.bugKillReadiness.passRate}%) | mutation ${scoreboard.bugKillReadiness.averageMutationScore}%`);
console.log(`Suites: ${scoreboard.overall.passedSuites}/${scoreboard.overall.totalSuites} (${scoreboard.overall.suitePassRate}%)`);
console.log(`Artifacts: ${reportJsonPath} | ${reportMdPath}`);
console.log("");
console.log("Top proof signals:");
for (const proofType of getTopProofSignals()) {
  console.log(`  - ${proofType.scope}:${proofType.proofType} | ${proofType.matched}/${proofType.expected} | recall ${proofType.recallProxy}% | precision ${proofType.precisionProxy}% | forbidden hits ${proofType.forbiddenHits}`);
}
console.log("");
console.log("Bug categories:");
for (const category of scoreboard.bugZooCategories) {
  console.log(`  - ${category.category}: ${category.passed}/${category.total} | recall ${category.recallProxy}% | precision ${category.precisionProxy}% | hallucinations ${category.hallucinations}`);
}
console.log("");
console.log("Proof types:");
for (const proofType of scoreboard.bugZooProofTypes) {
  console.log(`  - ${proofType.proofType}: ${proofType.fixturesMatched}/${proofType.fixturesExpecting} | recall ${proofType.recallProxy}% | precision ${proofType.precisionProxy}% | forbidden hits ${proofType.forbiddenHits}`);
}
console.log("");
for (const result of scoreboard.falsePositiveResults) {
  if (result.passed) continue;
  console.log(`[FAIL] false-positive ${result.name}`);
  console.log(`  Forbidden hits: ${result.forbiddenHits.join(", ")}`);
}

console.log("");
for (const result of scoreboard.benchmarkResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
  console.log(`  Tier: ${result.tier} | Evidence: ${result.evidenceLevel} | Gold readiness: ${result.goldReadinessScore}`);
  console.log(`  Proof planning: ${result.proofPlanningMode}`);
  console.log(`  Proof types: ${result.proofTypes.join(", ") || "-"}`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

console.log("");
for (const result of scoreboard.goldenBenchmarkResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] golden ${result.name}`);
  console.log(`  Adapter: ${result.adapter} | Expected: ${result.expectedAdapter} | Confidence: ${result.confidence}/${result.minConfidence}`);
  if (result.failures.length > 0) console.log(`  Failures: ${result.failures.join(" | ")}`);
}

console.log("");
for (const result of scoreboard.generatedSuiteQualityResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] generated-suite ${result.name}`);
  console.log(`  Readiness: ${result.readiness}`);
  if (result.failures.length > 0) console.log(`  Failures: ${result.failures.join(" | ")}`);
}

console.log("");
console.log(`[${scoreboard.salesProofDemoResult.passed ? "PASS" : "FAIL"}] sales-proof-demo`);
console.log(`  Phases: ${scoreboard.salesProofDemoResult.phasesProved}/${scoreboard.salesProofDemoResult.totalPhases}`);
console.log(`  Readiness: ${scoreboard.salesProofDemoResult.readiness}`);
console.log(`  Proof types: ${scoreboard.salesProofDemoResult.proofTypes.join(", ") || "-"}`);
if (scoreboard.salesProofDemoResult.failures.length > 0) console.log(`  Failures: ${scoreboard.salesProofDemoResult.failures.join(" | ")}`);

console.log("");
for (const result of scoreboard.externalRepoResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] external ${result.name}`);
  console.log(`  Repo: ${result.owner}/${result.repo}@${result.branch}`);
  console.log(`  Tier: ${result.tier} | Evidence: ${result.evidenceLevel} | Gold readiness: ${result.goldReadinessScore}`);
  console.log(`  Proof planning: ${result.proofPlanningMode}`);
  console.log(`  Notes: ${result.notes}`);
  console.log(`  Proof types: ${result.proofTypes.join(", ") || "-"}`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

console.log("");
console.log("External repo proof types:");
for (const proofType of scoreboard.externalRepoProofTypes) {
  console.log(`  - ${proofType.proofType}: ${proofType.reposMatched}/${proofType.reposExpecting} | recall ${proofType.recallProxy}% | precision ${proofType.precisionProxy}% | forbidden hits ${proofType.forbiddenHits}`);
}

console.log("");
for (const result of scoreboard.outputSnapshotResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] snapshot ${result.name}`);
  console.log(`  Files discovered: ${result.discoveredFiles}`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

console.log("");
for (const result of scoreboard.outputExecutionResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] output execution ${result.name}`);
  console.log(`  Checked files: ${result.checkedFiles} | Specs: ${result.playwrightSpecs} | Security specs: ${result.securitySpecs}`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

console.log("");
for (const result of scoreboard.bugKillReadinessResults) {
  console.log(`[${result.passed ? "PASS" : "FAIL"}] bug-kill ${result.name}`);
  console.log(`  Expected: ${result.expectedProofTypes.join(", ") || "-"} | Validated: ${result.validatedProofTypes.join(", ") || "-"} | Mutation: ${result.averageMutationScore}%`);
  if (result.failures.length > 0) {
    console.log(`  Failures: ${result.failures.join(" | ")}`);
  }
}

if (scoreboard.overall.failedSuites > 0) {
  process.exitCode = 1;
}
