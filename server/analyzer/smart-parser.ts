/**
 * TestForge Smart Spec Parser v2.0
 *
 * 3-Pass architecture for large specs (>50KB):
 *
 * Pass 1 — STRUCTURAL MAP (1 LLM call, full spec summary)
 *   Reads the entire spec (compressed) and produces a structural map:
 *   - All endpoints with names + auth level
 *   - All status/enum values
 *   - Tenant model
 *   - Auth model
 *   - Chapter→topic mapping
 *
 * Pass 2 — TARGETED EXTRACTION (N parallel LLM calls, chapter-aware)
 *   For each chapter/section identified in Pass 1:
 *   - Send ONLY that chapter's text
 *   - Send the structural map as context (so the LLM knows what exists)
 *   - Extract behaviors + detailed endpoint fields for THAT chapter only
 *
 * Pass 3 — DETERMINISTIC MERGE + ENRICH
 *   - Merge all Pass 2 results
 *   - Deduplicate by semantic similarity (not just ID)
 *   - Cross-reference: every behavior must link to a known endpoint
 *   - Enrich: add missing min/max from DB schema chapter
 *   - Validate: every endpoint in the structural map must have at least 1 behavior
 *
 * For small specs (<50KB): falls back to the existing 1-pass chunked parser.
 */

import { invokeLLM } from "../_core/llm";
import type { EndpointField, AnalysisIR, AnalysisResult, Behavior, APIEndpoint, AuthModel } from "./types";

export const LLM_TIMEOUT_MS = 90000;
const SMART_PARSER_THRESHOLD = 50000; // Use smart parser for specs > 50KB
const MAX_COMPRESSED_SIZE = 30000;    // Max chars for Pass 1 compressed spec

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── Spec Sectioner ───────────────────────────────────────────────────────────
// Splits a markdown spec into logical sections based on headers

export interface SpecSection {
  title: string;       // e.g. "Kapitel 5: Status-Übergänge"
  level: number;       // 1 = #, 2 = ##, 3 = ###
  startLine: number;
  endLine: number;
  text: string;
  charCount: number;
  topic: string;       // Classified topic: "endpoints", "schema", "status", "auth", "security", "dsgvo", "edge-cases", "business-logic", "other"
}

export function classifySection(title: string, text: string): SpecSection["topic"] {
  const t = (title + " " + text.slice(0, 500)).toLowerCase();
  if (t.includes("trpc") || t.includes("router") || t.includes("prozedur") || t.includes("endpoint") || t.includes("api v1")) return "endpoints";
  if (t.includes("schema") || t.includes("tabelle") || t.includes("datenbank") || t.includes("create table")) return "schema";
  if (t.includes("status") || t.includes("übergang") || t.includes("transition") || t.includes("state")) return "status";
  // Check business-logic BEFORE auth to avoid "preauth" matching auth
  if (t.includes("buchung") || t.includes("reservierung") || t.includes("booking") || t.includes("warteliste") || t.includes("waitlist") || t.includes("cron")) return "business-logic";
  if (t.includes("widget") || t.includes("self-service")) return "business-logic";
  if (t.includes("stripe") || t.includes("preauth") || t.includes("payment")) return "business-logic";
  if (t.includes("auth") || t.includes("login") || t.includes("session") || t.includes("jwt") || t.includes("passwort")) return "auth";
  if (t.includes("sicherheit") || t.includes("security") || t.includes("csrf") || t.includes("rate-limit") || t.includes("cors")) return "security";
  if (t.includes("dsgvo") || t.includes("gdpr") || t.includes("anonymis") || t.includes("lösch") || t.includes("deletion")) return "dsgvo";
  if (t.includes("edge case") || t.includes("race condition")) return "edge-cases";
  return "other";
}

