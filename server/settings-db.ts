/**
 * settings-db.ts — DB helpers + in-memory cache for editable system prompts.
 * All prompt reads go through getPrompt() which checks cache first, then DB,
 * then falls back to the hardcoded default.
 */
import { getDb } from "./db";
import { settings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Default Prompts ──────────────────────────────────────────────────────────

export const PROMPT_DEFAULTS: Record<string, { label: string; description: string; category: string; value: string }> = {
  "prompt.layer1.system": {
    label: "Schicht 1 — Spec Analyzer (System Prompt)",
    description: "System-Prompt für den LLM-basierten Spec-Parser (Schicht 1). Steuert, wie Behaviors, Endpoints und Datenmodelle aus der Spec extrahiert werden.",
    category: "prompts",
    value: `You are TestForge Schicht 1 — a precision spec analyzer for SaaS systems.
Extract EVERY testable behavior from this specification chunk.
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
Output ONLY valid JSON. No markdown, no explanation.`,
  },
  "prompt.layer1.smart.base": {
    label: "Smart-Parser — Base System Prompt",
    description: "Basis-Prompt für den Smart-Parser (Specs > 8KB). Wird allen 4 parallelen Extraktions-Calls vorangestellt.",
    category: "prompts",
    value: `You are a spec analyzer. Read this system specification and extract ONLY what is asked.
The spec may be in German — extract values in their original language/format.
Output ONLY valid JSON. No markdown, no explanation.`,
  },
  "prompt.layer1.smart.pass2": {
    label: "Smart-Parser — Pass 2 (Behavior-Extraktion)",
    description: "Prompt für den zweiten Pass des Smart-Parsers: extrahiert Behaviors aus einem spezifischen Spec-Abschnitt.",
    category: "prompts",
    value: `You are TestForge Pass 2 — extracting testable behaviors from a SPECIFIC section of a system spec.
Rules:
1. Extract behaviors as Subject-Verb-Object triples with specAnchor (verbatim quote 10-30 words)
2. For EACH endpoint: extract FULL inputFields as EndpointField objects with type, min, max, enumValues, isTenantKey, isBoundaryField
3. Use behavior IDs that include the section topic: e.g. "B-STATUS-001", "B-IDOR-001", "B-DSGVO-001"
4. Include ALL side-effects in postconditions AND as structuredSideEffects entries
5. Tag behaviors correctly: "authorization"+"security" for IDOR, "dsgvo" for PII, "state-machine" for transitions
6. For status transitions: create ONE behavior per transition (not one behavior for all transitions)
7. For forbidden transitions: create explicit rejection behaviors with HTTP 400/422 expected
Output ONLY valid JSON. No markdown, no explanation.`,
  },
  "prompt.layer3.system": {
    label: "Schicht 3 — Test-Generator (Gold Standard Rules)",
    description: "System-Prompt für den Playwright-Test-Generator (Schicht 3). Die Gold Standard Rules R1-R7 steuern die Qualität der generierten Tests.",
    category: "prompts",
    value: `You are TestForge Schicht 3 — a Gold Standard Playwright test generator.
Generate a TypeScript Playwright test that PROVES the given behavior and kills ALL listed mutation targets.

Gold Standard Rules (MUST follow — violations cause test to be discarded):
R1: NO if-wrappers: never 'if (x !== undefined) { expect(x)...' — use expect(x).toBeDefined() then unconditional assertions
R2: NO existence-only: never only toBeDefined()/toBeTruthy() — always assert exact values
R3: NO broad status codes: never toBeGreaterThanOrEqual(400) — use expect([401, 403]).toContain(status)
R4: Security tests MUST have side-effect check (verify DB state after attack)
R5: IDOR/Security tests MUST have positive control (verify legitimate access works)
R6: Counter checks MUST have baseline (const countBefore = ... BEFORE the action)
R7: Every assertion must have '// Kills: <specific mutation>' comment

Output ONLY the TypeScript test code. No markdown fences. No explanation.`,
  },
  "prompt.llmchecker.system": {
    label: "LLM Checker — Behavior-Verifikation",
    description: "Prompt für den unabhängigen LLM Checker (Schicht 5). Verifiziert ob ein extrahiertes Behavior wirklich aus der Spec ableitbar ist.",
    category: "prompts",
    value: `You are a spec verification expert. A behavior was extracted from a specification.
Verify if this behavior is correct, complete, and directly derivable from the spec text.
Answer in this exact JSON format:
{
  "verdict": "CORRECT" | "INCORRECT" | "PARTIAL",
  "confidence": 0.0-1.0,
  "issues": ["issue 1", "issue 2"]
}
Output ONLY valid JSON.`,
  },
  // General pipeline settings
  "setting.max_behaviors": {
    label: "Max. Behaviors pro Analyse",
    description: "Maximale Anzahl Behaviors die aus einer Spec extrahiert werden. Höhere Werte = längere Laufzeit.",
    category: "pipeline",
    value: "150",
  },
  "setting.max_llm_tests": {
    label: "Max. LLM-generierte Tests",
    description: "Maximale Anzahl Tests die per LLM generiert werden (Rest: deterministische Templates).",
    category: "pipeline",
    value: "8",
  },
  "setting.job_timeout_ms": {
    label: "Job-Timeout (ms)",
    description: "Maximale Laufzeit eines Analyse-Jobs in Millisekunden. Nach Ablauf wird der Job auf 'failed' gesetzt.",
    category: "pipeline",
    value: "480000",
  },
  "setting.llm_timeout_ms": {
    label: "LLM-Call Timeout (ms)",
    description: "Timeout pro LLM-API-Call in Millisekunden.",
    category: "pipeline",
    value: "55000",
  },
};

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

const cache = new Map<string, string>();

export async function warmCache(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(settings);
    for (const row of rows) {
      cache.set(row.key, row.value);
    }
  } catch {
    // DB not ready yet — will fall back to defaults
  }
}

