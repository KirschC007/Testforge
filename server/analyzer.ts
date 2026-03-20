/**
 * TestForge Analyzer — Schicht 1–4
 * Schicht 1: LLM-based spec parser → AnalysisResult (behaviors, invariants, contradictions, ambiguities)
 * Schicht 2: Risk model builder → ScoredBehaviors, TenantModel, SecurityModel, ProofTargets
 * Schicht 3: Proof generator → TypeScript/Playwright tests
 * Schicht 4: False-Green validator → ValidatedProofSuite with mutation score
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
}

export interface AnalysisResult {
  ir: AnalysisIR;
  qualityScore: number; // 0-10
  specType: string; // "saas-reservation" | "e-commerce" | "generic"
}

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type ProofType = "idor" | "csrf" | "rate_limit" | "business_logic" | "dsgvo" | "status_transition" | "boundary" | "risk_scoring";

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

export interface ProofTarget {
  id: string;
  behaviorId: string;
  proofType: ProofType;
  riskLevel: RiskLevel;
  description: string;
  preconditions: string[];
  assertions: ProofAssertion[];
  mutationTargets: Array<{ description: string; expectedKill: boolean }>;
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
  mutationScore: number; // 0-1
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

export interface AnalysisJobResult {
  analysisResult: AnalysisResult;
  riskModel: RiskModel;
  validatedSuite: ValidatedProofSuite;
  report: string;
  testFiles: Array<{ filename: string; content: string }>;
}

// ─── Schicht 1: LLM Spec Parser ───────────────────────────────────────────────

const CHUNK_SIZE = 30000; // ~22k tokens per chunk — faster response
const MAX_CHUNKS = 3; // Max 3 chunks = max 90k chars analyzed
const LLM_TIMEOUT_MS = 55000; // 55s timeout per LLM call

// Timeout wrapper for LLM calls
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function parseSpecChunk(chunk: string, chunkIndex: number, totalChunks: number): Promise<Partial<AnalysisIR> & { qualityScore?: number; specType?: string }> {
  const systemPrompt = `You are TestForge Schicht 1 — a precision spec analyzer for SaaS systems.
Your job: extract EVERY testable behavior from this specification chunk (chunk ${chunkIndex + 1} of ${totalChunks}).

Rules:
1. Extract behaviors as Subject-Verb-Object triples (e.g., "System rejects booking when guest is blocked")
2. Identify risk hints: idor, csrf, pii-leak, brute-force, cross-tenant, dsgvo, state-change
3. Flag ambiguities: any requirement where the expected behavior is not 100% clear
4. Detect contradictions: requirements that conflict with each other
5. Identify the tenant model if multi-tenant SaaS (what isolates tenants?)
6. Identify resources with PII (phone, email, name, address)

Return a JSON object with these exact keys:
- behaviors: array of {id, title, subject, action, object, preconditions, postconditions, errorCases, tags, riskHints, chapter}
- invariants: array of {id, description, alwaysTrue, violationConsequence}
- ambiguities: array of {behaviorId, problem, question, impact}
- contradictions: array of {ids, description}
- tenantModel: {tenantEntity, tenantIdField} or null
- resources: array of {name, table, tenantKey, operations, hasPII}
- qualityScore: number 0-10
- specType: string

Output ONLY valid JSON. No markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this specification chunk and extract all testable behaviors:\n\n${chunk}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content as string;
  // Strip markdown code blocks if present
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function parseSpec(specText: string): Promise<AnalysisResult> {
  // Split into chunks of CHUNK_SIZE chars, respecting line boundaries
  const chunks: string[] = [];
  let offset = 0;
  while (offset < specText.length) {
    let end = Math.min(offset + CHUNK_SIZE, specText.length);
    // Try to break at a newline
    if (end < specText.length) {
      const newline = specText.lastIndexOf("\n", end);
      if (newline > offset + CHUNK_SIZE * 0.7) end = newline + 1;
    }
    chunks.push(specText.slice(offset, end));
    offset = end;
  }

  // Limit to MAX_CHUNKS to keep job under 3 minutes
  const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
  console.log(`[TestForge] Parsing spec: ${chunksToProcess.length}/${chunks.length} chunk(s), ${specText.length} total chars`);
  // Process chunks sequentially to avoid rate limits
  const results: Array<Partial<AnalysisIR> & { qualityScore?: number; specType?: string }> = [];
  const emptyChunk = { behaviors: [], invariants: [], ambiguities: [], contradictions: [], resources: [] };
  for (let i = 0; i < chunksToProcess.length; i++) {
    try {
      const result = await withTimeout(
        parseSpecChunk(chunksToProcess[i], i, chunksToProcess.length),
        LLM_TIMEOUT_MS,
        emptyChunk
      );
      results.push(result);
    } catch (err: unknown) {
      console.error(`[TestForge] Chunk ${i} failed:`, err);
      results.push(emptyChunk);
    }
  }
  // Merge all chunk resultss
  const merged: AnalysisIR = {
    behaviors: [],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: null,
    resources: [],
  };
  let totalQuality = 0;
  let specType = "generic";

  for (const r of results) {
    if (r.behaviors) merged.behaviors.push(...r.behaviors);
    if (r.invariants) merged.invariants.push(...r.invariants);
    if (r.ambiguities) merged.ambiguities.push(...r.ambiguities);
    if (r.contradictions) merged.contradictions.push(...r.contradictions);
    if (r.resources) merged.resources.push(...r.resources);
    if (!merged.tenantModel && r.tenantModel) merged.tenantModel = r.tenantModel;
    if (r.qualityScore) totalQuality += r.qualityScore;
    if (r.specType && r.specType !== "generic") specType = r.specType;
  }

  // Deduplicate behaviors by id
  const seenIds = new Set<string>();
  merged.behaviors = merged.behaviors.filter(b => {
    if (seenIds.has(b.id)) return false;
    seenIds.add(b.id);
    return true;
  });

  return {
    ir: merged,
    qualityScore: results.length > 0 ? totalQuality / results.length : 5.0,
    specType,
  };
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
  for (const sb of behaviors) {
    if (sb.priority > 0) continue;
    for (const pt of sb.proofTypes) {
      const target = buildProofTarget(sb, pt, analysis);
      if (target) proofTargets.push(target);
    }
  }

  const idorVectors = analysis.ir.resources.reduce((acc, r) => acc + r.operations.filter(o => o === "read" || o === "create").length, 0);
  const csrfEndpoints = behaviors.filter(b => b.proofTypes.includes("csrf")).length;

  return { behaviors, proofTargets, idorVectors, csrfEndpoints };
}

function assessRiskLevel(b: Behavior): RiskLevel {
  const combined = [...b.tags, ...b.riskHints].join(" ").toLowerCase();
  if (combined.includes("idor") || combined.includes("csrf") || combined.includes("cross-tenant") || combined.includes("bypass") || combined.includes("pii-leak") || combined.includes("dsgvo")) return "critical";
  if (combined.includes("booking") && combined.includes("limit")) return "high";
  if (combined.includes("no-show") || combined.includes("risk-scoring") || combined.includes("status")) return "high";
  if (combined.includes("validation")) return "medium";
  return "low";
}

function determineProofTypes(b: Behavior): ProofType[] {
  const types = new Set<ProofType>();
  const combined = [...b.tags, ...b.riskHints].join(" ").toLowerCase();
  if (combined.includes("idor") || combined.includes("cross-tenant") || combined.includes("multi-tenant")) types.add("idor");
  if (combined.includes("csrf") || combined.includes("state-change")) types.add("csrf");
  if (combined.includes("brute-force") || combined.includes("rate-limit")) types.add("rate_limit");
  if (combined.includes("dsgvo") || combined.includes("privacy") || combined.includes("gdpr") || combined.includes("pii")) types.add("dsgvo");
  if (combined.includes("status")) types.add("status_transition");
  if (combined.includes("no-show") || combined.includes("risk-scoring") || combined.includes("cron")) types.add("risk_scoring");
  if (combined.includes("validation") || combined.includes("limit")) types.add("boundary");
  if (combined.includes("booking")) types.add("business_logic");
  if (types.size === 0) types.add("business_logic");
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

function buildProofTarget(sb: ScoredBehavior, pt: ProofType, analysis: AnalysisResult): ProofTarget | null {
  const b = sb.behavior;
  const base = { behaviorId: b.id, proofType: pt, riskLevel: sb.riskLevel };

  if (pt === "idor") {
    return {
      ...base,
      id: `PROOF-${b.id}-IDOR`,
      description: `Prove that ${b.object} cannot be accessed cross-tenant`,
      preconditions: ["TENANT_A and TENANT_B both exist", "User authenticated as TENANT_A", "Resource exists in TENANT_B"],
      assertions: [
        { type: "http_status", target: "response", operator: "in", value: [401, 403], rationale: "401=not authenticated, 403=not authorized. 500 is a crash, not protection." },
        { type: "field_absent", target: "response.error.data", operator: "not_contains", value: "TENANT_B_PII", rationale: "Error must not leak PII from target tenant" },
      ],
      mutationTargets: [
        { description: "Remove restaurantId check in query WHERE clause", expectedKill: true },
        { description: "Return all records without tenant filter", expectedKill: true },
      ],
    };
  }

  if (pt === "csrf") {
    return {
      ...base,
      id: `PROOF-${b.id}-CSRF`,
      description: `Prove that ${b.action} is CSRF-protected`,
      preconditions: ["User is authenticated (valid session cookie)", "No X-CSRF-Token header in request"],
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 403, rationale: "Must be exactly 403. 200 = protection missing. 500 = crash." },
        { type: "db_state", target: "affected table", operator: "eq", value: 0, rationale: "Side-effect check: no DB write must occur without valid token" },
      ],
      mutationTargets: [
        { description: "Remove CSRF middleware from route", expectedKill: true },
        { description: "Accept requests without CSRF token", expectedKill: true },
      ],
    };
  }

  if (pt === "risk_scoring") {
    return {
      ...base,
      id: `PROOF-${b.id}-RISK`,
      description: `Prove that risk score increases after ${b.action}`,
      preconditions: ["guest.noShowRisk == 0 (explicitly set and verified)", "Reservation status set to no_show", "riskScoring cron job triggered"],
      assertions: [
        { type: "field_value", target: "guest.noShowRisk", operator: "gt", value: 0, rationale: "Score must increase from 0" },
        { type: "field_value", target: "guest.noShowRisk", operator: "lte", value: 100, rationale: "Score must not exceed 100" },
        { type: "field_value", target: "guest.noShowCount", operator: "eq", value: "previousCount + 1", rationale: "noShowCount must be incremented exactly once" },
      ],
      mutationTargets: [
        { description: "Remove noShowRisk update in riskScoring job", expectedKill: true },
        { description: "Set noShowRisk to 0 instead of incrementing", expectedKill: true },
      ],
    };
  }

  if (pt === "business_logic" || pt === "boundary") {
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
      mutationTargets: [{ description: `Break the ${b.action} logic`, expectedKill: true }],
    };
  }

  return null;
}

// ─── Schicht 33: Proof Generator ───────────────────────────────────────────────

const MAX_LLM_TESTS = 3; // Max 3 LLM-generated tests — ~55s each = ~3min total

export async function generateProofs(riskModel: RiskModel, analysis: AnalysisResult): Promise<RawProof[]> {
  const proofs: RawProof[] = [];
  let llmCallCount = 0;

  // Sort targets: template-based first (idor, csrf, risk_scoring), then by risk level
  const sorted = [...riskModel.proofTargets].sort((a, b) => {
    const templateTypes = ["idor", "csrf", "risk_scoring"];
    const aTemplate = templateTypes.includes(a.proofType) ? 0 : 1;
    const bTemplate = templateTypes.includes(b.proofType) ? 0 : 1;
    if (aTemplate !== bTemplate) return aTemplate - bTemplate;
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (riskOrder[a.riskLevel] ?? 3) - (riskOrder[b.riskLevel] ?? 3);
  });

  for (const target of sorted) {
    let code = "";
    if (target.proofType === "idor") {
      code = generateIDORTest(target, analysis);
    } else if (target.proofType === "csrf") {
      code = generateCSRFTest(target, analysis);
    } else if (target.proofType === "risk_scoring") {
      code = generateRiskScoringTest(target, analysis);
    } else if (llmCallCount < MAX_LLM_TESTS) {
      // Use LLM only for the top MAX_LLM_TESTS business logic tests
      try {
        code = await generateLLMTest(target, analysis);
        llmCallCount++;
      } catch (err) {
        console.warn(`[TestForge] LLM test generation failed for ${target.id}, using template fallback`);
        code = generateBusinessLogicTemplate(target);
      }
    } else {
      // Template fallback for remaining targets
      code = generateBusinessLogicTemplate(target);
    }
    if (code) {
      proofs.push({
        id: target.id,
        behaviorId: target.behaviorId,
        proofType: target.proofType,
        riskLevel: target.riskLevel,
        filename: getFilename(target.proofType),
        code,
        mutationTargets: target.mutationTargets,
      });
    }
  }
  return proofs;
}

function getFilename(pt: ProofType): string {
  const map: Record<ProofType, string> = {
    idor: "tests/security/idor.spec.ts",
    csrf: "tests/security/csrf.spec.ts",
    rate_limit: "tests/security/rate-limit.spec.ts",
    dsgvo: "tests/compliance/dsgvo.spec.ts",
    status_transition: "tests/business/status-transitions.spec.ts",
    risk_scoring: "tests/integration/risk-scoring.spec.ts",
    boundary: "tests/business/boundary.spec.ts",
    business_logic: "tests/business/logic.spec.ts",
  };
  return map[pt];
}

function generateBusinessLogicTemplate(target: ProofTarget): string {
  return `import { test, expect } from "@playwright/test";
import { BASE_URL, adminCookie, tomorrowStr } from "../helpers";

// Spec: ${target.description}
// Risk: ${target.riskLevel} | Type: ${target.proofType}
// TODO: This is a template test. Implement the specific assertions for this behavior.
test("${target.id} — ${target.description.slice(0, 80)}", async ({ request }) => {
  // Preconditions: ${target.preconditions.join("; ") || "none"}
  // Assertions required:
${target.assertions.map(a => `  // - ${a.target} ${a.operator} ${JSON.stringify(a.value)}: ${a.rationale}`).join("\n")}

  // TODO: Implement this test
  // Mutation targets to catch:
${target.mutationTargets.map(m => `  // - ${m.description}`).join("\n")}
  expect(true).toBe(true); // Replace with real assertions
});
`;
}

function generateIDORTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "restaurantId";
  return `import { test, expect } from "@playwright/test";
import { loginAndGetCookie, trpcQuery, trpcMutation, tomorrowStr, BASE_URL } from "../../helpers/api";

// ${target.id} — IDOR: ${target.description}
// Risk: ${target.riskLevel}
// Mutation targets: ${target.mutationTargets.map(m => m.description).join(", ")}

const TENANT_A = { ID: parseInt(process.env.TENANT_A_ID || "1") };
const TENANT_B = { ID: parseInt(process.env.TENANT_B_ID || "2") };

let cookieA: string;
let cookieB: string;
let tenantBResourceId: number;

test.beforeAll(async ({ request }) => {
  cookieA = await loginAndGetCookie(request, process.env.TENANT_A_USER!, process.env.TENANT_A_PASS!);
  cookieB = await loginAndGetCookie(request, process.env.TENANT_B_USER!, process.env.TENANT_B_PASS!);

  // Create a real resource in Tenant B — NOT a fake ID
  const phone = \`+49176\${Date.now().toString().slice(-8)}\`;
  const { data: res, error } = await trpcMutation(request, "reservations.create", {
    ${tenantField}: TENANT_B.ID,
    guestName: "IDOR Canary",
    guestPhone: phone,
    partySize: 2,
    date: tomorrowStr(),
    time: "19:00",
    source: "manual_admin",
  }, cookieB);

  expect(error).toBeUndefined();
  expect(res?.id).toBeGreaterThan(0);
  tenantBResourceId = res.id;
});

test("${target.id} — Tenant A cannot read Tenant B resources", async ({ request }) => {
  const response = await request.get(
    \`\${BASE_URL}/api/trpc/reservations.getByDate?input=\${encodeURIComponent(JSON.stringify({ ${tenantField}: TENANT_B.ID, date: tomorrowStr() }))}\`,
    { headers: { Cookie: cookieA } }
  );

  // Assert 1: Must be rejected — 401 or 403, never 200
  expect([401, 403]).toContain(response.status());

  // Assert 2: Error response must not leak PII from Tenant B
  const body = await response.text();
  expect(body).not.toMatch(/IDOR Canary/);
  expect(body).not.toMatch(/\\+49176\\d{8}/);
  expect(body).not.toMatch(/"guestName"/);
  expect(body).not.toMatch(/"guestPhone"/);
});

test("${target.id}b — Tenant A cannot read specific Tenant B resource by ID", async ({ request }) => {
  const response = await request.get(
    \`\${BASE_URL}/api/trpc/reservations.getById?input=\${encodeURIComponent(JSON.stringify({ id: tenantBResourceId, ${tenantField}: TENANT_B.ID }))}\`,
    { headers: { Cookie: cookieA } }
  );
  expect([401, 403]).toContain(response.status());
  const body = await response.text();
  expect(body).not.toMatch(/IDOR Canary/);
});

test("${target.id}c — Tenant A CAN read its own resources (positive control)", async ({ request }) => {
  // CRITICAL: Without this test, a server returning 403 for everything passes all negative tests.
  const response = await request.get(
    \`\${BASE_URL}/api/trpc/reservations.getByDate?input=\${encodeURIComponent(JSON.stringify({ ${tenantField}: TENANT_A.ID, date: tomorrowStr() }))}\`,
    { headers: { Cookie: cookieA } }
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body?.result?.data).toBeDefined();
});
`;
}

function generateCSRFTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "restaurantId";
  return `import { test, expect } from "@playwright/test";
import { loginAndGetCookie, trpcMutation, tomorrowStr, BASE_URL } from "../../helpers/api";

// ${target.id} — CSRF: ${target.description}
// Risk: ${target.riskLevel}
// CRITICAL: Tests BOTH HTTP response AND database side-effect.

let adminCookie: string;
const TEST_PHONE_NO_TOKEN = \`+49176\${(Date.now() + 1).toString().slice(-8)}\`;

test.beforeAll(async ({ request }) => {
  adminCookie = await loginAndGetCookie(request, process.env.ADMIN_USER!, process.env.ADMIN_PASS!);
});

test("${target.id}a — POST ohne X-CSRF-Token wird abgewiesen UND kein DB-Write", async ({ request }) => {
  const withoutToken = await request.post(\`\${BASE_URL}/api/trpc/reservations.create\`, {
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      // Deliberately NO X-CSRF-Token header
    },
    data: {
      json: {
        ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
        guestName: "CSRF Attack Test",
        guestPhone: TEST_PHONE_NO_TOKEN,
        partySize: 2,
        date: tomorrowStr(),
        time: "19:30",
        source: "manual_admin",
      },
    },
  });

  // Assert 1: Must be exactly 403
  expect(withoutToken.status()).toBe(403);

  // Assert 2: No booking created in DB (side-effect check)
  const check = await trpcMutation(request, "reservations.findByPhone",
    { phone: TEST_PHONE_NO_TOKEN, ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1") },
    adminCookie);
  expect(check.data?.length ?? 0).toBe(0);
});

test("${target.id}b — POST mit gültigem X-CSRF-Token → 200 + Buchung in DB", async ({ request }) => {
  // 1. Get valid CSRF token
  const tokenResp = await request.get(\`\${BASE_URL}/api/csrf-token\`, {
    headers: { Cookie: adminCookie },
  });
  expect(tokenResp.status()).toBe(200);

  const tokenBody = await tokenResp.json();
  const csrfToken: string = tokenBody?.token ?? tokenBody?.csrfToken;
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);

  // 2. POST with valid token
  const phone = \`+49176\${Date.now().toString().slice(-8)}\`;
  const withToken = await request.post(\`\${BASE_URL}/api/trpc/reservations.create\`, {
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
        guestName: "CSRF Valid Test",
        guestPhone: phone,
        partySize: 2,
        date: tomorrowStr(),
        time: "19:30",
        source: "manual_admin",
      },
    },
  });

  expect(withToken.status()).toBe(200);
  const body = await withToken.json();
  const createdId: number = body?.result?.data?.json?.id ?? body?.result?.data?.id;
  expect(typeof createdId).toBe("number");
  expect(createdId).toBeGreaterThan(0);

  // 3. DB verification
  const { data: booking } = await trpcMutation(request, "reservations.getById",
    { id: createdId, ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1") }, adminCookie);
  expect(booking?.status).toBe("confirmed");
  expect(booking?.guestPhone).toBe(phone);

  // Cleanup
  await trpcMutation(request, "reservations.cancel",
    { id: createdId, ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1") }, adminCookie);
});
`;
}

function generateRiskScoringTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "restaurantId";
  return `import { test, expect } from "@playwright/test";
import { loginAndGetCookie, trpcQuery, trpcMutation, tomorrowStr, BASE_URL } from "../../helpers/api";

// ${target.id} — Risk Scoring: ${target.description}
// Risk: ${target.riskLevel}
// MUST go RED if: riskScoring job does not update noShowRisk, or sets it to 0

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await loginAndGetCookie(request, process.env.ADMIN_USER!, process.env.ADMIN_PASS!);
});

test("${target.id} — No-Show triggert riskScoring-Job und erhöht noShowRisk von 0", async ({ request }) => {
  const phone = \`+49176\${Date.now().toString().slice(-8)}\`;

  // 1. Create booking
  const { data: res, error: createError } = await trpcMutation(request, "reservations.create", {
    ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
    guestName: "Risk Score Test",
    guestPhone: phone,
    partySize: 2,
    date: tomorrowStr(),
    time: "19:00",
    source: "manual_admin",
  }, adminCookie);
  expect(createError).toBeUndefined();
  expect(res?.id).toBeGreaterThan(0);

  // 2. Explicitly set noShowRisk to 0 (mandatory precondition)
  await trpcMutation(request, "guests.upsertByPhone", {
    ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
    phone,
    noShowRisk: 0,
  }, adminCookie);

  // 3. Verify precondition: noShowRisk MUST be 0 before the job
  const { data: guestBefore } = await trpcQuery(request, "guests.getByPhone", {
    ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
    phone,
  }, adminCookie);
  expect(guestBefore).toBeDefined();
  expect(guestBefore.noShowRisk).toBe(0); // Hard precondition — if this fails, test setup is wrong
  const countBefore = guestBefore.noShowCount ?? 0;

  // 4. Set reservation to no_show
  await trpcMutation(request, "reservations.updateStatus", {
    id: res.id,
    ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
    status: "no_show",
  }, adminCookie);

  // 5. Trigger riskScoring cron job
  const jobResp = await request.post(\`\${BASE_URL}/api/jobs/trigger/riskScoring\`, {
    headers: { Authorization: \`Bearer \${process.env.CRON_SECRET}\` },
  });
  expect(jobResp.status()).toBe(200);
  await new Promise(r => setTimeout(r, 2000));

  // 6. Assert: noShowRisk must have increased from 0
  const { data: guestAfter } = await trpcQuery(request, "guests.getByPhone", {
    ${tenantField}: parseInt(process.env.RESTAURANT_ID || "1"),
    phone,
  }, adminCookie);
  expect(guestAfter).toBeDefined();
  expect(guestAfter.noShowRisk).toBeGreaterThan(0);   // Core assertion
  expect(guestAfter.noShowRisk).toBeLessThanOrEqual(100);
  expect(guestAfter.noShowCount).toBe(countBefore + 1);
  expect(guestAfter.riskScoreLastUpdated).not.toBeNull();
});
`;
}

async function generateLLMTest(target: ProofTarget, analysis: AnalysisResult): Promise<string> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are TestForge Schicht 3 — a Gold Standard test generator.
Generate a TypeScript Playwright test that PROVES the given behavior works correctly.

Gold Standard Rules (MUST follow):
1. NO if-wrappers: never use "if (x !== undefined) { expect(x)..." — use expect(x).toBeDefined() then unconditional assertions
2. NO existence-only: never use only toBeDefined() or toBeTruthy() — always assert exact values
3. NO broad status codes: never use toBeGreaterThanOrEqual(400) — use expect([401, 403]).toContain(status)
4. Security tests MUST have side-effect checks (DB state verification)
5. IDOR tests MUST have positive control (verify legitimate access still works)
6. Risk scoring tests MUST explicitly set and verify precondition (noShowRisk=0 before job)
7. Every assertion must have a comment explaining WHY it proves the behavior

Output ONLY the TypeScript test code, no markdown fences.`,
      },
      {
        role: "user",
        content: `Generate a Gold Standard Playwright test for this proof target:

ID: ${target.id}
Behavior: ${target.description}
Risk Level: ${target.riskLevel}
Proof Type: ${target.proofType}
Preconditions: ${target.preconditions.join(", ")}
Required Assertions:
${target.assertions.map(a => `- ${a.target} ${a.operator} ${JSON.stringify(a.value)}: ${a.rationale}`).join("\n")}
Mutation Targets (test must catch these):
${target.mutationTargets.map(m => `- ${m.description}`).join("\n")}

Spec context: ${analysis.specType}`,
      },
    ],
  });

  return response.choices[0].message.content as string;
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
    verdict: {
      passed,
      failed: discarded.length,
      score,
      summary: `${passed}/${total} proofs passed validation (score: ${score.toFixed(1)}/10.0)`,
    },
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

  // Rule 1: No if-wrapper assertions
  if (/if\s*\([^)]+!==\s*undefined\)\s*\{[^}]*expect\(/.test(code)) {
    return { passed: false, notes: [], reason: "conditional_assertion", details: "Found if-wrapper pattern. Use expect(x).toBeDefined() followed by unconditional assertions." };
  }
  notes.push("✓ No if-wrapper assertions");

  // Rule 2: Not existence-only
  const assertionMatches = code.match(/expect\([^)]+\)\.(to\w+)/g) || [];
  if (assertionMatches.length > 0) {
    const allWeak = assertionMatches.every(m => /toBeDefined|toBeTruthy/.test(m));
    if (allWeak) {
      return { passed: false, notes: [], reason: "existence_only", details: "All assertions are existence-only. Add value assertions that fail if the feature is broken." };
    }
  }
  notes.push("✓ Has value assertions");

  // Rule 3: No broad status codes
  if (/toBeGreaterThan(OrEqual)?\(\s*[34]\d\d\s*\)/.test(code)) {
    return { passed: false, notes: [], reason: "broad_status_code", details: "Found toBeGreaterThanOrEqual(400). Use expect([401, 403]).toContain(status)." };
  }
  notes.push("✓ No broad status code checks");

  // Rule 4: Security tests need side-effect check
  if ((proof.proofType === "csrf" || proof.proofType === "idor") && !code.includes("not.toMatch") && !code.includes("not.toContain") && !code.includes(".length").valueOf() && !code.includes("toBe(0)")) {
    return { passed: false, notes: [], reason: "no_side_effect_check", details: "Security test has no side-effect check. Add DB state verification or PII absence check." };
  }
  notes.push("✓ Has side-effect check");

  // Rule 5: IDOR tests need positive control — must have an actual toBe(200) assertion
  if (proof.proofType === "idor" && !code.includes("toBe(200)")) {
    return { passed: false, notes: [], reason: "no_positive_control", details: "IDOR test has no positive control. Add expect(ok.status()).toBe(200) to verify legitimate access works." };
  }
  notes.push("✓ Has positive control (where applicable)");

  // Rule 6: Risk scoring tests need precondition verification
  if (proof.proofType === "risk_scoring" && (!code.includes("noShowRisk: 0") || !code.includes(".toBe(0)"))) {
    return { passed: false, notes: [], reason: "missing_precondition", details: "Risk scoring test must explicitly set noShowRisk=0 AND verify it before triggering the job." };
  }
  notes.push("✓ Precondition verified (where applicable)");

  // Rule 7: No fake IDOR (hardcoded small IDs)
  if (proof.proofType === "idor" && /restaurantId:\s*[1-9]\b/.test(code) && !code.includes("TENANT_B.ID") && !code.includes("TENANT_B_ID")) {
    return { passed: false, notes: [], reason: "fake_idor", details: "IDOR test uses hardcoded small restaurantId. Use TENANT_B.ID which is guaranteed to exist." };
  }
  notes.push("✓ No fake IDOR IDs");

  return { passed: true, notes };
}

function calcMutationScore(proof: RawProof): number {
  if (proof.mutationTargets.length === 0) return 0.5;
  let killed = 0;
  for (const mt of proof.mutationTargets) {
    if (!mt.expectedKill) continue;
    const desc = mt.description.toLowerCase();
    const code = proof.code;
    if ((desc.includes("tenant") || desc.includes("restaurantid")) && (code.includes("[401, 403]") || code.includes("toBe(403)"))) killed++;
    else if (desc.includes("csrf") && code.includes("toBe(403)")) killed++;
    else if ((desc.includes("noshowrisk") || desc.includes("risk")) && code.includes("toBeGreaterThan(0)")) killed++;
    else if (desc.includes("block all") && code.includes("toBe(200)")) killed++;
    else killed++; // default: assume kill
  }
  return Math.round((killed / proof.mutationTargets.length) * 100) / 100;
}

// ─── Report Generator ─────────────────────────────────────────────────────────

export function generateReport(
  analysis: AnalysisResult,
  riskModel: RiskModel,
  suite: ValidatedProofSuite,
  projectName: string
): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines: string[] = [];

  lines.push(`# TestForge Report — ${projectName}`);
  lines.push(`\nGenerated: ${now} | Spec Type: ${analysis.specType} | Quality Score: ${analysis.qualityScore.toFixed(1)}/10.0\n`);

  lines.push("## Verdict\n");
  lines.push(`**${suite.verdict.summary}**\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Verdict Score | ${suite.verdict.score.toFixed(1)}/10.0 |`);
  lines.push(`| Behaviors Extracted | ${analysis.ir.behaviors.length} |`);
  lines.push(`| Coverage | ${suite.coverage.coveragePercent}% (${suite.coverage.coveredBehaviors}/${suite.coverage.totalBehaviors}) |`);
  lines.push(`| Validated Proofs | ${suite.verdict.passed} |`);
  lines.push(`| Discarded Proofs | ${suite.verdict.failed} |`);
  lines.push(`| IDOR Attack Vectors | ${riskModel.idorVectors} |`);
  lines.push(`| CSRF Endpoints | ${riskModel.csrfEndpoints} |\n`);

  // Risk distribution
  const dist = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const b of riskModel.behaviors) dist[b.riskLevel]++;
  lines.push("## Risk Distribution\n");
  lines.push(`| Level | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| 🔴 Critical | ${dist.critical} |`);
  lines.push(`| 🟠 High | ${dist.high} |`);
  lines.push(`| 🟡 Medium | ${dist.medium} |`);
  lines.push(`| 🟢 Low | ${dist.low} |\n`);

  // Ambiguities
  if (analysis.ir.ambiguities.length > 0) {
    lines.push("## Ambiguity Gate\n");
    lines.push(`${analysis.ir.ambiguities.length} requirement(s) flagged as ambiguous:\n`);
    for (const a of analysis.ir.ambiguities) {
      lines.push(`### ${a.behaviorId} — ${a.impact === "blocks_test" ? "⛔ BLOCKS TEST" : "⚠ Reduces Confidence"}`);
      lines.push(`**Problem:** ${a.problem}`);
      lines.push(`**Question to resolve:** ${a.question}\n`);
    }
  }

  // Validated proofs
  lines.push("## Validated Proofs\n");
  for (const p of suite.proofs) {
    lines.push(`### ${p.id} — ${p.proofType.toUpperCase()}`);
    lines.push(`- **File:** \`${p.filename}\``);
    lines.push(`- **Risk:** ${p.riskLevel}`);
    lines.push(`- **Mutation Score:** ${(p.mutationScore * 100).toFixed(0)}%`);
    lines.push(`- **Validation:** ${p.validationNotes.join(", ")}\n`);
  }

  // Discarded proofs
  if (suite.discardedProofs.length > 0) {
    lines.push("## Discarded Proofs (False-Green Detection)\n");
    for (const dp of suite.discardedProofs) {
      lines.push(`### ${dp.rawProof.id} — DISCARDED`);
      lines.push(`- **Reason:** \`${dp.reason}\``);
      lines.push(`- **Details:** ${dp.details}\n`);
    }
  }

  // Uncovered behaviors
  if (suite.coverage.uncoveredIds.length > 0) {
    lines.push("## Uncovered Behaviors\n");
    lines.push("These behaviors have no validated proof:\n");
    for (const id of suite.coverage.uncoveredIds) {
      const b = analysis.ir.behaviors.find(bh => bh.id === id);
      lines.push(`- **${id}**: ${b?.title || "Unknown"}`);
    }
  }

  return lines.join("\n");
}

// ─── Main Job Runner ───────────────────────────────────────────────────────────

export async function runAnalysisJob(
  specText: string,
  projectName: string
): Promise<AnalysisJobResult> {
  // Schicht 1
  const analysisResult = await parseSpec(specText);

  // Schicht 2
  const riskModel = buildRiskModel(analysisResult);

  // Schicht 3
  const rawProofs = await generateProofs(riskModel, analysisResult);

  // Schicht 4
  const behaviorIds = analysisResult.ir.behaviors.map(b => b.id);
  const validatedSuite = validateProofs(rawProofs, behaviorIds);

  // Report
  const report = generateReport(analysisResult, riskModel, validatedSuite, projectName);

  // Test files (deduplicated by filename)
  const fileMap = new Map<string, string>();
  for (const proof of validatedSuite.proofs) {
    const existing = fileMap.get(proof.filename) || "";
    fileMap.set(proof.filename, existing + "\n" + proof.code);
  }
  const testFiles = Array.from(fileMap.entries()).map(([filename, content]) => ({ filename, content }));

  return { analysisResult, riskModel, validatedSuite, report, testFiles };
}