export function splitIntoSections(specText: string): SpecSection[] {
  const lines = specText.split("\n");
  const sections: SpecSection[] = [];
  let currentStart = 0;
  let currentTitle = "Preamble";
  let currentLevel = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch && i > 0) {
      // Close previous section
      const text = lines.slice(currentStart, i).join("\n");
      if (text.trim().length > 100) { // Skip tiny sections
        sections.push({
          title: currentTitle,
          level: currentLevel,
          startLine: currentStart,
          endLine: i - 1,
          text,
          charCount: text.length,
          topic: classifySection(currentTitle, text),
        });
      }
      currentStart = i;
      currentTitle = headerMatch[2].trim();
      currentLevel = headerMatch[1].length;
    }
  }
  // Last section
  const lastText = lines.slice(currentStart).join("\n");
  if (lastText.trim().length > 100) {
    sections.push({
      title: currentTitle,
      level: currentLevel,
      startLine: currentStart,
      endLine: lines.length - 1,
      text: lastText,
      charCount: lastText.length,
      topic: classifySection(currentTitle, lastText),
    });
  }

  return sections;
}

// ─── Spec Compressor ──────────────────────────────────────────────────────────
// Creates a compressed version of the spec that fits in one LLM context
// Keeps: headers, table definitions, enum values, endpoint names, status transitions
// Removes: prose explanations, examples, edge case details

export function compressSpec(specText: string, maxChars: number): string {
  const lines = specText.split("\n");
  const compressed: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      codeBlockLines = 0;
      // Keep SQL CREATE TABLE and short code blocks
      if (inCodeBlock) {
        compressed.push(line);
        continue;
      } else {
        compressed.push(line);
        continue;
      }
    }
    if (inCodeBlock) {
      codeBlockLines++;
      // Keep CREATE TABLE, status enums, important code
      if (codeBlockLines <= 30 || line.includes("CREATE TABLE") || line.includes("ENUM(") || line.includes("NOT NULL") || line.includes("DEFAULT")) {
        compressed.push(line);
      }
      continue;
    }

    // Always keep headers
    if (line.match(/^#{1,4}\s/)) {
      compressed.push(line);
      continue;
    }
    // Always keep table rows (| ... | ... |)
    if (line.match(/^\|.+\|/)) {
      compressed.push(line);
      continue;
    }
    // Keep lines with key information patterns
    if (line.match(/→|ENUM|min|max|required|endpoint|procedure|router|Status|status|transition|forbidden|erlaubt|verboten|CSRF|IDOR|DSGVO|tenant|restaurantId|Auth|auth|Rate|rate|Limit|limit/i)) {
      compressed.push(line);
      continue;
    }
    // Keep lines with field definitions
    if (line.match(/^\s*(name|type|required|min|max|default)\s*[:=]/i) || line.match(/\b\w+\s+(?:INT|VARCHAR|TEXT|ENUM|BOOLEAN|TIMESTAMP|JSON)\b/)) {
      compressed.push(line);
      continue;
    }
    // Keep short lines (likely bullet points, config values)
    if (line.trim().length > 0 && line.trim().length < 120) {
      compressed.push(line);
      continue;
    }
    // Skip long prose paragraphs
  }

  let result = compressed.join("\n");
  // If still too long, truncate intelligently
  if (result.length > maxChars) {
    // Keep first 40% and last 20% (headers are usually at start and end)
    const front = result.slice(0, Math.floor(maxChars * 0.6));
    const back = result.slice(-Math.floor(maxChars * 0.2));
    result = front + "\n\n[... middle sections compressed ...]\n\n" + back;
  }
  return result;
}

// ─── Pass 1: Structural Map ──────────────────────────────────────────────────

