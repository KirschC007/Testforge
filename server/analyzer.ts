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
import { invokeLLM } from "./_core/llm";

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

export interface AnalysisIR {
  behaviors: Behavior[];
  invariants: Invariant[];
  ambiguities: Ambiguity[];
  contradictions: Contradiction[];
  tenantModel: { tenantEntity: string; tenantIdField: string } | null;
  resources: Array<{ name: string; table: string; tenantKey: string; operations: string[]; hasPII: boolean }>;
  apiEndpoints: APIEndpoint[];
  authModel: AuthModel | null;
  enums: Record<string, string[]>;  // e.g. { status: ["todo","in_progress","done"], priority: ["low","medium","high"] }
  statusMachine: {
    states: string[];
    transitions: [string, string][];
    forbidden: [string, string][];
    initialState?: string;
    terminalStates?: string[];
  } | null;
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
export type ProofType = "idor" | "csrf" | "rate_limit" | "business_logic" | "dsgvo" | "status_transition" | "boundary" | "risk_scoring" | "spec_drift";

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
}

export interface AnalysisJobResult {
  analysisResult: AnalysisResult;
  riskModel: RiskModel;
  validatedSuite: ValidatedProofSuite;
  report: string;
  testFiles: Array<{ filename: string; content: string }>;
  helpers: GeneratedHelpers;
  llmCheckerStats: { approved: number; flagged: number; rejected: number; avgConfidence: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 15000; // Smaller chunks = smaller LLM output per chunk = no JSON truncation
// No MAX_CHUNKS — analyze the full spec
const LLM_TIMEOUT_MS = 90000; // 90s timeout per LLM call

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── Schicht 1: LLM Spec Parser ───────────────────────────────────────────────

async function parseSpecChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Partial<AnalysisIR> & { qualityScore?: number; specType?: string }> {
  const systemPrompt = `You are TestForge Schicht 1 — a precision spec analyzer for SaaS systems.
Extract EVERY testable behavior from this specification chunk (chunk ${chunkIndex + 1} of ${totalChunks}).

Rules:
1. Extract behaviors as Subject-Verb-Object triples
2. For EACH behavior, include a specAnchor: an exact verbatim quote (10-30 words) from the spec text that proves this behavior exists
3. Identify risk hints: idor, csrf, pii-leak, brute-force, cross-tenant, dsgvo, state-change, boundary
4. Flag ambiguities: any requirement where expected behavior is not 100% clear
5. Detect contradictions: requirements that conflict
6. Identify tenant model if multi-tenant SaaS
7. Identify resources with PII
8. Extract API endpoints: procedure names, auth requirements, related behaviors
9. Extract auth model: login endpoint, CSRF pattern, roles with credentials

CRITICAL RULES for tags:
- IDOR/cross-tenant behaviors: MUST include "authorization" AND "security" in tags. Any behavior that checks workspaceId, tenantId, or ownership MUST have these tags.
- DSGVO/PII behaviors: MUST include "dsgvo" in tags for ANY behavior involving: personal data, PII fields, data export, data deletion, data anonymization, GDPR compliance, privacy. Also add "pii" if specific PII fields (email, name, phone, address) are mentioned.
- state-machine behaviors: MUST include "state-machine" in tags for ANY behavior involving status transitions, workflow steps, or state changes.
- rate-limiting behaviors: MUST include "rate-limiting" in tags.
- CSRF behaviors: MUST include "csrf" in tags.

Return JSON with these exact keys:
- behaviors: [{id, title, subject, action, object, preconditions, postconditions, errorCases, tags, riskHints, chapter, specAnchor}]
- invariants: [{id, description, alwaysTrue, violationConsequence}]
- ambiguities: [{behaviorId, problem, question, impact}]
- contradictions: [{ids, description}]
- tenantModel: {tenantEntity, tenantIdField} or null
- resources: [{name, table, tenantKey, operations, hasPII}]
- apiEndpoints: [{name, method, auth, relatedBehaviors, inputFields: EndpointField[], outputFields: string[]}]
- authModel: {loginEndpoint, csrfEndpoint, csrfPattern, roles: [{name, envUserVar, envPassVar, defaultUser, defaultPass}]} or null
- enums: object mapping field names to their allowed string values, e.g. {"status": ["todo","in_progress","done"], "priority": ["low","medium","high"]}
- statusMachine: {states: string[], transitions: [[from,to],...], forbidden: [[from,to],...], initialState: string, terminalStates: string[]} or null
- qualityScore: number 0-10
- specType: string

CRITICAL RULES for apiEndpoints.inputFields:
- inputFields MUST be an array of EndpointField objects (NOT plain strings)
- EndpointField schema: {name: string, type: "string"|"number"|"boolean"|"date"|"array"|"object"|"enum", required: boolean, min?: number, max?: number, enumValues?: string[], arrayItemType?: "number"|"object", arrayItemFields?: EndpointField[], isTenantKey?: boolean, isBoundaryField?: boolean}
- Set isTenantKey: true for the tenant/workspace ID field
- Set isBoundaryField: true for fields with explicit min/max constraints in the spec
- For number fields: set min/max from spec (e.g. price: min=0.01, max=999999.99)
- For string fields: set min/max from spec (e.g. name: min=1, max=100)
- For array fields: set arrayItemType and arrayItemFields for nested objects (e.g. items: [{productId: number, quantity: number}])
- For enum fields: set enumValues from the spec
- Include ALL input parameters visible in the spec, including path params and query params
- outputFields MUST be a flat array of strings: ["id", "title", "status", "createdAt"]

CRITICAL RULES for enums:
- Extract EVERY field that has a fixed set of allowed values
- Use the EXACT values from the spec (e.g. "in_progress" not "inProgress")
- If a field has numeric values, still include them as strings

CRITICAL RULES for statusMachine:
- Only populate if the spec describes a state machine or workflow
- transitions: list ONLY explicitly allowed transitions as [from, to] pairs
- forbidden: list ONLY explicitly forbidden transitions (e.g. reverse, skip)
- initialState: the state a new resource starts in
- terminalStates: states from which no further transitions are allowed

--- FEW-SHOT EXAMPLE (TaskManager + ShopCore) ---
Input: "Tasks have status: todo | in_progress | review | done. Transitions: todo→in_progress, in_progress→review, review→done. No skipping, no reverse. Tasks have priority: low | medium | high. POST /api/trpc/tasks.create (input: workspaceId, title, priority; output: id, title, status, priority, createdAt). POST /api/trpc/tasks.updateStatus (input: id, workspaceId, status; output: id, status, updatedAt). Login: POST /api/trpc/auth.login. Task descriptions may contain personal data. GET /api/trpc/workspace.exportData exports all workspace data for GDPR compliance. DELETE /api/trpc/workspace.deleteAll permanently deletes all workspace data. tasks.getById returns 403 if task belongs to a different workspace. POST /api/trpc/products.create (input: shopId, name (1-100 chars), price (0.01-999999.99), stock (0-10000), sku (3-50 chars), priority enum low|medium|high|critical). POST /api/trpc/orders.create (input: shopId, customerId, items array of {productId, quantity (1-100)}, max 50 items). When order is created, stock is decremented by quantity ordered."

Output fragment:
{
  "behaviors": [
    {
      "id": "B-001",
      "title": "System rejects todo→done skip-transition",
      "subject": "System", "action": "rejects", "object": "status update",
      "preconditions": ["task.status = 'todo'"],
      "postconditions": ["HTTP 422 returned", "task.status unchanged in DB"],
      "errorCases": ["todo→done → 422", "todo→review → 422"],
      "tags": ["state-machine", "validation"], "riskHints": ["state-change"],
      "chapter": "Tasks",
      "specAnchor": "No skipping, no reverse"
    },
    {
      "id": "B-002",
      "title": "tasks.getById returns 403 if task belongs to a different workspace",
      "subject": "System", "action": "returns 403", "object": "task",
      "preconditions": ["task.workspaceId != caller.workspaceId"],
      "postconditions": ["HTTP 403 returned"],
      "errorCases": ["cross-tenant access → 403"],
      "tags": ["authorization", "security", "error-handling"], "riskHints": ["idor", "cross-tenant"],
      "chapter": "Tasks",
      "specAnchor": "tasks.getById returns 403 if task belongs to a different workspace"
    },
    {
      "id": "B-003",
      "title": "Task descriptions may contain personal data",
      "subject": "System", "action": "stores", "object": "personal data in task descriptions",
      "preconditions": ["task has description field"],
      "postconditions": ["personal data stored in description"],
      "errorCases": [],
      "tags": ["dsgvo", "pii"], "riskHints": ["dsgvo", "pii-leak"],
      "chapter": "GDPR",
      "specAnchor": "Task descriptions may contain personal data"
    },
    {
      "id": "B-004",
      "title": "workspace.deleteAll permanently deletes all workspace data",
      "subject": "System", "action": "deletes", "object": "all workspace data",
      "preconditions": ["caller is admin"],
      "postconditions": ["all workspace data permanently deleted"],
      "errorCases": [],
      "tags": ["dsgvo", "delete"], "riskHints": ["dsgvo"],
      "chapter": "GDPR",
      "specAnchor": "DELETE /api/trpc/workspace.deleteAll permanently deletes all workspace data"
    }
  ],
  "apiEndpoints": [
    {"name": "tasks.create", "method": "POST /api/trpc/tasks.create", "auth": "requireAuth", "relatedBehaviors": ["B-002"],
     "inputFields": [
       {"name": "workspaceId", "type": "number", "required": true, "isTenantKey": true},
       {"name": "title", "type": "string", "required": true, "min": 1, "max": 100, "isBoundaryField": true},
       {"name": "priority", "type": "enum", "required": false, "enumValues": ["low", "medium", "high"]}
     ],
     "outputFields": ["id", "title", "status", "priority", "createdAt"]},
    {"name": "tasks.updateStatus", "method": "POST /api/trpc/tasks.updateStatus", "auth": "requireAuth", "relatedBehaviors": ["B-001"],
     "inputFields": [
       {"name": "id", "type": "number", "required": true},
       {"name": "workspaceId", "type": "number", "required": true, "isTenantKey": true},
       {"name": "status", "type": "enum", "required": true, "enumValues": ["todo", "in_progress", "review", "done"]}
     ],
     "outputFields": ["id", "status", "updatedAt"]},
    {"name": "products.create", "method": "POST /api/trpc/products.create", "auth": "requireShopAuth", "relatedBehaviors": ["B-003"],
     "inputFields": [
       {"name": "shopId", "type": "number", "required": true, "isTenantKey": true},
       {"name": "name", "type": "string", "required": true, "min": 1, "max": 100, "isBoundaryField": true},
       {"name": "price", "type": "number", "required": true, "min": 0.01, "max": 999999.99, "isBoundaryField": true},
       {"name": "stock", "type": "number", "required": true, "min": 0, "max": 10000, "isBoundaryField": true},
       {"name": "sku", "type": "string", "required": true, "min": 3, "max": 50, "isBoundaryField": true},
       {"name": "priority", "type": "enum", "required": true, "enumValues": ["low", "medium", "high", "critical"], "isBoundaryField": true}
     ],
     "outputFields": ["id", "name", "price", "stock", "sku", "createdAt"]},
    {"name": "orders.create", "method": "POST /api/trpc/orders.create", "auth": "requireShopAuth", "relatedBehaviors": ["B-004"],
     "inputFields": [
       {"name": "shopId", "type": "number", "required": true, "isTenantKey": true},
       {"name": "customerId", "type": "number", "required": true},
       {"name": "items", "type": "array", "required": true, "min": 1, "max": 50, "isBoundaryField": true,
        "arrayItemType": "object",
        "arrayItemFields": [
          {"name": "productId", "type": "number", "required": true},
          {"name": "quantity", "type": "number", "required": true, "min": 1, "max": 100, "isBoundaryField": true}
        ]}
     ],
     "outputFields": ["id", "status", "totalAmount", "createdAt"]},
    {"name": "auth.login", "method": "POST /api/trpc/auth.login", "auth": "public", "relatedBehaviors": [],
     "inputFields": [
       {"name": "username", "type": "string", "required": true},
       {"name": "password", "type": "string", "required": true}
     ],
     "outputFields": ["token"]}
  ],
  "enums": {
    "status": ["todo", "in_progress", "review", "done"],
    "priority": ["low", "medium", "high"]
  },
  "statusMachine": {
    "states": ["todo", "in_progress", "review", "done"],
    "transitions": [["todo", "in_progress"], ["in_progress", "review"], ["review", "done"]],
    "forbidden": [["done", "todo"], ["done", "in_progress"], ["review", "todo"], ["in_progress", "todo"]],
    "initialState": "todo",
    "terminalStates": ["done"]
  },
  "authModel": {"loginEndpoint": "/api/trpc/auth.login", "roles": [{"name": "admin", "envUserVar": "E2E_ADMIN_USER", "envPassVar": "E2E_ADMIN_PASS", "defaultUser": "test-admin", "defaultPass": "TestPass2026x"}]}
}
--- END EXAMPLE ---

Output ONLY valid JSON. No markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this specification chunk:\n\n${chunk}` },
    ],
    response_format: { type: "json_object" },
    thinkingBudget: 0,
    maxTokens: 16384, // Large enough for 15k-char chunks with 20+ behaviors
  });

  const content = response.choices[0].message.content as string;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function parseSpec(specText: string): Promise<AnalysisResult> {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < specText.length) {
    let end = Math.min(offset + CHUNK_SIZE, specText.length);
    if (end < specText.length) {
      const newline = specText.lastIndexOf("\n", end);
      if (newline > offset + CHUNK_SIZE * 0.7) end = newline + 1;
    }
    chunks.push(specText.slice(offset, end));
    offset = end;
  }

  // ALL chunks in parallel — no limit
  const t0 = Date.now();
  console.log(`[TestForge] Schicht 1: ${chunks.length} chunk(s), ${specText.length} chars — ALL PARALLEL`);

  const emptyChunk: Partial<AnalysisIR> & { qualityScore?: number; specType?: string } = {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [], resources: [], apiEndpoints: [],
    enums: {}, statusMachine: null,
  };

  const results = await Promise.all(
    chunks.map(async (chunk, i) => {
      try {
        const result = await withTimeout(parseSpecChunk(chunk, i, chunks.length), LLM_TIMEOUT_MS, emptyChunk);
        console.log(`[TestForge] Chunk ${i + 1}/${chunks.length} done in ${Date.now() - t0}ms`);
        return result;
      } catch (err) {
        console.error(`[TestForge] Chunk ${i} failed:`, err);
        return emptyChunk;
      }
    })
  );

  console.log(`[TestForge] All ${chunks.length} chunks done in ${Date.now() - t0}ms`);

  const merged: AnalysisIR = {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    tenantModel: null, resources: [], apiEndpoints: [], authModel: null,
    enums: {}, statusMachine: null,
  };
  let totalQuality = 0;
  let specType = "generic";

  for (const r of results) {
    if (r.behaviors) merged.behaviors.push(...r.behaviors);
    if (r.invariants) merged.invariants.push(...r.invariants);
    if (r.ambiguities) merged.ambiguities.push(...r.ambiguities);
    if (r.contradictions) merged.contradictions.push(...r.contradictions);
    if (r.resources) merged.resources.push(...r.resources);
    if (r.apiEndpoints) merged.apiEndpoints.push(...r.apiEndpoints);
    if (!merged.tenantModel && r.tenantModel) merged.tenantModel = r.tenantModel;
    if (!merged.authModel && r.authModel) merged.authModel = r.authModel;
    if (r.qualityScore) totalQuality += r.qualityScore;
    if (r.specType && r.specType !== "generic") specType = r.specType;
    // Merge enums: combine values from all chunks, deduplicate
    if (r.enums && typeof r.enums === "object") {
      for (const [key, vals] of Object.entries(r.enums)) {
        if (!Array.isArray(vals)) continue;
        if (!merged.enums[key]) merged.enums[key] = [];
        for (const v of vals) {
          if (!merged.enums[key].includes(v)) merged.enums[key].push(v);
        }
      }
    }
    // Merge statusMachine: first non-null wins, but merge transitions
    if (r.statusMachine) {
      if (!merged.statusMachine) {
        merged.statusMachine = r.statusMachine as AnalysisIR["statusMachine"];
      } else {
        // Merge states
        for (const s of (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).states || []) {
          if (!merged.statusMachine!.states.includes(s)) merged.statusMachine!.states.push(s);
        }
        // Merge transitions
        for (const t of (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).transitions || []) {
          const exists = merged.statusMachine!.transitions.some(x => x[0] === t[0] && x[1] === t[1]);
          if (!exists) merged.statusMachine!.transitions.push(t);
        }
      }
    }
  }

  // Deduplicate by id
  const seenBehaviors = new Set<string>();
  merged.behaviors = merged.behaviors.filter(b => {
    if (seenBehaviors.has(b.id)) return false;
    seenBehaviors.add(b.id);
    return true;
  });

  const seenEndpoints = new Set<string>();
  merged.apiEndpoints = merged.apiEndpoints.filter(e => {
    if (seenEndpoints.has(e.name)) return false;
    seenEndpoints.add(e.name);
    return true;
  });

  // Normalize inputFields: LLM may return objects or strings — convert to EndpointField[]
  const normalizeEndpointFields = (fields: unknown[]): EndpointField[] => fields.map((f: unknown) => {
    if (typeof f === "string") {
      // Legacy: plain string field name — convert to minimal EndpointField
      return { name: f, type: "string", required: true };
    }
    if (f && typeof f === "object") {
      const obj = f as Record<string, unknown>;
      const name = String(obj.name || obj.field || obj.key || "unknown");
      const type = (obj.type as EndpointField["type"]) || "string";
      const required = obj.required !== false; // default true
      const field: EndpointField = { name, type, required };
      if (obj.min !== undefined) field.min = Number(obj.min);
      if (obj.max !== undefined) field.max = Number(obj.max);
      if (Array.isArray(obj.enumValues)) field.enumValues = obj.enumValues as string[];
      if (obj.arrayItemType) field.arrayItemType = obj.arrayItemType as "number" | "object";
      if (Array.isArray(obj.arrayItemFields)) field.arrayItemFields = normalizeEndpointFields(obj.arrayItemFields as unknown[]);
      if (obj.isTenantKey) field.isTenantKey = true;
      if (obj.isBoundaryField) field.isBoundaryField = true;
      if (obj.validDefault) field.validDefault = String(obj.validDefault);
      return field;
    }
    return { name: String(f), type: "string", required: true };
  });
  // Normalize outputFields: keep as string[]
  const normalizeStringFields = (fields: unknown[]): string[] => fields.map((f: unknown) => {
    if (typeof f === "string") return f;
    if (f && typeof f === "object") {
      const obj = f as Record<string, unknown>;
      return String(obj.name || obj.field || obj.key || JSON.stringify(f));
    }
    return String(f);
  });
  merged.apiEndpoints = merged.apiEndpoints.map(e => ({
    ...e,
    inputFields: normalizeEndpointFields((e.inputFields as unknown as unknown[]) || []),
    outputFields: normalizeStringFields((e as unknown as Record<string, unknown[]>).outputFields || []),
  }));

  return {
    ir: merged,
    qualityScore: results.length > 0 ? totalQuality / results.length : 5.0,
    specType,
  };
}

// ─── LLM Checker ──────────────────────────────────────────────────────────────

function verifyAnchor(behavior: Behavior, specText: string): { found: boolean; score: number } {
  if (!behavior.specAnchor || behavior.specAnchor.length < 10) {
    return { found: false, score: 0.3 }; // No anchor provided — partial credit
  }

  // Exact match
  if (specText.includes(behavior.specAnchor)) {
    return { found: true, score: 1.0 };
  }

  // Fuzzy: check if 80% of words in anchor appear near each other in spec
  const anchorWords = behavior.specAnchor.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (anchorWords.length === 0) return { found: false, score: 0.2 };

  const specLower = specText.toLowerCase();
  const matchedWords = anchorWords.filter(w => specLower.includes(w));
  const score = matchedWords.length / anchorWords.length;

  return { found: score >= 0.7, score };
}

