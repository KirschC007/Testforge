/**
 * Test Failure → Auto-Fix Suggester.
 *
 * Closes the AI-native dev loop:
 *   Generate test → Run → Fail → AI diagnoses what's wrong → Suggests fix → Apply
 *
 * Three possible diagnoses:
 *   1. Spec is wrong   → API does X, spec says Y, but API behavior is correct → update spec
 *   2. Test is wrong   → Test asserts Y but spec says X → update test (likely wrong assertion)
 *   3. Code is wrong   → Spec says X, test asserts X, but API does Y → real bug, fix code
 *
 * No other test tool does this systematically. Postman shows you the failure.
 * Mabl tries to "self-heal" selectors. Nobody analyzes whether the SPEC, TEST,
 * or CODE is at fault and proposes the right fix.
 */
import { invokeLLM } from "../_core/llm";
import { withTimeout } from "./llm-parser";

export interface FailureInput {
  testCode: string;
  failureLog: string;        // raw playwright/jest output
  specSnippet?: string;       // relevant excerpt from the original spec
  expectedStatus?: number;    // what the test expected
  actualStatus?: number;      // what the API returned
  expectedBody?: unknown;
  actualBody?: unknown;
}

export type Diagnosis = "spec_wrong" | "test_wrong" | "code_wrong" | "flaky" | "unknown";

export interface FixSuggestion {
  diagnosis: Diagnosis;
  confidence: number;          // 0-1
  reasoning: string;           // why this diagnosis
  /** Concrete fix proposal — what to change */
  suggestedFix: {
    target: "spec" | "test" | "code";
    description: string;       // human-readable fix
    diff?: string;             // unified diff if available
    snippet?: string;          // updated test/spec snippet
  };
  /** Alternative diagnoses worth considering */
  alternatives: Array<{ diagnosis: Diagnosis; confidence: number; note: string }>;
  /** If the failure looks flaky (timeouts, race conditions), surface it */
  isLikelyFlaky: boolean;
}

const ANALYZE_SYSTEM_PROMPT = `You are an expert API/E2E test failure analyst. You receive:
- The failing test code
- The raw failure log
- (optionally) the relevant spec excerpt and expected/actual values

Your job: diagnose whether SPEC / TEST / CODE is at fault, with confidence 0-1.

Diagnosis options:
- "spec_wrong"  — Spec is outdated. API behavior is reasonable but spec says otherwise. Suggest spec update.
- "test_wrong"  — Test has a bug (wrong assertion, wrong endpoint, wrong setup). Suggest test fix.
- "code_wrong"  — Spec and test are correct; this is a real product bug. Suggest where to look in code.
- "flaky"       — Failure is timing/race-related, not a real assertion failure. Suggest retry or wait.
- "unknown"     — Can't tell from the available info.

Heuristics:
- Status codes 200 expected, 500 actual → almost always code_wrong
- Status codes 200 expected, 422 actual → often spec_wrong (validation tightened)
- Timeout/AbortError in log → flaky
- Test asserts on items[0] without sort → test_wrong (race condition in assertion)
- Field name mismatch (test expects 'id', API returns 'userId') → spec_wrong (API renamed)
- "Cannot read property X of undefined" in log → code_wrong (regression)

OUTPUT: a single JSON object only, no prose, no markdown:
{
  "diagnosis": "spec_wrong" | "test_wrong" | "code_wrong" | "flaky" | "unknown",
  "confidence": 0.0-1.0,
  "reasoning": "1-3 sentences why",
  "suggestedFix": {
    "target": "spec" | "test" | "code",
    "description": "concrete change to make",
    "snippet": "updated code/spec snippet (optional, max 400 chars)"
  },
  "alternatives": [{ "diagnosis": "...", "confidence": 0.0-1.0, "note": "why this might be it" }],
  "isLikelyFlaky": true|false
}`;

const ANALYZE_USER_TEMPLATE = (input: FailureInput) => `Failing test:
\`\`\`typescript
${input.testCode.slice(0, 4000)}
\`\`\`

Failure log:
\`\`\`
${input.failureLog.slice(0, 4000)}
\`\`\`
${input.specSnippet ? `
Relevant spec:
${input.specSnippet.slice(0, 2000)}
` : ""}${input.expectedStatus !== undefined ? `
Expected HTTP status: ${input.expectedStatus}` : ""}${input.actualStatus !== undefined ? `
Actual HTTP status:   ${input.actualStatus}` : ""}${input.expectedBody !== undefined ? `
Expected body: ${JSON.stringify(input.expectedBody).slice(0, 500)}` : ""}${input.actualBody !== undefined ? `
Actual body:   ${JSON.stringify(input.actualBody).slice(0, 500)}` : ""}

Diagnose and propose a fix. Respond with the JSON object only.`;

export async function analyzeFailure(input: FailureInput): Promise<FixSuggestion> {
  if (!input.testCode || input.testCode.length < 30) {
    throw new Error("testCode required (min 30 chars)");
  }
  if (!input.failureLog || input.failureLog.length < 10) {
    throw new Error("failureLog required (min 10 chars)");
  }

  // Quick deterministic heuristic FIRST — saves an LLM call for obvious cases
  const heuristic = quickHeuristic(input);
  if (heuristic.confidence >= 0.85) {
    return heuristic;
  }

  // LLM analysis with 30s timeout
  const response = await withTimeout(
    invokeLLM({
      messages: [
        { role: "system", content: ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: ANALYZE_USER_TEMPLATE(input) },
      ],
      thinkingBudget: 0,
      maxTokens: 1500,
      responseFormat: { type: "json_object" },
    }),
    30_000,
    null,
  );

  if (!response) {
    return { ...heuristic, reasoning: heuristic.reasoning + " (LLM timeout — using heuristic only)" };
  }
  const raw = response.choices[0]?.message?.content as string;
  return parseSuggestion(raw, heuristic);
}