// Normalize LLM output to ensure consistent types
export function normalizeStructuralMap(raw: Record<string, unknown>): StructuralMap {
  const sm = raw.statusMachine as Record<string, unknown> | null | undefined;
  const am = raw.authModel as Record<string, unknown> | null | undefined;
  return {
    endpoints: Array.isArray(raw.endpoints) ? raw.endpoints as StructuralMap["endpoints"] : [],
    statusMachine: sm ? {
      entity: String(sm.entity || ""),
      states: Array.isArray(sm.states) ? sm.states as string[] : [],
      // Normalize transitions: accept [from,to] tuples OR {from,to} objects
      transitions: Array.isArray(sm.transitions)
        ? (sm.transitions as unknown[]).map((t: unknown): [string, string] => {
            if (Array.isArray(t)) return [String(t[0]), String(t[1])];
            if (t && typeof t === "object") {
              const o = t as Record<string, unknown>;
              return [String(o.from || o[0] || ""), String(o.to || o[1] || "")];
            }
            return [String(t), ""];
          })
        : [],
      forbidden: Array.isArray(sm.forbidden)
        ? (sm.forbidden as unknown[]).map((t: unknown): [string, string] => {
            if (Array.isArray(t)) return [String(t[0]), String(t[1])];
            if (t && typeof t === "object") {
              const o = t as Record<string, unknown>;
              return [String(o.from || o[0] || ""), String(o.to || o[1] || "")];
            }
            return [String(t), ""];
          })
        : [],
      initialState: String(sm.initialState || ""),
      terminalStates: Array.isArray(sm.terminalStates) ? sm.terminalStates as string[] : [],
    } : null,
    tenantModel: raw.tenantModel ? {
      entity: String((raw.tenantModel as Record<string, unknown>).entity || ""),
      idField: String((raw.tenantModel as Record<string, unknown>).idField || ""),
    } : null,
    authModel: am ? {
      loginEndpoint: String(am.loginEndpoint || ""),
      csrfEndpoint: String(am.csrfEndpoint || ""),
      csrfPattern: String(am.csrfPattern || ""),
      // Normalize roles: accept {name,permissions} or plain strings
      roles: Array.isArray(am.roles)
        ? (am.roles as unknown[]).map((r: unknown) => {
            if (typeof r === "string") return { name: r, permissions: [] };
            if (r && typeof r === "object") {
              const o = r as Record<string, unknown>;
              return { name: String(o.name || o.role || ""), permissions: Array.isArray(o.permissions) ? o.permissions as string[] : [] };
            }
            return { name: String(r), permissions: [] };
          })
        : [],
    } : null,
    enums: (raw.enums && typeof raw.enums === "object" && !Array.isArray(raw.enums))
      ? Object.fromEntries(
          Object.entries(raw.enums as Record<string, unknown>).map(([k, v]) => [k, Array.isArray(v) ? v as string[] : []])
        )
      : {},
    piiTables: Array.isArray(raw.piiTables) ? raw.piiTables as string[] : [],
    chapters: Array.isArray(raw.chapters) ? raw.chapters as StructuralMap["chapters"] : [],
  };
}

export interface StructuralMap {
  endpoints: Array<{ name: string; method: string; auth: string; chapter: string }>;
  statusMachine: {
    entity: string;
    states: string[];
    transitions: [string, string][];
    forbidden: [string, string][];
    initialState: string;
    terminalStates: string[];
  } | null;
  tenantModel: { entity: string; idField: string } | null;
  authModel: {
    loginEndpoint: string;
    csrfEndpoint: string;
    csrfPattern: string;
    roles: Array<{ name: string; permissions: string[] }>;
  } | null;
  enums: Record<string, string[]>;
  piiTables: string[];
  chapters: Array<{ title: string; topics: string[] }>;
}