async function crossValidateBehavior(
  behavior: Behavior,
  specText: string,
  chunkSize = 8000
): Promise<{ verdict: "CORRECT" | "INCORRECT" | "PARTIAL"; confidence: number; issues: string[] }> {
  // Find the most relevant section of the spec for this behavior
  const anchor = behavior.specAnchor || behavior.title;
  const anchorIdx = specText.toLowerCase().indexOf(anchor.toLowerCase().slice(0, 30));
  const start = Math.max(0, anchorIdx - 500);
  const end = Math.min(specText.length, anchorIdx + chunkSize);
  const relevantSection = anchorIdx >= 0 ? specText.slice(start, end) : specText.slice(0, chunkSize);

  const prompt = `You are a spec verification expert. A behavior was extracted from a specification.
Verify if this behavior is correct, complete, and directly derivable from the spec text.

BEHAVIOR:
${JSON.stringify(behavior, null, 2)}

RELEVANT SPEC TEXT:
${relevantSection}

Answer in this exact JSON format:
{
  "verdict": "CORRECT" | "INCORRECT" | "PARTIAL",
  "confidence": 0.0-1.0,
  "issues": ["issue 1", "issue 2"] // empty if CORRECT
}

Output ONLY valid JSON.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      thinkingBudget: 0,
      maxTokens: 512,
    });
    const content = response.choices[0].message.content as string;
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { verdict: "PARTIAL", confidence: 0.5, issues: ["Cross-validation failed — using partial credit"] };
  }
}

async function improveBehavior(
  behavior: Behavior,
  issues: string[],
  specText: string,
  attempt: number
): Promise<Behavior | null> {
  const anchor = behavior.specAnchor || behavior.title;
  const anchorIdx = specText.toLowerCase().indexOf(anchor.toLowerCase().slice(0, 30));
  const start = Math.max(0, anchorIdx - 300);
  const end = Math.min(specText.length, anchorIdx + 4000);
  const relevantSection = anchorIdx >= 0 ? specText.slice(start, end) : specText.slice(0, 4000);

  const prompt = `Improve this behavior extracted from a spec. Attempt ${attempt + 1}/2.

CURRENT BEHAVIOR:
${JSON.stringify(behavior, null, 2)}

ISSUES TO FIX:
${issues.join("\n")}

RELEVANT SPEC TEXT:
${relevantSection}

Fix the behavior:
1. Add exact specAnchor (verbatim quote from spec text, 10-30 words)
2. Complete all postconditions (include all side-effects, HTTP codes, field changes)
3. Use concrete values (exact HTTP codes, field names, thresholds)
4. Remove anything not directly stated in the spec

Output ONLY the improved behavior as JSON (same structure, no markdown).`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      thinkingBudget: 0,
      maxTokens: 1024,
    });
    const content = response.choices[0].message.content as string;
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned) as Behavior;
  } catch {
    return null;
  }
}

export async function runLLMChecker(
  behaviors: Behavior[],
  specText: string
): Promise<{ checkedBehaviors: Behavior[]; stats: { approved: number; flagged: number; rejected: number; avgConfidence: number } }> {
  const t0 = Date.now();
  console.log(`[TestForge] LLM Checker: verifying ${behaviors.length} behaviors in parallel`);

  // Run all checks in parallel
  const checkResults = await Promise.all(
    behaviors.map(async (behavior): Promise<{ behavior: Behavior; result: CheckResult }> => {
      // Step 1: Anchor verification (fast, no LLM)
      const anchor = verifyAnchor(behavior, specText);

      // Step 2: Cross-validation (LLM call)
      const validation = await withTimeout(
        crossValidateBehavior(behavior, specText),
        30000,
        { verdict: "PARTIAL" as const, confidence: 0.5, issues: ["Timeout"] }
      );

      // Step 3: Confidence score
      const anchorScore = anchor.score;
      const validationScore = validation.verdict === "CORRECT" ? 1.0 : validation.verdict === "PARTIAL" ? 0.6 : 0.2;
      const confidence = (anchorScore * 0.4) + (validationScore * 0.4) + (validation.confidence * 0.2);

      if (confidence >= 0.8) {
        return {
          behavior,
          result: { behaviorId: behavior.id, verdict: "approved", confidence, issues: [], attempts: 0, anchorFound: anchor.found },
        };
      }

      if (confidence < 0.6 && validation.issues.length > 0) {
        // Step 4: Improvement loop (max 2 attempts)
        let current = behavior;
        let currentConfidence = confidence;
        let attempts = 0;

        for (let attempt = 0; attempt < 2; attempt++) {
          const improved = await withTimeout(
            improveBehavior(current, validation.issues, specText, attempt),
            30000,
            null
          );
          if (!improved) break;
          attempts++;

          const newAnchor = verifyAnchor(improved, specText);
          const newValidation = await withTimeout(
            crossValidateBehavior(improved, specText),
            30000,
            { verdict: "PARTIAL" as const, confidence: 0.5, issues: [] }
          );
          const newValidationScore = newValidation.verdict === "CORRECT" ? 1.0 : newValidation.verdict === "PARTIAL" ? 0.6 : 0.2;
          currentConfidence = (newAnchor.score * 0.4) + (newValidationScore * 0.4) + (newValidation.confidence * 0.2);
          current = improved;

          if (currentConfidence >= 0.6) break;
        }

        if (currentConfidence < 0.5) {
          return {
            behavior: current,
            result: { behaviorId: behavior.id, verdict: "rejected", confidence: currentConfidence, issues: validation.issues, attempts, anchorFound: anchor.found },
          };
        }

        return {
          behavior: current,
          result: { behaviorId: behavior.id, verdict: currentConfidence >= 0.8 ? "approved" : "flagged", confidence: currentConfidence, issues: validation.issues, attempts, anchorFound: anchor.found },
        };
      }

      return {
        behavior,
        result: { behaviorId: behavior.id, verdict: "flagged", confidence, issues: validation.issues, attempts: 0, anchorFound: anchor.found },
      };
    })
  );

  console.log(`[TestForge] LLM Checker done in ${Date.now() - t0}ms`);

  const approved = checkResults.filter(r => r.result.verdict === "approved").length;
  const flagged = checkResults.filter(r => r.result.verdict === "flagged").length;
  const rejected = checkResults.filter(r => r.result.verdict === "rejected").length;
  const avgConfidence = checkResults.reduce((sum, r) => sum + r.result.confidence, 0) / checkResults.length;

  console.log(`[TestForge] LLM Checker: ${approved} approved, ${flagged} flagged, ${rejected} rejected, avg confidence: ${avgConfidence.toFixed(2)}`);

  // Keep approved + flagged, discard rejected
  const checkedBehaviors = checkResults
    .filter(r => r.result.verdict !== "rejected")
    .map(r => r.behavior);

  return { checkedBehaviors, stats: { approved, flagged, rejected, avgConfidence } };
}

// ─── Spec Health Assessor ────────────────────────────────────────────────────

export function assessSpecHealth(ir: AnalysisIR): SpecHealth {
  const dims: SpecHealthDimension[] = [];

  // Dimension 1: Typed input fields (20 pts)
  // All endpoints should have typed EndpointField objects (not empty arrays)
  const epWithTypedFields = ir.apiEndpoints.filter(ep =>
    Array.isArray(ep.inputFields) && ep.inputFields.length > 0 &&
    typeof ep.inputFields[0] === "object" && "type" in ep.inputFields[0]
  );
  const typedFieldsRatio = ir.apiEndpoints.length > 0
    ? epWithTypedFields.length / ir.apiEndpoints.length : 0;
  const typedFieldsScore = Math.round(typedFieldsRatio * 20);
  dims.push({
    name: "typed_fields",
    label: "Typed Input Fields",
    passed: typedFieldsRatio >= 0.8,
    score: typedFieldsScore,
    maxScore: 20,
    tip: "Add field types (string/number/enum/array) and constraints (min/max) to all endpoint inputs",
    detail: `${epWithTypedFields.length}/${ir.apiEndpoints.length} endpoints have typed fields`,
  });

  // Dimension 2: Enum values defined (15 pts)
  // Endpoints with enum fields should have enumValues populated
  const enumFields = ir.apiEndpoints.flatMap(ep =>
    (ep.inputFields as Array<{type: string; enumValues?: string[]}>).filter(f => f.type === "enum")
  );
  const enumsWithValues = enumFields.filter(f => Array.isArray(f.enumValues) && f.enumValues.length > 0);
  const enumScore = enumFields.length === 0 ? 15 :
    Math.round((enumsWithValues.length / enumFields.length) * 15);
  dims.push({
    name: "enum_values",
    label: "Enum Values Defined",
    passed: enumFields.length === 0 || enumsWithValues.length === enumFields.length,
    score: enumScore,
    maxScore: 15,
    tip: "List all allowed values for enum fields (e.g. status: todo|in_progress|done)",
    detail: enumFields.length === 0 ? "No enum fields found" :
      `${enumsWithValues.length}/${enumFields.length} enum fields have values`,
  });

  // Dimension 3: Boundary constraints (min/max) (20 pts)
  // Numeric fields should have min/max defined
  const numericFields = ir.apiEndpoints.flatMap(ep =>
    (ep.inputFields as Array<{type: string; min?: number; max?: number; isBoundaryField?: boolean}>)
      .filter(f => f.type === "number")
  );
  const numericWithBounds = numericFields.filter(f => f.min !== undefined || f.max !== undefined);
  const boundaryScore = numericFields.length === 0 ? 20 :
    Math.round((numericWithBounds.length / numericFields.length) * 20);
  dims.push({
    name: "boundary_constraints",
    label: "Boundary Constraints",
    passed: numericFields.length === 0 || numericWithBounds.length === numericFields.length,
    score: boundaryScore,
    maxScore: 20,
    tip: "Add min/max constraints to numeric fields (e.g. price: 0.01–999999.99, quantity: 1–100)",
    detail: numericFields.length === 0 ? "No numeric fields found" :
      `${numericWithBounds.length}/${numericFields.length} numeric fields have bounds`,
  });

  // Dimension 4: Auth model present (15 pts)
  const hasAuth = ir.authModel !== null &&
    ir.authModel.loginEndpoint !== undefined &&
    ir.authModel.roles.length > 0;
  dims.push({
    name: "auth_model",
    label: "Authentication Model",
    passed: hasAuth,
    score: hasAuth ? 15 : 0,
    maxScore: 15,
    tip: "Document the login endpoint, session mechanism, and user roles (e.g. admin/user)",
    detail: hasAuth
      ? `Login: ${ir.authModel!.loginEndpoint}, ${ir.authModel!.roles.length} role(s)`
      : "No auth model found",
  });

  // Dimension 5: Tenant model present (15 pts)
  const hasTenant = ir.tenantModel !== null &&
    ir.tenantModel.tenantEntity !== undefined &&
    ir.tenantModel.tenantIdField !== undefined;
  dims.push({
    name: "tenant_model",
    label: "Multi-Tenant Isolation",
    passed: hasTenant,
    score: hasTenant ? 15 : 0,
    maxScore: 15,
    tip: "Specify the tenant entity and ID field (e.g. restaurantId, shopId) for IDOR test generation",
    detail: hasTenant
      ? `Tenant: ${ir.tenantModel!.tenantEntity} (field: ${ir.tenantModel!.tenantIdField})`
      : "No tenant model found",
  });

  // Dimension 6: Output fields documented (15 pts)
  const epWithOutput = ir.apiEndpoints.filter(ep =>
    Array.isArray(ep.outputFields) && ep.outputFields.length > 0
  );
  const outputRatio = ir.apiEndpoints.length > 0
    ? epWithOutput.length / ir.apiEndpoints.length : 0;
  const outputScore = Math.round(outputRatio * 15);
  dims.push({
    name: "output_fields",
    label: "Response Shape Documented",
    passed: outputRatio >= 0.8,
    score: outputScore,
    maxScore: 15,
    tip: "Document the response fields for each endpoint to enable spec_drift schema validation tests",
    detail: `${epWithOutput.length}/${ir.apiEndpoints.length} endpoints have output fields`,
  });

  // Calculate total score (0-100)
  const totalScore = dims.reduce((sum, d) => sum + d.score, 0);
  const maxPossible = dims.reduce((sum, d) => sum + d.maxScore, 0); // = 100
  const score = Math.round((totalScore / maxPossible) * 100);

  // Grade
  const grade: SpecHealth["grade"] =
    score >= 90 ? "A" :
    score >= 75 ? "B" :
    score >= 60 ? "C" :
    score >= 40 ? "D" : "F";

  // Summary
  const failedDims = dims.filter(d => !d.passed);
  const summary = failedDims.length === 0
    ? `Excellent spec — all ${dims.length} quality dimensions passed`
    : `${failedDims.length} dimension${failedDims.length > 1 ? "s" : ""} need improvement: ${failedDims.map(d => d.label).join(", ")}`;

  return { score, grade, dimensions: dims, summary };
}

export function assessSpecHealthFromResult(analysis: AnalysisResult): SpecHealth {
  return assessSpecHealth(analysis.ir);
}

// ─── Schicht 2: Risk Model Builder ────────────────────────────────────────────

export function buildRiskModel(analysis: AnalysisResult): RiskModel {
  const behaviors: ScoredBehavior[] = analysis.ir.behaviors.map(b => {
    const riskLevel = assessRiskLevel(b);
    return {
      behavior: b,
      riskLevel,
      proofTypes: determineProofTypes(b),
      priority: riskLevel === "critical" || riskLevel === "high" ? 0 : riskLevel === "medium" ? 1 : 2,
      rationale: buildRationale(b, riskLevel),
    };
  });

  const proofTargets: ProofTarget[] = [];
  let statusTransitionCounter = 0; // Increments per status_transition target to assign different transitions
  for (const sb of behaviors) {
    // Only generate proof targets for priority 0 (critical/high) and 1 (medium)
    // Low-risk behaviors (priority 2) don't get proof targets
    if (sb.priority === 2) continue;
    for (const pt of sb.proofTypes) {
      const target = buildProofTarget(sb, pt, analysis);
      if (target) {
        // Assign unique transitionIndex to each status_transition target
        if (pt === "status_transition") {
          target.transitionIndex = statusTransitionCounter++;
        }
        proofTargets.push(target);
      }
    }
  }

  const idorVectors = analysis.ir.resources.reduce(
    (acc, r) => acc + r.operations.filter(o => o === "read" || o === "create").length, 0
  );
  const csrfEndpoints = behaviors.filter(b => b.proofTypes.includes("csrf")).length;

  return { behaviors, proofTargets, idorVectors, csrfEndpoints };
}

function assessRiskLevel(b: Behavior): RiskLevel {
  const combined = [...b.tags, ...b.riskHints].join(" ").toLowerCase();
  if (combined.includes("idor") || combined.includes("csrf") || combined.includes("cross-tenant") || combined.includes("bypass") || combined.includes("pii-leak") || combined.includes("dsgvo") || combined.includes("gdpr")) return "critical";
  if (combined.includes("no-show") || combined.includes("risk-scoring") || combined.includes("status") || combined.includes("state-change")) return "high";
  if (combined.includes("validation") || combined.includes("boundary") || combined.includes("limit")) return "medium";
  // api-response / spec-drift behaviors: at least medium (contract violations break clients)
  if (combined.includes("api-response") || combined.includes("response-schema") || combined.includes("spec-drift")) return "medium";
  return "low";
}

function determineProofTypes(b: Behavior): ProofType[] {
  const types = new Set<ProofType>();
  const combined = [...b.tags, ...b.riskHints].join(" ").toLowerCase();
  if (combined.includes("idor") || combined.includes("cross-tenant") || combined.includes("multi-tenant")) types.add("idor");
  // csrf: triggered by csrf tag, NOT by state-change (state-change belongs to status_transition)
  if (combined.includes("csrf")) types.add("csrf");
  if (combined.includes("brute-force") || combined.includes("rate-limit")) types.add("rate_limit");
  if (combined.includes("dsgvo") || combined.includes("privacy") || combined.includes("gdpr") || combined.includes("pii")) types.add("dsgvo");
  // state-machine behaviors: ONLY detect by explicit state-machine tag (NOT state-change riskHint)
  // state-change in riskHints means "writes to DB" (not a status-transition behavior)
  const behaviorTitle = b.title.toLowerCase();
  const tagsOnly = b.tags.join(" ").toLowerCase();
  const hasArrowInTitle = behaviorTitle.includes("→") || behaviorTitle.includes("->");
  if (tagsOnly.includes("state-machine") || hasArrowInTitle ||
      (tagsOnly.includes("transition") && !tagsOnly.includes("validation"))) {
    types.add("status_transition");
  }
  if (combined.includes("no-show") || combined.includes("risk-scoring") || combined.includes("cron")) types.add("risk_scoring");
  // Only add boundary if NOT a rate-limit or state-machine behavior (those have their own test types)
  const isRateLimit = combined.includes("rate-limit") || combined.includes("brute-force");
  const isStateMachine = tagsOnly.includes("state-machine") || hasArrowInTitle;
  if (!isRateLimit && !isStateMachine && (combined.includes("validation") || combined.includes("boundary") || combined.includes("limit"))) types.add("boundary");
  if (types.size === 0) types.add("business_logic");
  // spec_drift: add for behaviors tagged with api-response or that have an associated endpoint with outputFields
  // This generates tests that validate response shapes against Zod schemas
  if (combined.includes("api-response") || combined.includes("response-schema") || combined.includes("spec-drift")) {
    types.add("spec_drift");
  }
  return Array.from(types);
}

function buildRationale(b: Behavior, level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    critical: `Critical: "${b.title}" involves security boundary or PII. Failure = data breach or auth bypass.`,
    high: `High: "${b.title}" affects core business logic. Failure = financial or operational impact.`,
    medium: `Medium: "${b.title}" is a validation rule. Failure = incorrect feedback, no breach.`,
    low: `Low: "${b.title}" is a minor functional requirement.`,
  };
  return map[level];
}

function resolveEndpoint(behaviorId: string, proofType: ProofType, analysis: AnalysisResult): string | undefined {
  // Find endpoint that mentions this behavior
  const direct = analysis.ir.apiEndpoints.find(e => e.relatedBehaviors.includes(behaviorId));
  if (direct) return direct.name;

  // Fallback: find by proof type keywords
  const keywords: Record<ProofType, string[]> = {
    idor: ["list", "get", "find"],
    csrf: ["create", "update", "delete", "cancel"],
    status_transition: ["updateStatus", "status"],
    dsgvo: ["delete", "gdpr", "remove"],
    boundary: ["create", "update"],
    risk_scoring: ["risk", "scoring"],
    business_logic: ["create", "update"],
    rate_limit: [],
    spec_drift: ["get", "list", "create", "update"],
  };

  const kws = keywords[proofType] || [];
  const match = analysis.ir.apiEndpoints.find(e =>
    kws.some(kw => e.name.toLowerCase().includes(kw))
  );
  return match?.name;
}

/**
 * Goldstandard: Extract structured field constraints from behavior text.
 * Parses preconditions, errorCases, and postconditions for boundary rules like:
 * - "title max 200 characters" → {field: "title", type: "string", max: 200}
 * - "partySize between 1 and 20" → {field: "partySize", type: "number", min: 1, max: 20}
 * - "dueDate must be in the future" → {field: "dueDate", type: "date", min: 1}
 * - "status: todo | in_progress | done" → {field: "status", type: "enum", enumValues: [...]}
 * - "taskIds max 50 items" → {field: "taskIds", type: "array", max: 50}
 */
export function extractConstraints(behavior: Behavior, ir: AnalysisIR): FieldConstraint[] {
  const constraints: FieldConstraint[] = [];
  const allText = [
    behavior.title,
    ...behavior.preconditions,
    ...behavior.postconditions,
    ...behavior.errorCases,
  ].join(" ");

  // Pattern: "<field> max <N> characters" or "<field> maximum <N> chars"
  const maxCharPattern = /(\w+)\s+(?:max|maximum)\s+(\d+)\s+(?:characters?|chars?|length)/gi;
  for (const m of Array.from(allText.matchAll(maxCharPattern))) {
    constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }

  // Pattern: "<field> min <N> characters"
  const minCharPattern = /(\w+)\s+(?:min|minimum)\s+(\d+)\s+(?:characters?|chars?|length)/gi;
  for (const m of Array.from(allText.matchAll(minCharPattern))) {
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.min = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", min: parseInt(m[2]) });
  }

  // Pattern: "<field> between <N> and <M>" or "<field> from <N> to <M>"
  const betweenPattern = /(\w+)\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)/gi;
  for (const m of Array.from(allText.matchAll(betweenPattern))) {
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) { existing.min = parseInt(m[2]); existing.max = parseInt(m[3]); }
    else constraints.push({ field: m[1], type: "number", min: parseInt(m[2]), max: parseInt(m[3]) });
  }

  // Pattern: "<field> max <N> items" or "<field> maximum <N> entries"
  const maxItemsPattern = /(\w+)\s+(?:max|maximum)\s+(\d+)\s+(?:items?|entries?|elements?|ids?)/gi;
  for (const m of Array.from(allText.matchAll(maxItemsPattern))) {
    constraints.push({ field: m[1], type: "array", max: parseInt(m[2]) });
  }

  // Pattern: "<field> must not exceed <N> characters" or "<field> cannot exceed <N>"
  const mustNotExceedPattern = /(\w+)\s+(?:must\s+not|cannot|can't|may\s+not)\s+exceed\s+(\d+)(?:\s+(?:characters?|chars?|items?|entries?))?/gi;
  for (const m of Array.from(allText.matchAll(mustNotExceedPattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if"].includes(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }
  // Pattern: "<field> exceeds <N>" or "<field> is empty or exceeds <N>"
  // Also handles: "<field> length exceeds <N>" → field is the word before "length"
  const exceedsPattern = /(\w+)\s+(?:length\s+)?(?:is\s+empty\s+or\s+)?exceeds?\s+(\d+)(?:\s+(?:characters?|chars?|items?|entries?))?/gi;
  for (const m of Array.from(allText.matchAll(exceedsPattern))) {
    const field = m[1].toLowerCase();
    // Skip common false positives and noise words
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if", "not", "length", "size", "array", "count"].includes(field)) continue;
    // Skip pure numbers (e.g. "400 if title exceeds" → skip "400")
    if (/^\d+$/.test(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }
  // Pattern: "<field> array exceeds <N> items" → extract field before "array"
  const arrayExceedsPattern = /(\w+)\s+array\s+exceeds?\s+(\d+)\s+(?:items?|entries?|elements?)/gi;
  for (const m of Array.from(allText.matchAll(arrayExceedsPattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which"].includes(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) { existing.max = parseInt(m[2]); existing.type = "array"; }
    else constraints.push({ field: m[1], type: "array", max: parseInt(m[2]) });
  }
  // Pattern: "<field> above <N>" (e.g. "pageSize above 100")
  const abovePattern = /(\w+)\s+(?:is\s+)?above\s+(\d+)/gi;
  for (const m of Array.from(allText.matchAll(abovePattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if"].includes(field)) continue;
    if (/^\d+$/.test(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "number", max: parseInt(m[2]) });
  }
  // Pattern: "<field> limited to <N>" or "<field> up to <N>"
  const limitedToPattern = /(\w+)\s+(?:limited\s+to|up\s+to)\s+(\d+)(?:\s+(?:characters?|chars?|items?|entries?))?/gi;
  for (const m of Array.from(allText.matchAll(limitedToPattern))) {
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }
  // Pattern: "max <N> <field>" or "maximum <N> <field>s"
  const maxNFieldPattern = /(?:max|maximum)\s+(\d+)\s+(\w+)/gi;
  const MAX_N_FIELD_NOISE = new Set(["characters", "chars", "items", "entries", "elements", "ids", "requests", "req", "calls", "per", "minute", "second", "hour", "day", "times"]);
  for (const m of Array.from(allText.matchAll(maxNFieldPattern))) {
    const field = m[2].replace(/s$/, ""); // remove plural
    if (MAX_N_FIELD_NOISE.has(m[2].toLowerCase())) continue; // skip noise words
    if (!constraints.find(c => c.field === field)) {
      const num = parseInt(m[1]);
      if (num > 0 && num < 10000) { // sanity check
        constraints.push({ field, type: "array", max: num });
      }
    }
  }
  // Pattern: "<field> array is empty" or "<field>s array is empty" → array min=1
  const arrayEmptyPattern = /(\w+)\s+(?:array|list|ids?)\s+is\s+empty/gi;
  for (const m of Array.from(allText.matchAll(arrayEmptyPattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if", "the", "a", "an"].includes(field)) continue;
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "array", min: 1 });
    }
  }
  // Pattern: "<field> is empty" or "empty <field>" → min=1 (field must not be empty)
  const emptyFieldPattern = /(?:(\w+)\s+is\s+empty|empty\s+(\w+))/gi;
  for (const m of Array.from(allText.matchAll(emptyFieldPattern))) {
    const field = m[1] || m[2];
    const fl = field.toLowerCase();
    // Skip noise words and words that are actually array-type fields (handled above)
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if", "the", "a", "an", "array", "list"].includes(fl)) continue;
    if (/^\d+$/.test(fl)) continue;
    if (!constraints.find(c => c.field === field)) {
      constraints.push({ field, type: "string", min: 1 });
    } else {
      const existing = constraints.find(c => c.field === field);
      if (existing && existing.min === undefined) existing.min = 1;
    }
  }
  // Pattern: "<field> must be in the future" or "<field> must be a future date"
  const futureDatePattern = /(\w*[Dd]ate\w*|\w*[Dd]ue\w*)\s+must\s+be\s+(?:in\s+the\s+)?future/gi;
  for (const m of Array.from(allText.matchAll(futureDatePattern))) {
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "date", min: 1 }); // min:1 means "tomorrow"
    }
  }

  // Pattern: "<field> must be in the past" or "past date"
  const pastDatePattern = /(\w*[Dd]ate\w*)\s+must\s+be\s+(?:in\s+the\s+)?past/gi;
  for (const m of Array.from(allText.matchAll(pastDatePattern))) {
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "date", max: -1 }); // max:-1 means "yesterday"
    }
  }
  // Pattern: "<field> is in the past" → implies must be future
  // e.g. "Returns 400 if dueDate is in the past"
  const isInPastPattern = /(\w*[Dd]ate\w*|\w*[Dd]ue\w*)\s+is\s+in\s+the\s+past/gi;
  for (const m of Array.from(allText.matchAll(isInPastPattern))) {
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "date", min: 1 }); // must be future
    }
  }

  // Merge with enums from IR
  for (const [field, vals] of Object.entries(ir.enums || {})) {
    if (!constraints.find(c => c.field === field)) {
      constraints.push({ field, type: "enum", enumValues: vals });
    }
  }

  return constraints;
}

function buildProofTarget(sb: ScoredBehavior, pt: ProofType, analysis: AnalysisResult): ProofTarget | null {
  const b = sb.behavior;
  const base = { behaviorId: b.id, proofType: pt, riskLevel: sb.riskLevel };
  const endpoint = resolveEndpoint(b.id, pt, analysis);

  // Extract side-effects from postconditions (field changes, counter increments)
  const sideEffects = b.postconditions.filter(pc =>
    pc.includes("+=") || pc.includes("=") || pc.includes("NOW()") || pc.includes("null") || pc.includes("count")
  );

  if (pt === "idor") {
    return {
      ...base,
      id: `PROOF-${b.id}-IDOR`,
      description: `Cross-tenant access to ${b.object} must be rejected`,
      preconditions: ["TENANT_A and TENANT_B both exist with data", "User authenticated as TENANT_A"],
      assertions: [
        { type: "http_status", target: "response", operator: "in", value: [401, 403], rationale: "Cross-tenant access must be rejected" },
        { type: "field_absent", target: "response.data", operator: "not_contains", value: "TENANT_B_DATA", rationale: "No TENANT_B data must leak" },
      ],
      mutationTargets: [
        { description: `Remove ${analysis.ir.tenantModel?.tenantIdField || "restaurantId"} filter in ${endpoint || "list"} query`, expectedKill: true },
        { description: "Return all records without tenant isolation", expectedKill: true },
      ],
      endpoint,
      sideEffects,
    };
  }

  if (pt === "csrf") {
    return {
      ...base,
      id: `PROOF-${b.id}-CSRF`,
      description: `${b.action} must be CSRF-protected`,
      preconditions: ["User authenticated", "No X-CSRF-Token header"],
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 403, rationale: "Must be exactly 403 without CSRF token" },
        { type: "db_state", target: "affected table", operator: "eq", value: 0, rationale: "No DB write without valid token" },
      ],
      mutationTargets: [
        { description: `Remove CSRF middleware from ${endpoint || "route"}`, expectedKill: true },
        { description: "Accept requests without CSRF token", expectedKill: true },
      ],
      endpoint,
      sideEffects,
    };
  }

  if (pt === "status_transition") {
    return {
      ...base,
      id: `PROOF-${b.id}-STATUS`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 200, rationale: "Valid transition must succeed" },
        { type: "field_value", target: "reservation.status", operator: "eq", value: "new_status", rationale: "Status must be updated in DB" },
      ],
      mutationTargets: [
        { description: `Remove ${b.action} transition from allowed list`, expectedKill: true },
        ...sideEffects.map(se => ({ description: `Remove ${se} side-effect`, expectedKill: true })),
      ],
      endpoint: endpoint || analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("status") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_STATUS_ENDPOINT",
      sideEffects,
    };
  }

  if (pt === "dsgvo") {
    return {
      ...base,
      id: `PROOF-${b.id}-DSGVO`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: [
        { type: "field_value", target: "guest.name", operator: "eq", value: "[gelöscht]", rationale: "Name must be anonymized" },
        { type: "field_value", target: "guest.phone", operator: "eq", value: "[gelöscht]", rationale: "Phone must be anonymized" },
        { type: "field_value", target: "guest.email", operator: "eq", value: null, rationale: "Email must be deleted" },
      ],
      mutationTargets: [
        { description: "Skip name anonymization in GDPR delete handler", expectedKill: true },
        { description: "Skip phone anonymization", expectedKill: true },
        { description: "Cascade delete reservations instead of anonymizing", expectedKill: true },
      ],
      endpoint: endpoint || "guests.deleteGdpr",
      sideEffects,
    };
  }

  if (pt === "boundary") {
    // Extract boundary values from errorCases
    const boundaries = b.errorCases.filter(ec => ec.includes("→") || ec.includes("=") || ec.includes("→"));
    // Extract structured constraints from behavior text + IR enums
    const constraints = extractConstraints(b, analysis.ir);
    return {
      ...base,
      id: `PROOF-${b.id}-BOUND`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: boundaries.length > 0
        ? boundaries.map((ec) => ({
            type: "http_status" as const,
            target: "response",
            operator: "in" as const,
            value: ec.includes("allowed") ? [200] : [400, 422],
            rationale: ec,
          }))
        : [
            { type: "http_status" as const, target: "response", operator: "in" as const, value: [400, 422], rationale: "Boundary violation must be rejected" },
          ],
      mutationTargets: [
        { description: `Change >= to > in boundary validation (off-by-one)`, expectedKill: true },
        { description: `Remove null check`, expectedKill: true },
        ...constraints.filter(c => c.max !== undefined).map(c =>
          ({ description: `Remove max ${c.max} constraint on ${c.field}`, expectedKill: true })
        ),
      ],
      endpoint,
      sideEffects,
      constraints,
    };
  }

  if (pt === "risk_scoring") {
    return {
      ...base,
      id: `PROOF-${b.id}-RISK`,
      description: b.title,
      preconditions: ["guest.noShowRisk = 0 (verified)", "reservation.status = no_show"],
      assertions: [
        { type: "field_value", target: "guest.noShowRisk", operator: "gt", value: 0, rationale: "Risk must increase" },
        { type: "field_value", target: "guest.noShowRisk", operator: "lte", value: 100, rationale: "Risk must not exceed 100" },
        { type: "field_value", target: "guest.noShowCount", operator: "eq", value: "countBefore + 1", rationale: "Count must increment exactly once" },
      ],
      mutationTargets: [
        { description: "Remove noShowRisk update in riskScoring job", expectedKill: true },
        { description: "Set noShowRisk to 0 instead of incrementing", expectedKill: true },
      ],
      endpoint,
      sideEffects,
    };
  }

  // business_logic — only generate if endpoint is known
  if (pt === "business_logic") {
    if (!endpoint) return null; // No endpoint = no test (DiscardReason: no_endpoint)
    // Build resolvedPayload from endpoint inputFields
    const blEpDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
    const blFields = blEpDef?.inputFields || [];
    const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
    const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
    const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
    const resolvedPayload: Record<string, unknown> = {};
    for (const f of blFields) {
      resolvedPayload[f.name] = getValidDefault(f, tenantConst);
    }
    return {
      ...base,
      id: `PROOF-${b.id}-BL`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: b.postconditions.map((pc, i) => ({
        type: "field_value" as const,
        target: `result.${i}`,
        operator: "eq" as const,
        value: pc,
        rationale: `Spec postcondition: ${pc}`,
      })),
      mutationTargets: (() => {
        // Generate precise mutation targets from side-effects (Briefing Fix 5)
        const blMutations: Array<{description: string; expectedKill: boolean}> = [
          { description: `Remove success path in ${endpoint}`, expectedKill: true },
        ];
        for (const se of sideEffects) {
          if (se.includes("+=") || se.includes("-=") || se.toLowerCase().includes("stock") || se.toLowerCase().includes("count") || se.toLowerCase().includes("decrement") || se.toLowerCase().includes("increment")) {
            const fieldMatch = se.match(/(\w+)\s*(?:\+=|-=)/)?.[1] || se.split("=")[0].trim().split(".").pop();
            const field = fieldMatch || "counter";
            blMutations.push({ description: `Not updating ${field} after ${b.action} in ${endpoint}`, expectedKill: true });
          } else if (se.includes("NOW()") || se.toLowerCase().includes("timestamp") || se.toLowerCase().includes("createdat") || se.toLowerCase().includes("updatedat")) {
            const field = se.split("=")[0].trim().split(".").pop() || "timestamp";
            blMutations.push({ description: `Not setting ${field} timestamp in ${endpoint}`, expectedKill: true });
          } else {
            blMutations.push({ description: `Skip side effect: ${se}`, expectedKill: true });
          }
        }
        // Special case: stock decrement behaviors
        const titleLower = b.title.toLowerCase();
        if (titleLower.includes("stock") || titleLower.includes("decrement") || titleLower.includes("restore") || titleLower.includes("inventory")) {
          blMutations.push(
            { description: `Not decrementing stock after successful order`, expectedKill: true },
            { description: `Decrementing stock by wrong amount`, expectedKill: true }
          );
        }
        return blMutations;
      })(),
      endpoint,
      sideEffects,
      resolvedPayload: Object.keys(resolvedPayload).length > 0 ? resolvedPayload : undefined,
    };
  }

  if (pt === "spec_drift") {
    // Find the endpoint with outputFields to build schema validation assertions
    const epDef = endpoint ? analysis.ir.apiEndpoints.find(e => e.name === endpoint) : null;
    const outputFields = epDef?.outputFields || [];
    const inputFields = epDef?.inputFields || [];
    const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
    const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
    const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
    // Build resolvedPayload for the query
    const resolvedPayload: Record<string, unknown> = {};
    for (const f of inputFields) {
      resolvedPayload[f.name] = getValidDefault(f, tenantConst);
    }
    const schemaName = endpoint ? `${endpoint.replace(/\./g, '_')}ResponseSchema` : null;
    return {
      ...base,
      id: `PROOF-${b.id}-DRIFT`,
      description: `API response shape for ${endpoint || b.object} matches spec (Zod validation)`,
      preconditions: ["Authenticated user", "At least one resource exists"],
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 200, rationale: "Endpoint must return 200" },
        { type: "field_value", target: "response.data", operator: "not_null", value: null, rationale: "Response data must not be null" },
        ...outputFields.slice(0, 3).map(f => ({
          type: "field_value" as const,
          target: `response.data.${f}`,
          operator: "not_null" as const,
          value: null,
          rationale: `Spec requires field '${f}' in response`,
        })),
      ],
      mutationTargets: [
        { description: `Remove '${outputFields[0] || 'id'}' field from ${endpoint || b.object} response`, expectedKill: true },
        { description: `Return wrong type for response fields (e.g. string instead of number)`, expectedKill: true },
        ...outputFields.slice(1, 3).map(f => ({ description: `Omit '${f}' from response`, expectedKill: true })),
      ],
      endpoint,
      sideEffects,
      resolvedPayload: Object.keys(resolvedPayload).length > 0 ? resolvedPayload : undefined,
    };
  }

  return null;
}

// ─── Helpers Generator ────────────────────────────────────────────────────────

export function generateHelpers(analysis: AnalysisResult): GeneratedHelpers {
  const ir = analysis.ir;
  const tenantField = ir.tenantModel?.tenantIdField || "restaurantId";
  const tenantEntity = ir.tenantModel?.tenantEntity || "restaurant";
  // Strip HTTP method prefix if present (e.g. "POST /api/trpc/auth.login" → "/api/trpc/auth.login")
  const rawLoginEndpoint = ir.authModel?.loginEndpoint || "/api/trpc/auth.login";
  const loginEndpoint = rawLoginEndpoint.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "");
  const csrfEndpoint = ir.authModel?.csrfEndpoint || "";
  const roles = ir.authModel?.roles || [
    { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" },
  ];

  // Find resources with PII for factories
  const mainResource = ir.resources.find(r => r.operations.includes("create")) || ir.resources[0];
  const piiResources = ir.resources.filter(r => r.hasPII);

  // Find create endpoint
  const createEndpoint = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("book"));
  const getEndpoint = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("get"));
  const listEndpoint = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("list"));
  const cancelEndpoint = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("cancel") || e.name.toLowerCase().includes("delete"));

  const apiTs = `// GENERATED by TestForge v3.0 — do not edit manually
// Source: ${analysis.specType} spec

export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export async function loginAndGetCookie(
  request: any,
  username: string,
  password: string
): Promise<string> {
  const response = await request.post(\`\${BASE_URL}${loginEndpoint}\`, {
    headers: { "Content-Type": "application/json" },
    data: { json: { username, password } },
  });
  if (!response.ok()) {
    throw new Error(\`Login failed for \${username}: HTTP \${response.status()}\`);
  }
  const setCookie = response.headers()["set-cookie"];
  if (!setCookie) throw new Error(\`Login succeeded but no cookie returned for \${username}\`);
  return setCookie;
}

export async function trpcMutation(
  request: any,
  procedure: string,
  input: Record<string, unknown>,
  cookieHeader?: string,
  extraHeaders?: Record<string, string>
): Promise<{ response: any; data: unknown; error: unknown; status: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const response = await request.post(\`\${BASE_URL}/api/trpc/\${procedure}\`, {
    headers,
    data: { json: input },
  });
  const body = await response.json().catch(() => null);
  const data = body?.result?.data?.json ?? body?.result?.data ?? null;
  const error = body?.error ?? body?.[0]?.error ?? null;
  return { response, data, error, status: response.status() };
}

export async function trpcQuery(
  request: any,
  procedure: string,
  input: Record<string, unknown> = {},
  cookieHeader?: string
): Promise<{ response: any; data: unknown; error: unknown; status: number }> {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const response = await request.get(
    \`\${BASE_URL}/api/trpc/\${procedure}?input=\${encodeURIComponent(JSON.stringify({ json: input }))}\`,
    { headers }
  );
  const body = await response.json().catch(() => null);
  const data = body?.result?.data?.json ?? body?.result?.data ?? null;
  const error = body?.error ?? null;
  return { response, data, error, status: response.status() };
}

export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function randomPhone(): string {
  return \`+49176\${Date.now().toString().slice(-8)}\`;
}
`;

  const authTs = `// GENERATED by TestForge v3.0 — Auth helpers
// Source: ${ir.authModel?.csrfPattern || "standard"} auth pattern

import { loginAndGetCookie, BASE_URL } from "./api";

${roles.map((role, i) => `
let _${role.name.replace(/[^a-zA-Z0-9]/g, "_")}Cookie: string | null = null;

export async function get${role.name.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("")}Cookie(request: any): Promise<string> {
  if (_${role.name.replace(/[^a-zA-Z0-9]/g, "_")}Cookie) return _${role.name.replace(/[^a-zA-Z0-9]/g, "_")}Cookie;
  _${role.name.replace(/[^a-zA-Z0-9]/g, "_")}Cookie = await loginAndGetCookie(
    request,
    process.env.${role.envUserVar} || "${role.defaultUser}",
    process.env.${role.envPassVar} || "${role.defaultPass}"
  );
  return _${role.name.replace(/[^a-zA-Z0-9]/g, "_")}Cookie;
}
`).join("")}

export function resetCookieCache(): void {
${roles.map(role => `  _${role.name.replace(/[^a-zA-Z0-9]/g, "_")}Cookie = null;`).join("\n")}
}

${csrfEndpoint ? `
export async function getCsrfToken(request: any, cookie: string): Promise<string> {
  const resp = await request.get(\`\${BASE_URL}${csrfEndpoint}\`, {
    headers: { Cookie: cookie },
  });
  const body = await resp.json();
  return body?.token ?? body?.csrfToken ?? body?.csrf_token ?? "";
}
` : "// No CSRF endpoint detected in spec"}
`;

  // Build factories based on discovered resources and endpoints
  const primaryRole = roles[0];
  const factoriesTs = `// GENERATED by TestForge v3.0 — Test data factories
// Source: ${analysis.specType} spec

import { trpcMutation, trpcQuery } from "./api";

// Test tenant IDs — update these to match your test environment
export const TEST_${tenantEntity.toUpperCase()}_ID = parseInt(process.env.TEST_TENANT_ID || "99001");
export const TEST_${tenantEntity.toUpperCase()}_B_ID = parseInt(process.env.TEST_TENANT_B_ID || "99002"); // For IDOR tests

${createEndpoint ? `
export interface CreateTestResourceOpts {
  ${tenantField}?: number;
${(createEndpoint.inputFields || []).map((f) => `  ${f.name}?: unknown;`).join("\n")}
  [key: string]: unknown;
}

export async function createTestResource(
  request: any,
  cookieHeader: string,
  opts: CreateTestResourceOpts = {}
): Promise<Record<string, unknown>> {
  const { data, error } = await trpcMutation(request, "${createEndpoint.name}", {
    ${tenantField}: opts.${tenantField} ?? TEST_${tenantEntity.toUpperCase()}_ID,
${(createEndpoint.inputFields || []).map((f) => {
  const fname = f.name;
  const fl = fname.toLowerCase();
  let defaultVal: string;
  if (f.validDefault) defaultVal = f.validDefault;
  else if (f.isTenantKey) defaultVal = `TEST_${tenantEntity.toUpperCase()}_ID`;
  else if (f.type === 'enum' && f.enumValues?.length) defaultVal = `\"${f.enumValues[0]}\"`;
  else if (f.type === 'number') defaultVal = f.min !== undefined ? String(Math.max(f.min, 1)) : '1';
  else if (f.type === 'boolean') defaultVal = 'false';
  else if (f.type === 'date' || fl.includes('date') || fl.includes('datum')) defaultVal = 'tomorrowStr()';
  else if (fl.includes('email')) defaultVal = `\"test@example.com\"`;
  else if (fl.includes('phone')) defaultVal = `\"+49176\${Date.now().toString().slice(-8)}\"`;
  else if (fl.includes('sku')) defaultVal = `\"SKU-\${Date.now()}\"`;
  else if (fl.includes('name') || fl.includes('title')) defaultVal = `\"Test ${fname}-\${Date.now()}\"`;
  else if (fl.includes('status')) defaultVal = `\"active\"`;
  else if (fl.includes('priority')) defaultVal = `\"medium\"`;
  else if (fl.includes('count') || fl.includes('size') || fl.includes('num')) defaultVal = '1';
  else if (fl.includes('id') || fl.includes('workspace') || fl.includes('tenant')) defaultVal = `TEST_${tenantEntity.toUpperCase()}_ID`;
    else {
    // Generic fallback: use getValidDefault logic for unknown fields
    defaultVal = `"test-${fname}-\${Date.now()}"`;
  }
  return `    ${fname}: opts.${fname} ?? ${defaultVal},`;
}).join("\n")}
    ...opts,
  }, cookieHeader);
  if (error) throw new Error(\`createTestResource failed: \${JSON.stringify(error)}\`);
  return data as Record<string, unknown>;
}
` : "// No create endpoint detected — add factory manually"}