/**
 * Fast deterministic heuristic — handles the obvious 80% of failures
 * without an LLM call. Returns confidence 0 if no rule matched.
 */
export function quickHeuristic(input: FailureInput): FixSuggestion {
  const log = input.failureLog.toLowerCase();
  const exp = input.expectedStatus;
  const act = input.actualStatus;

  // Flakiness signals
  if (log.includes("timeout") || log.includes("aborterror") || log.includes("econnreset")) {
    return {
      diagnosis: "flaky",
      confidence: 0.9,
      reasoning: "Failure log contains timeout/abort/reset signal — likely network or timing issue, not assertion failure.",
      suggestedFix: {
        target: "test",
        description: "Add retry with test.retries(2), or extend timeout, or use pollUntil() for eventual consistency.",
      },
      alternatives: [{ diagnosis: "code_wrong", confidence: 0.2, note: "Could also indicate slow code path" }],
      isLikelyFlaky: true,
    };
  }

  // Code error in log
  if (log.includes("cannot read prop") || log.includes("undefined is not")
      || log.includes("typeerror") || log.includes("internal server error")) {
    return {
      diagnosis: "code_wrong",
      confidence: 0.85,
      reasoning: "Failure log shows a runtime exception (TypeError or similar) — this is a code bug, not a test issue.",
      suggestedFix: {
        target: "code",
        description: "Check the API handler for the failing endpoint — likely null/undefined access on a code path the test exercised.",
      },
      alternatives: [{ diagnosis: "test_wrong", confidence: 0.1, note: "Possible if test sent malformed payload" }],
      isLikelyFlaky: false,
    };
  }

  // 500 when 200/201 expected → very likely code bug
  if (exp !== undefined && act === 500 && exp < 500) {
    return {
      diagnosis: "code_wrong",
      confidence: 0.9,
      reasoning: `Test expected ${exp} but API returned 500 — server crashed handling the request. This is a real bug.`,
      suggestedFix: {
        target: "code",
        description: "Check server logs for the stack trace at the time of this failure. Likely an unhandled exception in the API handler.",
      },
      alternatives: [{ diagnosis: "test_wrong", confidence: 0.1, note: "Could also be malformed test payload" }],
      isLikelyFlaky: false,
    };
  }

  // 422 when 200 expected → spec drift (validation tightened)
  if (exp !== undefined && act === 422 && exp >= 200 && exp < 300) {
    return {
      diagnosis: "spec_wrong",
      confidence: 0.7,
      reasoning: "Test expected success, API returned 422 (validation error) — likely the spec changed and added new required fields.",
      suggestedFix: {
        target: "spec",
        description: "Update the spec/test payload — API now requires additional fields. Check the actual response body for missing field names.",
      },
      alternatives: [
        { diagnosis: "test_wrong", confidence: 0.5, note: "Could be that the test payload is incomplete" },
        { diagnosis: "code_wrong", confidence: 0.2, note: "Validation may have been too tight (regression)" },
      ],
      isLikelyFlaky: false,
    };
  }

  // 401/403 when 200 expected → auth setup issue
  if (exp !== undefined && (act === 401 || act === 403) && exp === 200) {
    return {
      diagnosis: "test_wrong",
      confidence: 0.75,
      reasoning: `Test expected 200 but got ${act} — auth setup likely incorrect (cookie missing, expired, or wrong role).`,
      suggestedFix: {
        target: "test",
        description: "Verify beforeAll() correctly establishes the auth cookie, and that test uses the right role helper (getAdminCookie vs getUserCookie).",
      },
      alternatives: [{ diagnosis: "code_wrong", confidence: 0.25, note: "Could also be auth middleware regression" }],
      isLikelyFlaky: false,
    };
  }

  // No clear signal — return low-confidence "unknown" so caller knows to use LLM
  return {
    diagnosis: "unknown",
    confidence: 0,
    reasoning: "No strong heuristic signal — needs LLM analysis.",
    suggestedFix: { target: "test", description: "Manual review needed." },
    alternatives: [],
    isLikelyFlaky: false,
  };
}

export function parseSuggestion(raw: string, fallback: FixSuggestion): FixSuggestion {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const validDiagnoses: Diagnosis[] = ["spec_wrong", "test_wrong", "code_wrong", "flaky", "unknown"];
    const diagnosis: Diagnosis = validDiagnoses.includes(parsed.diagnosis) ? parsed.diagnosis : "unknown";

    return {
      diagnosis,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 1000) : "",
      suggestedFix: {
        target: ["spec", "test", "code"].includes(parsed.suggestedFix?.target) ? parsed.suggestedFix.target : "test",
        description: typeof parsed.suggestedFix?.description === "string"
          ? parsed.suggestedFix.description.slice(0, 1000)
          : "Review manually",
        snippet: typeof parsed.suggestedFix?.snippet === "string"
          ? parsed.suggestedFix.snippet.slice(0, 2000)
          : undefined,
      },
      alternatives: Array.isArray(parsed.alternatives)
        ? parsed.alternatives.slice(0, 3).map((a: any) => ({
            diagnosis: validDiagnoses.includes(a?.diagnosis) ? a.diagnosis : "unknown",
            confidence: typeof a?.confidence === "number" ? Math.max(0, Math.min(1, a.confidence)) : 0,
            note: typeof a?.note === "string" ? a.note.slice(0, 300) : "",
          }))
        : [],
      isLikelyFlaky: !!parsed.isLikelyFlaky,
    };
  } catch {
    // LLM output unparseable — return heuristic fallback
    return fallback;
  }
}