export async function getPrompt(key: string): Promise<string> {
  // 1. Check in-memory cache
  if (cache.has(key)) return cache.get(key)!;

  // 2. Try DB
  try {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (rows.length > 0) {
      cache.set(key, rows[0].value);
      return rows[0].value;
    }
  } catch {
    // DB error — fall through to default
  }

  // 3. Fall back to hardcoded default
  return PROMPT_DEFAULTS[key]?.value ?? "";
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return Object.entries(PROMPT_DEFAULTS).map(([key, def]) => ({ key, label: def.label, description: def.description, category: def.category, value: def.value, defaultValue: def.value, isCustomized: false, updatedAt: null }));
  const rows = await db.select().from(settings);
  // Merge with defaults — show all keys even if not yet in DB
  return Object.entries(PROMPT_DEFAULTS).map(([key, def]) => {
    const dbRow = rows.find((r: { key: string }) => r.key === key);
    return {
      key,
      label: def.label,
      description: def.description,
      category: def.category,
      value: dbRow?.value ?? def.value,
      defaultValue: def.value,
      isCustomized: !!dbRow,
      updatedAt: dbRow?.updatedAt ?? null,
    };
  });
}

export async function upsertSetting(key: string, value: string, userId: number): Promise<void> {
  const def = PROMPT_DEFAULTS[key];
  if (!def) throw new Error(`Unknown setting key: ${key}`);

  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(settings)
    .values({
      key,
      value,
      defaultValue: def.value,
      label: def.label,
      description: def.description,
      category: def.category,
      updatedBy: userId,
    })
    .onDuplicateKeyUpdate({ set: { value, updatedBy: userId } });

  // Invalidate cache
  invalidateCache(key);
}

export async function resetSetting(key: string): Promise<void> {
  const def = PROMPT_DEFAULTS[key];
  if (!def) throw new Error(`Unknown setting key: ${key}`);
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(settings).where(eq(settings.key, key));
  invalidateCache(key);
}