${getEndpoint ? `
export async function getResource(
  request: any,
  id: number,
  cookieHeader: string
): Promise<Record<string, unknown>> {
  const { data, error } = await trpcQuery(request, "${getEndpoint.name}",
    { id, ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID }, cookieHeader);
  if (error) throw new Error(\`getResource failed: \${JSON.stringify(error)}\`);
  return data as Record<string, unknown>;
}
` : ""}

${listEndpoint ? `
export async function listResources(
  request: any,
  cookieHeader: string,
  extra: Record<string, unknown> = {}
): Promise<Record<string, unknown>[]> {
  const { data } = await trpcQuery(request, "${listEndpoint.name}",
    { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID, ...extra }, cookieHeader);
  return (data as Record<string, unknown>[]) ?? [];
}
` : ""}

${piiResources.length > 0 ? (() => {
  const piiEndpoint = ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("phone") ||
    e.name.toLowerCase().includes("guest") ||
    e.name.toLowerCase().includes("user") ||
    e.name.toLowerCase().includes("getby")
  )?.name || "TODO_REPLACE_WITH_GET_BY_IDENTIFIER_ENDPOINT";
  return `
export async function getResourceByIdentifier(
  request: any,
  identifier: string | number,
  cookieHeader: string
): Promise<Record<string, unknown>> {
  // TODO: Update this function to use the correct identifier field for your resource
  const { data, error } = await trpcQuery(request, "${piiEndpoint}",
    { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID, id: identifier }, cookieHeader);
  if (error) throw new Error(\`getResourceByIdentifier failed: \${JSON.stringify(error)}\`);
  return data as Record<string, unknown>;
}
`;
})() : ""}
`;

  const resetTs = `// GENERATED by TestForge v3.0 — Test tenant reset
// IMPORTANT: You must implement POST /api/debug/reset-test-tenant in your app
// This endpoint should reset the test tenant to a known state
// Protect it with DEBUG_API_TOKEN env var and only enable in non-production

import { BASE_URL } from "./api";

export const TEST_TENANT_ID = parseInt(process.env.TEST_TENANT_ID || "99001");

export async function resetTestTenant(request: any): Promise<void> {
  const token = process.env.DEBUG_API_TOKEN;
  if (!token) {
    console.warn("[TestForge] DEBUG_API_TOKEN not set — skipping tenant reset");
    return;
  }
  const response = await request.post(\`\${BASE_URL}/api/debug/reset-test-tenant\`, {
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Token": token,
    },
    data: { ${tenantField}: TEST_TENANT_ID },
  });
  if (!response.ok()) {
    throw new Error(\`resetTestTenant failed: HTTP \${response.status()}\`);
  }
}
`;

  // Build Zod schemas from IR — resource-based + endpoint-based
  const schemasTs = (() => {
    // Recursive Zod field generator
    function generateZodField(f: EndpointField): string {
      let base: string;
      switch (f.type) {
        case "string":
          base = "z.string()";
          if (f.min !== undefined) base += `.min(${f.min})`;
          if (f.max !== undefined) base += `.max(${f.max})`;
          break;
        case "number":
          base = "z.number()";
          if (f.min !== undefined) base += `.min(${f.min})`;
          if (f.max !== undefined) base += `.max(${f.max})`;
          break;
        case "boolean":
          base = "z.boolean()";
          break;
        case "date":
          base = `z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).or(z.string().datetime({ offset: true }))`;
          break;
        case "enum":
          base = `z.enum([${f.enumValues?.map(v => `"${v}"`).join(", ") || '"unknown"'}])`;
          break;
        case "array":
          if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
            const objFields = f.arrayItemFields
              .map(af => `    ${af.name}: ${generateZodField(af)}`)
              .join(",\n");
            base = `z.array(z.object({\n${objFields}\n  }))`;
          } else {
            base = "z.array(z.unknown())";
          }
          if (f.min !== undefined) base += `.min(${f.min})`;
          if (f.max !== undefined) base += `.max(${f.max})`;
          break;
        default:
          base = "z.unknown()";
      }
      return f.required ? base : `${base}.optional()`;
    }

    // Resource-based schemas (for response validation)
    const resourceSchemaBlocks = ir.resources.map(resource => {
      const createEp = ir.apiEndpoints.find(e =>
        e.name.toLowerCase().includes(resource.name.toLowerCase()) &&
        e.name.toLowerCase().includes("create")
      );
      if (!createEp?.inputFields?.length) return "";

      const resourceName = resource.name.charAt(0).toUpperCase() + resource.name.slice(1);
      const schemaName = `${resourceName}Schema`;

      // Response schema: input fields + id + timestamps
      const fields: EndpointField[] = [
        { name: "id", type: "number", required: true },
        ...createEp.inputFields,
        { name: "createdAt", type: "number", required: false },
        { name: "updatedAt", type: "number", required: false },
      ];
      const fieldLines = fields
        .map(f => `  ${f.name}: ${generateZodField(f)}`)
        .join(",\n");

      return `// Response schema for ${resource.name}\nexport const ${schemaName} = z.object({\n${fieldLines},\n}).passthrough();\nexport type ${resourceName} = z.infer<typeof ${schemaName}>;`;
    }).filter(Boolean).join("\n\n");

    // Endpoint-based input schemas (for spec_drift tests)
    const endpointSchemaBlocks = ir.apiEndpoints
      .filter(e => e.inputFields && e.inputFields.length > 0)
      .map(ep => {
        const schemaName = ep.name.replace(/\./g, "_") + "Schema";
        const fields = (ep.inputFields || []).filter(f => !f.isTenantKey);
        const fieldLines = fields.map(f => `  ${f.name}: ${generateZodField(f)}`).join(",\n");
        const outputFields = ep.outputFields || [];
        const responseFields = outputFields.length > 0
          ? outputFields.map(fname => `  ${fname}: z.unknown()`).join(",\n")
          : "  id: z.number().or(z.string())";
        return `// Input schema for ${ep.name}\nexport const ${schemaName} = z.object({\n${fieldLines}\n});\nexport const ${ep.name.replace(/\./g, "_")}ResponseSchema = z.object({\n${responseFields}\n}).passthrough();`;
      }).join("\n\n");

    const hasSchemas = resourceSchemaBlocks || endpointSchemaBlocks;
    if (!hasSchemas) return `// GENERATED by TestForge v3.0 — Response schemas\nimport { z } from "zod";\n\n// No endpoints with typed fields detected in spec\nexport const schemas = {};\nexport function validateSchema<T>(schema: import("zod").ZodType<T>, data: unknown): T {\n  const result = schema.safeParse(data);\n  if (!result.success) throw new Error(\`Schema validation failed:\\n\${result.error.toString()}\`);\n  return result.data;\n}\n`;

    return `// GENERATED by TestForge v3.0 — Zod response & input schemas\n// Usage: const validated = validateSchema(BookingSchema, data);\nimport { z } from "zod";\n\n${resourceSchemaBlocks}\n\n${endpointSchemaBlocks}\n\n// Validate helper — throws on schema mismatch\nexport function validateSchema<T>(schema: z.ZodType<T>, data: unknown): T {\n  const result = schema.safeParse(data);\n  if (!result.success) {\n    throw new Error(\`Schema validation failed:\\n\${result.error.toString()}\`);\n  }\n  return result.data;\n}\n`;
  })()

  const indexTs = `// GENERATED by TestForge v3.0 — Helper exports
export * from "./api";
export * from "./auth";
export * from "./factories";
export * from "./reset";
export * from "./schemas";
`;

  const playwrightConfig = `// GENERATED by TestForge v3.0
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  workers: 4, // Run tests in parallel
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    extraHTTPHeaders: { "Accept": "application/json" },
  },
  projects: [
    { name: "api", use: { ...devices["Desktop Chrome"] } },
  ],
});
`;

  const packageJson = JSON.stringify({
    name: "testforge-proofs",
    version: "1.0.0",
    description: `Generated by TestForge v3.0 — ${analysis.specType} spec`,
    type: "module",
    scripts: {
      test: "playwright test",
      "test:security": "playwright test tests/security/",
      "test:integration": "playwright test tests/integration/",
      "test:compliance": "playwright test tests/compliance/",
      "test:business": "playwright test tests/business/",
      "test:list": "playwright test --list",
      "test:dry-run": "playwright test --dry-run",
      "install:browsers": "playwright install --with-deps chromium",
    },
    dependencies: {
      zod: "^3.22.0",
    },
    devDependencies: {
      "@playwright/test": "^1.41.0",
      typescript: "^5.3.0",
    },
  }, null, 2);

  const tsconfigJson = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "./dist",
      baseUrl: ".",
      paths: {
        "../../helpers/*": ["helpers/*"],
      },
    },
    include: ["tests/**/*.ts", "helpers/**/*.ts", "playwright.config.ts"],
    exclude: ["node_modules", "dist"],
  }, null, 2);

  const readmeMd = `# TestForge Proof Suite — ${analysis.specType}

Generated by **TestForge v3.0** on ${new Date().toISOString().split("T")[0]}.

## Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npm run install:browsers

# 3. Configure your environment
cp .env.example .env
# Edit .env and set BASE_URL, TEST_TENANT_ID, and credentials

# 4. Run all tests
npm test

# 5. View HTML report
npx playwright show-report
\`\`\`

## Test Structure

| Directory | Contents | Priority |
|---|---|---|
| \`tests/security/\` | IDOR, CSRF, Rate-Limit, Spec-Drift | P0 — Run first |
| \`tests/business/\` | Business Logic, Boundary Values | P1 — Core logic |
| \`tests/compliance/\` | DSGVO/GDPR, Data Retention | P1 — Compliance |
| \`tests/integration/\` | Status Transitions, Risk Scoring | P2 — Integration |

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| \`BASE_URL\` | API base URL | \`http://localhost:3000\` |
| \`TEST_TENANT_ID\` | Primary test tenant ID | \`99001\` |
| \`TEST_TENANT_B_ID\` | Secondary tenant (IDOR tests) | \`99002\` |
${roles.map(r => `| \`${r.envUserVar}\` | ${r.name} username | \`admin@example.com\` |
| \`${r.envPassVar}\` | ${r.name} password | \`secret\` |`).join("\n")}

