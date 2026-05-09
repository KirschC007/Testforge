import type { AnalysisResult, ExecutionProfile, RiskModel, ValidatedProofSuite } from "./types";

export function buildExecutionProfile(
  analysis: AnalysisResult,
  riskModel: RiskModel,
  suite: ValidatedProofSuite
): ExecutionProfile {
  const scope = analysis.supportedScope;
  const discardRatio = suite.verdict.passed + suite.verdict.failed > 0
    ? suite.verdict.failed / (suite.verdict.passed + suite.verdict.failed)
    : 0;

  const compileReadinessScore = Math.max(
    20,
    Math.min(
      98,
      Math.round(
        (scope?.confidenceScore ?? 40) * 0.45 +
        (scope?.goldReadinessScore ?? 30) * 0.35 +
        (100 - discardRatio * 100) * 0.2
      )
    )
  );

  const runtimeReadinessScore = Math.max(
    15,
    Math.min(
      96,
      Math.round(
        suite.coverage.coveragePercent * 0.45 +
        suite.verdict.score * 10 * 0.35 +
        (scope?.confidenceScore ?? 40) * 0.2
      )
    )
  );

  const sandboxReadinessScore = Math.max(
    20,
    Math.min(
      95,
      Math.round(
        (scope?.tier === "gold" ? 95 : scope?.tier === "supported" ? 70 : 40) * 0.6 +
        (riskModel.proofPlanning?.mode === "gold" ? 95 : riskModel.proofPlanning?.mode === "conservative" ? 72 : 45) * 0.4
      )
    )
  );

  const mode: ExecutionProfile["mode"] =
    compileReadinessScore >= 85 && runtimeReadinessScore >= 80 ? "verified"
      : compileReadinessScore >= 60 && runtimeReadinessScore >= 55 ? "conservative"
      : "minimal";

  const strengths: string[] = [];
  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (compileReadinessScore >= 80) strengths.push("Generated tests are structurally likely to compile cleanly.");
  if (runtimeReadinessScore >= 75) strengths.push("Validated proof set has enough signal for meaningful runtime execution.");
  if ((riskModel.proofPlanning?.skippedTargetCount ?? 0) === 0) strengths.push("No aggressive proof targets had to be dropped for this stack.");

  if (compileReadinessScore < 80) blockers.push("Compile readiness is below the verified band; generated tests may need repair on first run.");
  if (runtimeReadinessScore < 70) blockers.push("Runtime readiness is below the verified band; proof execution should be treated as conservative evidence.");
  if ((riskModel.proofPlanning?.skippedTargetCount ?? 0) > 0) blockers.push(`${riskModel.proofPlanning?.skippedTargetCount} aggressive proof targets were skipped before generation.`);
  if (scope?.evidenceLevel === "heuristic") blockers.push("Underlying stack extraction is still heuristic for parts of this analysis.");

  recommendations.push("Push compile readiness with stronger stack signals, deterministic schemas, and fewer mixed frameworks.");
  recommendations.push("Increase runtime readiness by raising validated proof coverage and reducing discarded proofs.");
  recommendations.push("Use Gold-Stack inputs or OpenAPI specs for the highest execution-truth band.");

  const summary =
    mode === "verified"
      ? "Execution truth is in the verified band: compile and runtime readiness are high."
      : mode === "conservative"
        ? "Execution truth is conservative: tests are useful, but not yet strong enough for blind trust."
        : "Execution truth is minimal: generated artifacts should be treated as guided starting points.";

  return {
    mode,
    compileReadinessScore,
    runtimeReadinessScore,
    sandboxReadinessScore,
    summary,
    strengths,
    blockers,
    recommendations,
  };
}
