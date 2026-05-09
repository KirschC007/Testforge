import type { EvalScoreboard } from "./scoreboard";
import type { QualityThresholds } from "./quality-thresholds";

export interface QualityBaseline {
  label: string;
  scoreboard: Pick<EvalScoreboard, "bugZoo" | "bugZooCategories" | "bugZooProofTypes" | "falsePositives" | "benchmarks" | "externalRepos" | "externalRepoProofTypes" | "outputSnapshots" | "overall">
    & Partial<Pick<EvalScoreboard, "outputExecution" | "bugKillReadiness">>;
}

export interface ScoreDelta {
  current: number;
  baseline: number;
  delta: number;
}

export interface CategoryDelta {
  category: string;
  recall: ScoreDelta;
  precision: ScoreDelta;
  regressed: boolean;
}

export interface ProofTypeDelta {
  proofType: string;
  recall: ScoreDelta;
  precision: ScoreDelta;
  regressed: boolean;
}

export interface ScoreboardComparison {
  passed: boolean;
  summary: string;
  overallSuitePassRate: ScoreDelta;
  bugZooRecall: ScoreDelta;
  bugZooPrecision: ScoreDelta;
  falsePositivePassRate: ScoreDelta;
  benchmarkPassRate: ScoreDelta;
  externalRepoPassRate: ScoreDelta;
  outputSnapshotPassRate: ScoreDelta;
  outputExecutionPassRate: ScoreDelta;
  bugKillReadinessPassRate: ScoreDelta;
  bugKillMutationScore: ScoreDelta;
  categoryDeltas: CategoryDelta[];
  bugZooProofTypeDeltas: ProofTypeDelta[];
  externalRepoProofTypeDeltas: ProofTypeDelta[];
  regressions: string[];
}

function delta(current: number, baseline: number): ScoreDelta {
  return { current, baseline, delta: current - baseline };
}

