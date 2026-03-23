/**
 * TestForge Pipeline — Shared Types
 * 
 * Single source of truth for all interfaces used across the pipeline.
 * Every module imports from here, never defines its own domain types.
 */

// ─── Spec IR (Intermediate Representation) ────────────────────────────────────

export interface StructuredSideEffect {
  field: string;
  operation: "set" | "set_if" | "increment" | "decrement" | "delete" | "create";
  value?: string;
  description: string;
}

export interface Behavior {
  id: string;
  title: string;
  subject: string;
  action: string;
  object: string;
  preconditions: string[];
  postconditions: string[];
  errorCases: string[];
  tags: string[];
  riskHints: string[];
  chapter?: string;
  specAnchor?: string;
  errorCodes?: string[];                       // Exact error codes e.g. ["INSUFFICIENT_BALANCE"]
  structuredSideEffects?: StructuredSideEffect[]; // Parsed postconditions for side-effect tests
}

export interface EndpointField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object" | "enum";
  required: boolean;
  min?: number;
  max?: number;
  enumValues?: string[];
  arrayItemType?: "number" | "object";
  arrayItemFields?: EndpointField[];
  isTenantKey?: boolean;
  isBoundaryField?: boolean;
  validDefault?: string;
}

export interface APIEndpoint {
  name: string;
  method: string;
  auth: string;
  relatedBehaviors: string[];
  inputFields: EndpointField[];
  outputFields?: string[];
}

export interface AuthRole {
  name: string;
  envUserVar: string;
  envPassVar: string;
  defaultUser: string;
  defaultPass: string;
}

export interface AuthModel {
  loginEndpoint: string;
  csrfEndpoint?: string;
  csrfPattern?: string;
  roles: AuthRole[];
}

export interface Invariant {
  id: string;
  description: string;
  alwaysTrue: string;
  violationConsequence: string;
}

export interface Ambiguity {
  behaviorId: string;
  problem: string;
  question: string;
  impact: "blocks_test" | "reduces_confidence";
}

export interface Contradiction {
  ids: string[];
  description: string;
}

export interface ServiceDep {
  from: string;
  to: string;
  via: string;
  critical: boolean;
}

export interface UserFlow {
  id: string;
  name: string;
  actor: string;
  steps: string[];
  successCriteria: string[];
  errorScenarios: string[];
  relatedEndpoints: string[];
}

export interface DataModel {
  name: string;
  fields: Array<{ name: string; type: string; required: boolean; unique?: boolean; pii?: boolean }>;
  relations: Array<{ to: string; type: "one-to-one" | "one-to-many" | "many-to-many" }>;
  hasPII: boolean;
}

export interface AnalysisIR {
  behaviors: Behavior[];
  invariants: Invariant[];
  ambiguities: Ambiguity[];
  contradictions: Contradiction[];
  tenantModel: { tenantEntity: string; tenantIdField: string } | null;
  resources: Array<{ name: string; table: string; tenantKey: string; operations: string[]; hasPII: boolean }>;
  apiEndpoints: APIEndpoint[];
  authModel: AuthModel | null;
  enums: Record<string, string[]>;
  statusMachine: {
    states: string[];
    transitions: [string, string][];
    forbidden: [string, string][];
    initialState?: string;
    terminalStates?: string[];
  } | null;
  services?: Array<{ name: string; description: string; techStack?: string; dependencies: ServiceDep[] }>;
  userFlows?: UserFlow[];
  dataModels?: DataModel[];
  cronJobs?: CronJobDef[];
  featureGates?: FeatureGate[];
  flows?: FlowDefinition[];
}

// ─── Spec Health ──────────────────────────────────────────────────────────────

export interface SpecHealthDimension {
  name: string;
  label: string;
  passed: boolean;
  score: number;
  maxScore: number;
  tip: string;
  detail?: string;
}

export interface SpecHealth {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: SpecHealthDimension[];
  summary: string;
}

// ─── Analysis Result ──────────────────────────────────────────────────────────

export interface AnalysisResult {
  ir: AnalysisIR;
  qualityScore: number;
  specType: string;
  specHealth?: SpecHealth;
}

// ─── LLM Checker ──────────────────────────────────────────────────────────────

export type CheckVerdict = "approved" | "flagged" | "rejected";

export interface CheckResult {
  behaviorId: string;
  verdict: CheckVerdict;
  confidence: number;
  issues: string[];
  attempts: number;
  anchorFound: boolean;
  improvedBehavior?: Behavior;
}

// ─── Risk Model ───────────────────────────────────────────────────────────────

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type ProofType = "idor" | "csrf" | "rate_limit" | "business_logic" | "dsgvo" | "status_transition" | "boundary" | "risk_scoring" | "spec_drift" | "concurrency" | "idempotency" | "auth_matrix" | "flow" | "cron_job" | "webhook" | "feature_gate" | "e2e_flow";

export interface ScoredBehavior {
  behavior: Behavior;
  riskLevel: RiskLevel;
  proofTypes: ProofType[];
  priority: 0 | 1 | 2;
  rationale: string;
}

export interface ProofAssertion {
  type: "http_status" | "db_state" | "field_value" | "field_absent";
  target: string;
  operator: "eq" | "gt" | "lt" | "in" | "not_contains" | "matches" | "not_null" | "lte";
  value: unknown;
  rationale: string;
}

