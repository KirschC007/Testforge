/**
 * spec-regex-extractor.ts
 *
 * Deterministic spec extraction using regex patterns.
 * Runs in parallel with LLM extraction (Mechanismus 2).
 * Results are merged with LLM results — LLM has priority,
 * but regex fills in gaps.
 *
 * No LLM calls — pure text pattern matching.
 */

export interface RegexExtractionResult {
  states: string[];
  transitions: [string, string][];
  forbidden: [string, string][];
  errorCodes: Array<{ code: string; httpStatus: number; description: string }>;
  roles: string[];
  piiFields: string[];
  endpoints: Array<{ method: string; path: string }>;
}

export function extractFromSpecText(specText: string): RegexExtractionResult {
  return {
    states: extractStates(specText),
    transitions: extractTransitions(specText),
    forbidden: extractForbidden(specText),
    errorCodes: extractErrorCodes(specText),
    roles: extractRoles(specText),
    piiFields: extractPIIFields(specText),
    endpoints: extractEndpoints(specText),
  };
}

// ─── States ───────────────────────────────────────────────────────────────

export function extractStates(text: string): string[] {
  const states = new Set<string>();

  // Pattern 1: ALL_CAPS_WORDS in lines containing transition arrows (→ or ->)
  // Split by lines first, then extract all ALL_CAPS words from arrow lines
  // This handles chains like "PENDING -> CONFIRMED -> COMPLETED"
  const lines = text.split('\n');
  let match;
  for (const line of lines) {
    if (/→|->/.test(line)) {
      // Extract all ALL_CAPS words from this line
      const wordPattern = /\b([A-Z][A-Z_]{2,})\b/g;
      while ((match = wordPattern.exec(line)) !== null) {
        const word = match[1];
        if (!HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word)) {
          states.add(word);
        }
      }
    }
  }

  // Pattern 2: States in backticks — `APPROVED`, `PENDING`
  const backtickPattern = /`([A-Z][A-Z_]{2,})`/g;
  while ((match = backtickPattern.exec(text)) !== null) {
    // Only add if it looks like a state (not a generic word like "GET" or "POST")
    const word = match[1];
    if (!HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word)) {
      states.add(word);
    }
  }

  // Pattern 3: States in bold — **APPROVED**, **PENDING**
  const boldPattern = /\*\*([A-Z][A-Z_]{2,})\*\*/g;
  while ((match = boldPattern.exec(text)) !== null) {
    const word = match[1];
    if (!HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word)) {
      states.add(word);
    }
  }

  // Pattern 4: "Status: APPROVED" or "state: PENDING, CONFIRMED, CANCELLED" patterns
  // Also handles comma-separated lists after the colon
  const statusLabelPattern = /(?:status|state|zustand)\s*:\s*((?:[A-Z][A-Z_]{2,}(?:\s*,\s*)?)+)/gi;
  while ((match = statusLabelPattern.exec(text)) !== null) {
    const parts = match[1].split(/\s*,\s*/);
    for (const part of parts) {
      const word = part.trim().toUpperCase();
      if (word.length >= 3 && !HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word)) {
        states.add(word);
      }
    }
  }

  // Pattern 4b: ENUM('DRAFT', 'SUBMITTED', ...) or ENUM("DRAFT", "SUBMITTED", ...)
  const enumPattern = /ENUM\s*\(([^)]+)\)/gi;
  while ((match = enumPattern.exec(text)) !== null) {
    const items = match[1].split(/\s*,\s*/);
    for (const item of items) {
      const word = item.replace(/['"`]/g, '').trim().toUpperCase();
      if (word.length >= 3 && !HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word)) {
        states.add(word);
      }
    }
  }

  // Pattern 5: "| APPROVED |" in markdown tables
  // Use lookahead to allow overlapping matches (each | can start next match)
  const tableLinePattern = /^\|(.+)\|$/gm;
  while ((match = tableLinePattern.exec(text)) !== null) {
    const cells = match[1].split('|');
    for (const cell of cells) {
      const word = cell.trim();
      if (/^[A-Z][A-Z_]{2,}$/.test(word) && !HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word) && !TABLE_HEADERS.has(word)) {
        states.add(word);
      }
    }
  }

  // Pattern 6: "Terminal: CLOSED, DENIED" or "Terminal States: ..."
  const terminalPattern = /terminal\s+states?\s*:?\s*((?:[A-Z][A-Z_]{2,}(?:\s*,\s*)?)+)/gi;
  while ((match = terminalPattern.exec(text)) !== null) {
    const stateList = match[1].split(/\s*,\s*/);
    for (const s of stateList) {
      const word = s.trim().toUpperCase();
      if (word.length >= 3 && !HTTP_METHODS.has(word) && !GENERIC_WORDS.has(word)) {
        states.add(word);
      }
    }
  }

  // Pattern 7: "Jeder Status → X" or "All states → X" — wildcard source
  // These don't add states but we capture the target
  const wildcardPattern = /(?:jeder status|alle zust.nde|all states?)\s*(?:→|->)\s*([A-Z][A-Z_]{2,})/gi;
  while ((match = wildcardPattern.exec(text)) !== null) {
    states.add(match[1].toUpperCase());
  }

  // Pattern 8: lowercase transition lines — "confirmed → seated" (Hey-Listen style)
  // Captures lowercase state names from arrow lines and uppercases them
  for (const line of lines) {
    if (/→|->/.test(line)) {
      const lcWordPattern = /(?:^|[\s,|→>])([a-zäöüß][a-zäöüß_]{2,})(?=[\s,|→<\-]|$)/g;
      while ((match = lcWordPattern.exec(line)) !== null) {
        const word = match[1];
        if (!LOWERCASE_NOISE.has(word) && word.length >= 3) {
          states.add(word.toUpperCase());
        }
      }
    }
  }

  return Array.from(states).filter(s => s.length >= 3);
}