export function compareScoreboards(
  current: EvalScoreboard,
  baseline: QualityBaseline,
  thresholds: QualityThresholds
): ScoreboardComparison {
  const regressions: string[] = [];
  const overallSuitePassRate = delta(current.overall.suitePassRate, baseline.scoreboard.overall.suitePassRate);
  const bugZooRecall = delta(current.bugZoo.recallProxy, baseline.scoreboard.bugZoo.recallProxy);
  const bugZooPrecision = delta(current.bugZoo.precisionProxy, baseline.scoreboard.bugZoo.precisionProxy);
  const falsePositivePassRate = delta(current.falsePositives.passRate, baseline.scoreboard.falsePositives.passRate);
  const benchmarkPassRate = delta(current.benchmarks.passRate, baseline.scoreboard.benchmarks.passRate);
  const externalRepoPassRate = delta(current.externalRepos.passRate, baseline.scoreboard.externalRepos.passRate);
  const outputSnapshotPassRate = delta(current.outputSnapshots.passRate, baseline.scoreboard.outputSnapshots.passRate);
  const outputExecutionPassRate = delta(current.outputExecution.passRate, baseline.scoreboard.outputExecution?.passRate ?? current.outputExecution.passRate);
  const bugKillReadinessPassRate = delta(current.bugKillReadiness.passRate, baseline.scoreboard.bugKillReadiness?.passRate ?? current.bugKillReadiness.passRate);
  const bugKillMutationScore = delta(current.bugKillReadiness.averageMutationScore, baseline.scoreboard.bugKillReadiness?.averageMutationScore ?? current.bugKillReadiness.averageMutationScore);

  if (overallSuitePassRate.delta < -thresholds.maxSuitePassRateDrop) {
    regressions.push(`Overall suite pass rate regressed by ${Math.abs(overallSuitePassRate.delta)} points`);
  }
  if (bugZooRecall.delta < -thresholds.maxBugZooRecallDrop) {
    regressions.push(`Bug Zoo recall regressed by ${Math.abs(bugZooRecall.delta)} points`);
  }
  if (bugZooPrecision.delta < -thresholds.maxBugZooPrecisionDrop) {
    regressions.push(`Bug Zoo precision regressed by ${Math.abs(bugZooPrecision.delta)} points`);
  }
  if (falsePositivePassRate.delta < -thresholds.maxFalsePositivePassRateDrop) {
    regressions.push(`False positive suite pass rate regressed by ${Math.abs(falsePositivePassRate.delta)} points`);
  }
  if (benchmarkPassRate.delta < -thresholds.maxBenchmarkPassRateDrop) {
    regressions.push(`Benchmark pass rate regressed by ${Math.abs(benchmarkPassRate.delta)} points`);
  }
  if (externalRepoPassRate.delta < -thresholds.maxExternalRepoPassRateDrop) {
    regressions.push(`External repo pass rate regressed by ${Math.abs(externalRepoPassRate.delta)} points`);
  }
  if (outputSnapshotPassRate.delta < -thresholds.maxOutputSnapshotPassRateDrop) {
    regressions.push(`Output snapshot pass rate regressed by ${Math.abs(outputSnapshotPassRate.delta)} points`);
  }
  if (outputExecutionPassRate.delta < -thresholds.maxOutputExecutionPassRateDrop) {
    regressions.push(`Output execution pass rate regressed by ${Math.abs(outputExecutionPassRate.delta)} points`);
  }
  if (bugKillReadinessPassRate.delta < -thresholds.maxBugKillReadinessPassRateDrop) {
    regressions.push(`Bug-kill readiness pass rate regressed by ${Math.abs(bugKillReadinessPassRate.delta)} points`);
  }
  if (bugKillMutationScore.delta < -thresholds.maxBugKillMutationScoreDrop) {
    regressions.push(`Bug-kill mutation score regressed by ${Math.abs(bugKillMutationScore.delta)} points`);
  }

  const categoryDeltas: CategoryDelta[] = current.bugZooCategories.map((category) => {
    const baselineCategory = baseline.scoreboard.bugZooCategories.find((entry) => entry.category === category.category);
    const recall = delta(category.recallProxy, baselineCategory?.recallProxy ?? category.recallProxy);
    const precision = delta(category.precisionProxy, baselineCategory?.precisionProxy ?? category.precisionProxy);
    const regressed = recall.delta < -thresholds.maxCategoryRecallDrop || precision.delta < -thresholds.maxCategoryPrecisionDrop;
    if (regressed) {
      regressions.push(`Category ${category.category} regressed (recall ${recall.delta}, precision ${precision.delta})`);
    }
    return {
      category: category.category,
      recall,
      precision,
      regressed,
    };
  });

  const bugZooProofTypeDeltas: ProofTypeDelta[] = current.bugZooProofTypes.map((proofType) => {
    const baselineProofType = baseline.scoreboard.bugZooProofTypes.find((entry) => entry.proofType === proofType.proofType);
    const recall = delta(proofType.recallProxy, baselineProofType?.recallProxy ?? proofType.recallProxy);
    const precision = delta(proofType.precisionProxy, baselineProofType?.precisionProxy ?? proofType.precisionProxy);
    const regressed = recall.delta < -thresholds.maxProofTypeRecallDrop || precision.delta < -thresholds.maxProofTypePrecisionDrop;
    if (regressed) {
      regressions.push(`Bug-zoo proof type ${proofType.proofType} regressed (recall ${recall.delta}, precision ${precision.delta})`);
    }
    return {
      proofType: proofType.proofType,
      recall,
      precision,
      regressed,
    };
  });

  const externalRepoProofTypeDeltas: ProofTypeDelta[] = current.externalRepoProofTypes.map((proofType) => {
    const baselineProofType = baseline.scoreboard.externalRepoProofTypes.find((entry) => entry.proofType === proofType.proofType);
    const recall = delta(proofType.recallProxy, baselineProofType?.recallProxy ?? proofType.recallProxy);
    const precision = delta(proofType.precisionProxy, baselineProofType?.precisionProxy ?? proofType.precisionProxy);
    const regressed = recall.delta < -thresholds.maxExternalProofTypeRecallDrop || precision.delta < -thresholds.maxExternalProofTypePrecisionDrop;
    if (regressed) {
      regressions.push(`External proof type ${proofType.proofType} regressed (recall ${recall.delta}, precision ${precision.delta})`);
    }
    return {
      proofType: proofType.proofType,
      recall,
      precision,
      regressed,
    };
  });

  return {
    passed: regressions.length === 0,
    summary: regressions.length === 0
      ? `Quality baseline held against ${baseline.label}.`
      : `${regressions.length} regression(s) detected against ${baseline.label}.`,
    overallSuitePassRate,
    bugZooRecall,
    bugZooPrecision,
    falsePositivePassRate,
    benchmarkPassRate,
    externalRepoPassRate,
    outputSnapshotPassRate,
    outputExecutionPassRate,
    bugKillReadinessPassRate,
    bugKillMutationScore,
    categoryDeltas,
    bugZooProofTypeDeltas,
    externalRepoProofTypeDeltas,
    regressions,
  };
}

export function renderScoreDelta(deltaValue: ScoreDelta): string {
  const sign = deltaValue.delta > 0 ? "+" : "";
  return `${deltaValue.current} (baseline ${deltaValue.baseline}, delta ${sign}${deltaValue.delta})`;
}