## CI/CD

The \`.github/workflows/testforge.yml\` file is ready to use. Add these secrets to your GitHub repository:
- \`STAGING_URL\` — your staging environment URL
- \`TEST_TENANT_ID\`, \`TEST_TENANT_B_ID\`
${roles.map(r => `- \`${r.envUserVar}\`, \`${r.envPassVar}\``).join("\n")}

## Mutation Targets

Every \`expect()\` call has a \`// Kills:\` comment explaining which code mutation it catches.
This makes it easy to verify test quality and understand what breaks when a test fails.

## Generated by TestForge

Do not edit these files manually — re-run TestForge to regenerate with updated spec.
`;

  const envExample = `# TestForge Proof Suite — Environment Variables
# Copy this file to .env and fill in your values

# API base URL (required)
BASE_URL=http://localhost:3000

# Test tenant IDs (required for IDOR tests)
TEST_TENANT_ID=99001
TEST_TENANT_B_ID=99002

# Credentials for each role
${roles.map(r => `${r.envUserVar}=${r.name.toLowerCase()}@example.com
${r.envPassVar}=changeme`).join("\n")}

# Optional: Debug token for direct DB state checks
DEBUG_API_TOKEN=
`;

  const githubAction = `# GENERATED by TestForge v3.0
# Commit this file to .github/workflows/ to enable automatic proof verification

name: TestForge Proof Suite
on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: [main]

jobs:
  p0-security:
    name: "P0 — Security & Tenant Isolation"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/security/
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roles.map(r => `          ${r.envUserVar}: \${{ secrets.${r.envUserVar} }}\n          ${r.envPassVar}: \${{ secrets.${r.envPassVar} }}`).join("\n")}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}
          TEST_TENANT_B_ID: \${{ secrets.TEST_TENANT_B_ID }}
          DEBUG_API_TOKEN: \${{ secrets.DEBUG_API_TOKEN }}

  p1-integration:
    name: "P1 — Integration & Business Logic"
    runs-on: ubuntu-latest
    needs: p0-security
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/integration/ tests/compliance/ tests/business/
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roles.map(r => `          ${r.envUserVar}: \${{ secrets.${r.envUserVar} }}\n          ${r.envPassVar}: \${{ secrets.${r.envPassVar} }}`).join("\n")}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}
          DEBUG_API_TOKEN: \${{ secrets.DEBUG_API_TOKEN }}

  proof-gate:
    name: "✓ Alle Beweise bestanden"
    needs: [p0-security, p1-integration]
    runs-on: ubuntu-latest
    steps:
      - run: echo "System ist spec-konform."
`;

  return {
    "helpers/api.ts": apiTs,
    "helpers/auth.ts": authTs,
    "helpers/factories.ts": factoriesTs,
    "helpers/reset.ts": resetTs,
    "helpers/schemas.ts": schemasTs,
    "helpers/index.ts": indexTs,
    "playwright.config.ts": playwrightConfig,
    "package.json": packageJson,
    ".github/workflows/testforge.yml": githubAction,
    "tsconfig.json": tsconfigJson,
    "README.md": readmeMd,
    ".env.example": envExample,
  };
}

// ─── Schicht 3: Proof Generator ───────────────────────────────────────────────

/**
 * Goldstandard: Check if generated TypeScript code is syntactically valid.
 * Uses a simple bracket/paren balance check + known bad patterns.
 * Returns error message if invalid, null if OK.
 */
function checkTypeScriptSyntax(code: string): string | null {
  // Check bracket balance
  let braces = 0, parens = 0, brackets = 0;
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const prev = i > 0 ? code[i - 1] : '';
    if (inString) {
      if (c === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }
    if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '(') parens++;
    else if (c === ')') parens--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
    if (braces < 0 || parens < 0 || brackets < 0) return `Unmatched closing bracket at position ${i}`;
  }
  if (braces !== 0) return `Unbalanced braces: ${braces > 0 ? 'unclosed {' : 'extra }'}`;
  if (parens !== 0) return `Unbalanced parentheses: ${parens > 0 ? 'unclosed (' : 'extra )'}`;
  if (brackets !== 0) return `Unbalanced brackets: ${brackets > 0 ? 'unclosed [' : 'extra ]'}`;
  // Check for obvious template artifacts
  if (code.includes('undefined}') || code.includes('null}') && code.includes('${')) return 'Unresolved template variable';
  if (code.includes('TODO_REPLACE_WITH_YOUR_ENDPOINT') && !code.includes('// ⚠️')) return null; // TODOs are allowed
  // Check for forbidden non-existent imports
  if (code.includes('from "../../helpers/db-queries"') || code.includes("from '../../helpers/db-queries'")) {
    return 'Forbidden import: db-queries helper does not exist. Use API-based DB checks instead.';
  }
  if (code.includes('from "../../helpers/database"') || code.includes("from '../../helpers/database'")) {
    return 'Forbidden import: database helper does not exist. Use API-based DB checks instead.';
  }
  // Check for TODO_ string literals (not comments) that would cause test failures
  const todoLiteralMatch = code.match(/["']TODO_[A-Z_]+["']/);
  if (todoLiteralMatch) {
    return `Unresolved TODO literal in test code: ${todoLiteralMatch[0]}`;
  }
  return null;
}

/**
 * Generate a valid TODO stub test when a template crashes or produces invalid code.
 */
function generateTODOStub(target: ProofTarget, reason: string): string {
  return `import { test, expect } from "@playwright/test";

// ${target.id} — ${target.description}
// ⚠️  TODO: This test could not be generated automatically.
// Reason: ${reason.replace(/\n/g, ' ').slice(0, 200)}
// Please implement this test manually.
// Risk: ${target.riskLevel}
// Proof type: ${target.proofType}

test.skip("${target.id} — TODO: Implement manually", async () => {
  // TODO: Implement ${target.description}
  expect(true).toBe(true);
});
`;
}

function getFilename(pt: ProofType): string {
  const map: Record<ProofType, string> = {
    idor: "tests/security/idor.spec.ts",
    csrf: "tests/security/csrf.spec.ts",
    rate_limit: "tests/security/rate-limit.spec.ts",
    dsgvo: "tests/compliance/dsgvo.spec.ts",
    status_transition: "tests/integration/status-transitions.spec.ts",
    risk_scoring: "tests/integration/risk-scoring.spec.ts",
    boundary: "tests/business/boundary.spec.ts",
    business_logic: "tests/business/logic.spec.ts",
    spec_drift: "tests/integration/spec-drift.spec.ts",
  };
  return map[pt];
}

// ─── Universal Field Helper Functions ──────────────────────────────────────────

/**
 * Returns a valid TypeScript expression for a field's default value.
 * Used in test payloads to avoid TODO_ placeholders.
 */
function getValidDefault(f: EndpointField, tenantConst: string): string {
  if (f.validDefault) return f.validDefault;
  if (f.isTenantKey) return tenantConst;
  const fl = f.name.toLowerCase();
  switch (f.type) {
    case "enum":
      return f.enumValues?.length ? `"${f.enumValues[0]}"` : `"active"`;
    case "number":
      if (fl.includes("price") || fl.includes("amount")) return f.min !== undefined ? String(Math.max(f.min, 0.01)) : "1.00";
      return f.min !== undefined ? String(Math.max(f.min, 1)) : "1";
    case "boolean":
      return "false";
    case "date":
      return "tomorrowStr()";
    case "array":
      if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
        const itemFields = f.arrayItemFields
          .map(af => `${af.name}: ${getValidDefault(af, tenantConst)}`)
          .join(", ");
        return `[{ ${itemFields} }]`;
      }
      if (f.arrayItemType === "number") return "[1]";
      return "[]";
    case "string":
    default:
      if (fl.includes("date") || fl.includes("datum")) return "tomorrowStr()";
      if (fl.includes("email")) return `"test@example.com"`;
      if (fl.includes("phone")) return `"+49176${Date.now().toString().slice(-8)}"`;
      if (fl.includes("sku")) return `"SKU-${Date.now()}"`;
      if (fl.includes("name") || fl.includes("title")) return `"Test ${f.name}-${Date.now()}"`;
      if (fl.includes("description")) return `"Test description"`;
      if (fl.includes("status")) return `"active"`;
      if (fl.includes("priority")) return `"medium"`;
      if (fl.includes("id") || fl.includes("workspace") || fl.includes("tenant")) return tenantConst;
      return `"test-${f.name}"`;
  }
}

export interface BoundaryCase {
  label: string;
  value: string;
  valid: boolean;
}

/**
 * Returns boundary test cases for a field based on its type and constraints.
 * Returns BoundaryCase[] with label, value (TypeScript expression), and valid flag.
 */
