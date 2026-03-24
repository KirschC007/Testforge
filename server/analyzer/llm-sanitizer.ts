/**
 * TestForge v5.3 — LLM Output Sanitizer
 *
 * Two-stage sanitization pipeline for LLM output:
 * Stufe 1: Deterministic fixes (free, instant) — handles 90% of issues
 * Stufe 2: LLM repair for unfixable issues (costs tokens, slow) — optional
 */
import { ensureArray, ensureString, sanitizeBehavior, sanitizeEndpoint, sanitizeUserFlow } from "./normalize";
import { normalizeEndpointName } from "./normalize";
import type { AnalysisIR, Behavior, APIEndpoint } from "./types";
import { invokeLLM } from "../_core/llm";

export interface SanitizationReport {
  fieldsFixed: number;
  llmRepairCalls: number;
  issues: Array<{ field: string; was: string; now: string; method: "deterministic" | "llm-repair" }>;
}

/**
 * LLM repair for a single field that deterministic fixes cannot handle.
 * Only called when Stufe 2 is enabled and the field is clearly broken.
 */
async function repairWithLLM(
  field: string,
  currentValue: unknown,
  context: string,
  expectedType: string
): Promise<unknown> {
  const prompt = `The following JSON field "${field}" has an unexpected value.
Current value: ${JSON.stringify(currentValue)}
Expected type: ${expectedType}
Context from the spec: "${context.slice(0, 500)}"

Return ONLY the corrected value as valid JSON. No explanation.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a JSON repair assistant. Return ONLY valid JSON, no explanation." },
        { role: "user", content: prompt },
      ],
    });
    const content = result.choices[0].message.content as string;
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return currentValue; // Return original if repair fails
  }
}

/**
 * Full sanitization pipeline for LLM output.
 * Stufe 1: Deterministic fixes (free, instant)
 * Stufe 2: LLM repair for unfixable issues (costs tokens, slow) — optional
 */
export async function sanitizeIR(
  ir: AnalysisIR,
  specText: string,
  options?: { enableLLMRepair?: boolean }
): Promise<{ ir: AnalysisIR; report: SanitizationReport }> {
  const report: SanitizationReport = { fieldsFixed: 0, llmRepairCalls: 0, issues: [] };

  // ─── Stufe 1: Deterministic Fixes ─────────────────────────────────────────

  // 1a. Behaviors: ensure all array fields have correct types
  for (const b of ir.behaviors) {
    const before = JSON.stringify(b);
    (b as unknown as Record<string, unknown>).preconditions = ensureArray(b.preconditions);
    (b as unknown as Record<string, unknown>).postconditions = ensureArray(b.postconditions);
    (b as unknown as Record<string, unknown>).errorCases = ensureArray(b.errorCases);
    (b as unknown as Record<string, unknown>).errorCodes = ensureArray(b.errorCodes);
    (b as unknown as Record<string, unknown>).tags = ensureArray(b.tags);
    (b as unknown as Record<string, unknown>).riskHints = ensureArray(b.riskHints);
    if (JSON.stringify(b) !== before) {
      report.fieldsFixed++;
      report.issues.push({
        field: `behavior.${b.id}`,
        was: "non-array fields",
        now: "arrays",
        method: "deterministic",
      });
    }
  }

  // 1b. Endpoints: normalize name and ensure array fields
  for (const ep of ir.apiEndpoints) {
    const oldName = ep.name;
    ep.name = normalizeEndpointName(ep.name, ep.method);
    if (oldName !== ep.name) {
      report.fieldsFixed++;
      report.issues.push({ field: `endpoint.${oldName}`, was: oldName, now: ep.name, method: "deterministic" });
    }
    // Ensure relatedBehaviors is an array
    if (!Array.isArray(ep.relatedBehaviors)) {
      (ep as unknown as Record<string, unknown>).relatedBehaviors = ensureArray(ep.relatedBehaviors);
      report.fieldsFixed++;
    }
    // Ensure inputFields is an array
    if (!Array.isArray(ep.inputFields)) {
      (ep as unknown as Record<string, unknown>).inputFields = [];
      report.fieldsFixed++;
    }
    // Ensure outputFields is an array
    if (!Array.isArray(ep.outputFields)) {
      (ep as unknown as Record<string, unknown>).outputFields =
        typeof ep.outputFields === "string" ? [ep.outputFields] : [];
      report.fieldsFixed++;
    }
  }

  // 1c. UserFlows: ensure arrays
  for (const flow of (ir.userFlows || [])) {
    (flow as unknown as Record<string, unknown>).steps = ensureArray(flow.steps);
    (flow as unknown as Record<string, unknown>).successCriteria = ensureArray(flow.successCriteria);
    (flow as unknown as Record<string, unknown>).relatedEndpoints = ensureArray(flow.relatedEndpoints);
  }

  // 1d. StatusMachine: filter invalid states (states that don't appear in transitions)
  if (ir.statusMachine) {
    const validStates = new Set(
      ir.statusMachine.transitions.flatMap(t => [t[0], t[1]])
    );
    if (validStates.size > 0) {
      const before = ir.statusMachine.states.length;
      ir.statusMachine.states = ir.statusMachine.states.filter(s => validStates.has(s));
      if (ir.statusMachine.states.length !== before) {
        report.fieldsFixed++;
        report.issues.push({
          field: "statusMachine.states",
          was: `${before} states (some invalid)`,
          now: `${ir.statusMachine.states.length} valid states`,
          method: "deterministic",
        });
      }
    }
  }

  // 1e. StatusMachines array: same filter for each
  for (const sm of (ir.statusMachines || [])) {
    const validStates = new Set(sm.transitions.flatMap(t => [t[0], t[1]]));
    if (validStates.size > 0) {
      sm.states = sm.states.filter(s => validStates.has(s));
    }
  }

  // 1f. Remove empty/invalid behaviors (title too short or default)
  const beforeCount = ir.behaviors.length;
  ir.behaviors = ir.behaviors.filter(b =>
    b.title && b.title.length > 3 && b.title !== "Untitled behavior"
  );
  if (ir.behaviors.length !== beforeCount) {
    report.fieldsFixed++;
    report.issues.push({
      field: "behaviors",
      was: `${beforeCount} behaviors`,
      now: `${ir.behaviors.length} valid behaviors`,
      method: "deterministic",
    });
  }

  // 1f-2. Extract UPPERCASE_ERROR_CODES from spec text and inject into behaviors.errorCodes
  // Pattern: any WORD_WITH_UNDERSCORES that appears after "→ 4xx" or "→ 422" or "→ 400" in spec
  const errorCodePattern = /\b([A-Z][A-Z0-9_]{3,})\b/g;
  const specErrorCodes = new Set<string>();
  let ecMatch;
  while ((ecMatch = errorCodePattern.exec(specText)) !== null) {
    const code = ecMatch[1];
    // Filter out common non-error-code uppercase words
    if (!['HTTP', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'API', 'URL', 'UUID', 'ID', 'JSON',
          'REST', 'SQL', 'JWT', 'GDPR', 'PII', 'DSGVO', 'ISO', 'UTC', 'PDF', 'CSV', 'XML',
          'NULL', 'TRUE', 'FALSE', 'AND', 'OR', 'NOT', 'ALL', 'ANY', 'NONE', 'SOME'].includes(code)) {
      specErrorCodes.add(code);
    }
  }
  // Inject error codes into behaviors that mention them in errorCases or preconditions
  for (const b of ir.behaviors) {
    const bText = [
      ...b.errorCases,
      ...b.preconditions,
      ...b.postconditions,
      b.title,
      b.specAnchor || '',
    ].join(' ').toUpperCase();
    const matchedCodes = Array.from(specErrorCodes).filter(code => bText.includes(code));
    if (matchedCodes.length > 0) {
      const existing = new Set(b.errorCodes || []);
      const newCodes = matchedCodes.filter(c => !existing.has(c));
      if (newCodes.length > 0) {
        (b as unknown as Record<string, unknown>).errorCodes = [...(b.errorCodes || []), ...newCodes];
        report.fieldsFixed++;
        report.issues.push({
          field: `behavior.${b.id}.errorCodes`,
          was: 'missing error codes',
          now: newCodes.join(', '),
          method: 'deterministic',
        });
      }
    }
  }

  // 1g. Remove duplicate endpoints by name
  const seenEndpoints = new Set<string>();
  ir.apiEndpoints = ir.apiEndpoints.filter(ep => {
    if (seenEndpoints.has(ep.name)) return false;
    seenEndpoints.add(ep.name);
    return true;
  });

  // 1h. Fallback: extract REST endpoints from spec text that the LLM missed
  // Pattern: ### POST /api/devices, ### GET /api/patients/:id, etc.
  const restEndpointPattern = /###\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[\w/:{}\ -]+)/gi;
  let restMatch;
  const specHasRestPattern = /###\s+(GET|POST|PUT|PATCH|DELETE)/i.test(specText);
  console.log(`[Sanitizer] 1h: specText length=${specText.length}, hasRestPattern=${specHasRestPattern}, existing endpoints=${ir.apiEndpoints.length}`);
  while ((restMatch = restEndpointPattern.exec(specText)) !== null) {
    const method = restMatch[1].toUpperCase();
    const path = restMatch[2];
    const normalizedName = normalizeEndpointName(path, method);
    if (!seenEndpoints.has(normalizedName)) {
      seenEndpoints.add(normalizedName);
      ir.apiEndpoints.push({
        name: normalizedName,
        method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        auth: 'requireAuth',
        relatedBehaviors: [],
        inputFields: [],
        outputFields: [],
      });
      report.fieldsFixed++;
      report.issues.push({
        field: `endpoint.${normalizedName}`,
        was: 'missing (LLM missed)',
        now: `added from spec text: ${method} ${path}`,
        method: 'deterministic',
      });
    }
  }

  // ─── Stufe 2: LLM Repair (optional) ──────────────────────────────────────

  if (options?.enableLLMRepair) {
    // 2a. Behaviors with 0 tags → ask LLM to assign tags
    for (const b of ir.behaviors) {
      if (b.tags.length === 0) {
        try {
          const repaired = await repairWithLLM(
            "tags",
            b.tags,
            `Behavior: "${b.title}". Preconditions: ${b.preconditions.join(", ")}. Postconditions: ${b.postconditions.join(", ")}.`,
            "string[] — valid tags: authorization, security, dsgvo, pii, state-machine, rate-limiting, csrf, business-logic, boundary, concurrency"
          );
          (b as unknown as Record<string, unknown>).tags = ensureArray(repaired);
          report.llmRepairCalls++;
          report.issues.push({
            field: `behavior.${b.id}.tags`,
            was: "[]",
            now: JSON.stringify(b.tags),
            method: "llm-repair",
          });
        } catch { /* ignore, empty tags is not fatal */ }
      }
    }

    // 2b. Endpoints with 0 inputFields but spec describes them
    for (const ep of ir.apiEndpoints) {
      if (ep.inputFields.length === 0) {
        const epName = ep.name.split(".")[0]; // "bookings" from "bookings.create"
        const specMentionsFields = specText.toLowerCase().includes(epName) &&
          (specText.toLowerCase().includes("input:") || specText.toLowerCase().includes("input fields") ||
           specText.toLowerCase().includes("parameters") || specText.toLowerCase().includes("body:"));
        if (specMentionsFields) {
          const sectionStart = specText.toLowerCase().indexOf(epName);
          const section = specText.slice(Math.max(0, sectionStart - 200), sectionStart + 1000);
          try {
            const repaired = await repairWithLLM(
              "inputFields",
              ep.inputFields,
              section,
              "Array of {name: string, type: 'string'|'number'|'boolean'|'enum'|'date'|'array', required: boolean, min?, max?, enumValues?: string[]}"
            );
            ep.inputFields = Array.isArray(repaired) ? repaired as typeof ep.inputFields : [];
            report.llmRepairCalls++;
          } catch { /* ignore */ }
        }
      }
    }

    // 2c. StatusMachine with 0 transitions → ask LLM to extract
    if (ir.statusMachine && ir.statusMachine.transitions.length === 0) {
      const statusSection = specText.slice(0, 5000); // First 5KB likely has status machine
      try {
        const repaired = await repairWithLLM(
          "statusMachine.transitions",
          ir.statusMachine.transitions,
          statusSection,
          "Array of [fromState, toState] tuples, e.g. [[\"pending\", \"active\"], [\"active\", \"completed\"]]"
        );
        if (Array.isArray(repaired)) {
          ir.statusMachine.transitions = repaired as [string, string][];
          report.llmRepairCalls++;
        }
      } catch { /* ignore */ }
    }
  }

  console.log(`[Sanitizer] Fixed ${report.fieldsFixed} fields deterministically, ${report.llmRepairCalls} LLM repair calls`);
  return { ir, report };
}