export interface FieldConstraint {
  field: string;
  type: "string" | "number" | "date" | "array" | "enum";
  min?: number;
  max?: number;
  pattern?: string;
  enumValues?: string[];
  required?: boolean;
}

export interface ProofTarget {
  id: string;
  behaviorId: string;
  proofType: ProofType;
  riskLevel: RiskLevel;
  description: string;
  preconditions: string[];
  assertions: ProofAssertion[];
  mutationTargets: Array<{ description: string; expectedKill: boolean }>;
  endpoint?: string;
  sideEffects?: string[];
  checkVerdict?: CheckVerdict;
  checkConfidence?: number;
  constraints?: FieldConstraint[];
  transitionIndex?: number;
  resolvedPayload?: Record<string, unknown>;
  structuredSideEffects?: StructuredSideEffect[]; // Passed through from Behavior
  errorCodes?: string[];                          // Exact error codes for assertion generation
}

export interface RiskModel {
  behaviors: ScoredBehavior[];
  proofTargets: ProofTarget[];
  idorVectors: number;
  csrfEndpoints: number;
}

// ─── Proofs ───────────────────────────────────────────────────────────────────

export interface RawProof {
  id: string;
  behaviorId: string;
  proofType: ProofType;
  riskLevel: RiskLevel;
  filename: string;
  code: string;
  mutationTargets: Array<{ description: string; expectedKill: boolean }>;
}

export interface ValidatedProof extends RawProof {
  mutationScore: number;
  validationNotes: string[];
}

export interface DiscardedProof {
  rawProof: RawProof;
  reason: string;
  details: string;
}

export interface ValidatedProofSuite {
  proofs: ValidatedProof[];
  discardedProofs: DiscardedProof[];
  verdict: { passed: number; failed: number; score: number; summary: string };
  coverage: { totalBehaviors: number; coveredBehaviors: number; coveragePercent: number; uncoveredIds: string[] };
}

// ─── Helpers & Output ─────────────────────────────────────────────────────────

export interface GeneratedHelpers {
  "helpers/api.ts": string;
  "helpers/auth.ts": string;
  "helpers/factories.ts": string;
  "helpers/reset.ts": string;
  "helpers/schemas.ts": string;
  "helpers/index.ts": string;
  "helpers/browser.ts": string;
  "playwright.config.ts": string;
  "package.json": string;
  ".github/workflows/testforge.yml": string;
  "tsconfig.json": string;
  "README.md": string;
  ".env.example": string;
  "validate-payloads.mjs": string;
}

// ─── Flow / CronJob / FeatureGate ────────────────────────────────────────────

export interface FlowStep {
  action: "mutation" | "query" | "wait" | "cron_trigger";
  endpoint?: string;
  payload?: Record<string, unknown>;
  expectedStatus?: number;
  dbChecks?: Array<{ endpoint: string; field: string; expected: string }>;
  description: string;
}

export interface FlowDefinition {
  id: string;
  name: string;
  behaviors: string[];
  steps: FlowStep[];
  invariants: string[];
}

export interface CronJobDef {
  name: string;
  frequency: string;
  triggerEndpoint?: string;
  preconditions: string[];
  expectedChanges: StructuredSideEffect[];
  raceConditionProtection?: string;
}

export interface FeatureGate {
  feature: string;
  requiredPlan: string;
  gatedEndpoints: string[];
  errorCode: string;
}

// ─── Extended Suite ───────────────────────────────────────────────────────────

export interface ExtendedTestFile {
  filename: string;
  content: string;
  layer: "unit" | "integration" | "e2e" | "uat" | "security" | "performance";
  description: string;
}

export interface ExtendedTestSuite {
  files: ExtendedTestFile[];
  configs: Record<string, string>;
  packageJson: string;
  readme: string;
}

// ─── Job Result ───────────────────────────────────────────────────────────────

export interface AnalysisJobResult {
  analysisResult: AnalysisResult;
  riskModel: RiskModel;
  validatedSuite: ValidatedProofSuite;
  report: string;
  testFiles: Array<{ filename: string; content: string }>;
  helpers: GeneratedHelpers;
  llmCheckerStats: { approved: number; flagged: number; rejected: number; avgConfidence: number };
  extendedSuite: ExtendedTestSuite;
}

// ─── Pipeline Callback ────────────────────────────────────────────────────────

export type ProgressCallback = (layer: number, message: string, data?: {
  analysisResult?: AnalysisResult;
  riskModel?: RiskModel;
  proofCount?: number;
}) => Promise<void>;

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  notes: string[];
  reason?: string;
  details?: string;
}

// ─── Browser Flow ────────────────────────────────────────────────────────────

export interface BrowserFlowStep {
  action: "navigate" | "fill" | "select" | "click" | "verify_text" | "verify_url" | "verify_api" | "wait" | "login";
  target?: string;       // URL, selector, button name
  field?: string;        // field name for fill/select
  value?: string;        // value to fill/select
  expected?: string;     // expected text/url/api value
  endpoint?: string;     // for verify_api
  timeout?: number;      // ms, default 10000
}

// ─── Boundary ─────────────────────────────────────────────────────────────────

export interface BoundaryCase {
  label: string;
  value: string;
  valid: boolean;
}
