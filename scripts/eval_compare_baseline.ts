import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import baseline from "../server/analyzer/evals/quality-baseline.json";
import { buildEvalScoreboard } from "../server/analyzer/evals/scoreboard";
import { compareScoreboards } from "../server/analyzer/evals/scoreboard-compare";
import { renderScoreboardComparisonMarkdown } from "../server/analyzer/evals/scoreboard-compare-report";
import { QUALITY_THRESHOLDS } from "../server/analyzer/evals/quality-thresholds";

function getTopProofRisks() {
  return [
    ...comparison.bugZooProofTypeDeltas.map((entry) => ({ scope: "bug-zoo", ...entry })),
    ...comparison.externalRepoProofTypeDeltas.map((entry) => ({ scope: "external", ...entry })),
  ]
    .sort((a, b) => {
      const aWorst = Math.min(a.recall.delta, a.precision.delta);
      const bWorst = Math.min(b.recall.delta, b.precision.delta);
      if (aWorst !== bWorst) return aWorst - bWorst;
      return a.proofType.localeCompare(b.proofType);
    })
    .slice(0, 5);
}

const asJson = process.argv.includes("--json");
const current = await buildEvalScoreboard();
const comparison = compareScoreboards(current, baseline, QUALITY_THRESHOLDS);
const generatedAt = new Date().toISOString();
const reportDir = path.resolve(process.cwd(), "artifacts", "quality");
const historyDir = path.join(reportDir, "history");
const compareJsonPath = path.join(reportDir, "scoreboard-compare.json");
const compareMdPath = path.join(reportDir, "scoreboard-compare.md");
const latestHistoryPath = path.join(historyDir, "latest.json");
const stampedHistoryPath = path.join(historyDir, `${generatedAt.replace(/[:.]/g, "-")}.json`);

mkdirSync(reportDir, { recursive: true });
mkdirSync(historyDir, { recursive: true });
writeFileSync(compareJsonPath, JSON.stringify({ generatedAt, baselineLabel: baseline.label, comparison }, null, 2));
writeFileSync(compareMdPath, renderScoreboardComparisonMarkdown(comparison, generatedAt, baseline.label));
writeFileSync(latestHistoryPath, JSON.stringify({ generatedAt, scoreboard: current }, null, 2));
writeFileSync(stampedHistoryPath, JSON.stringify({ generatedAt, scoreboard: current }, null, 2));

if (asJson) {
  console.log(JSON.stringify({
    generatedAt,
    baselineLabel: baseline.label,
    comparison,
    compareJsonPath,
    compareMdPath,
    latestHistoryPath,
    stampedHistoryPath,
  }, null, 2));
  if (!comparison.passed) {
    process.exitCode = 1;
  }
  process.exit();
}

console.log("TestForge Quality Baseline Compare");
console.log("==================================");
console.log(`Baseline: ${baseline.label}`);
console.log(comparison.summary);
console.log(`Artifacts: ${compareJsonPath} | ${compareMdPath}`);
console.log(`History: ${latestHistoryPath} | ${stampedHistoryPath}`);
console.log("Top proof risks:");
for (const proofType of getTopProofRisks()) {
  const regressed = proofType.regressed ? " | REGRESSED" : "";
  console.log(`- ${proofType.scope}:${proofType.proofType} | recall ${proofType.recall.current} (delta ${proofType.recall.delta}) | precision ${proofType.precision.current} (delta ${proofType.precision.delta})${regressed}`);
}
if (comparison.regressions.length > 0) {
  console.log("Regressions:");
  for (const regression of comparison.regressions) {
    console.log(`- ${regression}`);
  }
}

if (!comparison.passed) {
  process.exitCode = 1;
}