async function buildStructuralMap(compressedSpec: string): Promise<StructuralMap> {
  const t0 = Date.now();
  console.log(`[TestForge] Pass 1: Building structural map from ${compressedSpec.length} chars...`);

  const prompt = `You are a spec analyzer. Read this compressed system specification and extract a STRUCTURAL MAP.
Do NOT extract individual behaviors yet — only the high-level structure.

Extract:
1. endpoints: ALL API endpoints/procedures mentioned (name, HTTP method, auth level, which chapter)
2. statusMachine: If a status/state machine exists — ALL states, ALL allowed transitions, ALL forbidden transitions, initial state, terminal states
3. tenantModel: The multi-tenant entity and its ID field (e.g. {entity: "restaurant", idField: "restaurantId"})
4. authModel: Login endpoint, CSRF endpoint/pattern, ALL user roles with their permission levels
5. enums: ALL fields with fixed allowed values (status enums, type enums, etc.)
6. piiTables: Tables/entities that contain personal data (name, email, phone, address)
7. chapters: List of chapter titles with their main topics (for targeted extraction later)

Return JSON with these exact keys. Be thorough — list EVERY endpoint, EVERY enum, EVERY transition.
The spec may be in German — extract values in their original language/format.

Output ONLY valid JSON. No markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: compressedSpec },
    ],
    response_format: { type: "json_object" },
    thinkingBudget: 4096,   // Give it thinking time for this important extraction
    maxTokens: 16384,
  });

  const content = response.choices[0].message.content as string;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const rawMap = JSON.parse(cleaned) as Record<string, unknown>;
  const map = normalizeStructuralMap(rawMap);

  console.log(`[TestForge] Pass 1 done in ${Date.now() - t0}ms — ${map.endpoints?.length || 0} endpoints, ${map.statusMachine?.states?.length || 0} states, ${map.enums ? Object.keys(map.enums).length : 0} enums`);
  return map;
}

// ─── Pass 2: Targeted Extraction ─────────────────────────────────────────────

export interface ChunkGroup {
  title: string;
  topics: string[];
  text: string;
  charCount: number;
}

export function groupSectionsForExtraction(sections: SpecSection[], structuralMap: StructuralMap): ChunkGroup[] {
  const groups: ChunkGroup[] = [];

  // Group sections by topic, keeping each group under 20K chars
  const MAX_GROUP_SIZE = 20000;
  const topicOrder: SpecSection["topic"][] = [
    "endpoints", "status", "auth", "security", "dsgvo",
    "business-logic", "edge-cases", "schema", "other",
  ];

  for (const topic of topicOrder) {
    const topicSections = sections.filter(s => s.topic === topic);
    if (topicSections.length === 0) continue;

    let currentGroup: SpecSection[] = [];
    let currentSize = 0;

    for (const section of topicSections) {
      if (currentSize + section.charCount > MAX_GROUP_SIZE && currentGroup.length > 0) {
        // Flush current group
        groups.push({
          title: currentGroup.map(s => s.title).join(" + "),
          topics: [topic],
          text: currentGroup.map(s => s.text).join("\n\n"),
          charCount: currentSize,
        });
        currentGroup = [];
        currentSize = 0;
      }
      currentGroup.push(section);
      currentSize += section.charCount;
    }
    // Flush remaining
    if (currentGroup.length > 0) {
      groups.push({
        title: currentGroup.map(s => s.title).join(" + "),
        topics: [topic],
        text: currentGroup.map(s => s.text).join("\n\n"),
        charCount: currentSize,
      });
    }
  }

  return groups;
}

async function extractFromChunkGroup(
  group: ChunkGroup,
  structuralMap: StructuralMap,
  groupIndex: number,
  totalGroups: number,
): Promise<Partial<AnalysisIR> & { qualityScore?: number }> {
  // Build a compact context summary from the structural map
  const contextSummary = [
    `Known endpoints: ${structuralMap.endpoints.map(e => e.name).join(", ")}`,
    structuralMap.tenantModel ? `Tenant: ${structuralMap.tenantModel.entity} (${structuralMap.tenantModel.idField})` : "",
    structuralMap.statusMachine ? `States: ${structuralMap.statusMachine.states.join(", ")}` : "",
    structuralMap.statusMachine ? `Transitions: ${structuralMap.statusMachine.transitions.map(t => t.join("→")).join(", ")}` : "",
    structuralMap.authModel ? `Auth roles: ${structuralMap.authModel.roles.map(r => r.name).join(", ")}` : "",
    `Enums: ${Object.entries(structuralMap.enums || {}).map(([k, v]) => `${k}=[${v.join(",")}]`).join("; ")}`,
    `PII tables: ${(structuralMap.piiTables || []).join(", ")}`,
  ].filter(Boolean).join("\n");

  // Topic-specific extraction instructions
  const topicInstructions: Record<string, string> = {
    endpoints: "Focus on extracting EVERY API endpoint with FULL inputFields (name, type, required, min, max, enumValues, isTenantKey, isBoundaryField). Also extract behaviors for each endpoint.",
    status: "Focus on extracting EVERY status transition as a separate behavior. Include preconditions, postconditions (side-effects like counter increments, timestamps), and error cases for forbidden transitions.",
    auth: "Focus on extracting auth-related behaviors: login, logout, session management, password policies, role-based access. Extract the auth model with all roles.",
    security: "Focus on extracting security behaviors: CSRF protection, rate limiting, input validation, XSS prevention. Tag appropriately.",
    dsgvo: "Focus on extracting DSGVO/GDPR behaviors: data anonymization, deletion, export, retention, consent. Include which PII fields must be anonymized.",
    "business-logic": "Focus on extracting business logic behaviors: booking rules, validation steps, cron jobs, notifications, payment flows. For EACH side-effect (counter increment, timestamp update, SMS trigger, audit log insert, Stripe charge): add a structuredSideEffect entry with entity, field, operation, verifyVia. Also extract cronJobs and flows if present. Include errorCodes for each error case.",
    "edge-cases": "Focus on extracting edge case behaviors: race conditions, concurrent access, error recovery. Tag with appropriate risk hints.",
    schema: "Focus on extracting data models, field constraints (min/max/required), relationships, and PII flags. Also extract any validation rules mentioned in field descriptions.",
    other: "Extract any testable behaviors from this section.",
  };

  const topic = group.topics[0] || "other";

  const systemPrompt = `You are TestForge Pass 2 — extracting testable behaviors from a SPECIFIC section of a system spec.
Section topic: ${topic.toUpperCase()} | Group ${groupIndex + 1} of ${totalGroups}: "${group.title}"

SYSTEM CONTEXT (already extracted from full spec — use this as reference, don't re-extract):
${contextSummary}

YOUR TASK: ${topicInstructions[topic] || topicInstructions.other}

Rules:
1. Extract behaviors as Subject-Verb-Object triples with specAnchor (verbatim quote 10-30 words)
2. For EACH endpoint: extract FULL inputFields as EndpointField objects with type, min, max, enumValues, isTenantKey, isBoundaryField
3. Use behavior IDs that include the section topic: e.g. "B-STATUS-001", "B-IDOR-001", "B-DSGVO-001"
4. Include ALL side-effects in postconditions AND as structuredSideEffects entries (entity, field, operation, verifyVia). For DB side-effects: set verifyVia to "get_endpoint" or "list_endpoint" and provide verifyEndpoint+verifyField+verifyExpected. For non-verifiable: set verifyVia to "not_verifiable".
5. Tag behaviors correctly: "authorization"+"security" for IDOR, "dsgvo" for PII, "state-machine" for transitions, "csrf" for CSRF, "rate-limiting" for rate limits
6. For status transitions: create ONE behavior per transition (not one behavior for all transitions)
7. For forbidden transitions: create explicit rejection behaviors with HTTP 400/422 expected
8. For each errorCase: extract the exact error code string (e.g. "VALIDATION_GUEST_NAME_REQUIRED", "INVALID_STATUS_TRANSITION") into errorCodes array

Return JSON:
- behaviors: [{id, title, subject, action, object, preconditions, postconditions, errorCases, tags, riskHints, chapter, specAnchor, structuredSideEffects: [{entity, field, operation, value?, condition?, verifyVia, verifyEndpoint?, verifyField?, verifyExpected?}]?, errorCodes: string[]?}]
- apiEndpoints: [{name, method, auth, relatedBehaviors, inputFields: EndpointField[], outputFields: string[]}]
- resources: [{name, table, tenantKey, operations, hasPII}]
- invariants: [{id, description, alwaysTrue, violationConsequence}]
- ambiguities: [{behaviorId, problem, question, impact}]
- tenantModel, authModel, enums, statusMachine — ONLY if this section contains NEW info not in the context above
- qualityScore: 0-10
- cronJobs: [{name, frequency, triggerEndpoint?, preconditions, expectedChanges: [{entity, field, operation, value?, condition?, verifyVia, verifyEndpoint?, verifyField?, verifyExpected?}], raceConditionProtection?}]? (ONLY if this section describes cron/scheduled jobs)
- featureGates: [{feature, requiredPlan, gatedEndpoints, errorCode}]? (ONLY if this section describes plan-based feature gates)
- flows: [{id, name, behaviors: string[], steps: [{action, endpoint?, payload?, expectedStatus?, dbChecks?, description}], invariants: string[]}]? (ONLY if this section describes multi-step flows)
Output ONLY valid JSON. No markdown.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: group.text },
    ],
    response_format: { type: "json_object" },
    thinkingBudget: 2048,
    maxTokens: 16384,
  });

  const content = response.choices[0].message.content as string;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

