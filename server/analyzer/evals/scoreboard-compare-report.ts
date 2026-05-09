import type { ScoreboardComparison } from "./scoreboard-compare";
import { renderScoreDelta } from "./scoreboard-compare";

function getTopProofRisks(comparison: ScoreboardComparison) {
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

export function renderScoreboardComparisonMarkdown(comparison: ScoreboardComparison, generatedAt: string, baselineLabel: string): string {
  const topProofRisks = getTopProofRisks(comparison);
  const lines: string[] = [
    "# TestForge Quality Delta Report",
    "",
    `Generated at: ${generatedAt}`,
    `Baseline: ${baselineLabel}`,
    "",
    `Summary: ${comparison.summary}`,
    "",
    "## Core Metrics",
    `- Overall suites: ${renderScoreDelta(comparison.overallSuitePassRate)}`,
    `- Bug Zoo recall: ${renderScoreDelta(comparison.bugZooRecall)}`,
    `- Bug Zoo precision: ${renderScoreDelta(comparison.bugZooPrecision)}`,
    `- False positive pass rate: ${renderScoreDelta(comparison.falsePositivePassRate)}`,
    `- Benchmark pass rate: ${renderScoreDelta(comparison.benchmarkPassRate)}`,
    `- External repo pass rate: ${renderScoreDelta(comparison.externalRepoPassRate)}`,
    `- Output snapshot pass rate: ${renderScoreDelta(comparison.outputSnapshotPassRate)}`,
    `- Output execution pass rate: ${renderScoreDelta(comparison.outputExecutionPassRate)}`,
    `- Bug-kill readiness pass rate: ${renderScoreDelta(comparison.bugKillReadinessPassRate)}`,
    `- Bug-kill mutation score: ${renderScoreDelta(comparison.bugKillMutationScore)}`,
    "",
    "## Top Proof Risks",
  ];

  for (const proofType of topProofRisks) {
    lines.push(`- ${proofType.scope}:${proofType.proofType} | recall ${renderScoreDelta(proofType.recall)} | precision ${renderScoreDelta(proofType.precision)}${proofType.regressed ? " | REGRESSED" : ""}`);
  }

  lines.push(
    "",
    "## Category Deltas",
  );

  for (const category of comparison.categoryDeltas) {
    lines.push(`- ${category.category}: recall ${renderScoreDelta(category.recall)} | precision ${renderScoreDelta(category.precision)}${category.regressed ? " | REGRESSED" : ""}`);
  }

  lines.push("", "## Bug Zoo Proof Type Deltas");
  for (const proofType of comparison.bugZooProofTypeDeltas) {
    lines.push(`- ${proofType.proofType}: recall ${renderScoreDelta(proofType.recall)} | precision ${renderScoreDelta(proofType.precision)}${proofType.regressed ? " | REGRESSED" : ""}`);
  }

  lines.push("", "## External Repo Proof Type Deltas");
  for (const proofType of comparison.externalRepoProofTypeDeltas) {
    lines.push(`- ${proofType.proofType}: recall ${renderScoreDelta(proofType.recall)} | precision ${renderScoreDelta(proofType.precision)}${proofType.regressed ? " | REGRESSED" : ""}`);
  }

  lines.push("", "## Regressions");
  if (comparison.regressions.length === 0) {
    lines.push("- None");
  } else {
    for (const regression of comparison.regressions) {
      lines.push(`- ${regression}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
