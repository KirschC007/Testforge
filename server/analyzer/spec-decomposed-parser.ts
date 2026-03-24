/**
 * spec-decomposed-parser.ts — Mechanismus 1 + 3
 *
 * Instead of one large LLM call that tries to extract EVERYTHING,
 * we make 7 focused parallel calls — one per semantic dimension.
 * Each call gets only the relevant spec section and a focused prompt.
 * This dramatically improves recall for complex specs.
 *
 * Mechanismus 1: 7 focused parallel LLM calls (Decompose)
 * Mechanismus 3: Verify & Repair (1 targeted LLM call for missing elements)
 */

import { invokeLLM } from "../_core/llm";
import type { AnalysisIR, AnalysisResult, Behavior, APIEndpoint, AuthModel, UserFlow } from "./types";
import { sanitizeBehavior, sanitizeEndpoint, sanitizeUserFlow } from "./normalize";
import { decomposeSpec, extractFromSpecText, mergeWithRegex } from "./spec-regex-extractor";

export const DECOMPOSED_TIMEOUT_MS = 90_000;

// ─── withTimeout helper ───────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── JSON parse helper ────────────────────────────────────────────────────────

function parseJSON(raw: string, label: string): Record<string, unknown> {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    console.warn(`[Decomposed] ${label}: JSON parse error`, e);
    return {};
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Parse a spec using 7 focused parallel LLM calls (Mechanismus 1).
 * Each call handles one semantic dimension:
 *   Block 1: Endpoints + Fields
 *   Block 2: Roles + Permissions
 *   Block 3: Status-Machine (most critical)
 *   Block 4: Business Rules + Error Codes
 *   Block 5: DSGVO + PII Fields
 *   Block 6: User Flows
 *   Block 7: Constraints + Validation
 */
export async function parseSpecDecomposed(specText: string): Promise<AnalysisResult> {
  const t0 = Date.now();
  console.log(`[Decomposed] Starting 7-block parallel extraction for ${specText.length} chars`);

  // Step 1: Decompose spec into semantic sections (deterministic, no LLM)
  const sections = decomposeSpec(specText);

  // Step 2: 7 parallel focused LLM calls
  const [endpointsResult, rolesResult, statusResult, businessResult, gdprResult, flowsResult, constraintsResult] =
    await Promise.all([
      extractEndpointsBlock(sections.endpoints || sections.full),
      extractRolesBlock(sections.roles || sections.full),
      extractStatusMachineBlock(sections.statusMachine || sections.full),
      extractBusinessRulesBlock(sections.businessRules || sections.full),
      extractGDPRBlock(sections.gdpr || sections.full),
      extractUserFlowsBlock(sections.userFlows || sections.full),
      extractConstraintsBlock(sections.constraints || sections.full),
    ]);

  console.log(`[Decomposed] 7 blocks done in ${Date.now() - t0}ms`);

  // Step 3: Merge all block results into a single IR
  const mergedIR = mergeDecomposedBlocks(
    endpointsResult, rolesResult, statusResult, businessResult,
    gdprResult, flowsResult, constraintsResult
  );

  console.log(`[Decomposed] Merged IR: ${mergedIR.behaviors.length} behaviors, ${mergedIR.apiEndpoints.length} endpoints, ${mergedIR.statusMachine?.states.length ?? 0} states`);

  // Step 4: Regex fallback — fills in anything LLM missed (Mechanismus 2)
  const regexResult = extractFromSpecText(specText);
  const enrichedIR = mergeWithRegex(mergedIR, regexResult);

  console.log(`[Decomposed] After regex merge: ${enrichedIR.apiEndpoints.length} endpoints, ${enrichedIR.statusMachine?.states.length ?? 0} states, ${enrichedIR.authModel?.roles.length ?? 0} roles`);

  // Step 5: Verify & Repair (Mechanismus 3) — targeted repair for missing elements
  const verifiedIR = await verifyAndRepairIR(enrichedIR, specText);

  const elapsed = Date.now() - t0;
  console.log(`[Decomposed] Done in ${elapsed}ms — ${verifiedIR.behaviors.length} behaviors, ${verifiedIR.apiEndpoints.length} endpoints, ${verifiedIR.statusMachine?.states.length ?? 0} states`);

  return {
    ir: verifiedIR,
    qualityScore: 8.0,
    specType: "decomposed-v2",
  };
}

// ─── Block 1: Endpoints ───────────────────────────────────────────────────────

async function extractEndpointsBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return { apiEndpoints: [] };

  const prompt = `Analysiere diesen Endpoint-Abschnitt einer API-Spezifikation.

Für JEDEN Endpoint extrahiere:
1. name: resource.action Format (z.B. "claims.updateStatus", "policies.coverage")
2. method: GET/POST/PATCH/PUT/DELETE
3. auth: "requireAuth" oder "public"
4. inputFields: Array von { name, type, required }
5. relatedBehaviors: []

WICHTIG:
- Jeder ### Header ist ein eigener Endpoint
- Jeder HTTP-Verb + Pfad ist ein eigener Endpoint
- Sub-Endpoints wie /claims/:id/assessment, /claims/:id/payout sind EIGENE Endpoints
- Vergiss keine Endpoints

Antworte NUR als JSON: { "apiEndpoints": [...] }

Spec-Abschnitt:
${section.slice(0, 8000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 3000 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return { apiEndpoints: [] };
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 1 (Endpoints)");
    const endpoints = Array.isArray(parsed.apiEndpoints) ? parsed.apiEndpoints : [];
    console.log(`[Decomposed] Block 1 (Endpoints): ${endpoints.length} endpoints`);
    return { apiEndpoints: (endpoints as Record<string, unknown>[]).map(e => sanitizeEndpoint(e)) as unknown as APIEndpoint[] };
  } catch (e) {
    console.warn(`[Decomposed] Block 1 (Endpoints) failed:`, e);
    return { apiEndpoints: [] };
  }
}

// ─── Block 2: Roles ───────────────────────────────────────────────────────────

async function extractRolesBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return { authModel: null };

  const prompt = `Analysiere diesen Rollen/Berechtigungs-Abschnitt einer API-Spezifikation.

EXTRAHIERE EXAKT:
1. loginEndpoint: Der Login-Endpoint (z.B. "/api/auth/login")
2. roles: Array von Rollennamen (z.B. ["policyholder", "claims_agent", "fraud_analyst", "insurer_admin"])
   WICHTIG: Jede Rolle die in einer Permission-Tabelle, einem Satz, oder einem Endpoint erwähnt wird.
3. publicEndpoints: Endpoints die KEINE Authentifizierung brauchen

Antworte NUR als JSON: { "loginEndpoint": "...", "roles": [...], "publicEndpoints": [...] }

Spec-Abschnitt:
${section.slice(0, 6000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 1500 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return { authModel: null };
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 2 (Roles)");
    const roleNames: string[] = Array.isArray(parsed.roles) ? parsed.roles as string[] : [];
    const loginEndpoint = typeof parsed.loginEndpoint === "string" ? parsed.loginEndpoint : "/api/auth/login";
    const authModel: AuthModel = {
      loginEndpoint,
      roles: roleNames.map(name => ({
        name: String(name),
        envUserVar: `${String(name).toUpperCase().replace(/-/g, "_")}_USER`,
        envPassVar: `${String(name).toUpperCase().replace(/-/g, "_")}_PASS`,
        defaultUser: `test_${String(name)}`,
        defaultPass: "password123",
      })),
    };
    console.log(`[Decomposed] Block 2 (Roles): ${roleNames.length} roles`);
    return { authModel };
  } catch (e) {
    console.warn(`[Decomposed] Block 2 (Roles) failed:`, e);
    return { authModel: null };
  }
}

// ─── Block 3: Status-Machine ──────────────────────────────────────────────────

async function extractStatusMachineBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return { statusMachine: null };

  const prompt = `Analysiere diesen Status-Machine-Abschnitt einer API-Spezifikation.

EXTRAHIERE EXAKT:

1. states: ALLE Status-States als Array (z.B. ["DRAFT", "SUBMITTED", "APPROVED", ...])
   WICHTIG: Jeder State der in einer Transition, einem Pfeil (→), oder als "Terminal" erwähnt wird, MUSS im Array sein.

2. transitions: ALLE erlaubten Übergänge als [from, to] Arrays
   WICHTIG: Wenn "Jeder Status → X" steht, generiere für JEDEN State eine Transition zu X.
   Wildcard-Transitions müssen aufgelöst werden.

3. forbidden: ALLE verbotenen Übergänge als [from, to] Arrays
   WICHTIG: Terminal-States generieren automatisch forbidden-Einträge zu allen anderen States.

4. terminalStates: States aus denen KEINE Transition möglich ist

5. initialState: Der Anfangs-State

REGELN:
- Zähle am Ende: Wenn die Spec N States erwähnt und du weniger als N hast, hast du welche vergessen.
- "CLOSED → jeder Status (Terminal)" bedeutet: CLOSED ist terminal UND forbidden zu allen anderen States.

Antworte NUR als JSON: { "states": [...], "transitions": [[...],[...]], "forbidden": [[...],[...]], "terminalStates": [...], "initialState": "..." }

Spec-Abschnitt:
${section.slice(0, 8000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 2000 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return { statusMachine: null };
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 3 (StatusMachine)");
    const states: string[] = Array.isArray(parsed.states) ? parsed.states as string[] : [];
    const transitions: [string, string][] = Array.isArray(parsed.transitions)
      ? (parsed.transitions as unknown[])
          .filter(t => Array.isArray(t) && (t as unknown[]).length >= 2)
          .map(t => [String((t as unknown[])[0]), String((t as unknown[])[1])] as [string, string])
      : [];
    const forbidden: [string, string][] = Array.isArray(parsed.forbidden)
      ? (parsed.forbidden as unknown[])
          .filter(t => Array.isArray(t) && (t as unknown[]).length >= 2)
          .map(t => [String((t as unknown[])[0]), String((t as unknown[])[1])] as [string, string])
      : [];
    console.log(`[Decomposed] Block 3 (StatusMachine): ${states.length} states, ${transitions.length} transitions`);
    return {
      statusMachine: {
        states,
        transitions,
        forbidden,
        terminalStates: Array.isArray(parsed.terminalStates) ? parsed.terminalStates as string[] : [],
        initialState: typeof parsed.initialState === "string" ? parsed.initialState : (states[0] || ""),
      }
    };
  } catch (e) {
    console.warn(`[Decomposed] Block 3 (StatusMachine) failed:`, e);
    return { statusMachine: null };
  }
}

// ─── Block 4: Business Rules ──────────────────────────────────────────────────

async function extractBusinessRulesBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return { behaviors: [], errorCodes: [] };

  const prompt = `Analysiere diesen Business-Rules-Abschnitt einer API-Spezifikation.

EXTRAHIERE:
1. behaviors: Array von Verhaltensregeln, jede mit:
   - id: "B-XXX" Format
   - title: Kurze Beschreibung
   - subject: Wer führt die Aktion aus
   - action: Was wird getan
   - object: Worauf wirkt die Aktion
   - preconditions: Array von Vorbedingungen
   - postconditions: Array von Nachbedingungen
   - errorCases: Array von Fehlerfällen
   - tags: Array von Tags (z.B. ["business_logic"])
   - errorCodes: Array von Error-Codes (z.B. ["INSURER_MISMATCH"])

2. errorCodes: Array von { code: string, httpStatus: number, description: string }
   WICHTIG: Alle Error-Codes aus Tabellen, Fehlerfällen, und Validierungsregeln.

Antworte NUR als JSON: { "behaviors": [...], "errorCodes": [...] }

Spec-Abschnitt:
${section.slice(0, 8000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 3000 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return { behaviors: [], errorCodes: [] };
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 4 (BusinessRules)");
    const behaviors = Array.isArray(parsed.behaviors)
      ? (parsed.behaviors as Record<string, unknown>[]).map(b => sanitizeBehavior(b))
      : [];
    const errorCodes = Array.isArray(parsed.errorCodes)
      ? parsed.errorCodes as Array<{ code: string; httpStatus: number; description: string }>
      : [];
    console.log(`[Decomposed] Block 4 (BusinessRules): ${behaviors.length} behaviors, ${errorCodes.length} error codes`);
    return { behaviors: behaviors as unknown as Behavior[], errorCodes };
  } catch (e) {
    console.warn(`[Decomposed] Block 4 (BusinessRules) failed:`, e);
    return { behaviors: [], errorCodes: [] };
  }
}

// ─── Block 5: DSGVO ───────────────────────────────────────────────────────────

async function extractGDPRBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return {};

  const prompt = `Analysiere diesen DSGVO/Datenschutz-Abschnitt einer API-Spezifikation.

EXTRAHIERE:
1. gdprBehaviors: Array von DSGVO-relevanten Verhaltensregeln (Löschung, Export, Anonymisierung)
   Jede mit: id, title, subject, action, object, preconditions, postconditions, errorCases, tags: ["dsgvo"]

Antworte NUR als JSON: { "gdprBehaviors": [...] }

Spec-Abschnitt:
${section.slice(0, 5000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 1500 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return {};
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 5 (GDPR)");
    const gdprBehaviors = Array.isArray(parsed.gdprBehaviors)
      ? (parsed.gdprBehaviors as Record<string, unknown>[]).map(b => sanitizeBehavior(b))
      : [];
    console.log(`[Decomposed] Block 5 (GDPR): ${gdprBehaviors.length} behaviors`);
    return { behaviors: gdprBehaviors as unknown as Behavior[] };
  } catch (e) {
    console.warn(`[Decomposed] Block 5 (GDPR) failed:`, e);
    return {};
  }
}

// ─── Block 6: User Flows ──────────────────────────────────────────────────────

async function extractUserFlowsBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return { userFlows: [] };

  const prompt = `Analysiere diesen User-Flow-Abschnitt einer API-Spezifikation.

EXTRAHIERE:
userFlows: Array von User-Flows, jeder mit:
- id: "UF-XXX" Format
- name: Name des Flows
- actor: Wer führt den Flow aus
- steps: Array von Schritten
- successCriteria: Array von Erfolgskriterien
- errorScenarios: Array von Fehlerszenarien
- relatedEndpoints: Array von beteiligten Endpoints

Antworte NUR als JSON: { "userFlows": [...] }

Spec-Abschnitt:
${section.slice(0, 5000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 1500 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return { userFlows: [] };
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 6 (UserFlows)");
    const userFlows = Array.isArray(parsed.userFlows)
      ? (parsed.userFlows as Record<string, unknown>[]).map(f => sanitizeUserFlow(f))
      : [];
    console.log(`[Decomposed] Block 6 (UserFlows): ${userFlows.length} flows`);
    return { userFlows: userFlows as unknown as UserFlow[] };
  } catch (e) {
    console.warn(`[Decomposed] Block 6 (UserFlows) failed:`, e);
    return { userFlows: [] };
  }
}

// ─── Block 7: Constraints ─────────────────────────────────────────────────────

async function extractConstraintsBlock(section: string): Promise<Partial<AnalysisIR>> {
  if (!section || section.length < 50) return { behaviors: [], errorCodes: [] };

  const prompt = `Analysiere diesen Validierungs/Constraints-Abschnitt einer API-Spezifikation.

EXTRAHIERE:
1. validationBehaviors: Array von Validierungsregeln als Behaviors:
   - id: "B-VAL-XXX" Format
   - title, subject, action, object, preconditions, postconditions, errorCases, tags: ["validation"]
   - errorCodes: Array von Error-Codes

2. errorCodes: Array von { code: string, httpStatus: number, description: string }

Antworte NUR als JSON: { "validationBehaviors": [...], "errorCodes": [...] }

Spec-Abschnitt:
${section.slice(0, 6000)}`;

  try {
    const res = await withTimeout(
      invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, maxTokens: 2000 }),
      DECOMPOSED_TIMEOUT_MS,
      null
    );
    if (!res) return { behaviors: [], errorCodes: [] };
    const parsed = parseJSON(res.choices[0].message.content as string, "Block 7 (Constraints)");
    const behaviors = Array.isArray(parsed.validationBehaviors)
      ? (parsed.validationBehaviors as Record<string, unknown>[]).map(b => sanitizeBehavior(b))
      : [];
    const errorCodes = Array.isArray(parsed.errorCodes)
      ? parsed.errorCodes as Array<{ code: string; httpStatus: number; description: string }>
      : [];
    console.log(`[Decomposed] Block 7 (Constraints): ${behaviors.length} behaviors, ${errorCodes.length} error codes`);
    return { behaviors: behaviors as unknown as Behavior[], errorCodes };
  } catch (e) {
    console.warn(`[Decomposed] Block 7 (Constraints) failed:`, e);
    return { behaviors: [], errorCodes: [] };
  }
}