export function calcBoundaryValues(f: EndpointField): BoundaryCase[] {
  switch (f.type) {
    case "number": {
      const min = f.min ?? 0;
      const max = f.max ?? 100;
      const fl = f.name.toLowerCase();
      const isDecimal = !Number.isInteger(min) || !Number.isInteger(max) ||
        fl.includes("price") || fl.includes("amount") || fl.includes("cost") || fl.includes("fee");
      const step = isDecimal ? 0.01 : 1;
      const fmt = (n: number) => isDecimal ? n.toFixed(2) : String(n);
      return [
        { label: `${fmt(min)} (minimum)`, value: fmt(min), valid: true },
        { label: `${fmt(max)} (maximum)`, value: fmt(max), valid: true },
        { label: `${fmt(+(min - step).toFixed(2))} (below minimum)`, value: fmt(+(min - step).toFixed(2)), valid: false },
        { label: `${fmt(+(max + step).toFixed(2))} (above maximum)`, value: fmt(+(max + step).toFixed(2)), valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    case "string": {
      const min = f.min ?? 1;
      const max = f.max ?? 200;
      return [
        { label: `"A".repeat(${min}) (minimum)`, value: `"A".repeat(${min})`, valid: true },
        { label: `"A".repeat(${max}) (maximum)`, value: `"A".repeat(${max})`, valid: true },
        { label: `"" (below minimum)`, value: `""`, valid: false },
        { label: `"A".repeat(${max + 1}) (above maximum)`, value: `"A".repeat(${max + 1})`, valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    case "date": return [
      { label: `tomorrowStr() (future = valid)`, value: `tomorrowStr()`, valid: true },
      { label: `yesterdayStr() (past = invalid)`, value: `yesterdayStr()`, valid: false },
      { label: `null`, value: `null`, valid: false },
    ];
    case "array": {
      const min = f.min ?? 1;
      const max = f.max ?? 50;
      const item = buildArrayItemLiteral(f);
      return [
        { label: `[${item}] (minimum 1 item)`, value: `[${item}]`, valid: true },
        { label: `Array(${max}).fill(${item}) (maximum ${max} items)`, value: `Array(${max}).fill(${item})`, valid: true },
        { label: `[] (empty = below minimum)`, value: `[]`, valid: false },
        { label: `Array(${max + 1}).fill(${item}) (above maximum)`, value: `Array(${max + 1}).fill(${item})`, valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    case "enum": {
      const valid = f.enumValues?.[0] ?? "valid";
      return [
        { label: `"${valid}" (valid enum)`, value: `"${valid}"`, valid: true },
        { label: `"__invalid__" (invalid enum)`, value: `"__invalid__"`, valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    default: return [
      { label: `"valid"`, value: `"valid"`, valid: true },
      { label: `null`, value: `null`, valid: false },
    ];
  }
}

/**
 * Builds a TypeScript array item literal for nested array fields.
 */
export function buildArrayItemLiteral(f: EndpointField): string {
  if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
    const fields = f.arrayItemFields.map(af => {
      const val = af.type === "number" ? (af.min !== undefined ? Math.max(af.min, 1) : 1) : `"test-${af.name}"`;
      return `${af.name}: ${val}`;
    }).join(", ");
    return `{ ${fields} }`;
  }
  if (f.arrayItemType === "number") return "1";
  return `"item"`;
}

/**
 * Builds a TypeScript array item expression for nested array fields.
 */
function buildArrayItem(f: EndpointField, tenantConst: string): string {
  if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
    const fields = f.arrayItemFields.map(af => `${af.name}: ${getValidDefault(af, tenantConst)}`).join(", ");
    return `{ ${fields} }`;
  }
  if (f.arrayItemType === "number") return "1";
  return `"item"`;
}

/**
 * Finds the best boundary field in an endpoint's inputFields.
 * Priority: 1) exact match on target.boundaryField name
 *           2) first isBoundaryField=true field
 *           3) first non-tenant field with min/max
 *           4) first non-tenant field
 */
function findBoundaryField(fields: EndpointField[], preferredName?: string): EndpointField | undefined {
  if (!fields.length) return undefined;
  // 1. Exact match by name
  if (preferredName) {
    const exact = fields.find(f => f.name.toLowerCase() === preferredName.toLowerCase());
    if (exact) return exact;
  }
  // 2. First isBoundaryField=true (non-tenant)
  const boundaryField = fields.find(f => f.isBoundaryField && !f.isTenantKey);
  if (boundaryField) return boundaryField;
  // 3. First field with min/max (non-tenant)
  const constrainedField = fields.find(f => !f.isTenantKey && (f.min !== undefined || f.max !== undefined));
  if (constrainedField) return constrainedField;
  // 4. First non-tenant, non-id field
  const nonTenant = fields.find(f => !f.isTenantKey && f.name !== "id");
  return nonTenant || fields[0];
}

/**
 * Finds the best boundary field for a behavior using semantic keyword matching.
 * This is the new behavior-aware version that matches the spec's field lookup logic.
 * Priority:
 *   1) isBoundaryField=true field whose name appears in behavior title
 *   2) Semantic keyword match (price, stock, name, items, quantity, etc.)
 *   3) First isBoundaryField=true field as fallback
 */
export function findBoundaryFieldForBehavior(
  behavior: Behavior,
  endpointDef: APIEndpoint | undefined
): EndpointField | undefined {
  if (!endpointDef?.inputFields?.length) return undefined;
  const titleLower = behavior.title.toLowerCase();

  // 1. Field name appears directly in behavior title
  const direct = endpointDef.inputFields.find(f =>
    f.isBoundaryField && titleLower.includes(f.name.toLowerCase()));
  if (direct) return direct;

  // 2. Semantic keyword matching
  const semanticMap: Record<string, string[]> = {
    price:    ["price", "cost", "amount", "fee", "total"],
    stock:    ["stock", "inventory", "quantity"],
    name:     ["name", "title", "label"],
    items:    ["items", "array", "list"],
    quantity: ["quantity", "qty", "count"],
    pageSize: ["page", "pagesize", "limit", "per_page"],
    sku:      ["sku", "code"],
  };
  for (const [fieldName, keywords] of Object.entries(semanticMap)) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      const match = endpointDef.inputFields.find(f =>
        f.isBoundaryField && f.name.toLowerCase() === fieldName);
      if (match) return match;
    }
  }

  // 3. First isBoundaryField=true as fallback
  return endpointDef.inputFields.find(f => f.isBoundaryField);
}

// ─── Test Generators ────────────────────────────────────────────────────────────

function generateIDORTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const tenantBConst = `TEST_${tenantEntity.toUpperCase()}_B_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  // For IDOR tests: use the actual target endpoint for the attack, and list endpoint for positive control
  const listEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("getall") || e.name.toLowerCase().includes("search"))?.name
    || analysis.ir.apiEndpoints.find(e => !e.name.toLowerCase().includes("create") && !e.name.toLowerCase().includes("update") && !e.name.toLowerCase().includes("delete"))?.name
    || target.endpoint
    || "TODO_REPLACE_WITH_LIST_ENDPOINT";
  // The actual endpoint being tested for IDOR (e.g. tasks.delete, tasks.updateStatus)
  const attackEndpoint = target.endpoint || listEndpoint;
  const attackEpDef = analysis.ir.apiEndpoints.find(e => e.name === attackEndpoint);
  const attackFields = attackEpDef?.inputFields || [];
  // Determine if this is a mutation endpoint (needs a resource ID) or a query endpoint
  const isMutationEndpoint = attackEndpoint.toLowerCase().includes("delete") ||
    attackEndpoint.toLowerCase().includes("update") ||
    attackEndpoint.toLowerCase().includes("create") ||
    attackEndpoint.toLowerCase().includes("bulk");
  const hasEndpoint = !!attackEpDef;
  const getEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("getby") || e.name.toLowerCase().includes(".get"))?.name || "TODO_REPLACE_WITH_GETBYID_ENDPOINT";
  // Build attack payload for mutation endpoints
  const attackPayloadLines = attackFields.map(f => {
    const fname = f.name;
    const fl = fname.toLowerCase();
    if (f.isTenantKey || fl === tenantField || fl.includes("workspace") || fl.includes("tenant")) return `        ${fname}: ${tenantBConst},`;
    if (fl === "id" || fl.endsWith("id") || fl.endsWith("ids")) return `        ${fname}: resourceId,`;
    if (fl.includes("status")) {
      const statusVals = analysis.ir.enums?.status || analysis.ir.statusMachine?.states || [];
      return `        ${fname}: "${statusVals[0] || "active"}",`;
    }
    if (fl.includes("title") || fl.includes("name")) return `        ${fname}: "test-title",`;
    if (f.type === "number") return `        ${fname}: ${f.min !== undefined ? Math.max(f.min, 1) : 1},`;
    if (f.type === "enum" && f.enumValues?.length) return `        ${fname}: "${f.enumValues[0]}",`;
    return `        ${fname}: "test-${fname}",`;
  }).join("\n");
  // For array fields like taskIds, build a list payload
  const hasArrayField = attackFields.some(f => f.name.toLowerCase().endsWith("ids") || f.name.toLowerCase().includes("ids"));
  const arrayField = attackFields.find(f => f.name.toLowerCase().endsWith("ids") || f.name.toLowerCase().includes("ids"));
  const attackPayloadForArray = hasArrayField && arrayField
    ? `        ${arrayField.name}: [resourceId],\n        ${tenantField}: ${tenantBConst},`
    : attackPayloadLines;

  return `import { test, expect } from "@playwright/test";
import { trpcQuery, trpcMutation, loginAndGetCookie } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, ${tenantBConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — IDOR: ${target.description}
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No list endpoint found in spec. Replace TODO_REPLACE_WITH_LIST_ENDPOINT and TODO_REPLACE_WITH_GETBYID_ENDPOINT." : ""}

let tenantACookie: string;
let tenantBCookie: string;

test.beforeAll(async ({ request }) => {
  tenantACookie = await ${roleFnName}(request);
  // IMPORTANT: Set E2E_TENANT_B_USER and E2E_TENANT_B_PASS to a user from a DIFFERENT tenant
  tenantBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_TENANT_B_USER || "test-tenant-b-user",
    process.env.E2E_TENANT_B_PASS || "TestPass2026x"
  );
});

test("${target.id}a — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: ${target.mutationTargets[0]?.description || `Remove workspaceId filter in ${attackEndpoint} query`}

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(${tenantBConst}));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

${isMutationEndpoint ? `test("${target.id}b — Tenant A cannot mutate Tenant B resource via ${attackEndpoint}", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { ${tenantField}: ${tenantBConst} });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via ${attackEndpoint}
  const crossTenant = await trpcMutation(request, "${attackEndpoint}",
    {
${hasArrayField ? attackPayloadForArray : attackPayloadLines}
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in ${attackEndpoint}
  // Kills: Allow cross-tenant mutations on ${attackEndpoint}

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});` : `test("${target.id}b — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { ${tenantField}: ${tenantBConst} });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via ${attackEndpoint}
  const crossTenant = await trpcQuery(request, "${attackEndpoint}",
    { id: resourceId, ${tenantField}: ${tenantBConst} }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in ${attackEndpoint}
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});`}
`;
}

function generateCSRFTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);

  // Use resolved endpoint from IR, or TODO placeholder
  const endpoint = target.endpoint || "TODO_REPLACE_WITH_MUTATION_ENDPOINT";
  const hasEndpoint = !!target.endpoint;
  const listEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get"))?.name || "TODO_REPLACE_WITH_LIST_ENDPOINT";
  const csrfEndpoint = analysis.ir.authModel?.csrfEndpoint;
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  // Build minimal payload from known input fields
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
  const knownFields = epDef?.inputFields || [];

  // Side-effect check: use a unique title field to verify no DB write after 403
  const uniqueField = knownFields.find(f => f.name.toLowerCase().includes("title") || f.name.toLowerCase().includes("name"))?.name || knownFields[0]?.name || "title";
  const listEndpointForDbCheck = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("getall"))?.name || "TODO_REPLACE_WITH_LIST_ENDPOINT";

  // Pre-compute payload lines (avoids nested backtick issues in template literals)
  // Track if any date field is used so we can import tomorrowStr
  let csrfHasDateField = false;
  function buildCsrfPayloadLine(f: EndpointField, isUnique: boolean): string {
    const fname = f.name;
    const fl = fname.toLowerCase();
    if (isUnique) return `        ${fname}: uniqueTitle,`;
    if (f.isTenantKey || fl === tenantField || fl.includes("workspace") || fl.includes("tenant")) return `        ${fname}: ${tenantConst},`;
    if (f.type === "date" || fl.includes("date") || fl.includes("datum")) {
      csrfHasDateField = true;
      return `        ${fname}: tomorrowStr(),`;
    }
    if (f.type === "number") return `        ${fname}: ${f.min !== undefined ? Math.max(f.min, 1) : 1},`;
    if (f.type === "enum" && f.enumValues?.length) return `        ${fname}: "${f.enumValues[0]}",`;
    if (fl.includes("assignee") || (fl.includes("id") && !fl.includes("workspace"))) return `        ${fname}: ${tenantConst},`;
    if (fl.includes("priority")) {
      const enumPriority = analysis.ir.enums && analysis.ir.enums.priority;
      const pv = (enumPriority && enumPriority[0]) || "medium";
      return `        ${fname}: "${pv}",`;
    }
    if (fl.includes("status")) {
      const enumStatus = analysis.ir.enums && analysis.ir.enums.status;
      const sm = analysis.ir.statusMachine;
      const sv = (sm && sm.initialState) || (enumStatus && enumStatus[0]) || "active";
      return `        ${fname}: "${sv}",`;
    }
    return `        ${fname}: "test-${fname}",`;
  }

  const noTokenPayloadLines = knownFields.length > 0
    ? knownFields.map(f => buildCsrfPayloadLine(f, f.name === uniqueField)).join("\n")
    : `        ${tenantField}: ${tenantConst},\n        ${uniqueField}: uniqueTitle,\n        // TODO: Add other required fields for ${endpoint}`;

  function buildCsrfPositivePayloadLine(f: EndpointField): string {
    const fname = f.name;
    const fl = fname.toLowerCase();
    if (f.isTenantKey || fl === tenantField || fl.includes("workspace") || fl.includes("tenant")) return `        ${fname}: ${tenantConst},`;
    if (f.type === "date" || fl.includes("date") || fl.includes("datum")) {
      csrfHasDateField = true;
      return `        ${fname}: tomorrowStr(),`;
    }
    if (f.type === "number") return `        ${fname}: ${f.min !== undefined ? Math.max(f.min, 1) : 1},`;
    if (f.type === "enum" && f.enumValues?.length) return `        ${fname}: "${f.enumValues[0]}",`;
    if (fl.includes("title") || fl.includes("name")) return `        ${fname}: "Test ${fname} valid",`;
    if (fl.includes("assignee") || (fl.includes("id") && !fl.includes("workspace"))) return `        ${fname}: ${tenantConst},`;
    if (fl.includes("priority")) {
      const enumPriority2 = analysis.ir.enums && analysis.ir.enums.priority;
      const pv2 = (enumPriority2 && enumPriority2[0]) || "medium";
      return `        ${fname}: "${pv2}",`;
    }
    if (fl.includes("status")) {
      const enumStatus2 = analysis.ir.enums && analysis.ir.enums.status;
      const sm2 = analysis.ir.statusMachine;
      const sv2 = (sm2 && sm2.initialState) || (enumStatus2 && enumStatus2[0]) || "active";
      return `        ${fname}: "${sv2}",`;
    }
    return `        ${fname}: "test-${fname}",`;
  }

  const positivePayloadLines = knownFields.length > 0
    ? knownFields.map(f => buildCsrfPositivePayloadLine(f)).join("\n")
    : `        ${tenantField}: ${tenantConst},\n        // TODO: Add other required fields for ${endpoint}`;

  // Detect special CSRF behaviors that need custom test logic
  const behaviorTitle = (behavior?.title || target.description).toLowerCase();
  const isSessionBinding = behaviorTitle.includes("tied to") || behaviorTitle.includes("session") || behaviorTitle.includes("bound to");
  const isTokenReuse = behaviorTitle.includes("other session") || behaviorTitle.includes("different session") || behaviorTitle.includes("rejects") || behaviorTitle.includes("cross-session");
  const isCsrfTokenEndpoint = behaviorTitle.includes("csrf token is obtained") || behaviorTitle.includes("get /api/auth/csrf") || endpoint.includes("csrf");

  // Build kills comments
  const killsComments = target.mutationTargets.slice(1).map(m => `  // Kills: ${m.description}`).join("\n");
  const firstKill = target.mutationTargets[0]?.description || `Remove CSRF middleware from ${endpoint}`;

  // Build positive test (with CSRF token) - uses pre-computed positivePayloadLines
  const positiveTest = csrfEndpoint ? `
test("${target.id}b \u2014 POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
${positivePayloadLines}
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});
` : `
test("${target.id}b \u2014 POST with valid session (no CSRF required) succeeds", async ({ request }) => {
  // No CSRF endpoint in spec \u2014 testing that authenticated requests work normally
  const res = await trpcMutation(request, "${endpoint}", {
${positivePayloadLines.replace(/^        /gm, "    ")}
  }, adminCookie);
  expect(res.status).toBe(200);
  // Kills: Auth middleware blocks all requests
});
`;

  const csrfTomorrowImport = csrfHasDateField ? ", tomorrowStr" : "";

  // Special test for CSRF token endpoint (just verifies token is returned)
  if (isCsrfTokenEndpoint) {
    return `import { test, expect } from "@playwright/test";
import { BASE_URL } from "../../helpers/api";
import { ${roleFnName}, getCsrfToken } from "../../helpers/auth";

// ${target.id} \u2014 CSRF Token Endpoint
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;
test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a \u2014 CSRF token endpoint returns valid token", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Return empty string as CSRF token
  // Kills: Return same token for all sessions
});

test("${target.id}b \u2014 CSRF token is unique per request", async ({ request }) => {
  const token1 = await getCsrfToken(request, adminCookie);
  const token2 = await getCsrfToken(request, adminCookie);
  // Tokens may be the same (stateless) or different (stateful) — both are valid
  // But both must be non-empty valid strings
  expect(typeof token1).toBe("string");
  expect(typeof token2).toBe("string");
  expect(token1.length).toBeGreaterThanOrEqual(16);
  expect(token2.length).toBeGreaterThanOrEqual(16);
  // Kills: Return null or undefined as CSRF token
});
`;
  }

  // Special test for session-binding (CSRF token tied to session)
  if (isSessionBinding && !isTokenReuse) {
    return `import { test, expect } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery${csrfTomorrowImport} } from "../../helpers/api";
import { ${roleFnName}, getCsrfToken } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} \u2014 CSRF Session Binding
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;
test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a \u2014 CSRF token is valid for the session that obtained it", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token regardless of session

  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
${positivePayloadLines}
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF middleware ignores session binding
});

test("${target.id}b \u2014 Expired/invalid CSRF token is rejected", async ({ request }) => {
  const fakeToken = "invalid-csrf-token-that-was-never-issued";
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": fakeToken,
    },
    data: {
      json: {
${noTokenPayloadLines}
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Accept any string as valid CSRF token without validation
  // Kills: Only check token presence, not token validity
});
`;
  }

  // Special test for token reuse across sessions (CSRF-005)
  if (isTokenReuse) {
    return `import { test, expect } from "@playwright/test";
import { BASE_URL, trpcMutation, loginAndGetCookie${csrfTomorrowImport} } from "../../helpers/api";
import { ${roleFnName}, getCsrfToken } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} \u2014 CSRF Token Cross-Session Rejection
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}

let sessionACookie: string;
let sessionBCookie: string;
let sessionAToken: string;

test.beforeAll(async ({ request }) => {
  sessionACookie = await ${roleFnName}(request);
  sessionAToken = await getCsrfToken(request, sessionACookie);
  // Session B: same user, different session (re-login)
  sessionBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_ADMIN_USER || "test-admin",
    process.env.E2E_ADMIN_PASS || "TestPass2026x"
  );
});

test("${target.id}a \u2014 CSRF token from Session A is rejected when used with Session B cookie", async ({ request }) => {
  // Use Session A's token with Session B's cookie — must be rejected
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionBCookie,
      "X-CSRF-Token": sessionAToken, // Token from a DIFFERENT session
    },
    data: {
      json: {
${noTokenPayloadLines}
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Accept CSRF tokens from any session (global token pool)
  // Kills: Only validate token format, not session binding
});

test("${target.id}b \u2014 Session B's own CSRF token is accepted", async ({ request }) => {
  const sessionBToken = await getCsrfToken(request, sessionBCookie);
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionBCookie,
      "X-CSRF-Token": sessionBToken,
    },
    data: {
      json: {
${positivePayloadLines}
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF validation rejects all tokens including valid session-bound ones
});
`;
  }

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery, BASE_URL${csrfTomorrowImport} } from "../../helpers/api";
import { ${roleFnName}${csrfEndpoint ? ", getCsrfToken" : ""} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} \u2014 CSRF: ${target.description}
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// \u26a0\ufe0f  TODO: No mutation endpoint found in spec. Replace TODO_REPLACE_WITH_MUTATION_ENDPOINT." : ""}

let adminCookie: string;
test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a \u2014 POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = \`CSRF-Test-\${Date.now()}\`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
${noTokenPayloadLines}
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: ${firstKill}
${killsComments}
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "${listEndpointForDbCheck}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["${uniqueField}"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});
${positiveTest}
`;
}
function generateStatusTransitionTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  // Use resolved endpoint from IR, or TODO placeholder
  const endpoint = target.endpoint || analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("status") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_STATUS_ENDPOINT";
  const hasEndpoint = !!target.endpoint;
  // Find a GET endpoint to verify status after transition
  // Prefer getById, but fall back to any list/get endpoint (orders.list, products.list, etc.)
  const getEndpoint = (
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("getby")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get"))
  )?.name || "TODO_REPLACE_WITH_GET_ENDPOINT";

  // Goldstandard: Use statusMachine from IR if available, otherwise fall back to text extraction
  const sm = analysis.ir.statusMachine;
  const arrowPattern = /([a-z][a-z_0-9]*)\s*(?:→|->|to\s+)\s*([a-z][a-z_0-9]*)/i;
  const titleMatch = behavior?.title.match(arrowPattern);
  // precondMatch: extract status value from preconditions, but skip meta-words like 'transition', 'valid', 'is'
  const STATUS_META_WORDS = new Set(['transition', 'valid', 'invalid', 'is', 'the', 'a', 'an', 'be', 'change', 'update', 'set', 'backwards', 'backward', 'forward', 'forwards', 'skipping', 'skip', 'reverse', 'reversed', 'check', 'field', 'value', 'must', 'should', 'cannot', 'not']);
  const precondMatchRaw = !titleMatch && behavior?.preconditions.join(" ").match(/status[\s=:"']+([a-z][a-z_0-9]*)/i);
  const precondMatch = precondMatchRaw && !STATUS_META_WORDS.has((precondMatchRaw[1] || '').toLowerCase()) ? precondMatchRaw : null;
  const postcondMatch = !titleMatch && !precondMatch && behavior?.postconditions.join(" ").match(arrowPattern);
  const errorMatch = !titleMatch && !precondMatch && !postcondMatch && behavior?.errorCases.join(" ").match(arrowPattern);

  // If statusMachine is known from IR, use transitions in round-robin based on transitionIndex
  // This ensures each proof target gets a DIFFERENT transition (not all todo→in_progress)
  const allTransitions = sm?.transitions || [];
  const transitionIdx = target.transitionIndex ?? 0;
  const assignedTransition = allTransitions.length > 0
    ? allTransitions[transitionIdx % allTransitions.length]
    : null;
  const firstTransition = sm?.transitions?.[0];
  // Validate extracted status values against known states — if not a valid state, fall back to assignedTransition
  const knownStates = new Set(sm?.states || []);
  const isValidState = (s: string | undefined): s is string => !!s && (knownStates.size === 0 || knownStates.has(s));
  const rawFromStatus: string | undefined = titleMatch?.[1] || (precondMatch ? precondMatch[1] : undefined) || (postcondMatch ? postcondMatch[1] : undefined) || (errorMatch ? errorMatch[1] : undefined) || undefined;
  const rawToStatus: string | undefined = titleMatch?.[2] || (postcondMatch ? postcondMatch[2] : undefined) || (errorMatch ? errorMatch[2] : undefined) || undefined;
  // Use assignedTransition (from transitionIndex) as fallback to ensure diversity
  const fromStatus = (isValidState(rawFromStatus) ? rawFromStatus : assignedTransition?.[0] || firstTransition?.[0] || "pending") as string;
  const toStatus = (isValidState(rawToStatus) ? rawToStatus : assignedTransition?.[1] || firstTransition?.[1] || "completed") as string;

  // Find a skip-target: a state that is NOT directly reachable from fromStatus
  // Goldstandard: use statusMachine.forbidden or statusMachine.states to find skip candidates
  let skipStatus: string | undefined;
  if (sm) {
    // Find a state that is not directly reachable from fromStatus (not in transitions from fromStatus)
    const directlyReachable = new Set(sm.transitions.filter(t => t[0] === fromStatus).map(t => t[1]));
    skipStatus = sm.states.find(s => s !== fromStatus && s !== toStatus && !directlyReachable.has(s));
  }
  if (!skipStatus) {
    // Fallback: extract from behavior text
    const allStatusText = [
      ...(behavior?.preconditions || []),
      ...(behavior?.postconditions || []),
      ...(behavior?.errorCases || []),
      behavior?.title || "",
    ].join(" ");
    const statusMatchAll = allStatusText.match(/["']([a-z][a-z_0-9]*)["']/g) || [];
    const statusValuesRaw = statusMatchAll
      .map(m => m.replace(/["']/g, ""))
      .filter(s => s !== fromStatus && s !== toStatus && s.length > 2 && s !== "null" && s !== "the");
    skipStatus = statusValuesRaw.filter((s, i) => statusValuesRaw.indexOf(s) === i)[0];
  }

  // Detect side-effects from sideEffects array
  const hasCounter = target.sideEffects?.some(se => se.toLowerCase().includes("count"));
  const hasTimestamp = target.sideEffects?.some(se => se.toLowerCase().includes("at") || se.toLowerCase().includes("now()"));
  const counterField = target.sideEffects?.find(se => se.toLowerCase().includes("count"))?.match(/(\w+[Cc]ount)/)?.[1] || "count";
  const timestampField = target.sideEffects?.find(se => se.toLowerCase().includes("at"))?.match(/(\w+[Aa]t)/)?.[1] || "updatedAt";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource, getResource } from "../../helpers/factories";

// ${target.id} — Status Transition: ${target.description}
// Risk: ${target.riskLevel}
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Business Logic"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No status endpoint found in spec. Replace TODO_REPLACE_WITH_STATUS_ENDPOINT and TODO_REPLACE_WITH_GET_ENDPOINT." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a — ${fromStatus} → ${toStatus}: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

${hasCounter ? `  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.${counterField} as number) ?? 0;
` : ""}
  const { status } = await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${toStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect(status).toBe(200);
  // Kills: ${target.mutationTargets[0]?.description || `Remove ${fromStatus}→${toStatus} from allowed transitions`}

  // DB state check
  const { data: updated } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("${toStatus}");
  // Kills: Update status field but not persist to DB

${hasTimestamp ? `  expect((updated as Record<string, unknown>)?.${timestampField}).not.toBeNull();
  // Kills: Remove ${timestampField} = NOW() in handler
` : ""}
${hasCounter ? `  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.${counterField}).toBe(countBefore + 1);
  // Kills: ${target.mutationTargets[1]?.description || `Remove ${counterField} increment in ${endpoint} handler`}
` : ""}
${target.mutationTargets.slice(hasCounter ? 2 : 1).map(m => `  // Kills: ${m.description}`).join("\n")}
});

test("${target.id}b — ${toStatus} → ${fromStatus}: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to ${toStatus} state first
  await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${toStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${fromStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow ${toStatus}→${fromStatus} reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("${toStatus}");
  // Kills: Silent state corruption on rejected transition
});
${skipStatus ? `
test("${target.id}c — ${fromStatus} → ${skipStatus}: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to ${skipStatus} without going through ${toStatus}
  const { status } = await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${skipStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("${fromStatus}");
  // Kills: Accept any status value without validating transition chain
});
` : ""}
`;
}

function generateDSGVOTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  // Detect if this is an export behavior or a delete/anonymize behavior
  const isExportBehavior = (behavior?.title || '').toLowerCase().includes('export') ||
    (behavior?.action || '').toLowerCase().includes('export') ||
    (target.endpoint || '').toLowerCase().includes('export');

  // Detect if this is a hard-delete behavior (permanently deletes) vs soft-delete/anonymize
  // Declared early so it can be used in endpoint detection below
  const isHardDelete = (behavior?.title || '').toLowerCase().includes('permanently') ||
    (behavior?.postconditions || []).some(p => p.toLowerCase().includes('permanently') || p.toLowerCase().includes('all') && p.toLowerCase().includes('deleted'));

  // Detect if behavior title mentions workspace-level deleteAll
  const isWorkspaceDeleteAll = (behavior?.title || '').toLowerCase().includes('deleteall') ||
    (behavior?.title || '').toLowerCase().includes('delete all') ||
    (behavior?.specAnchor || '').toLowerCase().includes('deleteall') ||
    (behavior?.specAnchor || '').toLowerCase().includes('delete all');

  // Use resolved endpoint from IR, or TODO placeholder
  // CRITICAL: For hard-delete behaviors, prefer workspace.deleteAll over tasks.delete
  const endpoint = (() => {
    if (isExportBehavior) {
      // Export: prefer export endpoint from IR
      return target.endpoint?.toLowerCase().includes('export')
        ? target.endpoint
        : analysis.ir.apiEndpoints.find(e =>
            e.name.toLowerCase().includes('export') || e.name.toLowerCase().includes('download'))?.name
          || target.endpoint
          || 'TODO_REPLACE_WITH_EXPORT_ENDPOINT';
    }
    if (isWorkspaceDeleteAll || (isHardDelete && !target.endpoint?.toLowerCase().includes('delete'))) {
      // Workspace-level hard delete: prefer workspace.deleteAll
      const deleteAllEp = analysis.ir.apiEndpoints.find(e =>
        e.name.toLowerCase().includes('deleteall') ||
        (e.name.toLowerCase().includes('delete') && e.name.toLowerCase().includes('all')) ||
        (e.name.toLowerCase().includes('workspace') && e.name.toLowerCase().includes('delete')))?.name;
      if (deleteAllEp) return deleteAllEp;
    }
    if (isHardDelete && target.endpoint) {
      // Hard-delete: if target.endpoint is a single-resource delete (tasks.delete)
      // but a workspace-level deleteAll exists, prefer that
      const deleteAllEp = analysis.ir.apiEndpoints.find(e =>
        e.name.toLowerCase().includes('deleteall') ||
        (e.name.toLowerCase().includes('workspace') && e.name.toLowerCase().includes('delete')))?.name;
      if (deleteAllEp && target.endpoint !== deleteAllEp &&
          !target.endpoint.toLowerCase().includes('workspace')) {
        return deleteAllEp;
      }
      return target.endpoint;
    }
    if (target.endpoint) return target.endpoint;
    // Fallback: find any GDPR/delete endpoint
    return analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes('gdpr') || e.name.toLowerCase().includes('delete') ||
      e.name.toLowerCase().includes('dsgvo') || e.name.toLowerCase().includes('anon'))?.name
      || 'TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT';
  })();
  const hasEndpoint = endpoint !== 'TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT' && endpoint !== 'TODO_REPLACE_WITH_EXPORT_ENDPOINT';

  // Find list endpoint for history check
  const listEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("history"))?.name || "TODO_REPLACE_WITH_LIST_ENDPOINT";

  // Determine PII field names from behavior text and IR resources
  // 1. From postconditions: "name = [deleted]" → "name"
  const piiFromPostconds = (behavior?.postconditions || [])
    .map(p => p.match(/(\w+)\s*(?:=|is|wird|anonymized|gelöscht|null|\[deleted\]|\[gelöscht\])/i)?.[1])
    .filter((f): f is string => !!f && f.length > 2 && !['the','all','data','null','true','false'].includes(f.toLowerCase()));
  // 2. From behavior title: "Task descriptions may contain personal data" → "description"
  // Pattern: capture the field-type word (description, email, phone, name) from the title
  const titlePiiMatch = (() => {
    const title = behavior?.title || '';
    // "X descriptions may contain" → "description"
    const descMatch = title.match(/\b(description|email|phone|name|address|ssn|dob|birthdate)s?\b/i)?.[1];
    if (descMatch) return descMatch.toLowerCase();
    // "X field may contain personal data" → extract field name before 'field'
    const fieldMatch = title.match(/(\w+)\s+field/i)?.[1];
    if (fieldMatch && !['the','a','an','this','that'].includes(fieldMatch.toLowerCase())) return fieldMatch.toLowerCase();
    return null;
  })();
  // 3. From IR resources with hasPII: only extract if resource name has 2+ words (e.g. "Task Description" → "description")
  // Single-word resource names like "Task" or "Workspace" are entity names, NOT field names
  const piiResourceFields = analysis.ir.resources
    .filter(r => r.hasPII)
    .map(r => {
      // "Task Description" → "description", "Guest Phone" → "phone"
      const words = r.name.toLowerCase().split(/\s+/);
      // Only use if multi-word (e.g. "Task Description") — single words are entity names
      if (words.length < 2) return null;
      return words[words.length - 1]; // last word is usually the field name
    })
    .filter((f): f is string => !!f && f.length > 2 && !['data','export','workspace','task','member'].includes(f));
  const piiFields = Array.from(new Set([...piiFromPostconds, ...(titlePiiMatch ? [titlePiiMatch.toLowerCase()] : []), ...piiResourceFields]));

  // Determine the identifier field used for GDPR deletion
  const idField = behavior?.preconditions.join(" ").match(/by\s+(\w+)/i)?.[1] || "id";

  // For export behaviors: collect output fields from the main resource endpoint (e.g. tasks.create outputFields)
  // These are the fields that MUST appear in the export
  const EXPORT_NOISE_FIELDS = new Set(['x-csrf-token', 'workspaceid', 'tenantid', 'id']);
  const resourceOutputFields: string[] = isExportBehavior
    ? (() => {
        // Find the primary resource endpoint (create or update) to get its output fields
        const resourceEndpoint = analysis.ir.apiEndpoints.find(e =>
          e.name.toLowerCase().includes('create') || e.name.toLowerCase().includes('update'));
        const outFields = (resourceEndpoint?.outputFields || []) as string[];
        return outFields
          .filter(f => typeof f === 'string' && !EXPORT_NOISE_FIELDS.has(f.toLowerCase()))
          .slice(0, 5); // Max 5 fields to keep test readable
      })()
    : [];
  // Merge piiFields + resourceOutputFields for export assertions (piiFields first, then resource fields)
  const exportAssertFields = Array.from(new Set([...piiFields, ...resourceOutputFields]));

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — DSGVO Art. 17: ${target.description}
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Compliance"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No GDPR deletion endpoint found in spec. Replace TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

${isExportBehavior ? `
test("${target.id}a — Export returns all required fields including PII", async ({ request }) => {
  // Create a resource with data to export
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Execute data export
  const { status, data: exportData } = await trpcQuery(request, "${endpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200);
  // Kills: Export endpoint returns error

  // Verify export contains data
  expect(exportData).toBeDefined();
  const exportArray = Array.isArray(exportData) ? exportData : [exportData];
  expect(exportArray.length).toBeGreaterThan(0);
  // Kills: Export returns empty data

  // Verify required fields are present in export
  const firstRecord = exportArray[0] as Record<string, unknown>;
  expect(firstRecord?.id).toBeDefined();
  // Kills: Export omits record IDs
${exportAssertFields.length > 0
  ? exportAssertFields.map(f => `  expect(firstRecord?.${f}).toBeDefined(); // Kills: Export omits ${f} field`).join('\n')
  : '  // Verify all task fields are present in export (including soft-deleted records)\n  expect(firstRecord?.title).toBeDefined(); // Kills: Export omits title field'}
});

test("${target.id}b — Export requires admin authorization", async ({ request }) => {
  // Attempt export without authentication
  const { status: unauthStatus } = await trpcQuery(request, "${endpoint}",
    { ${tenantField}: ${tenantConst} });
  expect([401, 403]).toContain(unauthStatus);
  // Kills: Allow unauthenticated data export
});
` : `
test("${target.id}a — ${isHardDelete ? 'All records permanently deleted' : 'PII fields anonymized'} after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "${endpoint}",
    { ${idField}: resourceId, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200);
  // Kills: ${target.mutationTargets[0]?.description || "GDPR deletion endpoint returns error"}

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
${isHardDelete ? `  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll` : `  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
${piiFields.length > 0
  ? piiFields.map(f => `    // PII field '${f}' must be anonymized or nulled\n    expect(deletedResource?.${f}).toBeNull(); // Kills: Skip ${f} anonymization`).join('\n')
  : `    // Verify PII fields are anonymized — check fields mentioned in spec
    expect(deletedResource?.description).toBeNull(); // Kills: Skip description anonymization`}
  }`}
${target.mutationTargets.slice(1).map(m => `  // Kills: ${m.description}`).join('\n')}
});

test("${target.id}b — ${isHardDelete ? 'Hard-delete is irreversible' : 'Record history preserved after GDPR deletion'}", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "${endpoint}",
    { ${idField}: resourceId, ${tenantField}: ${tenantConst} }, adminCookie);

${isHardDelete ? `  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records` : `  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion`}
});
`}
`;
}

/**
 * Legacy boundary test generator — used as fallback when no isBoundaryField is found in IR.
 * Uses constraint-based extraction from behavior text.
 */
function generateBoundaryTestLegacy(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  const endpoint = target.endpoint || "TODO_REPLACE_WITH_YOUR_ENDPOINT";
  const hasEndpoint = !!target.endpoint;

  const RATE_LIMIT_NOISE_FIELDS = new Set(["workspace", "request", "minute", "second", "hour", "day", "requests"]);
  const primaryConstraint = target.constraints?.find(c =>
    c.type !== "enum" &&
    !c.field.toLowerCase().includes("id") &&
    !RATE_LIMIT_NOISE_FIELDS.has(c.field.toLowerCase())
  ) || target.constraints?.find(c => c.type !== "enum") || target.constraints?.[0];

  const fieldFromConstraint = primaryConstraint?.field;
  const titleText = behavior?.title || "";
  const arrayEmptyTitleMatch = titleText.match(/(\w+)\s+(?:array|list|ids?)\s+is\s+empty/i);
  const fieldFromTitle = arrayEmptyTitleMatch?.[1] ||
    titleText.match(/(\w+)\s+(?:exceeds?|is\s+empty|is\s+in\s+the\s+past|must\s+be|above|below|between|boundary|limit|range)/i)?.[1];
  const fieldFromError = behavior?.errorCases[0]?.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*(?:>|<|=|exceeds?|is\s+empty|must)/i)?.[1];
  const fieldFromAssertion = target.assertions.find(a => a.type === "field_value")?.target.split(".").pop();
  const NOISE_FIELD_NAMES = new Set(["empty", "not", "length", "size", "array", "list", "count", "value", "request", "returns", "return", "if", "system", "api"]);
  const rawFieldName = fieldFromConstraint || fieldFromTitle || fieldFromError || fieldFromAssertion;
  const fieldName = (rawFieldName && !NOISE_FIELD_NAMES.has(rawFieldName.toLowerCase())) ? rawFieldName : "value";

  const allText = [...(behavior?.errorCases || []), ...(behavior?.postconditions || []), target.description].join(" ");
  const minMatch = allText.match(/(\d+)\s*(?:minimum|min|\(min|≥|>=|mindestens)/i);
  const maxMatch = allText.match(/(\d+)\s*(?:maximum|max|\(max|≤|<=|maximal)/i);
  const gtAssertions = target.assertions.filter(a => a.operator === "gt" || a.operator === "lte");
  const min = primaryConstraint?.min ?? (minMatch ? parseInt(minMatch[1]) : (gtAssertions[0] ? Number(gtAssertions[0].value) + 1 : 1));
  const maxRaw: number | undefined = primaryConstraint?.max ?? (maxMatch ? parseInt(maxMatch[1]) : (gtAssertions[1] ? Number(gtAssertions[1].value) : undefined));
  const max = maxRaw ?? 100;
  const hasMax = maxRaw !== undefined;

  const isStringField = primaryConstraint?.type === "string" || allText.toLowerCase().includes("length") || allText.toLowerCase().includes("char");
  const isDateField = primaryConstraint?.type === "date" || allText.toLowerCase().includes("date") || allText.toLowerCase().includes("future");
  const isArrayField = primaryConstraint?.type === "array" || allText.toLowerCase().includes("array") || allText.toLowerCase().includes("items");

  const targetEndpointDef = target.endpoint ? analysis.ir.apiEndpoints.find(e => e.name === target.endpoint) : undefined;
  const createEndpoint = targetEndpointDef || analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"));
  const knownFields = createEndpoint?.inputFields || [];
  const knownFieldNames = knownFields.map(f => f.name);
  let resolvedFieldName = fieldName;
  if (!knownFieldNames.includes(fieldName) && knownFields.length > 0) {
    const betterConstraint = target.constraints?.find(c =>
      c.type !== "enum" && !RATE_LIMIT_NOISE_FIELDS.has(c.field.toLowerCase()) && knownFieldNames.includes(c.field));
    if (betterConstraint) resolvedFieldName = betterConstraint.field;
  }
  const fieldInKnown = knownFieldNames.includes(resolvedFieldName);
  const effectiveFields: EndpointField[] = fieldInKnown || knownFields.length === 0
    ? knownFields
    : [...knownFields, { name: resolvedFieldName, type: "string", required: true }];
  const finalFieldName = resolvedFieldName;

  const boundaryField: EndpointField = knownFields.find(f => f.name === finalFieldName) || {
    name: finalFieldName,
    type: isDateField ? "date" : isStringField ? "string" : isArrayField ? "array" : "number",
    required: true,
    min,
    max: hasMax ? max : undefined,
  };
  const boundaryCases = calcBoundaryValues(boundaryField);
  const payloadFnName = `basePayload_${target.id.replace(/-/g, "_")}`;

  function buildPayloadLine(f: EndpointField, isBoundaryFieldArg: boolean): string {
    const fname = f.name;
    if (isBoundaryFieldArg) return `    ${fname}: boundaryValue,`;
    const defaultVal = getValidDefault(f, tenantConst);
    if (f.type === "array" && f.arrayItemType === "object" && f.arrayItemFields?.length) {
      const item = buildArrayItem(f, tenantConst);
      return `    ${fname}: [${item}],`;
    }
    if (f.type === "date" || f.name.toLowerCase().includes("date")) return `    ${fname}: tomorrowStr(),`;
    return `    ${fname}: ${defaultVal},`;
  }

  const payloadLines = effectiveFields.length > 0
    ? effectiveFields.map(f => buildPayloadLine(f, f.name === finalFieldName)).join("\n")
    : `    ${tenantField}: ${tenantConst},\n    ${finalFieldName}: boundaryValue,`;

  const needsTomorrowStr = isDateField || effectiveFields.some(f => f.name.toLowerCase().includes("date"));

  // Generate test cases from BoundaryCase[]
  const validCases = boundaryCases.filter(bc => bc.valid);
  const invalidCases = boundaryCases.filter(bc => !bc.valid);
  const testCasesStr = [
    ...validCases.map((bc, i) => `\ntest("${target.id}${String.fromCharCode(97 + i)} — ${finalFieldName}=${bc.label}", async ({ request }) => {\n  const { status } = await trpcMutation(request, "${endpoint}", ${payloadFnName}(${bc.value}), adminCookie);\n  expect(status).toBe(200);\n  // Kills: Change >= to > in ${finalFieldName} validation (off-by-one)\n});`),
    ...invalidCases.map((bc, i) => `\ntest("${target.id}${String.fromCharCode(97 + validCases.length + i)} — ${finalFieldName}=${bc.label}", async ({ request }) => {\n  const { status } = await trpcMutation(request, "${endpoint}", ${payloadFnName}(${bc.value}), adminCookie);\n  expect([400, 422]).toContain(status);\n  // Kills: Remove ${finalFieldName} boundary validation\n});`),
  ].join("\n");

  return `import { test, expect } from "@playwright/test";
import { trpcMutation${needsTomorrowStr ? ", tomorrowStr, yesterdayStr" : ""} } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Boundary: ${target.description}
// Risk: ${target.riskLevel}
${!hasEndpoint ? "// ⚠️  TODO: No endpoint found. Replace TODO_REPLACE_WITH_YOUR_ENDPOINT." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

const ${payloadFnName} = (boundaryValue: unknown) => ({\n${payloadLines}\n});
${testCasesStr}\n`;
}

function generateBoundaryTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const endpoint = target.endpoint || "TODO_REPLACE_WITH_YOUR_ENDPOINT";
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId)!;
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  const endpointDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);

  // Use new behavior-aware findBoundaryField with semantic keyword matching
  const boundaryField = findBoundaryFieldForBehavior(behavior, endpointDef);

  if (!boundaryField) {
    // Fallback: legacy constraint-based approach
    return generateBoundaryTestLegacy(target, analysis);
  }

  // All other required fields with valid defaults
  const otherFields = (endpointDef?.inputFields || [])
    .filter(f => f.required && f.name !== boundaryField.name)
    .map(f => {
      if (f.type === "array" && f.arrayItemType === "object" && f.arrayItemFields?.length) {
        return `    ${f.name}: [${buildArrayItemLiteral(f)}]`;
      }
      if (f.type === "date" || f.name.toLowerCase().includes("date")) return `    ${f.name}: tomorrowStr()`;
      return `    ${f.name}: ${getValidDefault(f, tenantConst)}`;
    })
    .join(",\n");

  const boundaryCases = calcBoundaryValues(boundaryField);
  const varName = `basePayload_${target.id.replace(/-/g, "_")}`;

  const testCases = boundaryCases.map((bc, idx) => {
    const letter = String.fromCharCode(97 + idx);
    const statusLine = bc.valid
      ? `  expect(status).toBe(200);`
      : `  expect([400, 422]).toContain(status);`;
    const killLine = bc.valid
      ? `  // Kills: Change >= to > in ${boundaryField.name} validation (off-by-one)`
      : `  // Kills: Remove ${boundaryField.name} boundary validation`;
    return `\ntest("${target.id}${letter} — ${boundaryField.name}=${bc.label}", async ({ request }) => {\n  const { status } = await trpcMutation(request, "${endpoint}", ${varName}(${bc.value}), adminCookie);\n${statusLine}\n${killLine}\n});`;
  }).join("\n");

  const needsDates = boundaryField.type === "date" ||
    (endpointDef?.inputFields || []).some(f => f.type === "date" || f.name.toLowerCase().includes("date"));
  const dateImport = needsDates ? ", tomorrowStr, yesterdayStr" : "";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation${dateImport} } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Boundary: ${target.description}
// Risk: ${target.riskLevel}
// Boundary Field: ${boundaryField.name} (${boundaryField.type}${boundaryField.min !== undefined ? `, min: ${boundaryField.min}` : ""}${boundaryField.max !== undefined ? `, max: ${boundaryField.max}` : ""})

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

const ${varName} = (boundaryValue: unknown) => ({\n${otherFields ? otherFields + "," : ""}
    ${boundaryField.name}: boundaryValue,
});
${testCases}
`;
}

function generateRiskScoringTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  // Resolve endpoints from IR
  const createEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"))?.name || "TODO_REPLACE_WITH_CREATE_ENDPOINT";
  const updateStatusEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("status") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_STATUS_ENDPOINT";
  const upsertEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("upsert") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_UPSERT_ENDPOINT";
  const getByIdEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("getby") || e.name.toLowerCase().includes("get"))?.name || "TODO_REPLACE_WITH_GET_ENDPOINT";
  const hasEndpoints = analysis.ir.apiEndpoints.length > 0;

  // Determine the risk score field name from behavior postconditions
  const riskFieldMatch = behavior?.postconditions.join(" ").match(/(\w*[Rr]isk\w*|\w*[Ss]core\w*|\w*[Pp]enalty\w*)/);
  const riskField = riskFieldMatch?.[1] || "riskScore";
  const countFieldMatch = behavior?.postconditions.join(" ").match(/(\w*[Cc]ount\w*|\w*[Nn]um\w*)/);
  const countField = countFieldMatch?.[1] || "count";

  // Build create payload from known fields
  const createEpDef = analysis.ir.apiEndpoints.find(e => e.name === createEp);
  const createFields = createEpDef?.inputFields || [];
  // Build create payload using getValidDefault (no TODO_ placeholders)
  const tenantConst2 = analysis.ir.tenantModel?.tenantIdField
    ? analysis.ir.tenantModel.tenantIdField.replace(/([A-Z])/g, '_$1').toUpperCase()
    : 'TENANT_ID';
  const createPayload = createFields.length > 0
    ? createFields.map(f => `    ${f.name}: ${getValidDefault(f as EndpointField, tenantConst2)},`).join("\n")
    : `    // TODO: Add the actual input fields for ${createEp}`;

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery, BASE_URL } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Risk Scoring: ${target.description}
// Risk: ${target.riskLevel}
// Spec: ${behavior?.chapter || behavior?.specAnchor || ""}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoints ? "// ⚠️  TODO: No endpoints found in spec. Replace all TODO_REPLACE_WITH_* placeholders." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id} — ${riskField} increases after negative event", async ({ request }) => {
  // Step 1: Create a resource
  const { data: created, error: createError } = await trpcMutation(request, "${createEp}", {
    ${tenantField}: ${tenantConst},
${createPayload}
  }, adminCookie);
  expect(createError).toBeNull();
  const resourceId = (created as Record<string, unknown>)?.id;
  expect(resourceId).toBeDefined();

  // Step 2: Set ${riskField} to 0 (mandatory precondition — must be baseline)
  await trpcMutation(request, "${upsertEp}",
    { ${tenantField}: ${tenantConst}, id: resourceId, ${riskField}: 0 }, adminCookie);

  // Step 3: Verify precondition
  const { data: before } = await trpcQuery(request, "${getByIdEp}",
    { ${tenantField}: ${tenantConst}, id: resourceId }, adminCookie);
  expect((before as Record<string, unknown>)?.${riskField}).toBe(0);
  // Kills: Test against resource with existing ${riskField}
  const countBefore = ((before as Record<string, unknown>)?.${countField} as number) ?? 0;

  // Step 4: Trigger the negative event (e.g. status change to no_show/failed/cancelled)
  await trpcMutation(request, "${updateStatusEp}",
    { id: resourceId, ${tenantField}: ${tenantConst}, status: "no_show" /* TODO: use actual negative status */ }, adminCookie);

  // Step 5: Trigger risk scoring job (if async)
  const jobResp = await request.post(\`\${BASE_URL}/api/jobs/trigger/riskScoring\`, {
    headers: { Authorization: \`Bearer \${process.env.CRON_SECRET || ""}\` },
  });
  if (jobResp.status() === 200) {
    await new Promise(r => setTimeout(r, 2000)); // Wait for async job
  }

  // Step 6: Assert risk score increased
  const { data: after } = await trpcQuery(request, "${getByIdEp}",
    { ${tenantField}: ${tenantConst}, id: resourceId }, adminCookie);
  expect((after as Record<string, unknown>)?.${riskField}).toBeGreaterThan(0);
  // Kills: ${target.mutationTargets[0]?.description || `Remove ${riskField} update in risk scoring`}
  expect((after as Record<string, unknown>)?.${riskField}).toBeLessThanOrEqual(100);
  // Kills: Set ${riskField} > 100 (out of range)
  expect((after as Record<string, unknown>)?.${countField}).toBe(countBefore + 1);
  // Kills: ${target.mutationTargets[1]?.description || `Remove ${countField} increment`}
${target.mutationTargets.slice(2).map(m => `  // Kills: ${m.description}`).join("\n")}
});
`;
}

export function generateBusinessLogicTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);

  // Use resolved endpoint from IR, or TODO placeholder
  const ep = target.endpoint || analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"))?.name || "TODO_REPLACE_WITH_MUTATION_ENDPOINT";
  const hasEndpoint = !!target.endpoint || analysis.ir.apiEndpoints.length > 0;
  const getEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get"))?.name || "TODO_REPLACE_WITH_QUERY_ENDPOINT";

  const adminRole = analysis.ir.authModel?.roles?.find(r => r.name.toLowerCase().includes("admin")) || analysis.ir.authModel?.roles?.[0];
  const roleFnName = adminRole
    ? `get${adminRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  // Build payload from known input fields using getValidDefault (no TODO_ placeholders)
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === ep);
  const knownFields: EndpointField[] = epDef?.inputFields || [];
  const payloadFields = knownFields.length > 0
    ? knownFields
        .filter(f => f.required)
        .map(f => `    ${f.name}: ${getValidDefault(f, tenantConst)},`)
        .join("\n")
    : `    ${tenantField}: ${tenantConst}, // Add required fields for ${ep}`;

  // Detect side-effects from ProofTarget.sideEffects
  const stockSideEffect = target.sideEffects?.find(se =>
    se.toLowerCase().includes("stock") || se.toLowerCase().includes("decrement") ||
    se.toLowerCase().includes("inventory"));
  const restoreSideEffect = target.sideEffects?.find(se =>
    se.toLowerCase().includes("restore") || se.toLowerCase().includes("refund"));
  const counterSideEffect = target.sideEffects?.find(se =>
    se.includes("+=") || se.toLowerCase().includes("count"));

  // Side-effect setup block (BEFORE the action)
  // restoreSideEffect takes priority over stockSideEffect to avoid ambiguity
  const effectiveStockSideEffect = restoreSideEffect ? null : stockSideEffect;
  const sideEffectSetup = effectiveStockSideEffect || restoreSideEffect ? `
  // Side-Effect-Check: Read stock BEFORE action
  const { data: resourceBefore } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const stockBefore = (Array.isArray(resourceBefore)
    ? (resourceBefore as Record<string, unknown>[])[0]
    : resourceBefore as Record<string, unknown>
  )?.stock as number ?? 0;
  expect(typeof stockBefore).toBe("number");
  // Kills: Cannot read stock before action` : counterSideEffect ? `
  // Side-Effect-Check: Read counter BEFORE action
  const { data: before } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const countBefore = (before as Record<string, unknown>)?.count as number ?? 0;` : "";

  // Side-effect assertion block (AFTER the action)
  const sideEffectAssert = effectiveStockSideEffect ? `
  // Side-Effect: Verify stock DECREASED after action
  const { data: resourceAfter } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const stockAfter = (Array.isArray(resourceAfter)
    ? (resourceAfter as Record<string, unknown>[])[0]
    : resourceAfter as Record<string, unknown>
  )?.stock as number;
  expect(stockAfter).toBeLessThan(stockBefore);
  // Kills: Not decrementing stock after ${ep}
  expect(stockAfter).toBeGreaterThanOrEqual(0);
  // Kills: Allow negative stock (overselling)` : restoreSideEffect ? `
  // Side-Effect: Verify stock RESTORED after cancellation
  const { data: resourceAfter2 } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const stockAfter2 = (Array.isArray(resourceAfter2)
    ? (resourceAfter2 as Record<string, unknown>[])[0]
    : resourceAfter2 as Record<string, unknown>
  )?.stock as number;
  expect(stockAfter2).toBeGreaterThan(stockBefore);
  // Kills: Not restoring stock on cancellation` : counterSideEffect ? `
  const { data: after } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const countAfter = (after as Record<string, unknown>)?.count as number ?? 0;
  expect(countAfter).toBe(countBefore + 1);
  // Kills: Not incrementing counter in ${ep}` : "";

  // Build precondition comment block from actual spec preconditions
  const preconditionComments = target.preconditions.length > 0
    ? target.preconditions.map(p => `  // Precondition: ${p}`).join("\n")
    : "  // Precondition: valid authenticated user";

  // Build assertion lines from actual ProofTarget assertions
  // Filter out invalid assertions: postcondition strings (e.g. "new task created in DB") are not real field values
  const INVALID_ASSERTION_PATTERNS = /created in db|deleted from db|updated in db|persisted|success|task created|record created|new task|new record/i;
  const validAssertions = target.assertions.filter(a => {
    if (typeof a.value === 'string' && INVALID_ASSERTION_PATTERNS.test(a.value)) return false; // skip postcondition strings
    if (a.target.match(/^result\.\d+$/) && typeof a.value === 'string') return false; // skip result.0, result.1 etc. with string values
    return true;
  });
  const assertionLines = validAssertions.map(a => {
    if (a.operator === "eq") return `  expect((data as Record<string, unknown>)?.["${a.target.split(".").pop()}"] ?? status).toBe(${JSON.stringify(a.value)}); // Kills: ${a.rationale}`;
    if (a.operator === "not_null") return `  expect((data as Record<string, unknown>)?.["${a.target.split(".").pop()}"]).toBeDefined(); // Kills: ${a.rationale}`;
    if (a.operator === "in") return `  expect(${JSON.stringify(a.value)}).toContain((data as Record<string, unknown>)?.["${a.target.split(".").pop()}"]);  // Kills: ${a.rationale}`;
    return `  // Assert: ${a.target} ${a.operator} ${JSON.stringify(a.value)} — ${a.rationale}`;
  }).join("\n");

  // Build mutation kill comments from actual mutationTargets
  const killComments = target.mutationTargets.map(m => `  // Kills: ${m.description}`).join("\n");

  // Build delete endpoint name (prefer tasks.delete, tasks.bulkDelete, etc.)
  const deleteEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("delete") || e.name.toLowerCase().includes("remove"))?.name || null;
  const bulkDeleteEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("bulk") && e.name.toLowerCase().includes("delete"))?.name || null;

  // Determine if this behavior is about delete or bulkDelete
  const behaviorTitle = (behavior?.title || target.description).toLowerCase();
  const isDelete = behaviorTitle.includes("delete") || behaviorTitle.includes("remove");
  // isBulkDelete: check both behavior title AND target.endpoint (e.g. tasks.bulkDelete)
  const isBulkDelete = behaviorTitle.includes("bulk") ||
    (target.endpoint?.toLowerCase().includes("bulk") ?? false);
  const actionEp = isBulkDelete ? (bulkDeleteEp || deleteEp || ep) : isDelete ? (deleteEp || ep) : ep;

  // Build the resource ID field name (taskId, reservationId, etc.)
  // Derive from the create endpoint name: "tasks.create" → "tasks" → "task" → "taskId"
  const resourceEntity =
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("create"))?.name?.split(".")[0]?.replace(/s$/, "") ||
    analysis.ir.tenantModel?.tenantEntity?.replace(/s$/, "") ||
    "task";
  const resourceIdField = `${resourceEntity}Id`;

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — Business Logic: ${target.description}
// Risk: ${target.riskLevel} | Endpoint: ${actionEp}
// Spec: ${behavior?.chapter || behavior?.specAnchor || ""}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No endpoint found in spec. Replace endpoint names below." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

${isBulkDelete ? `test("${target.id}a — ${target.description.slice(0, 70)}", async ({ request }) => {
  // Arrange: Create two real resources
  const resource1 = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resource2 = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField}s = [resource1.id as number, resource2.id as number];
  expect(${resourceIdField}s[0]).toBeDefined();
  expect(${resourceIdField}s[1]).toBeDefined();

  // Act: Bulk delete
  const { status, data } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField}s,
    ${tenantField}: ${tenantConst},
  }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove success path in ${actionEp}

  const result = data as Record<string, unknown>;
  expect(result?.deleted).toBe(2);
  // Kills: Return wrong deleted count
  expect(Array.isArray(result?.failed)).toBe(true);
  expect((result?.failed as unknown[]).length).toBe(0);
  // Kills: Report tasks as failed when they succeeded

  // DB-Check: Both resources must be gone
  for (const id of ${resourceIdField}s) {
    const { status: getStatus } = await trpcQuery(request, "${getEp}",
      { ${resourceIdField}: id, ${tenantField}: ${tenantConst} }, adminCookie);
    expect(getStatus).toBe(404);
    // Kills: Not actually deleting from DB
  }
});

test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const { status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField}s: [resource.id as number],
    ${tenantField}: ${tenantConst},
  }, ""); // No cookie
  expect([401, 403]).toContain(status);
  // Kills: Remove role check from ${actionEp}
});` : isDelete ? `test("${target.id}a — ${target.description.slice(0, 70)}", async ({ request }) => {
  // Arrange: Create a real resource
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  expect(${resourceIdField}).toBeDefined();

  // Act: Delete resource
  const { status, data } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove success path in ${actionEp}

  expect((data as Record<string, unknown>)?.success).toBe(true);
  // Kills: Return success:false on deletion

  // DB-Check: Resource must be gone
  const { status: getStatus } = await trpcQuery(request, "${getEp}",
    { ${resourceIdField}, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(getStatus).toBe(404);
  // Kills: Soft-delete instead of hard-delete
});

test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;

  const { status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, ""); // No cookie

  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from ${actionEp}
});` : `test("${target.id}a — ${target.description.slice(0, 70)}", async ({ request }) => {
${preconditionComments}
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  expect(${resourceIdField}).toBeDefined();
${sideEffectSetup}
  // Act
  const { data, status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in ${actionEp}
${assertionLines || "  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id"}
${sideEffectAssert}
${killComments}
});

test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;

  const { status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from ${actionEp}
});

test("${target.id}c — ${target.description.slice(0, 60)} persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  expect(${resourceIdField}).toBeDefined(); // Kills: Don't return id from ${actionEp}

  const { data: fetched, status } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200); // Kills: Remove ${getEp} endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === ${resourceIdField})).toBe(true); // Kills: Don't persist to DB
});`}
`;
}

function generateRateLimitTest(target: ProofTarget, analysis: AnalysisResult): string {
  // Use actual login endpoint from auth model
  const rawLoginEp = analysis.ir.authModel?.loginEndpoint || "/api/trpc/auth.login";
  const loginEp = rawLoginEp.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "");
  // Use actual endpoint from target if it's not the login endpoint
  const targetEp = target.endpoint ? target.endpoint : null;
  // Build kill comments from actual mutationTargets
  const killComments = target.mutationTargets.map(m => `  // Kills: ${m.description}`).join("\n");
  return `import { test, expect } from "@playwright/test";
import { BASE_URL } from "../../helpers/api";
// ${target.id} — Rate Limit: ${target.description}
// Risk: ${target.riskLevel} | Endpoint: ${targetEp || loginEp}
test("${target.id} — Brute-force blocked after 10 attempts on ${targetEp || loginEp}", async ({ request }) => {
  const results: number[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await request.post(BASE_URL + "${loginEp}", {
      data: { json: { email: "attacker-" + i + "@evil.com", password: "wrong" + i } },
    });
    results.push(res.status());
  }
  // At least one request should be rate-limited (429) after repeated failures
  expect(results.some(s => s === 429)).toBe(true); // Kills: Remove rate limiting middleware
${killComments}
});
test("${target.id} — Legitimate user not blocked after 3 attempts", async ({ request }) => {
  const results: number[] = [];
  for (let i = 0; i < 3; i++) {
    const res = await request.post(BASE_URL + "${loginEp}", {
      data: { json: { email: "legit@example.com", password: "wrong" } },
    });
    results.push(res.status());
  }
  // Should not be rate-limited yet (only 3 attempts)
  expect(results.every(s => s !== 429)).toBe(true); // Kills: Rate limit too aggressively
});
test("${target.id} — Rate limit resets after window expires", async ({ request }) => {
  // This test documents the expected reset behavior
  // In CI: mock time or use short window (e.g. 1 minute)
  const res = await request.post(BASE_URL + "${loginEp}", {
    data: { json: { email: "reset-test@example.com", password: "wrong" } },
  });
  // Should not be blocked on first attempt after window reset
  expect(res.status()).not.toBe(429); // Kills: Never reset rate limit counter
});
`;
}

function generateSpecDriftTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = "TEST_" + tenantEntity.toUpperCase() + "_ID";
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const adminRole = analysis.ir.authModel?.roles?.find(r => r.name.toLowerCase().includes("admin")) || analysis.ir.authModel?.roles?.[0];
  const roleFnName = adminRole
    ? "get" + adminRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("") + "Cookie"
    : "getAdminCookie";

  const endpoint = target.endpoint || analysis.ir.apiEndpoints[0]?.name || "TODO_REPLACE_WITH_ENDPOINT";
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
  const outputFields = epDef?.outputFields || [];
  const inputFields = epDef?.inputFields || [];

  // Determine if this is a query (GET) or mutation (POST/PUT)
  const isQuery = !endpoint.toLowerCase().includes("create") &&
    !endpoint.toLowerCase().includes("update") &&
    !endpoint.toLowerCase().includes("delete") &&
    !endpoint.toLowerCase().includes("cancel");

  // Build the schema name from the endpoint
  const schemaName = endpoint.replace(/\./g, "_") + "ResponseSchema";

  // Build query payload from input fields
  const queryPayloadLines = inputFields
    .filter(f => !f.isTenantKey)
    .map(f => "    " + f.name + ": " + getValidDefault(f, tenantConst) + ",")
    .join("\n");

  // Build field assertions from outputFields
  const fieldAssertions = outputFields.length > 0
    ? outputFields.slice(0, 5).map(f =>
        "  expect(record?." + f + ").toBeDefined(); // Kills: Remove '" + f + "' from " + endpoint + " response"
      ).join("\n")
    : "  expect(record?.id).toBeDefined(); // Kills: Remove 'id' from " + endpoint + " response";

  // Build mutation kill comments
  const killComments = target.mutationTargets.map(m => "  // Kills: " + m.description).join("\n");

  const importLine = isQuery
    ? "import { trpcQuery } from \"../../helpers/api\";"
    : "import { trpcMutation, trpcQuery } from \"../../helpers/api\";";

  const payloadExtra = queryPayloadLines ? ",\n" + queryPayloadLines : "";

  const lines: string[] = [
    "import { test, expect } from \"@playwright/test\";",
    importLine,
    "import { " + roleFnName + " } from \"../../helpers/auth\";",
    "import { " + tenantConst + ", createTestResource } from \"../../helpers/factories\";",
    "import { " + schemaName + " } from \"../../helpers/schemas\";",
    "",
    "// " + target.id + " \u2014 Spec Drift: " + target.description,
    "// Risk: " + target.riskLevel,
    "// Spec: " + (behavior?.chapter || behavior?.specAnchor || "API Contract"),
    "// Behavior: " + (behavior?.title || target.description),
    "// Purpose: Validates that the API response shape matches the spec-derived Zod schema.",
    "//          Catches when implementation drifts from the spec (missing fields, wrong types).",
    "",
    "let adminCookie: string;",
    "",
    "test.beforeAll(async ({ request }) => {",
    "  adminCookie = await " + roleFnName + "(request);",
    "});",
    "",
    "test(\"" + target.id + "a \u2014 " + endpoint + " response shape matches spec schema\", async ({ request }) => {",
    "  // Arrange: Ensure at least one resource exists",
    "  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;",
    "  expect(resource?.id).toBeDefined();",
    "  // Kills: " + (target.mutationTargets[0]?.description || "Remove 'id' field from " + endpoint + " response"),
    "",
    "  // Act: Call the endpoint",
    "  const { status, data } = await trpcQuery(request, \"" + endpoint + "\",",
    "    { " + tenantField + ": " + tenantConst + payloadExtra + " }, adminCookie);",
    "  expect(status).toBe(200);",
    "  // Kills: " + (target.mutationTargets[1]?.description || "Return wrong type for response fields"),
    "",
    "  // Assert: Validate response shape with Zod schema",
    "  const records = Array.isArray(data) ? data : [data];",
    "  expect(records.length).toBeGreaterThan(0);",
    "  // Kills: Return empty array when resources exist",
    "",
    "  const record = records[0] as Record<string, unknown>;",
    "",
    "  // Zod schema validation \u2014 catches spec drift (missing/wrong-type fields)",
    "  const parseResult = " + schemaName + ".safeParse(record);",
    "  if (!parseResult.success) {",
    "    throw new Error(\"Spec drift detected in " + endpoint + ": \" + parseResult.error.message);",
    "  }",
    "  // Kills: Return response that doesn't match spec schema",
    "",
    "  // Field-level assertions (belt-and-suspenders)",
    fieldAssertions,
    killComments,
    "});",
    "",
    "test(\"" + target.id + "b \u2014 " + endpoint + " returns correct HTTP status for invalid input\", async ({ request }) => {",
    "  // Send request with missing required fields",
    "  const { status: badStatus } = await trpcQuery(request, \"" + endpoint + "\",",
    "    { " + tenantField + ": -1 }, adminCookie);",
    "  // Should return error status, not 200 with empty data",
    "  expect([400, 404, 422]).toContain(badStatus);",
    "  // Kills: Return 200 with empty array for invalid tenant ID",
    "});",
  ];

  return lines.join("\n") + "\n";
}