// ─── Transitions ──────────────────────────────────────────────────────────

export function extractTransitions(text: string): [string, string][] {
  const transitions = new Map<string, [string, string]>();

  // Pattern 1: "REPORTED → UNDER_REVIEW" or "REPORTED -> UNDER_REVIEW"
  const arrowPattern = /([A-Z][A-Z_]{2,})\s*(?:→|->)\s*([A-Z][A-Z_]{2,})/g;
  let match;
  while ((match = arrowPattern.exec(text)) !== null) {
    const from = match[1];
    const to = match[2];
    if (!HTTP_METHODS.has(from) && !HTTP_METHODS.has(to)) {
      const key = `${from}→${to}`;
      transitions.set(key, [from, to]);
    }
  }

  // Pattern 2: "REPORTED, UNDER_REVIEW → CLOSED" (multiple sources)
  const multiSourcePattern = /([A-Z][A-Z_]{2,}(?:\s*,\s*[A-Z][A-Z_]{2,})+)\s*(?:→|->)\s*([A-Z][A-Z_]{2,})/g;
  while ((match = multiSourcePattern.exec(text)) !== null) {
    const sources = match[1].split(/\s*,\s*/);
    const to = match[2];
    for (const from of sources) {
      const f = from.trim();
      if (!HTTP_METHODS.has(f) && !HTTP_METHODS.has(to)) {
        const key = `${f}→${to}`;
        transitions.set(key, [f, to]);
      }
    }
  }

  // Pattern 3: lowercase transitions — "confirmed → seated" (Hey-Listen style)
  const lcArrowPattern = /(?:^|[\s,|])([a-zäöüß][a-zäöüß_]{2,})\s*(?:→|->)\s*([a-zäöüß][a-zäöüß_]{2,})(?=[\s,|]|$)/g;
  while ((match = lcArrowPattern.exec(text)) !== null) {
    const from = match[1].toUpperCase();
    const to = match[2].toUpperCase();
    if (!HTTP_METHODS.has(from) && !HTTP_METHODS.has(to)
        && !LOWERCASE_NOISE.has(match[1]) && !LOWERCASE_NOISE.has(match[2])) {
      const key = `${from}→${to}`;
      transitions.set(key, [from, to]);
    }
  }

  return Array.from(transitions.values());
}

// ─── Forbidden transitions ────────────────────────────────────────────────

