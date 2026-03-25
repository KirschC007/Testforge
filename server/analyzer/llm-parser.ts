import { invokeLLM } from "../_core/llm";
import type { EndpointField, AnalysisIR, AnalysisResult } from "./types";
import { jsonrepair } from "jsonrepair";
import { normalizeEndpointName, sanitizeLLMOutput, sanitizeBehavior, sanitizeEndpoint, sanitizeUserFlow } from "./normalize";
import { getPrompt } from "../settings-db";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 10000; // Smaller chunks = smaller LLM output per chunk = no JSON truncation
// No MAX_CHUNKS — analyze the full spec
export const LLM_TIMEOUT_MS = 150000; // 150s timeout per LLM call (increased for larger specs)

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
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
  // Load editable prompt prefix from DB (falls back to hardcoded default)
  const customPrefix = await getPrompt("prompt.layer1.system");
  const systemPrompt = `${customPrefix}

[Chunk ${chunkIndex + 1} of ${totalChunks}]

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
- statusMachine: {states: string[], transitions: [[from,to],...], forbidden: [[from,to],...], initialState: string, terminalStates: string[]} or null (use for single status machine; for multiple status machines use statusMachines array instead)
- statusMachines: [{resource: string, states: string[], transitions: [[from,to],...], forbidden: [[from,to],...], initialState: string, terminalStates: string[]}] — use when spec defines multiple status machines for different resources (e.g. devices AND rentals each have their own status machine). Leave empty array [] if only one or zero status machines.
- services: [{name, description, techStack, dependencies: [{from, to, via, critical}]}] — extract microservices/modules if mentioned, else []
- userFlows: [{id, name, actor, steps, successCriteria, errorScenarios, relatedEndpoints}] — extract user journeys/flows/stories, else []
- dataModels: [{name, fields: [{name, type, required, unique, pii}], relations: [{to, type}], hasPII}] — extract data models/entities/tables, else []
- qualityScore: number 0-10
- specType: string (e.g. "api-spec", "system-spec", "user-stories", "prd", "architecture-doc")

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

--- EXAMPLE ---
Input: "tasks.getById returns 403 if task.workspaceId != caller.workspaceId. Tasks: status todo|in_progress|done, transitions todo→in_progress→done only. POST /api/trpc/tasks.create (workspaceId:number tenant, title:string 1-100, priority:enum low|medium|high). Task descriptions may contain personal data."
Output: {"behaviors":[{"id":"B-001","title":"tasks.getById returns 403 for cross-workspace access","subject":"System","action":"returns 403","object":"task","preconditions":["task.workspaceId != caller.workspaceId"],"postconditions":["HTTP 403"],"errorCases":["cross-tenant → 403"],"tags":["authorization","security"],"riskHints":["idor","cross-tenant"],"chapter":"Tasks","specAnchor":"returns 403 if task.workspaceId != caller.workspaceId"},{"id":"B-002","title":"Status todo→done skip is rejected","subject":"System","action":"rejects","object":"status update","preconditions":["task.status=todo"],"postconditions":["HTTP 422"],"errorCases":["todo→done → 422"],"tags":["state-machine"],"riskHints":["state-change"],"chapter":"Tasks","specAnchor":"transitions todo→in_progress→done only"},{"id":"B-003","title":"Task descriptions may contain personal data","subject":"System","action":"stores","object":"PII in descriptions","preconditions":[],"postconditions":["PII stored"],"errorCases":[],"tags":["dsgvo","pii"],"riskHints":["dsgvo","pii-leak"],"chapter":"GDPR","specAnchor":"Task descriptions may contain personal data"}],"apiEndpoints":[{"name":"tasks.create","method":"POST","auth":"requireAuth","relatedBehaviors":["B-001"],"inputFields":[{"name":"workspaceId","type":"number","required":true,"isTenantKey":true},{"name":"title","type":"string","required":true,"min":1,"max":100,"isBoundaryField":true},{"name":"priority","type":"enum","required":false,"enumValues":["low","medium","high"]}],"outputFields":["id","title","status"]}],"enums":{"status":["todo","in_progress","done"],"priority":["low","medium","high"]},"statusMachine":{"states":["todo","in_progress","done"],"transitions":[["todo","in_progress"],["in_progress","done"]],"forbidden":[["todo","done"]],"initialState":"todo","terminalStates":["done"]},"invariants":[],"ambiguities":[],"contradictions":[],"tenantModel":{"tenantEntity":"workspace","tenantIdField":"workspaceId"},"resources":[{"name":"task","table":"tasks","tenantKey":"workspaceId","operations":["create","read","update"],"hasPII":true}],"authModel":{"loginEndpoint":"/api/trpc/auth.login","roles":[{"name":"user","envUserVar":"E2E_USER","envPassVar":"E2E_PASS","defaultUser":"test-user","defaultPass":"TestPass2026x"}]},"services":[],"userFlows":[],"dataModels":[],"qualityScore":8,"specType":"api-spec"}
--- END EXAMPLE ---

Output ONLY valid JSON. No markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this specification chunk:\n\n${chunk}` },
    ],
    response_format: { type: "json_object" },
    thinkingBudget: 0,
    maxTokens: 32768, // Must be large enough: 10k-char chunk + few-shot prompt can produce 20k+ token output
  });

  const content = response.choices[0].message.content as string;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Robust JSON parsing: try direct parse first, then jsonrepair for truncated/malformed LLM output
  try {
    const rawParsed = JSON.parse(cleaned);
    return sanitizeLLMOutput(rawParsed as Record<string, unknown>);
  } catch (_parseErr) {
    console.warn(`[TestForge] Chunk ${chunkIndex}: JSON.parse failed (truncated output?), attempting jsonrepair...`);
    try {
      const repaired = jsonrepair(cleaned);
      const result = JSON.parse(repaired);
      console.log(`[TestForge] Chunk ${chunkIndex}: jsonrepair succeeded — recovered partial behaviors`);
      return sanitizeLLMOutput(result as Record<string, unknown>);
    } catch (repairErr) {
      console.error(`[TestForge] Chunk ${chunkIndex}: jsonrepair also failed:`, repairErr);
      throw _parseErr; // throw original error so caller can log it properly
    }
  }
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
      // Retry up to 2 times on LLM failure (500 errors, timeouts, etc.)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await withTimeout(parseSpecChunk(chunk, i, chunks.length), LLM_TIMEOUT_MS, emptyChunk);
          console.log(`[TestForge] Chunk ${i + 1}/${chunks.length} done in ${Date.now() - t0}ms`);
          return result;
        } catch (err) {
          if (attempt < 2) {
            console.warn(`[TestForge] Chunk ${i} attempt ${attempt + 1} failed, retrying in 3s...`, (err as Error).message);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.error(`[TestForge] Chunk ${i} failed after 3 attempts:`, err);
            return emptyChunk;
          }
        }
      }
      return emptyChunk;
    })
  );

  console.log(`[TestForge] All ${chunks.length} chunks done in ${Date.now() - t0}ms`);

  const merged: AnalysisIR = {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    tenantModel: null, resources: [], apiEndpoints: [], authModel: null,
    enums: {}, statusMachine: null,
    services: [], userFlows: [], dataModels: [],
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
    // Merge extended system-spec fields
    if ((r as any).services) merged.services!.push(...(r as any).services);
    if ((r as any).userFlows) merged.userFlows!.push(...(r as any).userFlows);
    if ((r as any).dataModels) merged.dataModels!.push(...(r as any).dataModels);
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
    // Merge statusMachines array (multiple status machines)
    if ((r as any).statusMachines && Array.isArray((r as any).statusMachines)) {
      if (!merged.statusMachines) merged.statusMachines = [];
      for (const sm of (r as any).statusMachines) {
        if (sm && sm.resource) {
          const existing = merged.statusMachines.find(x => x.resource === sm.resource);
          if (!existing) {
            merged.statusMachines.push(sm);
          } else {
            // Merge states and transitions
            for (const s of (sm.states || [])) { if (!existing.states.includes(s)) existing.states.push(s); }
            for (const t of (sm.transitions || [])) {
              if (!existing.transitions.some((x: [string,string]) => x[0] === t[0] && x[1] === t[1])) existing.transitions.push(t);
            }
          }
        }
      }
    }
    // Merge statusMachine: first non-null wins, but merge transitions
    if (r.statusMachine) {
      if (!merged.statusMachine) {
        merged.statusMachine = r.statusMachine as AnalysisIR["statusMachine"];
      } else {
        // Merge states — guard against LLM returning string instead of array
        const incomingStates = (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).states || [];
        const statesArr = Array.isArray(incomingStates) ? incomingStates : String(incomingStates).split(/[,;\s]+/).filter(Boolean);
        if (!Array.isArray(merged.statusMachine!.states)) {
          merged.statusMachine!.states = String(merged.statusMachine!.states).split(/[,;\s]+/).filter(Boolean);
        }
        for (const s of statesArr) {
          if (!merged.statusMachine!.states.includes(s)) merged.statusMachine!.states.push(s);
        }
        // Merge transitions — guard against LLM returning non-array
        const incomingTransitions = (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).transitions || [];
        const transitionsArr = Array.isArray(incomingTransitions) ? incomingTransitions : [];
        if (!Array.isArray(merged.statusMachine!.transitions)) merged.statusMachine!.transitions = [];
        for (const t of transitionsArr) {
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

  // Global array guard: LLM may return strings instead of arrays for these fields
  const toArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string" && v.trim()) return v.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
    return [];
  };
  merged.behaviors = merged.behaviors.map(b => ({
    ...b,
    errorCases: toArray(b.errorCases),
    preconditions: toArray(b.preconditions),
    postconditions: toArray(b.postconditions),
    tags: toArray(b.tags),
    riskHints: toArray(b.riskHints),
  }));

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
  // normalizeEndpointName is imported from ./normalize (single source of truth)

  merged.apiEndpoints = merged.apiEndpoints.map(e => ({
    ...e,
    name: normalizeEndpointName(e.name, e.method),
    inputFields: normalizeEndpointFields((e.inputFields as unknown as unknown[]) || []),
    outputFields: normalizeStringFields((e as unknown as Record<string, unknown[]>).outputFields || []),
  }));

  return {
    ir: merged,
    qualityScore: results.length > 0 ? totalQuality / results.length : 5.0,
    specType,
  };
}