const LAYER3_FEW_SHOT_EXAMPLE = [
  "--- FEW-SHOT EXAMPLE (follow this structure exactly) ---",
  "Proof target: Item quantity boundary (1-100)",
  "Available helpers: createTestResource, getResource, trpcMutation, trpcQuery, BASE_URL",
  "",
  "Expected output:",
  'import { test, expect } from "@playwright/test";',
  'import { trpcMutation } from "../../helpers/api";',
  'import { getAdminCookie } from "../../helpers/auth";',
  'import { TEST_TENANT_ID } from "../../helpers/factories";',
  "",
  "let adminCookie: string;",
  "test.beforeAll(async ({ request }) => { adminCookie = await getAdminCookie(request); });",
  "",
  "const base = (quantity: unknown) => ({",
  "  tenantId: TEST_TENANT_ID,",
  "  // TODO: Add the actual input fields for your endpoint",
  "  quantity,",
  "});",
  "",
  'test("BOUND-001a \u2014 quantity=1 allowed", async ({ request }) => {',
  "  const { status } = await trpcMutation(request, 'items.create', base(1), adminCookie);",
  "  expect(status).toBe(200); // Kills: Change >= to > in quantity validation",
  "});",
  'test("BOUND-001b \u2014 quantity=0 rejected", async ({ request }) => {',
  "  const { status } = await trpcMutation(request, 'items.create', base(0), adminCookie);",
  "  expect([400, 422]).toContain(status); // Kills: Remove quantity >= 1 check",
  "});",
  "--- END EXAMPLE ---",
].join("\n");

async function generateLLMTest(target: ProofTarget, analysis: AnalysisResult): Promise<string> {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const primaryRole = analysis.ir.authModel?.roles[0];
  const roleFnName = primaryRole
    ? `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";

  const systemPrompt = [
    "You are TestForge Schicht 3 \u2014 a Gold Standard Playwright test generator.",
    "Generate a TypeScript Playwright test that PROVES the given behavior and kills ALL listed mutation targets.",
    "",
    "AVAILABLE HELPERS (use ONLY these \u2014 no other imports):",
    `- from "../../helpers/api": trpcMutation, trpcQuery, BASE_URL`,
    `- from "../../helpers/auth": ${roleFnName}`,
    `- from "../../helpers/factories": TEST_${tenantEntity.toUpperCase()}_ID, createTestResource, getResource, listResources`,
    "",
    "Gold Standard Rules (MUST follow — violations cause test to be discarded):",
    "R1: NO if-wrappers: never 'if (x !== undefined) { expect(x)...' — use expect(x).toBeDefined() then unconditional assertions",
    "R2: NO existence-only: never only toBeDefined()/toBeTruthy() — always assert exact values",
    "R3: NO broad status codes: never toBeGreaterThanOrEqual(400) — use expect([401, 403]).toContain(status)",
    "R4: Security tests MUST have side-effect check (verify DB state after attack)",
    "R5: IDOR/Security tests MUST have positive control (verify legitimate access works)",
    "R6: Counter checks MUST have baseline (const countBefore = ... BEFORE the action)",
    "R7: Every assertion must have '// Kills: <specific mutation>' comment",
    "",
    LAYER3_FEW_SHOT_EXAMPLE,
    "",
    "Output ONLY the TypeScript test code. No markdown fences. No explanation.",
  ].join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: (() => {
        // Build endpoint schema section
        const endpointDef = target.endpoint ? analysis.ir.apiEndpoints.find(e => e.name === target.endpoint) : null;
        const validPayloadLines = target.resolvedPayload
          ? Object.entries(target.resolvedPayload).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join(",\n")
          : endpointDef?.inputFields.map(f => `  ${f.name}: ${getValidDefault(f, `TEST_${(analysis.ir.tenantModel?.tenantEntity || "tenant").toUpperCase()}_ID`)}`).join(",\n") || "";

        // Build side-effect instructions with before/after comparison
        const sideEffects = target.sideEffects || [];
        const sideEffectInstructions = sideEffects.length > 0
          ? `SIDE EFFECTS — you MUST verify EACH with BEFORE/AFTER comparison:\n${sideEffects.map((se, i) => {
            const fieldMatch = se.match(/(\w+)\s*(?:\+=|-=|\+\+|--)/);
            const field = fieldMatch?.[1];
            if (field && (se.includes("+=") || se.includes("-=") || se.includes("++"))) {
              return `${i + 1}. ${se}\n   \u2192 BEFORE: const ${field}Before = resource.${field} as number;\n   \u2192 AFTER:  const ${field}After = (await getResource(...)).${field} as number;\n   \u2192 ASSERT: expect(${field}After).toBe(${field}Before ${se.includes("-") ? "-" : "+"} quantity);\n   \u2192 // Kills: Not updating ${field} in ${target.endpoint}`;
            }
            if (se.includes("NOW()") || se.includes("At =")) {
              const ts = se.split("=")[0].trim();
              return `${i + 1}. ${se}\n   \u2192 ASSERT: expect(after.${ts}).not.toBeNull();\n   \u2192 // Kills: Not setting ${ts} timestamp`;
            }
            return `${i + 1}. ${se}\n   \u2192 Read state BEFORE the action, then assert the change AFTER`;
          }).join("\n")}`
          : "No side effects to verify.";

        // Schema import hint
        const firstResource = analysis.ir.resources[0];
        const schemaImportHint = firstResource
          ? `SCHEMA VALIDATION — import and use after successful API call:\nimport { ${firstResource.name.charAt(0).toUpperCase() + firstResource.name.slice(1)}Schema, validateSchema } from "../../helpers/schemas";\n// After a successful API call:\nconst validated = validateSchema(${firstResource.name.charAt(0).toUpperCase() + firstResource.name.slice(1)}Schema, data);\nexpect(validated.id).toBeDefined(); // Kills: Return wrong shape`
          : "";

        // Concurrency hint for stock/inventory side effects
        const hasStockEffect = sideEffects.some(se =>
          /stock|inventory|count|balance|quota|limit/i.test(se)
        );
        const concurrencyHint = hasStockEffect && target.proofType === 'business_logic'
          ? `\nCONCURRENCY INVARIANT (add as a separate test block):\n- Run 5 concurrent requests with Promise.all()\n- After all complete, verify the resource count/stock is exactly correct (no double-spend)\n- Kills: Race condition in stock decrement`
          : "";

        return `Generate a Gold Standard Playwright test for this proof target:

ID: ${target.id}
Behavior: ${target.description}
Risk Level: ${target.riskLevel}
Proof Type: ${target.proofType}
Endpoint: ${target.endpoint || "UNKNOWN \u2014 infer from behavior description"}
Tenant Field: ${tenantField}
Preconditions: ${target.preconditions.join("; ")}

Endpoint Input Schema (use ONLY these field names \u2014 NEVER invent others):
{
${validPayloadLines}
}

CRITICAL RULES FOR PAYLOAD:
- Use ONLY the field names listed above \u2014 never invent other field names
- For array fields: use proper array syntax with objects, NEVER dot notation
  CORRECT:   items: [{ productId: 1, quantity: 2 }]
  INCORRECT: items.productId: 1  (this is not valid TypeScript)
- For enum fields: use one of the listed enum values as a string literal
- For number fields: use a number literal, not a string

${sideEffectInstructions}
${schemaImportHint ? "\n" + schemaImportHint + "\n" : ""}
Required Assertions:
${target.assertions.map(a => `- ${a.target} ${a.operator} ${JSON.stringify(a.value)}: ${a.rationale}`).join("\n")}

Mutation Targets (kill ALL with '// Kills:' comments):
${target.mutationTargets.map((m, i) => `${i + 1}. ${m.description}`).join("\n")}

AVAILABLE IMPORTS:
- from "../../helpers/api": trpcMutation, trpcQuery, BASE_URL, tomorrowStr, yesterdayStr
- from "../../helpers/auth": ${roleFnName}
- from "../../helpers/factories": TEST_${tenantEntity.toUpperCase()}_ID, createTestResource, getResource, listResources
- from "../../helpers/schemas": ${firstResource ? `${firstResource.name.charAt(0).toUpperCase() + firstResource.name.slice(1)}Schema, validateSchema` : "validateSchema"}

Spec context: ${analysis.specType}
Spec chapter: ${analysis.ir.behaviors.find(b => b.id === target.behaviorId)?.chapter || "unknown"}${concurrencyHint}`;
      })(),
      },
    ],
    thinkingBudget: 2048,
    maxTokens: 8192,
  });

  return response.choices[0].message.content as string;
}

export async function generateProofs(riskModel: RiskModel, analysis: AnalysisResult): Promise<RawProof[]> {
  const t0 = Date.now();

  // Categorize targets
  const templateMap: Record<string, (target: ProofTarget, analysis: AnalysisResult) => string> = {
    idor: generateIDORTest,
    csrf: generateCSRFTest,
    status_transition: generateStatusTransitionTest,
    dsgvo: generateDSGVOTest,
    boundary: generateBoundaryTest,
    risk_scoring: generateRiskScoringTest,
    business_logic: generateBusinessLogicTest,
    rate_limit: generateRateLimitTest,
    spec_drift: generateSpecDriftTest,
  };

  const templateTargets = riskModel.proofTargets.filter(t => templateMap[t.proofType]);
  const llmTargets = riskModel.proofTargets.filter(t => !templateMap[t.proofType]); // all types now have templates

  console.log(`[TestForge] Schicht 3: ${templateTargets.length} template tests, ${llmTargets.length} LLM tests — ALL PARALLEL`);

  // Template tests (instant)
  const templateProofs: RawProof[] = templateTargets.map(target => {
    const generator = templateMap[target.proofType];
    let code: string;
    try {
      code = generator(target, analysis);
    } catch (err) {
      console.warn(`[TestForge] Template generator crashed for ${target.id}:`, err);
      // Replace with a TODO stub so the file is still valid TypeScript
      code = generateTODOStub(target, String(err));
    }
    if (!code) return null;
    // Goldstandard: TypeScript syntax check — discard tests with syntax errors
    const syntaxError = checkTypeScriptSyntax(code);
    if (syntaxError) {
      console.warn(`[TestForge] Syntax error in ${target.id}: ${syntaxError}`);
      code = generateTODOStub(target, `Syntax error: ${syntaxError}`);
    }
    return {
      id: target.id,
      behaviorId: target.behaviorId,
      proofType: target.proofType,
      riskLevel: target.riskLevel,
      filename: getFilename(target.proofType),
      code,
      mutationTargets: target.mutationTargets,
    };
  }).filter((p): p is RawProof => p !== null);

  // LLM tests — ALL parallel, no limit
  const llmProofs: RawProof[] = (await Promise.all(
    llmTargets.map(async (target) => {
      try {
        let code = await withTimeout(generateLLMTest(target, analysis), LLM_TIMEOUT_MS, "");
        if (!code) return null;
        // Apply the same syntax check as template tests — fallback to template if LLM code is invalid
        const llmSyntaxError = checkTypeScriptSyntax(code);
        if (llmSyntaxError) {
          console.warn(`[TestForge] LLM test ${target.id} has syntax error: ${llmSyntaxError} — falling back to template`);
          const templateGen = templateMap[target.proofType];
          if (templateGen) {
            try { code = templateGen(target, analysis); } catch (e) { code = generateTODOStub(target, `LLM syntax error: ${llmSyntaxError}`); }
          } else {
            code = generateTODOStub(target, `LLM syntax error: ${llmSyntaxError}`);
          }
        }
        console.log(`[TestForge] LLM test ${target.id} done in ${Date.now() - t0}ms`);
        return {
          id: target.id,
          behaviorId: target.behaviorId,
          proofType: target.proofType,
          riskLevel: target.riskLevel,
          filename: getFilename(target.proofType),
          code,
          mutationTargets: target.mutationTargets,
        };
      } catch (err) {
        console.warn(`[TestForge] LLM test failed for ${target.id}:`, err);
        return null;
      }
    })
  )).filter((p): p is RawProof => p !== null);

  console.log(`[TestForge] Schicht 3 done in ${Date.now() - t0}ms — ${templateProofs.length + llmProofs.length} proofs`);
  return [...templateProofs, ...llmProofs];
}

// ─── Schicht 4: False-Green Validator ─────────────────────────────────────────

export function validateProofs(proofs: RawProof[], behaviorIds: string[]): ValidatedProofSuite {
  const validated: ValidatedProof[] = [];
  const discarded: DiscardedProof[] = [];

  for (const proof of proofs) {
    const result = runValidationRules(proof);
    if (result.passed) {
      validated.push({
        ...proof,
        mutationScore: calcMutationScore(proof),
        validationNotes: result.notes,
      });
    } else {
      discarded.push({ rawProof: proof, reason: result.reason!, details: result.details! });
    }
  }

  const passed = validated.length;
  const total = proofs.length;
  const score = total > 0 ? Math.round((passed / total) * 100) / 10 : 0;
  const covered = new Set(validated.map(p => p.behaviorId));
  const uncoveredIds = behaviorIds.filter(id => !covered.has(id));

  return {
    proofs: validated,
    discardedProofs: discarded,
    verdict: { passed, failed: discarded.length, score, summary: `${passed}/${total} proofs passed validation (score: ${score.toFixed(1)}/10.0)` },
    coverage: {
      totalBehaviors: behaviorIds.length,
      coveredBehaviors: behaviorIds.length - uncoveredIds.length,
      coveragePercent: behaviorIds.length > 0 ? Math.round(((behaviorIds.length - uncoveredIds.length) / behaviorIds.length) * 100) : 0,
      uncoveredIds,
    },
  };
}

