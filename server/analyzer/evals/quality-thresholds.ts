export interface QualityThresholds {
  maxSuitePassRateDrop: number;
  maxBugZooRecallDrop: number;
  maxBugZooPrecisionDrop: number;
  maxFalsePositivePassRateDrop: number;
  maxBenchmarkPassRateDrop: number;
  maxExternalRepoPassRateDrop: number;
  maxOutputSnapshotPassRateDrop: number;
  maxOutputExecutionPassRateDrop: number;
  maxBugKillReadinessPassRateDrop: number;
  maxBugKillMutationScoreDrop: number;
  maxCategoryRecallDrop: number;
  maxCategoryPrecisionDrop: number;
  maxProofTypeRecallDrop: number;
  maxProofTypePrecisionDrop: number;
  maxExternalProofTypeRecallDrop: number;
  maxExternalProofTypePrecisionDrop: number;
}

export const QUALITY_THRESHOLDS: QualityThresholds = {
  maxSuitePassRateDrop: 0,
  maxBugZooRecallDrop: 0,
  maxBugZooPrecisionDrop: 0,
  maxFalsePositivePassRateDrop: 0,
  maxBenchmarkPassRateDrop: 0,
  maxExternalRepoPassRateDrop: 0,
  maxOutputSnapshotPassRateDrop: 0,
  maxOutputExecutionPassRateDrop: 0,
  maxBugKillReadinessPassRateDrop: 0,
  maxBugKillMutationScoreDrop: 0,
  maxCategoryRecallDrop: 0,
  maxCategoryPrecisionDrop: 0,
  maxProofTypeRecallDrop: 0,
  maxProofTypePrecisionDrop: 0,
  maxExternalProofTypeRecallDrop: 0,
  maxExternalProofTypePrecisionDrop: 0,
};