export function extractForbidden(text: string): [string, string][] {
  const forbidden = new Map<string, [string, string]>();

  // Pattern 1: "CLOSED → X (verboten)" or "DENIED → X (not allowed)"
  const forbiddenPattern = /([A-Z][A-Z_]{2,})\s*(?:→|->)\s*([A-Z][A-Z_]{2,})\s*\((?:verboten|not allowed|forbidden|illegal)\)/gi;
  let match;
  while ((match = forbiddenPattern.exec(text)) !== null) {
    const key = `${match[1]}→${match[2]}`;
    forbidden.set(key, [match[1], match[2]]);
  }

  // Pattern 2: "Terminal: CLOSED" — terminal states can't transition anywhere
  // We collect terminal states and add forbidden transitions in mergeWithRegex
  const terminalPattern = /terminal\s*:?\s*([A-Z][A-Z_]{2,})/gi;
  while ((match = terminalPattern.exec(text)) !== null) {
    const terminalState = match[1].toUpperCase();
    // Mark as terminal by adding a self-referential forbidden (handled in merge)
    forbidden.set(`${terminalState}→__TERMINAL__`, [terminalState, "__TERMINAL__"]);
  }

  return Array.from(forbidden.values());
}

// ─── Error codes ──────────────────────────────────────────────────────────

export function extractErrorCodes(text: string): Array<{ code: string; httpStatus: number; description: string }> {
  const codes = new Map<string, { code: string; httpStatus: number; description: string }>();

  // Pattern 1: "INSURER_MISMATCH (403)" or "INSURER_MISMATCH: 403"
  const codeWithStatusPattern = /([A-Z][A-Z_]{2,})\s*[:(]\s*(4\d\d|5\d\d)\)?/g;
  let match;
  while ((match = codeWithStatusPattern.exec(text)) !== null) {
    const code = match[1];
    const status = parseInt(match[2], 10);
    if (!HTTP_METHODS.has(code) && !GENERIC_WORDS.has(code) && !TABLE_HEADERS.has(code)) {
      codes.set(code, { code, httpStatus: status, description: "" });
    }
  }

  // Pattern 2: Table rows "| INSURER_MISMATCH | 403 | Beschreibung |" or "| INSURER_MISMATCH | 403 |"
  // Description column is optional (2-column or 3-column tables)
  const tableRowPattern = /\|\s*([A-Z][A-Z_]{2,})\s*\|\s*(4\d\d|5\d\d)\s*\|(?:([^|]*)\|)?/g;
  while ((match = tableRowPattern.exec(text)) !== null) {
    const code = match[1];
    const status = parseInt(match[2], 10);
    const desc = (match[3] || '').trim();
    if (!HTTP_METHODS.has(code) && !GENERIC_WORDS.has(code) && !TABLE_HEADERS.has(code)) {
      codes.set(code, { code, httpStatus: status, description: desc });
    }
  }

  // Pattern 3: "returns INSURER_MISMATCH" or "wirft INSURER_MISMATCH"
  const returnsPattern = /(?:returns?|wirft|throws?|gibt)\s+`?([A-Z][A-Z_]{2,})`?/gi;
  while ((match = returnsPattern.exec(text)) !== null) {
    const code = match[1];
    if (!HTTP_METHODS.has(code) && !GENERIC_WORDS.has(code) && !TABLE_HEADERS.has(code) && !codes.has(code)) {
      codes.set(code, { code, httpStatus: 400, description: "" });
    }
  }

  // Pattern 4: "Returns 409 DUPLICATE_CLAIM" — HTTP status before code
  const statusBeforeCodePattern = /(?:returns?|wirft|throws?|gibt|\b)\s*(4\d\d|5\d\d)\s+([A-Z][A-Z_]{2,})/g;
  while ((match = statusBeforeCodePattern.exec(text)) !== null) {
    const status = parseInt(match[1], 10);
    const code = match[2];
    if (!HTTP_METHODS.has(code) && !GENERIC_WORDS.has(code) && !TABLE_HEADERS.has(code)) {
      codes.set(code, { code, httpStatus: status, description: "" });
    }
  }

  return Array.from(codes.values());
}

// ─── Roles ────────────────────────────────────────────────────────────────

