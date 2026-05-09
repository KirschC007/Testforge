/**
 * server/analyzer/index.ts
 *
 * Re-exports all public API from the analyzer sub-modules.
 * This is the single public surface — all consumers import from "./analyzer"
 * (or "../analyzer") as before, with no change to import paths.
 */

// ─── Types & Interfaces ───────────────────────────────────────────────────────
export type {
  Behavior,
  EndpointField,
  APIEndpoint,
  AuthRole,
  AuthModel,
  Invariant,
  Ambiguity,
  Contradiction,
  ServiceDep,
  UserFlow,
  DataModel,
  AnalysisIR,
  SpecHealthDimension,
  SpecHealth,
  AnalysisResult,
  CheckVerdict,
  CheckResult,
  RiskLevel,
  ProofType,
  ScoredBehavior,
  ProofAssertion,
  FieldConstraint,
  ProofTarget,
  RiskModel,
  RawProof,
  ValidatedProof,
  DiscardedProof,
  ValidatedProofSuite,
  GeneratedHelpers,
  ExtendedTestFile,
  ExtendedTestSuite,
  AnalysisJobResult,
  StructuredSideEffect,
  FlowStep,
  FlowDefinition,
  CronJobDef,
  FeatureGate,
  SupportedScopeAssessment,
  EvidenceLevel,
  EvidenceSignal,
  ExecutionProfile,
} from "./types";

// ─── LLM Parser ───────────────────────────────────────────────────────────────
export { parseSpec, withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";

// ─── Smart Parser (3-Pass for large specs) ────────────────────────────────────
export { parseSpecSmart } from "./smart-parser";

// ─── Risk Model ───────────────────────────────────────────────────────────────
export {
  runLLMChecker,
  assessSpecHealth,
  assessSpecHealthFromResult,
  buildRiskModel,
  determineProofTypes,
  extractConstraints,
  buildProofTarget,
} from "./risk-model";

// ─── Helpers Generator ────────────────────────────────────────────────────────
export { generateHelpers } from "./helpers-generator";

// ─── Proof Generator ─────────────────────────────────────────────────────────
export type { BoundaryCase } from "./proof-generator";
export {
  calcBoundaryValues,
  buildArrayItemLiteral,
  findBoundaryFieldForBehavior,
  getValidDefault,
  generateBusinessLogicTest,
  generateConcurrencyTest,
  generateIdempotencyTest,
  generateAuthMatrixTest,
  generateFlowTest,
  generateCronJobTest,
  generateWebhookTest,
  generateFeatureGateTest,
  generateProofs,
} from "./proof-generator";
export { getProofGenerationProfile } from "./proof-planning";

// ─── Validator ────────────────────────────────────────────────────────────────
export { validateProofs, runIndependentChecker, mergeProofsToFile } from "./validator";

// ─── Report ───────────────────────────────────────────────────────────────────
export { generateReport } from "./report";
export { buildExecutionProfile } from "./execution-profile";
export { runEvalCase, summarizeEvalResults } from "./eval-harness";
export { buildEvalScoreboard } from "./evals/scoreboard";
export { renderEvalScoreboardMarkdown } from "./evals/scoreboard-report";
export { compareScoreboards, renderScoreDelta } from "./evals/scoreboard-compare";
export { renderScoreboardComparisonMarkdown } from "./evals/scoreboard-compare-report";
export {
  runExternalRepoBenchmarkSuite,
  runExternalRepoBenchmarkSuiteLive,
  summarizeExternalRepoBenchmarks,
  summarizeExternalRepoBenchmarksByProofType,
  resolveExternalRepoBenchmarkCase,
} from "./evals/external-repo-benchmarks";
export {
  buildLiveRepoHarvest,
  buildLiveRepoFixtureBacklog,
  renderLiveRepoHarvestMarkdown,
  renderLiveRepoFixtureBacklogMarkdown,
} from "./evals/live-repo-harvest";
export { runBugZooEval, summarizeBugZoo, summarizeBugZooByCategory, summarizeBugZooByProofType } from "./evals/bug-zoo-eval";
export { runBugKillReadinessEval, summarizeBugKillReadiness } from "./evals/bug-kill-readiness";
export { runFalsePositiveEval, summarizeFalsePositiveEval } from "./evals/false-positive-eval";
export { runOutputExecutionSuite, summarizeOutputExecutionResults } from "./evals/output-execution";
export { classifyStackAdapter } from "./stack-adapters";
export { evaluateGeneratedSuiteQuality } from "./generated-suite-gate";
export { runGoldenBenchmarkSuite, summarizeGoldenBenchmarkResults } from "./evals/golden-benchmark-cases";
export { runGeneratedSuiteQualitySuite, summarizeGeneratedSuiteQuality } from "./evals/generated-suite-quality";
export { runSalesProofDemo } from "./evals/sales-proof-demo";

// ─── Supported Scope ──────────────────────────────────────────────────────────
export { assessSupportedScopeForCodebase, assessSupportedScopeForSpec } from "./supported-scope";

// ─── Job Runner ───────────────────────────────────────────────────────────────
export type { ProgressCallback } from "./job-runner";
export { runAnalysisJob } from "./job-runner";

// // ─── Extended Test Suite ──────────────────────────────────────────────────
export { generateExtendedTestSuite } from "./extended-suite";

// ─── Code Parser ────────────────────────────────────────────────────────────────────
export type { CodeFile, CodeParseResult } from "./code-parser";
export { parseCodeToIR, detectFramework } from "./code-parser";

// ─── Repo Scanner ─────────────────────────────────────────────────────────────────
export { fetchRepoCodeFiles } from "./repo-scanner";