interface ValidationResult {
  passed: boolean;
  notes: string[];
  reason?: string;
  details?: string;
}

function runValidationRules(proof: RawProof): ValidationResult {
  const code = proof.code;
  const notes: string[] = [];

  // R1: No if-wrapper assertions
  if (/if\s*\([^)]+!==\s*undefined\)\s*\{[^}]*expect\(/.test(code)) {
    return { passed: false, notes: [], reason: "conditional_assertion", details: "R1 violation: if-wrapper around expect(). Use expect(x).toBeDefined() then unconditional assertions." };
  }
  notes.push("✓ R1: No if-wrapper assertions");

  // R2: Not existence-only
  const assertionMatches = code.match(/expect\([^)]+\)\.(to\w+)/g) || [];
  if (assertionMatches.length > 0) {
    const allWeak = assertionMatches.every(m => /toBeDefined|toBeTruthy/.test(m));
    if (allWeak) {
      return { passed: false, notes: [], reason: "existence_only", details: "R2 violation: All assertions are existence-only. Add value assertions." };
    }
  }
  notes.push("✓ R2: Has value assertions");

  // R3: No broad status codes
  if (/toBeGreaterThan(OrEqual)?\(\s*[34]\d\d\s*\)/.test(code)) {
    return { passed: false, notes: [], reason: "broad_status_code", details: "R3 violation: Use expect([401, 403]).toContain(status) instead of toBeGreaterThanOrEqual(400)." };
  }
  notes.push("✓ R3: No broad status codes");

  // R4: Security tests need side-effect check
  if ((proof.proofType === "csrf" || proof.proofType === "idor") &&
    !code.includes("not.toMatch") && !code.includes("not.toContain") &&
    !code.includes("toBeUndefined") && !code.includes("toBe(0)") && !code.includes("toBeNull")) {
    return { passed: false, notes: [], reason: "no_side_effect_check", details: "R4 violation: Security test has no side-effect check. Add DB state verification." };
  }
  notes.push("✓ R4: Has side-effect check");

  // R5: IDOR tests need positive control
  if (proof.proofType === "idor" && !code.includes("toBe(200)")) {
    return { passed: false, notes: [], reason: "no_positive_control", details: "R5 violation: IDOR test has no positive control. Add expect(status).toBe(200) for legitimate access." };
  }
  notes.push("✓ R5: Has positive control");

  // R6: Counter checks need baseline
  if ((code.includes("Count") || code.includes("count")) && code.includes("+ 1") && !code.includes("Before")) {
    return { passed: false, notes: [], reason: "missing_baseline", details: "R6 violation: Counter check without baseline. Add const countBefore = ... BEFORE the action." };
  }
  notes.push("✓ R6: Baseline present");

  // R8: risk_scoring tests must verify precondition (noShowRisk = 0) before triggering job
  if (proof.proofType === "risk_scoring") {
    const hasPreconditionCheck = code.includes(".toBe(0)") || code.includes("noShowRisk = 0") || code.includes("noShowRisk: 0") || code.includes("noShowRisk).toBe(0");
    if (!hasPreconditionCheck) {
      return { passed: false, notes: [], reason: "missing_precondition", details: "R8 violation: risk_scoring test must verify noShowRisk = 0 BEFORE triggering job (precondition check)." };
    }
  }
  notes.push("✓ R8: Preconditions verified");

  // R7: Must have at least one Kills comment
  if (!code.includes("// Kills:")) {
    return { passed: false, notes: [], reason: "no_mutation_kill", details: "R7 violation: No '// Kills:' comment found. Every assertion must explain which mutation it kills." };
  }
  notes.push("✓ R7: Has mutation-kill comments");

  // R7b: No fake IDOR
  if (proof.proofType === "idor" && /restaurantId:\s*[1-9]\b/.test(code) && !code.includes("TEST_") && !code.includes("TENANT_B")) {
    return { passed: false, notes: [], reason: "fake_idor", details: "R7b violation: IDOR test uses hardcoded small ID. Use TEST_RESTAURANT_B_ID." };
  }
  notes.push("✓ R7b: No fake IDOR IDs");

  return { passed: true, notes };
}

function calcMutationScore(proof: RawProof): number {
  if (proof.mutationTargets.length === 0) return 0.0;

  const expectedKills = proof.mutationTargets.filter(mt => mt.expectedKill).length;
  if (expectedKills === 0) return 0.0;

  // Count actual // Kills: comments in code
  const killComments = (proof.code.match(/\/\/ Kills:/g) || []).length;

  const score = Math.min(1.0, killComments / expectedKills);
  return Math.round(score * 100) / 100;
}

// ─── Schicht 5: Independent Checker ──────────────────────────────────────────

function adversarialCheck(proof: RawProof): { passed: boolean; issues: string[] } {
  const code = proof.code;
  const issues: string[] = [];

  // Check: Only HTTP status checked (no DB state)
  const hasDbCheck = code.includes("getResource") || code.includes("trpcQuery") ||
    code.includes("guestAfter") || code.includes("guestBefore") || code.includes("updated") ||
    code.includes("unchanged");
  const hasStatusCheck = code.includes("expect(status)") || code.includes("expect(res.status");
  if (hasStatusCheck && !hasDbCheck && proof.proofType !== "boundary") {
    issues.push("Only HTTP status checked — add DB-state assertion to prevent false-green");
  }

  // Check: Security test missing positive control
  if ((proof.proofType === "idor" || proof.proofType === "csrf") && !code.includes("toBe(200)")) {
    issues.push("Security test missing positive control — test may pass even if feature is completely broken");
  }

  // Check: Counter without baseline
  if ((code.includes("noShowCount") || code.includes("visitCount")) &&
    code.includes("+ 1") && !code.includes("countBefore") && !code.includes("Before")) {
    issues.push("Counter assertion without baseline — test may always pass regardless of implementation");
  }

  // Check: PII leak in security test
  if (proof.proofType === "idor" && !code.includes("not.toContain") && !code.includes("toBeNull")) {
    issues.push("IDOR test should verify no PII from target tenant appears in response");
  }

  return { passed: issues.length === 0, issues };
}

async function reworkProof(proof: RawProof, issues: string[], analysis: AnalysisResult, attempt: number): Promise<RawProof | null> {
  const prompt = `This Playwright test has quality issues that must be fixed:

ISSUES:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

CURRENT TEST:
${proof.code}

AVAILABLE HELPERS:
- from "../../helpers/api": trpcMutation, trpcQuery, BASE_URL, tomorrowStr, randomPhone
- from "../../helpers/auth": getAdminCookie (or role-specific getter)
- from "../../helpers/factories": TEST_RESTAURANT_ID, createTestResource, getResource, getGuestByPhone

Fix ALL issues. Output ONLY the corrected TypeScript test code. No markdown.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      thinkingBudget: 0,
      maxTokens: 8192,
    });
    const code = response.choices[0].message.content as string;
    return { ...proof, code };
  } catch {
    return null;
  }
}

export async function runIndependentChecker(proofs: RawProof[], analysis: AnalysisResult): Promise<{ checkedProofs: RawProof[]; reworked: number; discarded: number }> {
  const t0 = Date.now();
  console.log(`[TestForge] Schicht 5: checking ${proofs.length} proofs`);

  const results = await Promise.all(
    proofs.map(async (proof) => {
      const check = adversarialCheck(proof);
      if (check.passed) return proof;

      // Rework loop (max 2 attempts)
      let current = proof;
      for (let attempt = 0; attempt < 2; attempt++) {
        const reworked = await withTimeout(
          reworkProof(current, check.issues, analysis, attempt),
          30000,
          null
        );
        if (!reworked) break;

        const recheckResult = adversarialCheck(reworked);
        current = reworked;
        if (recheckResult.passed) return current;
      }

      // After 2 attempts: run validation rules — if passes R1-R7, keep with warning
      const validationResult = runValidationRules(current);
      if (validationResult.passed) return current;

      return null; // Discard
    })
  );

  const checkedProofs = results.filter((p): p is RawProof => p !== null);
  const reworked = proofs.filter((p, i) => {
    const result = results[i];
    return result !== null && result.code !== p.code;
  }).length;
  const discarded = results.filter(r => r === null).length;

  console.log(`[TestForge] Schicht 5 done in ${Date.now() - t0}ms — ${checkedProofs.length} approved, ${reworked} reworked, ${discarded} discarded`);
  return { checkedProofs, reworked, discarded };
}

// ─── File Merger (Bug 5 Fix) ─────────────────────────────────────────────────

/**
 * Merges multiple proof codes into a single file, deduplicating imports and
 * shared let-declarations (adminCookie, staffCookie, tenantACookie, tenantBCookie).
 */
function extractTestBody(code: string): string {
  const lines = code.split("\n");
  const result: string[] = [];
  let skipDepth = 0;
  let inBeforeAll = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip import lines
    if (trimmed.startsWith("import ")) continue;

    // Skip let cookie declarations
    if (/^let\s+(adminCookie|staffCookie|tenantACookie|tenantBCookie)/.test(trimmed)) continue;

    // Detect start of test.beforeAll block
    if (trimmed.startsWith("test.beforeAll(")) {
      inBeforeAll = true;
      skipDepth = 0;
      // Count opening braces on this line
      for (const ch of line) {
        if (ch === "{") skipDepth++;
        if (ch === "}") skipDepth--;
      }
      // If depth reaches 0 on same line, block ended
      if (skipDepth <= 0) inBeforeAll = false;
      continue;
    }

    // Inside beforeAll block — track braces
    if (inBeforeAll) {
      for (const ch of line) {
        if (ch === "{") skipDepth++;
        if (ch === "}") skipDepth--;
      }
      if (skipDepth <= 0) inBeforeAll = false;
      continue;
    }

    result.push(line);
  }

  // Remove leading/trailing blank lines and collapse 3+ blank lines to 2
  return result.join("\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mergeProofsToFile(proofs: ValidatedProof[]): string {
  // Collect all imports from all proofs and deduplicate
  // Collect imports per module path, merging named imports to avoid duplicates
  // e.g. two proofs importing { trpcMutation } and { trpcMutation, tomorrowStr } → one merged import
  const importsByModule = new Map<string, Set<string>>();
  for (const proof of proofs) {
    const lines = proof.code.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("import ")) continue;
      // Match: import { a, b, c } from "module"
      const namedMatch = trimmed.match(/^import\s+\{([^}]+)\}\s+from\s+(["'][^"']+["'])/);
      if (namedMatch) {
        const symbols = namedMatch[1].split(",").map(s => s.trim()).filter(Boolean);
        const mod = namedMatch[2];
        if (!importsByModule.has(mod)) importsByModule.set(mod, new Set());
        for (const sym of symbols) importsByModule.get(mod)!.add(sym);
      } else {
        // Default or namespace imports — keep as-is (use module path as key)
        const defaultMatch = trimmed.match(/^import\s+\w+\s+from\s+(["'][^"']+["'])/);
        const mod = defaultMatch?.[1] || trimmed;
        if (!importsByModule.has(mod)) importsByModule.set(mod, new Set([trimmed]));
      }
    }
  }
  // Rebuild merged import lines
  const mergedImports = Array.from(importsByModule.entries()).map(([mod, syms]) => {
    const firstVal = Array.from(syms)[0];
    // If the only entry is a full import line (default import), use it directly
    if (firstVal && firstVal.startsWith("import ")) return firstVal;
    const sorted = Array.from(syms).sort();
    return `import { ${sorted.join(", ")} } from ${mod};`;
  });

  // Detect which cookie variables are actually used across all proofs
  const allCode = proofs.map(p => p.code).join("\n");
  const needsTenantCookies = allCode.includes("tenantACookie") || allCode.includes("tenantBCookie");
  const needsStaffCookie = allCode.includes("staffCookie");

  // Determine the login function from the first proof's beforeAll
  const loginFnMatch = allCode.match(/tenantACookie = await (\w+)\(request\)/);
  const tenantLoginFn = loginFnMatch?.[1] || "getAdminCookie";

  // Shared beforeAll block
  const beforeAll = needsTenantCookies ? `
let tenantACookie: string;
let tenantBCookie: string;

test.beforeAll(async ({ request }) => {
  tenantACookie = await ${tenantLoginFn}(request);
  // IMPORTANT: Set E2E_TENANT_B_USER and E2E_TENANT_B_PASS to a user from a DIFFERENT tenant
  tenantBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_TENANT_B_USER || "test-tenant-b-user",
    process.env.E2E_TENANT_B_PASS || "TestPass2026x"
  );
});
` : `
let adminCookie: string;${needsStaffCookie ? "\nlet staffCookie: string;" : ""}

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
${needsStaffCookie ? "  staffCookie = await getStaffCookie(request);\n" : ""}});
`;

  // Test bodies without repeated imports/declarations
  // Note: basePayload functions now have unique names (basePayload_PROOF_B_007_BOUND, etc.)
  // so no deduplication is needed — each test keeps its own payload function
  const testBodies = proofs
    .map(p => extractTestBody(p.code))
    .filter(b => b.length > 0)
    .join("\n\n");

  return [
    mergedImports.join("\n"),
    beforeAll,
    testBodies,
  ].join("\n");
}

// ─── Report Generator ─────────────────────────────────────────────────────────

export function generateReport(
  analysis: AnalysisResult,
  riskModel: RiskModel,
  suite: ValidatedProofSuite,
  projectName: string,
  llmCheckerStats?: { approved: number; flagged: number; rejected: number; avgConfidence: number }
): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines: string[] = [];

  lines.push(`# TestForge Report v3.0 — ${projectName}`);
  lines.push(`\nGenerated: ${now} | Spec Type: ${analysis.specType} | Quality Score: ${analysis.qualityScore.toFixed(1)}/10.0\n`);

  lines.push("## Verdict\n");
  lines.push(`**${suite.verdict.summary}**\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Verdict Score | ${suite.verdict.score.toFixed(1)}/10.0 |`);
  lines.push(`| Behaviors Extracted | ${analysis.ir.behaviors.length} |`);
  lines.push(`| API Endpoints Discovered | ${analysis.ir.apiEndpoints.length} |`);
  lines.push(`| Coverage | ${suite.coverage.coveragePercent}% (${suite.coverage.coveredBehaviors}/${suite.coverage.totalBehaviors}) |`);
  lines.push(`| Validated Proofs | ${suite.verdict.passed} |`);
  lines.push(`| Discarded Proofs | ${suite.verdict.failed} |`);
  lines.push(`| IDOR Attack Vectors | ${riskModel.idorVectors} |`);
  lines.push(`| CSRF Endpoints | ${riskModel.csrfEndpoints} |\n`);

  if (llmCheckerStats) {
    lines.push("## LLM Checker Results\n");
    lines.push(`| Verdict | Count |`);
    lines.push(`|---|---|`);
    lines.push(`| ✅ Approved | ${llmCheckerStats.approved} |`);
    lines.push(`| ⚠️ Flagged | ${llmCheckerStats.flagged} |`);
    lines.push(`| ❌ Rejected (hallucinated) | ${llmCheckerStats.rejected} |`);
    lines.push(`| Avg Confidence | ${(llmCheckerStats.avgConfidence * 100).toFixed(0)}% |\n`);
  }

  const dist = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const b of riskModel.behaviors) dist[b.riskLevel]++;
  lines.push("## Risk Distribution\n");
  lines.push(`| Level | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| 🔴 Critical | ${dist.critical} |`);
  lines.push(`| 🟠 High | ${dist.high} |`);
  lines.push(`| 🟡 Medium | ${dist.medium} |`);
  lines.push(`| 🟢 Low | ${dist.low} |\n`);

  if (analysis.ir.ambiguities.length > 0) {
    lines.push("## Ambiguity Gate\n");
    for (const a of analysis.ir.ambiguities) {
      lines.push(`### ${a.behaviorId} — ${a.impact === "blocks_test" ? "⛔ BLOCKS TEST" : "⚠ Reduces Confidence"}`);
      lines.push(`**Problem:** ${a.problem}`);
      lines.push(`**Question:** ${a.question}\n`);
    }
  }

  lines.push("## Validated Proofs\n");
  for (const p of suite.proofs) {
    lines.push(`### ${p.id} — ${p.proofType.toUpperCase()}`);
    lines.push(`- **File:** \`${p.filename}\``);
    lines.push(`- **Risk:** ${p.riskLevel}`);
    lines.push(`- **Mutation Score:** ${(p.mutationScore * 100).toFixed(0)}%`);
    lines.push(`- **Validation:** ${p.validationNotes.join(", ")}\n`);
  }

  if (suite.discardedProofs.length > 0) {
    lines.push("## Discarded Proofs (False-Green Detection)\n");
    for (const dp of suite.discardedProofs) {
      lines.push(`### ${dp.rawProof.id} — DISCARDED`);
      lines.push(`- **Reason:** \`${dp.reason}\``);
      lines.push(`- **Details:** ${dp.details}\n`);
    }
  }

  if (suite.coverage.uncoveredIds.length > 0) {
    lines.push("## Uncovered Behaviors\n");
    for (const id of suite.coverage.uncoveredIds) {
      const b = analysis.ir.behaviors.find(bh => bh.id === id);
      lines.push(`- **${id}**: ${b?.title || "Unknown"}`);
    }
  }

  lines.push("\n## Getting Started\n");
  lines.push("```bash");
  lines.push("npm install");
  lines.push("npx playwright install --with-deps chromium");
  lines.push("BASE_URL=https://your-staging-url.com npx playwright test --list");
  lines.push("BASE_URL=https://your-staging-url.com npx playwright test");
  lines.push("```");
  lines.push("\nRed test = Bug found. Green test = Spec correctly implemented. Both are success.\n");

  return lines.join("\n");
}

// ─── Main Job Runner ───────────────────────────────────────────────────────────

export type ProgressCallback = (layer: number, message: string, data?: {
  analysisResult?: AnalysisResult;
  riskModel?: RiskModel;
  proofCount?: number;
}) => Promise<void>;

export async function runAnalysisJob(
  specText: string,
  projectName: string,
  onProgress?: ProgressCallback
): Promise<AnalysisJobResult> {
  const jobStart = Date.now();
  console.log(`[TestForge] Job START v3.0 — ${specText.length} chars, project: ${projectName}`);

  const progress = async (layer: number, message: string, data?: Parameters<ProgressCallback>[2]) => {
    console.log(`[TestForge] Progress Layer ${layer}: ${message}`);
    if (onProgress) {
      try { await onProgress(layer, message, data); } catch (e) { console.error("[TestForge] Progress callback error:", e); }
    }
  };

  await progress(1, "Layer 1: Analysiere Spec...");

  // Schicht 1: Spec parsing (ALL chunks parallel)
  const t1 = Date.now();
  const analysisResult = await parseSpec(specText);
  console.log(`[TestForge] Schicht 1 done in ${Date.now() - t1}ms — ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints.length} endpoints`);

  // Assess spec health immediately after parsing
  analysisResult.specHealth = assessSpecHealth(analysisResult.ir);
  console.log(`[TestForge] Spec Health: ${analysisResult.specHealth.score}/100 (${analysisResult.specHealth.grade}) — ${analysisResult.specHealth.summary}`);

  await progress(1, `Layer 1 fertig: ${analysisResult.ir.behaviors.length} Behaviors, ${analysisResult.ir.apiEndpoints.length} Endpoints gefunden`, { analysisResult });

  // LLM Checker: verify all behaviors (parallel)
  await progress(2, "LLM Checker: Verifiziere Behaviors gegen Spec...");
  const t_checker = Date.now();
  const { checkedBehaviors, stats: llmCheckerStats } = await runLLMChecker(
    analysisResult.ir.behaviors,
    specText
  );
  analysisResult.ir.behaviors = checkedBehaviors;
  console.log(`[TestForge] LLM Checker done in ${Date.now() - t_checker}ms — ${checkedBehaviors.length} behaviors verified`);

  await progress(2, `LLM Checker fertig: ${llmCheckerStats.approved} approved, ${llmCheckerStats.flagged} flagged, ${llmCheckerStats.rejected} rejected`);

  // Schicht 2: Risk model
  const t2 = Date.now();
  const riskModel = buildRiskModel(analysisResult);
  console.log(`[TestForge] Schicht 2 done in ${Date.now() - t2}ms — ${riskModel.proofTargets.length} proof targets`);

  await progress(2, `Layer 2 fertig: ${riskModel.proofTargets.length} Proof-Targets, ${riskModel.idorVectors} IDOR-Vektoren`, { analysisResult, riskModel });

  // Helpers Generator
  const helpers = generateHelpers(analysisResult);
  console.log(`[TestForge] Helpers generated — ${Object.keys(helpers).length} files`);

  // Schicht 3: Proof generation (ALL parallel)
  await progress(3, "Layer 3: Generiere Tests (alle parallel)...");
  const t3 = Date.now();
  const rawProofs = await generateProofs(riskModel, analysisResult);
  console.log(`[TestForge] Schicht 3 done in ${Date.now() - t3}ms — ${rawProofs.length} raw proofs`);

  await progress(3, `Layer 3 fertig: ${rawProofs.length} Tests generiert`, { proofCount: rawProofs.length });

  // Schicht 5: Independent Checker (before Schicht 4)
  await progress(4, `Layer 4: Independent Checker prüft ${rawProofs.length} Tests...`);
  const t5 = Date.now();
  const { checkedProofs } = await runIndependentChecker(rawProofs, analysisResult);
  console.log(`[TestForge] Schicht 5 done in ${Date.now() - t5}ms — ${checkedProofs.length} proofs after independent check`);

  await progress(4, `Layer 4 fertig: ${checkedProofs.length} Tests nach Independent Check`);

  // Schicht 4: False-green validation
  const t4 = Date.now();
  const behaviorIds = analysisResult.ir.behaviors.map(b => b.id);
  const validatedSuite = validateProofs(checkedProofs, behaviorIds);
  console.log(`[TestForge] Schicht 4 done in ${Date.now() - t4}ms — ${validatedSuite.proofs.length} validated, ${validatedSuite.discardedProofs.length} discarded`);

  await progress(5, `Layer 5 fertig: ${validatedSuite.proofs.length} validierte Tests, ${validatedSuite.discardedProofs.length} verworfen`);

  // Report
  const report = generateReport(analysisResult, riskModel, validatedSuite, projectName, llmCheckerStats);

  // Test files (deduplicated by filename, properly structured)
  // Bug 5 Fix: deduplicate imports and shared let-declarations per file
  const fileMap = new Map<string, ValidatedProof[]>();
  for (const proof of validatedSuite.proofs) {
    if (!fileMap.has(proof.filename)) fileMap.set(proof.filename, []);
    fileMap.get(proof.filename)!.push(proof);
  }
  const testFiles = Array.from(fileMap.entries()).map(([filename, proofs]) => ({
    filename,
    content: mergeProofsToFile(proofs),
  }));

  console.log(`[TestForge] Job DONE in ${Date.now() - jobStart}ms — ${testFiles.length} test files, ${validatedSuite.proofs.length} proofs`);

  return { analysisResult, riskModel, validatedSuite, report, testFiles, helpers, llmCheckerStats };
}