// ─── Pass 3: Deterministic Merge + Enrich ─────────────────────────────────────

export function semanticDedup(behaviors: Behavior[]): Behavior[] {
  const kept: Behavior[] = [];
  const titles = new Set<string>();

  for (const b of behaviors) {
    // Normalize title for comparison
    const normalized = b.title.toLowerCase()
      .replace(/[^a-z0-9äöüß→\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Check for near-duplicates
    let isDupe = false;
    for (const existing of Array.from(titles)) {
      if (existing === normalized) { isDupe = true; break; }
      // Simple word-overlap check: if 80%+ of words match, it's a dupe
      const wordsA = new Set(normalized.split(" ").filter((w: string) => w.length > 3));
      const wordsB = new Set(existing.split(" ").filter((w: string) => w.length > 3));
      if (wordsA.size === 0 || wordsB.size === 0) continue;
      const overlap = Array.from(wordsA).filter((w: string) => wordsB.has(w)).length;
      const similarity = overlap / Math.max(wordsA.size, wordsB.size);
      if (similarity > 0.8) { isDupe = true; break; }
    }

    if (!isDupe) {
      titles.add(normalized);
      kept.push(b);
    }
  }

  return kept;
}

export function mergeEndpoints(endpoints: APIEndpoint[]): APIEndpoint[] {
  const byName = new Map<string, APIEndpoint>();

  for (const ep of endpoints) {
    const existing = byName.get(ep.name);
    if (!existing) {
      byName.set(ep.name, ep);
      continue;
    }
    // Merge: keep the one with more inputFields
    if (ep.inputFields.length > existing.inputFields.length) {
      byName.set(ep.name, { ...ep, relatedBehaviors: Array.from(new Set([...existing.relatedBehaviors, ...ep.relatedBehaviors])) });
    } else {
      existing.relatedBehaviors = Array.from(new Set([...existing.relatedBehaviors, ...ep.relatedBehaviors]));
    }
  }

  return Array.from(byName.values());
}

export function enrichFromStructuralMap(ir: AnalysisIR, structuralMap: StructuralMap): void {
  // 1. Ensure tenant model is set
  if (!ir.tenantModel && structuralMap.tenantModel) {
    ir.tenantModel = {
      tenantEntity: structuralMap.tenantModel.entity,
      tenantIdField: structuralMap.tenantModel.idField,
    };
  }

  // 2. Ensure auth model is set
  if (!ir.authModel && structuralMap.authModel) {
    ir.authModel = {
      loginEndpoint: structuralMap.authModel.loginEndpoint,
      csrfEndpoint: structuralMap.authModel.csrfEndpoint || undefined,
      csrfPattern: structuralMap.authModel.csrfPattern || undefined,
      roles: structuralMap.authModel.roles.map(r => ({
        name: r.name,
        envUserVar: `E2E_${r.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_USER`,
        envPassVar: `E2E_${r.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PASS`,
        defaultUser: `test-${r.name}`,
        defaultPass: "TestPass2026x",
      })),
    };
  }

  // 3. Ensure status machine is complete
  if (structuralMap.statusMachine && ir.statusMachine) {
    // Add any transitions from structural map that Pass 2 missed
    for (const t of structuralMap.statusMachine.transitions) {
      const exists = ir.statusMachine.transitions.some(x => x[0] === t[0] && x[1] === t[1]);
      if (!exists) ir.statusMachine.transitions.push(t);
    }
    for (const f of structuralMap.statusMachine.forbidden) {
      const exists = (ir.statusMachine.forbidden || []).some(x => x[0] === f[0] && x[1] === f[1]);
      if (!exists) {
        if (!ir.statusMachine.forbidden) ir.statusMachine.forbidden = [];
        ir.statusMachine.forbidden.push(f);
      }
    }
  } else if (structuralMap.statusMachine && !ir.statusMachine) {
    ir.statusMachine = {
      states: structuralMap.statusMachine.states,
      transitions: structuralMap.statusMachine.transitions,
      forbidden: structuralMap.statusMachine.forbidden,
      initialState: structuralMap.statusMachine.initialState,
      terminalStates: structuralMap.statusMachine.terminalStates,
    };
  }

  // 4. Merge enums
  for (const [key, vals] of Object.entries(structuralMap.enums || {})) {
    if (!ir.enums[key]) ir.enums[key] = [];
    for (const v of vals) {
      if (!ir.enums[key].includes(v)) ir.enums[key].push(v);
    }
  }

  // 5. Ensure every endpoint from structural map exists in IR
  for (const mapEp of structuralMap.endpoints) {
    if (!ir.apiEndpoints.some(e => e.name === mapEp.name)) {
      ir.apiEndpoints.push({
        name: mapEp.name,
        method: mapEp.method || `POST /api/trpc/${mapEp.name}`,
        auth: mapEp.auth || "requireAuth",
        relatedBehaviors: [],
        inputFields: [],
        outputFields: [],
      });
    }
  }

  // 6. Flag coverage gaps — endpoints with no behaviors
  const coveredEndpoints = new Set(ir.behaviors.flatMap(b => {
    const related = ir.apiEndpoints.filter(e => e.relatedBehaviors.includes(b.id));
    return related.map(e => e.name);
  }));
  const uncoveredEndpoints = ir.apiEndpoints.filter(e => !coveredEndpoints.has(e.name) && e.inputFields.length === 0);
  if (uncoveredEndpoints.length > 0) {
    console.log(`[TestForge] Pass 3: ${uncoveredEndpoints.length} endpoints have no behaviors or fields: ${uncoveredEndpoints.map(e => e.name).join(", ")}`);
  }
}

// ─── Normalize (shared with old parser) ───────────────────────────────────────

export function normalizeEndpointFields(fields: unknown[]): EndpointField[] {
  return fields.map((f: unknown) => {
    if (typeof f === "string") {
      return { name: f, type: "string" as const, required: true };
    }
    if (f && typeof f === "object") {
      const obj = f as Record<string, unknown>;
      const name = String(obj.name || obj.field || obj.key || "unknown");
      const type = (obj.type as EndpointField["type"]) || "string";
      const required = obj.required !== false;
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
    return { name: String(f), type: "string" as const, required: true };
  });
}

export function normalizeStringFields(fields: unknown[]): string[] {
  return fields.map((f: unknown) => {
    if (typeof f === "string") return f;
    if (f && typeof f === "object") {
      const obj = f as Record<string, unknown>;
      return String(obj.name || obj.field || obj.key || JSON.stringify(f));
    }
    return String(f);
  });
}

// ─── Main: Smart Parse ────────────────────────────────────────────────────────

export async function parseSpecSmart(specText: string): Promise<AnalysisResult> {
  const t0 = Date.now();
  console.log(`[TestForge] Smart Parser v2.0 — ${specText.length} chars`);

  // Step 0: Split spec into sections
  const sections = splitIntoSections(specText);
  console.log(`[TestForge] Found ${sections.length} sections: ${sections.map(s => `${s.topic}(${s.charCount})`).join(", ")}`);

  // Step 1: Build structural map from compressed spec
  const compressed = compressSpec(specText, MAX_COMPRESSED_SIZE);
  console.log(`[TestForge] Compressed spec: ${specText.length} → ${compressed.length} chars (${Math.round(compressed.length / specText.length * 100)}%)`);

  const structuralMap = await buildStructuralMap(compressed);

  // Step 2: Group sections and extract in parallel
  const groups = groupSectionsForExtraction(sections, structuralMap);
  console.log(`[TestForge] Pass 2: ${groups.length} chunk groups — ALL PARALLEL`);

  const emptyResult: Partial<AnalysisIR> & { qualityScore?: number } = {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    resources: [], apiEndpoints: [], enums: {}, statusMachine: null,
  };

  const extractionResults = await Promise.all(
    groups.map(async (group, i) => {
      try {
        const result = await withTimeout(
          extractFromChunkGroup(group, structuralMap, i, groups.length),
          LLM_TIMEOUT_MS,
          emptyResult,
        );
        console.log(`[TestForge] Pass 2 group ${i + 1}/${groups.length} (${group.topics[0]}): ${(result.behaviors || []).length} behaviors, ${(result.apiEndpoints || []).length} endpoints`);
        return result;
      } catch (err) {
        console.error(`[TestForge] Pass 2 group ${i} (${group.title}) failed:`, err);
        return emptyResult;
      }
    }),
  );

  // Step 3: Merge all results
  const merged: AnalysisIR = {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    tenantModel: null, resources: [], apiEndpoints: [], authModel: null,
    enums: {}, statusMachine: null,
    services: [], userFlows: [], dataModels: [],
    cronJobs: [], featureGates: [], flows: [],
  };
  let totalQuality = 0;

  for (const r of extractionResults) {
    if (r.behaviors) merged.behaviors.push(...r.behaviors);
    if (r.invariants) merged.invariants.push(...r.invariants);
    if (r.ambiguities) merged.ambiguities.push(...r.ambiguities);
    if (r.contradictions) merged.contradictions.push(...r.contradictions);
    if (r.resources) merged.resources.push(...r.resources);
    if (r.apiEndpoints) merged.apiEndpoints.push(...r.apiEndpoints);
    if (!merged.tenantModel && r.tenantModel) merged.tenantModel = r.tenantModel;
    if (!merged.authModel && r.authModel) merged.authModel = r.authModel;
    if (r.qualityScore) totalQuality += r.qualityScore;
    if ((r as any).services) merged.services!.push(...(r as any).services);
    if ((r as any).userFlows) merged.userFlows!.push(...(r as any).userFlows);
    if ((r as any).dataModels) merged.dataModels!.push(...(r as any).dataModels);
    if ((r as any).cronJobs) merged.cronJobs!.push(...(r as any).cronJobs);
    if ((r as any).featureGates) merged.featureGates!.push(...(r as any).featureGates);
    if ((r as any).flows) merged.flows!.push(...(r as any).flows);
    // Merge enums
    if (r.enums && typeof r.enums === "object") {
      for (const [key, vals] of Object.entries(r.enums)) {
        if (!Array.isArray(vals)) continue;
        if (!merged.enums[key]) merged.enums[key] = [];
        for (const v of vals) {
          if (!merged.enums[key].includes(v)) merged.enums[key].push(v);
        }
      }
    }
    // Merge statusMachine
    if (r.statusMachine) {
      if (!merged.statusMachine) {
        merged.statusMachine = r.statusMachine as AnalysisIR["statusMachine"];
      } else {
        for (const s of (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).states || []) {
          if (!merged.statusMachine!.states.includes(s)) merged.statusMachine!.states.push(s);
        }
        for (const t of (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).transitions || []) {
          const exists = merged.statusMachine!.transitions.some(x => x[0] === t[0] && x[1] === t[1]);
          if (!exists) merged.statusMachine!.transitions.push(t);
        }
        for (const f of (r.statusMachine as NonNullable<AnalysisIR["statusMachine"]>).forbidden || []) {
          if (!merged.statusMachine!.forbidden) merged.statusMachine!.forbidden = [];
          const exists = merged.statusMachine!.forbidden.some(x => x[0] === f[0] && x[1] === f[1]);
          if (!exists) merged.statusMachine!.forbidden.push(f);
        }
      }
    }
  }

  // Step 3b: Semantic deduplication
  const beforeDedup = merged.behaviors.length;
  merged.behaviors = semanticDedup(merged.behaviors);
  console.log(`[TestForge] Pass 3: Dedup ${beforeDedup} → ${merged.behaviors.length} behaviors`);

  // Step 3c: Merge endpoints (keep richest version)
  merged.apiEndpoints = mergeEndpoints(merged.apiEndpoints);

  // Step 3d: Normalize fields
  merged.apiEndpoints = merged.apiEndpoints.map(e => ({
    ...e,
    inputFields: normalizeEndpointFields((e.inputFields as unknown as unknown[]) || []),
    outputFields: normalizeStringFields((e as unknown as Record<string, unknown[]>).outputFields || []),
  }));

  // Step 3e: Enrich from structural map
  enrichFromStructuralMap(merged, structuralMap);

  const elapsed = Date.now() - t0;
  console.log(`[TestForge] Smart Parser done in ${elapsed}ms — ${merged.behaviors.length} behaviors, ${merged.apiEndpoints.length} endpoints`);

  return {
    ir: merged,
    qualityScore: extractionResults.length > 0 ? totalQuality / extractionResults.length : 5.0,
    specType: "system-spec",
  };
}