export function extractRoles(text: string): string[] {
  const roles = new Set<string>();

  // Pattern 1: role-like words (snake_case or simple words) in permission tables or sentences
  // Matches: "policyholder", "claims_agent", "fraud_analyst", "insurer_admin"
  // Also matches simple words like "policyholder" (no underscore)
  const roleWordPattern = /(?:^|[\s,|`'"])([a-zäöüß][a-zäöüß_]{2,})(?=[\s,|`'"]|$)/g;
  let match;
  while ((match = roleWordPattern.exec(text)) !== null) {
    const word = match[1];
    if (ROLE_KEYWORDS.some(kw => word === kw || word.includes(kw + '_') || word.includes('_' + kw) || word.endsWith(kw))) {
      roles.add(word);
    }
  }

  // Pattern 2: Role names in backticks — `policyholder`, `admin`
  const backtickPattern = /`([a-zäöüß][a-zäöüß_]{2,})`/g;
  while ((match = backtickPattern.exec(text)) !== null) {
    const word = match[1];
    if (ROLE_KEYWORDS.some(kw => word.includes(kw)) || COMMON_ROLES.has(word)) {
      roles.add(word);
    }
  }

  // Pattern 3: "Rolle: policyholder" or "Role: admin, user, moderator" (comma-separated list)
  const roleLabelPattern = /(?:rolle|role)\s*:\s*((?:[a-zäöüß][a-zäöüß_]{2,}(?:\s*,\s*)?)+)/gi;
  while ((match = roleLabelPattern.exec(text)) !== null) {
    const parts = match[1].split(/\s*,\s*/);
    for (const part of parts) {
      const word = part.trim().toLowerCase();
      if (word.length >= 3) {
        roles.add(word);
      }
    }
  }

  // Pattern 3b: user.role === 'roleName' or user.role === "roleName" (all occurrences)
  const userRolePattern = /user\.role\s*===?\s*['"]([a-zäöüß][a-zäöüß_]{2,})['"]|req\.user\.role\s*===?\s*['"]([a-zäöüß][a-zäöüß_]{2,})['"]|ctx\.user\.role\s*===?\s*['"]([a-zäöüß][a-zäöüß_]{2,})['"]|role\s*===?\s*['"]([a-zäöüß][a-zäöüß_]{2,})['"]/g;
  while ((match = userRolePattern.exec(text)) !== null) {
    const role = (match[1] || match[2] || match[3] || match[4] || '').toLowerCase();
    if (role.length >= 3) {
      roles.add(role);
    }
  }

  // Pattern 4: "| policyholder | ✓ |" in permission tables
  const tableRolePattern = /^\|\s*([a-zäöüß][a-zäöüß_]{2,})\s*\|/gm;
  while ((match = tableRolePattern.exec(text)) !== null) {
    const word = match[1];
    if (ROLE_KEYWORDS.some(kw => word.includes(kw)) || COMMON_ROLES.has(word)) {
      roles.add(word);
    }
  }

  // Final filter: remove known noise words
  return Array.from(roles).filter(r => !ROLE_NOISE_BLOCKLIST.has(r));
}

// ─── PII Fields ───────────────────────────────────────────────────────────

export function extractPIIFields(text: string): string[] {
  const fields = new Set<string>();

  // Pattern 1: Known PII field names in camelCase or snake_case
  const piiPattern = /\b(name|email|phone|address|birthdate|birth_date|dateOfBirth|date_of_birth|ssn|nationalId|national_id|passport|driverLicense|driver_license|creditCard|credit_card|bankAccount|bank_account|iban|taxId|tax_id|ipAddress|ip_address|location|geoLocation|geo_location)\b/gi;
  let match;
  while ((match = piiPattern.exec(text)) !== null) {
    fields.add(match[1].toLowerCase());
  }

  // Pattern 2: Fields in DSGVO/GDPR section
  const gdprSectionMatch = text.toLowerCase().match(/(?:dsgvo|gdpr|datenschutz|privacy)[^#]*?(?=##|$)/i);
  if (gdprSectionMatch) {
    const gdprText = gdprSectionMatch[0];
    // Extract field names from the DSGVO section
    const fieldPattern = /\b([a-z][a-zA-Z_]{2,})\b/g;
    while ((match = fieldPattern.exec(gdprText)) !== null) {
      const word = match[1];
      if (PII_INDICATORS.some(ind => word.toLowerCase().includes(ind))) {
        fields.add(word);
      }
    }
  }

  return Array.from(fields);
}

// ─── Endpoints ────────────────────────────────────────────────────────────

export function extractEndpoints(text: string): Array<{ method: string; path: string }> {
  const endpoints = new Map<string, { method: string; path: string }>();

  // Pattern 1: "POST /api/claims/:id/status" or "GET /claims"
  const httpMethodPattern = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[a-zA-Z0-9_/:.-]+)/g;
  let match;
  while ((match = httpMethodPattern.exec(text)) !== null) {
    const method = match[1];
    const path = match[2];
    const key = `${method} ${path}`;
    endpoints.set(key, { method, path });
  }

  // Pattern 2: Markdown headers like "### POST /api/claims/:id/assessment"
  const headerPattern = /^#{1,4}\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/[a-zA-Z0-9_/:.-]+)/gm;
  while ((match = headerPattern.exec(text)) !== null) {
    const method = match[1];
    const path = match[2];
    const key = `${method} ${path}`;
    endpoints.set(key, { method, path });
  }

  // Pattern 3: "### claims.updateStatus" — resource.action format
  const resourceActionPattern = /^#{1,4}\s+([a-z][a-zA-Z]+\.[a-zA-Z]+)/gm;
  while ((match = resourceActionPattern.exec(text)) !== null) {
    const name = match[1];
    // Infer method from action name
    const method = inferMethodFromAction(name.split(".")[1]);
    endpoints.set(name, { method, path: `/${name.replace(".", "/")}` });
  }

  return Array.from(endpoints.values());
}

// ─── Spec Section Decomposition ───────────────────────────────────────────

export interface SpecSections {
  endpoints: string;
  roles: string;
  statusMachine: string;
  businessRules: string;
  gdpr: string;
  userFlows: string;
  constraints: string;
  full: string;
}

export function decomposeSpec(specText: string): SpecSections {
  // Split at ## headers (keep the header in each section)
  const sectionPattern = /^(##\s+.+)$/gm;
  const sectionStarts: Array<{ index: number; title: string }> = [];
  let match;
  while ((match = sectionPattern.exec(specText)) !== null) {
    sectionStarts.push({ index: match.index, title: match[1] });
  }

  // Build sections map: title → content
  const sectionTitles: string[] = [];
  const sectionContents: string[] = [];
  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].index;
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : specText.length;
    const content = specText.slice(start, end);
    sectionTitles.push(sectionStarts[i].title.toLowerCase());
    sectionContents.push(content);
  }

  const find = (keywords: string[]): string => {
    for (let i = 0; i < sectionTitles.length; i++) {
      if (keywords.some(kw => sectionTitles[i].includes(kw.toLowerCase()))) {
        return sectionContents[i];
      }
    }
    return "";
  };

  return {
    endpoints: find(["endpunkte", "endpoints", "api", "routes", "routen"]),
    roles: find(["rollen", "roles", "authorization", "auth", "berechtigungen", "permissions", "zugriff"]),
    statusMachine: find(["status", "workflow", "state", "zustände", "states", "übergänge", "transitions"]),
    businessRules: find(["geschäftsregeln", "business rules", "business logic", "regeln", "logic"]),
    gdpr: find(["dsgvo", "gdpr", "datenschutz", "privacy", "data protection", "pii"]),
    userFlows: find(["user flow", "abläufe", "flows", "journeys", "use cases", "szenarien"]),
    constraints: find(["fehler", "error", "validierung", "validation", "constraints", "fehlercodes"]),
    full: specText,
  };
}

// ─── Merge LLM IR with Regex Results ─────────────────────────────────────

import type { AnalysisIR } from "./types";
import { normalizeEndpointName } from "./normalize";

export function mergeWithRegex(llmIR: AnalysisIR, regexResult: RegexExtractionResult, specText = ""): AnalysisIR {
  // 1. Merge states
  if (llmIR.statusMachine && regexResult.states.length > 0) {
    const existingStates = new Set(llmIR.statusMachine.states);
    let added = 0;
    for (const state of regexResult.states) {
      if (!existingStates.has(state)) {
        llmIR.statusMachine.states.push(state);
        existingStates.add(state);
        added++;
        console.log(`[RegexFallback] Added missing state: ${state}`);
      }
    }
    if (added > 0) {
      console.log(`[RegexFallback] Total states after merge: ${llmIR.statusMachine.states.length}`);
    }
  } else if (!llmIR.statusMachine && regexResult.states.length > 0) {
    // Create status machine from regex results
    llmIR.statusMachine = {
      states: regexResult.states,
      transitions: regexResult.transitions,
      forbidden: regexResult.forbidden.filter(f => f[1] !== "__TERMINAL__"),
      terminalStates: regexResult.forbidden
        .filter(f => f[1] === "__TERMINAL__")
        .map(f => f[0]),
      initialState: regexResult.states[0] || "",
    };
    console.log(`[RegexFallback] Created status machine from regex: ${regexResult.states.length} states`);
  }

  // 2. Merge transitions
  if (llmIR.statusMachine && regexResult.transitions.length > 0) {
    const existingTransitions = new Set(
      llmIR.statusMachine.transitions.map(t => `${t[0]}→${t[1]}`)
    );
    let added = 0;
    for (const t of regexResult.transitions) {
      const key = `${t[0]}→${t[1]}`;
      if (!existingTransitions.has(key)) {
        llmIR.statusMachine.transitions.push(t);
        existingTransitions.add(key);
        added++;
      }
    }
    if (added > 0) {
      console.log(`[RegexFallback] Added ${added} missing transitions`);
    }
  }

  // 3. Merge error codes
  if (regexResult.errorCodes.length > 0) {
    const existingCodes = new Set(
      (llmIR.errorCodes || []).map(e => e.code)
    );
    let added = 0;
    for (const ec of regexResult.errorCodes) {
      if (!existingCodes.has(ec.code)) {
        llmIR.errorCodes = llmIR.errorCodes || [];
        llmIR.errorCodes.push(ec);
        existingCodes.add(ec.code);
        added++;
      }
    }
    if (added > 0) {
      console.log(`[RegexFallback] Added ${added} missing error codes`);
    }
  }

  // 4. Merge roles
  if (llmIR.authModel && regexResult.roles.length > 0) {
    const existingRoles = new Set(llmIR.authModel.roles.map(r => r.name));
    let added = 0;
    for (const role of regexResult.roles) {
      if (!existingRoles.has(role)) {
        llmIR.authModel.roles.push({ name: role, envUserVar: "", envPassVar: "", defaultUser: "", defaultPass: "" });
        existingRoles.add(role);
        added++;
        console.log(`[RegexFallback] Added missing role: ${role}`);
      }
    }
    if (added > 0) {
      console.log(`[RegexFallback] Total roles after merge: ${llmIR.authModel.roles.length}`);
    }
  }

  // 5. Merge tenant model from regex if LLM returned null
  if (!llmIR.tenantModel) {
    const regexTenant = extractTenantModel(specText);
    if (regexTenant) {
      llmIR.tenantModel = {
        tenantEntity: regexTenant.entity,
        tenantIdField: regexTenant.idField,
      };
      console.log(`[RegexFallback] Set tenant: ${regexTenant.entity} (${regexTenant.idField})`);
    }
  }

  // 6. Merge endpoints
  if (regexResult.endpoints.length > 0) {
    const existingEndpoints = new Set(llmIR.apiEndpoints.map(ep => ep.name));
    let added = 0;
    for (const ep of regexResult.endpoints) {
      const normalized = normalizeEndpointName(ep.path, `${ep.method} ${ep.path}`);
      if (!existingEndpoints.has(normalized)) {
        llmIR.apiEndpoints.push({
          name: normalized,
          method: ep.method,
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [],
        });
        existingEndpoints.add(normalized);
        added++;
        console.log(`[RegexFallback] Added missing endpoint: ${normalized} (${ep.method} ${ep.path})`);
      }
    }
    if (added > 0) {
      console.log(`[RegexFallback] Total endpoints after merge: ${llmIR.apiEndpoints.length}`);
    }
  }

  return llmIR;
}

// ─── Constants ────────────────────────────────────────────────────────────

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

// Common words that appear in lowercase transition lines but are NOT state names
const LOWERCASE_NOISE = new Set([
  "by", "via", "or", "and", "the", "a", "an", "is", "are", "was", "were",
  "to", "from", "at", "in", "on", "of", "for", "with", "not", "if", "when",
  "then", "after", "before", "durch", "nach", "von", "mit", "oder", "und",
  "nur", "auch", "als", "bei", "per", "bis", "alle", "jede", "jeder",
  "automatisch", "manuell", "korrektur", "reaktivierung", "gast",
  "begründung", "pflicht", "kündigungsfrist", "wochen", "kinder",
  "betreuung", "startdatum", "platzanzahl", "prüft", "unterlagen",
  "beginnt", "frist", "freigegeben", "reduziert", "zeitpunkt",
]);

const GENERIC_WORDS = new Set([
  "API", "URL", "HTTP", "JSON", "REST", "AUTH", "JWT", "UUID", "ID", "OK",
  "NULL", "TRUE", "FALSE", "AND", "OR", "NOT", "THE", "FOR", "WITH",
  "FROM", "INTO", "OVER", "UNDER", "AFTER", "BEFORE", "WHEN", "THEN",
  "MUST", "SHOULD", "SHALL", "MAY", "CAN", "WILL", "DOES", "HAS",
  "NEW", "OLD", "ALL", "ANY", "NONE", "SOME", "EACH", "EVERY",
]);

const TABLE_HEADERS = new Set([
  "STATUS", "STATE", "ROLE", "NAME", "TYPE", "CODE", "ERROR", "FIELD",
  "METHOD", "PATH", "DESCRIPTION", "NOTES", "EXAMPLE", "DEFAULT",
  "REQUIRED", "OPTIONAL", "VALUE", "FORMAT", "CONSTRAINT",
]);

const ROLE_KEYWORDS = [
  "admin", "user", "agent", "officer", "analyst", "manager", "operator",
  "holder", "owner", "viewer", "editor", "moderator", "staff", "member",
  "customer", "client", "vendor", "partner", "doctor", "nurse", "patient",
  "adjuster", "underwriter", "compliance", "finance", "fraud",
];

const COMMON_ROLES = new Set([
  "admin", "user", "guest", "owner", "viewer", "editor", "moderator",
  "staff", "member", "customer", "client", "manager", "operator",
]);

// Words that look like roles but are NOT roles (SQL artifacts, event names, etc.)
const ROLE_NOISE_BLOCKLIST = new Set([
  // SQL index names
  "idx_users_role", "idx_role",
  // Database/session artifacts
  "user_sessions", "users",
  // Audit log event types (not roles)
  "user_login", "user_login_failed", "user_logout",
  "user_locked", "user_unlocked",
  "manual_admin_action",
  // Field names
  "username", "stripe_user_id",
  // Generic words that happen to contain role keywords
  "client_secret", "client_id", "client_credentials",
]);

const PII_INDICATORS = [
  "name", "email", "phone", "address", "birth", "ssn", "passport",
  "license", "card", "account", "iban", "tax", "ip", "location", "geo",
];

// ─── Tenant Model ────────────────────────────────────────────────────────

export function extractTenantModel(text: string): { entity: string; idField: string } | null {
  // Pattern 1: "isolated by `companyId`" / "isoliert durch `insurerId`"
  const isolatedPattern = /(?:isolated|isoliert|discriminat|tenant)\s+(?:by|durch|per)\s+[`'"']?(\w+Id)[`'"']?/i;
  const isolatedMatch = text.match(isolatedPattern);
  if (isolatedMatch) {
    const idField = isolatedMatch[1];
    const entity = idField.replace(/Id$/, "");
    return { entity, idField };
  }

  // Pattern 2: "Each company (`companyId`) is an isolated tenant"
  const eachPattern = /[Ee]ach\s+(\w+)\s+\(?[`'"']?(\w+Id)[`'"']?\)?\s+(?:is|operates|has)/;
  const eachMatch = text.match(eachPattern);
  if (eachMatch) {
    return { entity: eachMatch[1].toLowerCase(), idField: eachMatch[2] };
  }

  // Pattern 3: "Jeder Versicherer (Tenant) ist durch `insurerId` isoliert"
  const jederPattern = /[Jj]ede[rs]?\s+(\w+)\s+.*?(?:durch|per|mit)\s+[`'"']?(\w+Id)[`'"']?\s+(?:isoliert|getrennt)/;
  const jederMatch = text.match(jederPattern);
  if (jederMatch) {
    return { entity: jederMatch[1].toLowerCase(), idField: jederMatch[2] };
  }

  // Pattern 4: "tenant discriminator" / "Tenant-Key: clinicId"
  const tenantKeyPattern = /[Tt]enant[- ]?(?:[Kk]ey|discriminator|field)[:\s]+[`'"']?(\w+Id)[`'"']?/;
  const tenantKeyMatch = text.match(tenantKeyPattern);
  if (tenantKeyMatch) {
    const idField = tenantKeyMatch[1];
    return { entity: idField.replace(/Id$/, ""), idField };
  }

  // Pattern 5: "`companyId` must match JWT" / "insurerId muss mit JWT übereinstimmen"
  const jwtPattern = /[`'"']?(\w+Id)[`'"']?\s+(?:must match|muss.*?übereinstimmen|must equal|must correspond)/i;
  const jwtMatch = text.match(jwtPattern);
  if (jwtMatch) {
    const idField = jwtMatch[1];
    return { entity: idField.replace(/Id$/, ""), idField };
  }

  // Pattern 6: "Each X (`xId`) is isolated" — variant without 'is/operates/has'
  const eachPattern2 = /[Ee]ach\s+(\w+)\s+\([`'"']?(\w+Id)[`'"']?\)/;
  const eachMatch2 = text.match(eachPattern2);
  if (eachMatch2) {
    return { entity: eachMatch2[1].toLowerCase(), idField: eachMatch2[2] };
  }

  // Pattern 7b (formerly Pattern 8): "Alle Tabellen ... haben `xId`" (German: all tables have xId)
  // Explicit statement beats frequency heuristic — run BEFORE Pattern 7
  const alleTabPattern = /[Aa]lle\s+Tabellen\s+.*?haben\s+[`'"']?(\w+Id)[`'"']?/;
  const alleMatch = text.match(alleTabPattern);
  if (alleMatch) {
    const idField = alleMatch[1];
    return { entity: idField.replace(/Id$/, ""), idField };
  }

  // Pattern 7: Frequency heuristic — xId appearing most frequently overall → likely tenant key
  // Uses total occurrences (not just backtick) + INDEX bonus for SQL schemas
  // Handles: "restaurantId" appearing 99 times in Hey-Listen spec
  const anyIdPattern = /\b(\w+Id)\b/g;
  const idTotalFreq = new Map<string, number>();
  let bm;
  while ((bm = anyIdPattern.exec(text)) !== null) {
    const id = bm[1];
    // Skip very generic IDs that are not tenant keys
    if (id === "userId" || id === "Id") continue;
    idTotalFreq.set(id, (idTotalFreq.get(id) || 0) + 1);
  }
  // Bonus: xId appearing in INDEX definitions (SQL schema) is a strong tenant signal
  const indexIdPattern = /INDEX\s+idx_\w+_(\w+Id)/g;
  while ((bm = indexIdPattern.exec(text)) !== null) {
    const id = bm[1];
    idTotalFreq.set(id, (idTotalFreq.get(id) || 0) + 10); // bonus weight
  }
  // Find the most frequent xId (min 15 occurrences total) — that's the tenant key
  let bestId: string | null = null;
  let bestCount = 14; // minimum threshold
  for (const entry of Array.from(idTotalFreq.entries())) {
    const [id, count] = entry;
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
    }
  }
  if (bestId) {
    return { entity: bestId.replace(/Id$/, ""), idField: bestId };
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function inferMethodFromAction(action: string): string {
  if (!action) return "GET";
  const lower = action.toLowerCase();
  if (lower.startsWith("create") || lower.startsWith("add") || lower.startsWith("register") || lower.startsWith("submit")) return "POST";
  if (lower.startsWith("update") || lower.startsWith("edit") || lower.startsWith("modify") || lower.startsWith("patch")) return "PATCH";
  if (lower.startsWith("replace") || lower.startsWith("set")) return "PUT";
  if (lower.startsWith("delete") || lower.startsWith("remove") || lower.startsWith("destroy")) return "DELETE";
  return "GET";
}