// ─── Merge Decomposed Blocks ──────────────────────────────────────────────────

function mergeDecomposedBlocks(
  endpoints: Partial<AnalysisIR>,
  roles: Partial<AnalysisIR>,
  status: Partial<AnalysisIR>,
  business: Partial<AnalysisIR>,
  gdpr: Partial<AnalysisIR>,
  flows: Partial<AnalysisIR>,
  constraints: Partial<AnalysisIR>,
): AnalysisIR {
  const ir: AnalysisIR = {
    behaviors: [],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: null,
    resources: [],
    apiEndpoints: [],
    authModel: null,
    enums: {},
    statusMachine: null,
    userFlows: [],
    errorCodes: [],
  };

  // Merge endpoints
  ir.apiEndpoints = (endpoints.apiEndpoints || []) as APIEndpoint[];

  // Merge auth model
  ir.authModel = roles.authModel || null;

  // Merge status machine
  ir.statusMachine = status.statusMachine || null;

  // Merge behaviors from all blocks (deduplicate)
  const allBehaviors: Behavior[] = [
    ...(business.behaviors || []),
    ...(gdpr.behaviors || []),
    ...(constraints.behaviors || []),
  ] as Behavior[];

  // Simple dedup by title similarity
  const seen = new Set<string>();
  ir.behaviors = allBehaviors.filter(b => {
    const key = b.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Merge user flows
  ir.userFlows = (flows.userFlows || []) as UserFlow[];

  // Merge error codes (deduplicate by code)
  const errorCodeMap = new Map<string, { code: string; httpStatus: number; description: string }>();
  for (const ec of [...(business.errorCodes || []), ...(constraints.errorCodes || [])]) {
    if (!errorCodeMap.has(ec.code)) errorCodeMap.set(ec.code, ec);
  }
  ir.errorCodes = Array.from(errorCodeMap.values());

  return ir;
}

// ─── Verify & Repair (Mechanismus 3) ─────────────────────────────────────────

export async function verifyAndRepairIR(ir: AnalysisIR, specText: string): Promise<AnalysisIR> {
  const { extractStates, extractEndpoints, extractRoles } = await import("./spec-regex-extractor");
  const { normalizeEndpointName } = await import("./normalize");

  const regexStates = extractStates(specText);
  const regexEndpoints = extractEndpoints(specText);
  const regexRoles = extractRoles(specText);

  const missingStates = regexStates.filter(s => !ir.statusMachine?.states.includes(s));
  const missingEndpoints = regexEndpoints.filter(ep => {
    const normalized = normalizeEndpointName(ep.path, `${ep.method} ${ep.path}`);
    return !ir.apiEndpoints.some(e => e.name === normalized);
  });
  const missingRoles = regexRoles.filter(r =>
    !ir.authModel?.roles.some(role => role.name === r)
  );

  // If nothing is missing → no repair needed
  if (missingStates.length === 0 && missingEndpoints.length === 0 && missingRoles.length === 0) {
    console.log(`[Verify] IR vollständig — kein Repair nötig`);
    return ir;
  }

  console.log(`[Verify] Fehlend: ${missingStates.length} States, ${missingEndpoints.length} Endpoints, ${missingRoles.length} Rollen`);

  // Repair missing states with a targeted LLM call
  if (missingStates.length > 0 && ir.statusMachine) {
    const statusIdx = specText.toLowerCase().indexOf("status");
    const statusSection = statusIdx >= 0
      ? specText.slice(Math.max(0, statusIdx - 200), statusIdx + 3000)
      : specText.slice(0, 3000);

    const repairPrompt = `Die Spec erwähnt diese Status-States: ${regexStates.join(", ")}.
Die aktuelle Extraktion hat nur: ${ir.statusMachine.states.join(", ")}.
Fehlende States: ${missingStates.join(", ")}.

Für JEDEN fehlenden State: Welche Transitions gibt es von/zu diesem State?
Ist er terminal?

Antworte als JSON:
{
  "states": ["FEHLENDER_STATE", ...],
  "transitions": [["FROM", "TO"], ...],
  "forbidden": [["FROM", "TO"], ...]
}

Relevanter Spec-Abschnitt:
${statusSection}`;

    try {
      const res = await withTimeout(
        invokeLLM({ messages: [{ role: "user", content: repairPrompt }], response_format: { type: "json_object" }, maxTokens: 1000 }),
        DECOMPOSED_TIMEOUT_MS,
        null
      );
      if (res) {
        const parsed = parseJSON(res.choices[0].message.content as string, "Verify Repair");
        const newStates: string[] = Array.isArray(parsed.states) ? parsed.states as string[] : [];
        const newTransitions: [string, string][] = Array.isArray(parsed.transitions)
          ? (parsed.transitions as unknown[])
              .filter(t => Array.isArray(t) && (t as unknown[]).length >= 2)
              .map(t => [String((t as unknown[])[0]), String((t as unknown[])[1])] as [string, string])
          : [];
        const newForbidden: [string, string][] = Array.isArray(parsed.forbidden)
          ? (parsed.forbidden as unknown[])
              .filter(t => Array.isArray(t) && (t as unknown[]).length >= 2)
              .map(t => [String((t as unknown[])[0]), String((t as unknown[])[1])] as [string, string])
          : [];

        for (const state of newStates) {
          if (!ir.statusMachine!.states.includes(state)) {
            ir.statusMachine!.states.push(state);
          }
        }
        for (const t of newTransitions) {
          const key = `${t[0]}→${t[1]}`;
          if (!ir.statusMachine!.transitions.some(x => `${x[0]}→${x[1]}` === key)) {
            ir.statusMachine!.transitions.push(t);
          }
        }
        if (!ir.statusMachine!.forbidden) ir.statusMachine!.forbidden = [];
        for (const f of newForbidden) {
          const key = `${f[0]}→${f[1]}`;
          if (!ir.statusMachine!.forbidden.some(x => `${x[0]}→${x[1]}` === key)) {
            ir.statusMachine!.forbidden.push(f);
          }
        }

        console.log(`[Verify] Repaired: +${newStates.length} states, +${newTransitions.length} transitions`);
      }
    } catch (e) {
      console.warn(`[Verify] Repair-Call fehlgeschlagen:`, e);
    }
  }

  return ir;
}
