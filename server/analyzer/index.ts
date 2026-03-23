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

// ─── Validator ────────────────────────────────────────────────────────────────
export { validateProofs, runIndependentChecker, mergeProofsToFile } from "./validator";

// ─── Report ───────────────────────────────────────────────────────────────────
export { generateReport } from "./report";

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
