import type { EvalScoreboard } from "./scoreboard";

function getTopProofSignals(scoreboard: EvalScoreboard) {
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

function renderBenchmarkLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## Benchmarks"];
  for (const result of scoreboard.benchmarkResults) {
    lines.push(`- ${result.name}: ${result.passed ? "PASS" : "FAIL"} | tier=${result.tier} | evidence=${result.evidenceLevel} | readiness=${result.goldReadinessScore} | mode=${result.proofPlanningMode}`);
    if (result.failures.length > 0) {
      lines.push(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
  return lines;
}

function renderWorldClassLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## World-Class Phase Proofs"];
  lines.push(`- Golden benchmarks: ${scoreboard.goldenBenchmarks.passed}/${scoreboard.goldenBenchmarks.total} (${scoreboard.goldenBenchmarks.passRate}%)`);
  lines.push(`- Generated suite quality: ${scoreboard.generatedSuiteQuality.passed}/${scoreboard.generatedSuiteQuality.total} (${scoreboard.generatedSuiteQuality.passRate}%)`);
  lines.push(`- Sales-proof demo: ${scoreboard.salesProofDemo.passed}/${scoreboard.salesProofDemo.total} (${scoreboard.salesProofDemo.passRate}%) | phases=${scoreboard.salesProofDemoResult.phasesProved}/${scoreboard.salesProofDemoResult.totalPhases} | readiness=${scoreboard.salesProofDemoResult.readiness}`);
  for (const result of scoreboard.goldenBenchmarkResults) {
    lines.push(`- golden:${result.name}: ${result.passed ? "PASS" : "FAIL"} | adapter=${result.adapter} | expected=${result.expectedAdapter} | confidence=${result.confidence}`);
    if (result.failures.length > 0) lines.push(`  Failures: ${result.failures.join(" | ")}`);
  }
  for (const result of scoreboard.generatedSuiteQualityResults) {
    lines.push(`- generated-suite:${result.name}: ${result.passed ? "PASS" : "FAIL"} | readiness=${result.readiness}`);
    if (result.failures.length > 0) lines.push(`  Failures: ${result.failures.join(" | ")}`);
  }
  if (scoreboard.salesProofDemoResult.failures.length > 0) {
    lines.push(`- sales-proof-demo failures: ${scoreboard.salesProofDemoResult.failures.join(" | ")}`);
  }
  return lines;
}

function renderFalsePositiveLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## False Positive Suite"];
  for (const result of scoreboard.falsePositiveResults) {
    lines.push(`- ${result.name}: ${result.passed ? "PASS" : "FAIL"}`);
    if (result.forbiddenHits.length > 0) {
      lines.push(`  Forbidden hits: ${result.forbiddenHits.join(" | ")}`);
    }
  }
  return lines;
}

function renderExternalRepoLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## External Repo Benchmarks"];
  for (const result of scoreboard.externalRepoResults) {
    lines.push(`- ${result.name}: ${result.passed ? "PASS" : "FAIL"} | repo=${result.owner}/${result.repo}@${result.branch} | tier=${result.tier} | evidence=${result.evidenceLevel} | readiness=${result.goldReadinessScore} | mode=${result.proofPlanningMode}`);
    if (result.failures.length > 0) {
      lines.push(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
  return lines;
}

function renderExternalRepoProofLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## External Repo Proof Types"];
  for (const proofType of scoreboard.externalRepoProofTypes) {
    lines.push(`- ${proofType.proofType}: ${proofType.reposMatched}/${proofType.reposExpecting} | recall ${proofType.recallProxy}% | precision ${proofType.precisionProxy}% | forbidden hits ${proofType.forbiddenHits}`);
  }
  return lines;
}

function renderExternalPromotionCoverage(scoreboard: EvalScoreboard): string[] {
  return [
    "## External Promotion Coverage",
    `- Coverage: ${scoreboard.externalPromotionCoverage.promotedContracts}/${scoreboard.externalPromotionCoverage.totalContracts} (${scoreboard.externalPromotionCoverage.coverageRate}%)`,
    `- Uncovered contracts: ${scoreboard.externalPromotionCoverage.uncoveredContracts}`,
    `- Promoted contracts: ${scoreboard.externalPromotionCoverage.promotedNames.join(", ") || "-"}`,
    `- Remaining uncovered: ${scoreboard.externalPromotionCoverage.uncoveredNames.join(", ") || "-"}`,
  ];
}

function renderSnapshotLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## Output Snapshots"];
  for (const result of scoreboard.outputSnapshotResults) {
    lines.push(`- ${result.name}: ${result.passed ? "PASS" : "FAIL"} | files=${result.discoveredFiles}`);
    if (result.failures.length > 0) {
      lines.push(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
  return lines;
}

function renderOutputExecutionLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## Output Execution Readiness"];
  lines.push(`- Summary: ${scoreboard.outputExecution.passed}/${scoreboard.outputExecution.total} (${scoreboard.outputExecution.passRate}%) | specs=${scoreboard.outputExecution.totalSpecs} | security specs=${scoreboard.outputExecution.totalSecuritySpecs}`);
  for (const result of scoreboard.outputExecutionResults) {
    lines.push(`- ${result.name}: ${result.passed ? "PASS" : "FAIL"} | checked=${result.checkedFiles} | specs=${result.playwrightSpecs} | security=${result.securitySpecs}`);
    if (result.failures.length > 0) {
      lines.push(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
  return lines;
}

function renderBugKillReadinessLines(scoreboard: EvalScoreboard): string[] {
  const lines: string[] = ["## Bug-Kill Readiness"];
  lines.push(`- Summary: ${scoreboard.bugKillReadiness.passed}/${scoreboard.bugKillReadiness.total} (${scoreboard.bugKillReadiness.passRate}%) | expected proof types=${scoreboard.bugKillReadiness.totalExpectedProofTypes} | missing=${scoreboard.bugKillReadiness.missingProofTypes} | mutation=${scoreboard.bugKillReadiness.averageMutationScore}%`);
  lines.push(`- Validated proofs: ${scoreboard.bugKillReadiness.totalValidatedProofs} | kill-comment proofs=${scoreboard.bugKillReadiness.totalKillCommentProofs}`);
  for (const result of scoreboard.bugKillReadinessResults) {
    lines.push(`- ${result.name}: ${result.passed ? "PASS" : "FAIL"} | expected=${result.expectedProofTypes.join(", ") || "-"} | validated=${result.validatedProofTypes.join(", ") || "-"} | mutation=${result.averageMutationScore}%`);
    if (result.failures.length > 0) {
      lines.push(`  Failures: ${result.failures.join(" | ")}`);
    }
  }
  return lines;
}

export function renderEvalScoreboardMarkdown(scoreboard: EvalScoreboard, generatedAt: string): string {
  const topProofSignals = getTopProofSignals(scoreboard);
  const lines: string[] = [
    "# TestForge Quality Report",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## Overall",
    `- Suites: ${scoreboard.overall.passedSuites}/${scoreboard.overall.totalSuites} (${scoreboard.overall.suitePassRate}%)`,
    `- Bug Zoo: ${scoreboard.bugZoo.passed}/${scoreboard.bugZoo.total} (${scoreboard.bugZoo.passRate}%)`,
    `- False positives: ${scoreboard.falsePositives.passed}/${scoreboard.falsePositives.total} (${scoreboard.falsePositives.passRate}%)`,
    `- Benchmarks: ${scoreboard.benchmarks.passed}/${scoreboard.benchmarks.total} (${scoreboard.benchmarks.passRate}%)`,
    `- Golden benchmarks: ${scoreboard.goldenBenchmarks.passed}/${scoreboard.goldenBenchmarks.total} (${scoreboard.goldenBenchmarks.passRate}%)`,
    `- Generated suite quality: ${scoreboard.generatedSuiteQuality.passed}/${scoreboard.generatedSuiteQuality.total} (${scoreboard.generatedSuiteQuality.passRate}%)`,
    `- Sales-proof demo: ${scoreboard.salesProofDemo.passed}/${scoreboard.salesProofDemo.total} (${scoreboard.salesProofDemo.passRate}%)`,
    `- External repos: ${scoreboard.externalRepos.passed}/${scoreboard.externalRepos.total} (${scoreboard.externalRepos.passRate}%)`,
    `- External promotion coverage: ${scoreboard.externalPromotionCoverage.promotedContracts}/${scoreboard.externalPromotionCoverage.totalContracts} (${scoreboard.externalPromotionCoverage.coverageRate}%)`,
    `- Output snapshots: ${scoreboard.outputSnapshots.passed}/${scoreboard.outputSnapshots.total} (${scoreboard.outputSnapshots.passRate}%)`,
    `- Output execution readiness: ${scoreboard.outputExecution.passed}/${scoreboard.outputExecution.total} (${scoreboard.outputExecution.passRate}%)`,
    `- Bug-kill readiness: ${scoreboard.bugKillReadiness.passed}/${scoreboard.bugKillReadiness.total} (${scoreboard.bugKillReadiness.passRate}%) | mutation ${scoreboard.bugKillReadiness.averageMutationScore}%`,
    "",
    "## Bug Zoo Signal Quality",
    `- Expected signals: ${scoreboard.bugZoo.expectedSignals}`,
    `- Matched signals: ${scoreboard.bugZoo.matchedSignals}`,
    `- Recall proxy: ${scoreboard.bugZoo.recallProxy}%`,
    `- Precision proxy: ${scoreboard.bugZoo.precisionProxy}%`,
    `- Hallucinations: ${scoreboard.bugZoo.hallucinations}`,
    `- Safe-suite forbidden hits: ${scoreboard.falsePositives.falsePositiveHits}`,
    "",
    "## Top Proof Signals",
  ];

  for (const proofType of topProofSignals) {
    lines.push(`- ${proofType.scope}:${proofType.proofType} | ${proofType.matched}/${proofType.expected} | recall ${proofType.recallProxy}% | precision ${proofType.precisionProxy}% | forbidden hits ${proofType.forbiddenHits}`);
  }

  lines.push(
    "",
    "## Bug Categories",
  );

  for (const category of scoreboard.bugZooCategories) {
    lines.push(`- ${category.category}: ${category.passed}/${category.total} | recall ${category.recallProxy}% | precision ${category.precisionProxy}% | hallucinations ${category.hallucinations}`);
  }

  lines.push("", "## Proof Types");

  for (const proofType of scoreboard.bugZooProofTypes) {
    lines.push(`- ${proofType.proofType}: ${proofType.fixturesMatched}/${proofType.fixturesExpecting} | recall ${proofType.recallProxy}% | precision ${proofType.precisionProxy}% | forbidden hits ${proofType.forbiddenHits}`);
  }

  lines.push(
    "",
    ...renderFalsePositiveLines(scoreboard),
    "",
    ...renderBenchmarkLines(scoreboard),
    "",
    ...renderWorldClassLines(scoreboard),
    "",
    ...renderExternalRepoLines(scoreboard),
    "",
    ...renderExternalRepoProofLines(scoreboard),
    "",
    ...renderExternalPromotionCoverage(scoreboard),
    "",
    ...renderSnapshotLines(scoreboard),
    "",
    ...renderOutputExecutionLines(scoreboard),
    "",
    ...renderBugKillReadinessLines(scoreboard),
    ""
  );
  return lines.join("\n");
}
