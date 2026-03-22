/**
 * TestForge Analyzer v3.0 — Weltklasse Spec-zu-Test-Maschine
 *
 * Schicht 1: LLM Spec Parser (alle Chunks parallel, kein Limit)
 * LLM Checker: Spec-Anker-Verifikation + Cross-Validation + Improvement Loop
 * Schicht 2: Risk Model Builder (Endpoints + AuthModel aus Spec)
 * Helpers Generator: api.ts + auth.ts + factories.ts + reset.ts + index.ts
 * Schicht 3: Proof Generator (alle parallel, 7 Templates, kein Limit)
 * Schicht 4: False-Green Validator (7 Guardrails, R1-R7)
 * Schicht 5: Independent Checker (Adversarial Review + Rework Loop)
 * GitHub Action: automatisch in ZIP eingebettet
 */

// ─── Types ────────────────────────────────────────────────────────────────────

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
  specAnchor?: string; // Exact quote from spec for anchor verification
}

export interface EndpointField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object" | "enum";
  required: boolean;
  min?: number;           // For number: minimum value; for string/array: minimum length
  max?: number;           // For number: maximum value; for string/array: maximum length
  enumValues?: string[];  // For type: "enum"
  arrayItemType?: "number" | "object"; // For type: "array"
  arrayItemFields?: EndpointField[]; // For nested array items
  isTenantKey?: boolean;  // true if this field is the tenant ID
  isBoundaryField?: boolean; // true if this field has boundary validation
  validDefault?: string;  // TypeScript expression for a valid default value
}

export interface APIEndpoint {
  name: string;           // e.g. "reservations.updateStatus"
  method: string;         // e.g. "POST /api/trpc/reservations.updateStatus"
  auth: string;           // e.g. "requireRestaurantAuth"
  relatedBehaviors: string[]; // behavior IDs
  inputFields: EndpointField[]; // fully typed input fields
  outputFields?: string[]; // known output fields
}

export interface AuthRole {
  name: string;           // e.g. "restaurant_admin"
  envUserVar: string;     // e.g. "E2E_ADMIN_USER"
  envPassVar: string;     // e.g. "E2E_ADMIN_PASS"
  defaultUser: string;
  defaultPass: string;
}

export interface AuthModel {
  loginEndpoint: string;
  csrfEndpoint?: string;
  csrfPattern?: string;   // e.g. "double-submit-cookie"
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
  from: string;   // service name
  to: string;     // service name
  via: string;    // e.g. "HTTP", "gRPC", "queue", "DB"
  critical: boolean;
}

export interface UserFlow {
  id: string;
  name: string;       // e.g. "User Registration", "Checkout"
  actor: string;      // e.g. "anonymous user", "admin"
  steps: string[];    // ordered list of actions
  successCriteria: string[];
  errorScenarios: string[];
  relatedEndpoints: string[];
}

export interface DataModel {
  name: string;       // e.g. "User", "Order"
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
  // Extended for full system specs
  services?: Array<{ name: string; description: string; techStack?: string; dependencies: ServiceDep[] }>;
  userFlows?: UserFlow[];
  dataModels?: DataModel[];
}

export interface SpecHealthDimension {
  name: string;
  label: string;
  passed: boolean;
  score: number;       // 0-100 contribution
  maxScore: number;    // max possible contribution
  tip: string;         // actionable improvement hint
  detail?: string;     // optional detail (e.g. "3/5 endpoints typed")
}

export interface SpecHealth {
  score: number;       // 0-100 weighted total
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: SpecHealthDimension[];
  summary: string;     // one-line human-readable summary
}

export interface AnalysisResult {
  ir: AnalysisIR;
  qualityScore: number;
  specType: string;
  specHealth?: SpecHealth;
}

// LLM Checker types
export type CheckVerdict = "approved" | "flagged" | "rejected";

export interface CheckResult {
  behaviorId: string;
  verdict: CheckVerdict;
  confidence: number; // 0.0–1.0
  issues: string[];
  attempts: number;
  anchorFound: boolean;
  improvedBehavior?: Behavior;
}

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type ProofType = "idor" | "csrf" | "rate_limit" | "business_logic" | "dsgvo" | "status_transition" | "boundary" | "risk_scoring" | "spec_drift" | "concurrency" | "idempotency" | "auth_matrix";

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
  field: string;          // e.g. "title"
  type: "string" | "number" | "date" | "array" | "enum";
  min?: number;           // min length (string/array) or min value (number/date)
  max?: number;           // max length (string/array) or max value (number/date)
  pattern?: string;       // regex pattern for string fields
  enumValues?: string[];  // allowed values for enum fields
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
  endpoint?: string;       // Resolved from apiEndpoints
  sideEffects?: string[];  // Postconditions that are DB side-effects
  checkVerdict?: CheckVerdict;
  checkConfidence?: number;
  constraints?: FieldConstraint[];  // Boundary constraints extracted from spec
  transitionIndex?: number;          // For status_transition: which transition from statusMachine to use
  resolvedPayload?: Record<string, unknown>; // Pre-built valid payload for LLM hint
}

export interface RiskModel {
  behaviors: ScoredBehavior[];
  proofTargets: ProofTarget[];
  idorVectors: number;
  csrfEndpoints: number;
}

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

export interface GeneratedHelpers {
  "helpers/api.ts": string;
  "helpers/auth.ts": string;
  "helpers/factories.ts": string;
  "helpers/reset.ts": string;
  "helpers/schemas.ts": string;
  "helpers/index.ts": string;
  "playwright.config.ts": string;
  "package.json": string;
  ".github/workflows/testforge.yml": string;
  "tsconfig.json": string;
  "README.md": string;
  ".env.example": string;
  "validate-payloads.mjs": string;
}

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

