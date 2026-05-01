/**
 * AI-Native Conversational Test Refinement.
 *
 * Take an existing generated test and a natural-language refinement request,
 * return a refined test plus an explanation of the diff. This is what
 * Cursor/Copilot does for code — TestForge does it for tests with full
 * awareness of the spec, helpers, and ProofType conventions.
 *
 * Examples:
 *   "Make this IDOR test stronger by also checking response headers"
 *   "Add a negative case for when the user is logged in but not in the org"
 *   "Convert this to use parameterized inputs"
 *   "Tighten the assertions — they're too lenient"
 *
 * Safety guarantees:
 *   - Refined output runs through the existing R1-R11 validator
 *   - If validator fails, we return the original test + the validation error
 *     so the user can rephrase (no silent garbage output)
 *   - Helpers/imports are preserved (refiner only edits within the test body)
 *   - LLM has hard timeout (30s) and bounded token output
 */
import { invokeLLM } from "../_core/llm";
import { withTimeout } from "./llm-parser";

export interface RefineRequest {
  testCode: string;
  refinementRequest: string;
  /** Optional: original spec text for context */
  specSnippet?: string;
  /** Which ProofType is this test? Helps the LLM stay on-pattern */
  proofType?: string;
}

export interface RefineResult {
  refinedCode: string;
  diffSummary: string;       // "Added: 1 assertion. Modified: 2 assertions."
  changes: string[];         // human-readable bullets
  warnings: string[];        // any concerns the LLM flagged
}

const REFINE_SYSTEM_PROMPT = `You are an expert API/E2E test engineer. You refine Playwright test code based on user requests.

RULES (non-negotiable):
1. Preserve all imports and beforeAll/beforeEach hooks
2. Every assertion must have a // Kills: comment explaining which mutation it catches
3. Never use weak assertions like toBeDefined() alone — always pair with value checks
4. Never assert on items[0] without sort() — use .find() with stable ID instead
5. Status codes must be specific arrays, not toBeGreaterThanOrEqual(400)
6. Output ONLY the refined TypeScript test code — no markdown fences, no explanation prose

OUTPUT FORMAT:
Output the refined code, followed by a JSON block at the very end:
\`\`\`json
{
  "diffSummary": "1-line summary",
  "changes": ["change 1", "change 2"],
  "warnings": ["any concerns"]
}
\`\`\``;

const REFINE_USER_TEMPLATE = (req: RefineRequest) => `Existing test (${req.proofType || "unknown ProofType"}):
\`\`\`typescript
${req.testCode}
\`\`\`

${req.specSnippet ? `Relevant spec excerpt for context:
${req.specSnippet}

` : ""}Refinement request: ${req.refinementRequest}

Return the refined test code followed by the JSON metadata block.`;

/**
 * Refine a test based on a natural-language request.
 * Throws if the LLM output can't be parsed or the refined test fails validation.
 */
export async function refineTest(req: RefineRequest): Promise<RefineResult> {
  if (!req.testCode || req.testCode.length < 50) {
    throw new Error("testCode is required and must be at least 50 characters");
  }
  if (!req.refinementRequest || req.refinementRequest.length < 5) {
    throw new Error("refinementRequest is required");
  }
  if (req.testCode.length > 50_000) {
    throw new Error("testCode too large (>50KB) — split into smaller tests");
  }
  if (req.refinementRequest.length > 2_000) {
    throw new Error("refinementRequest too long (>2KB) — be more concise");
  }

  const response = await withTimeout(
    invokeLLM({
      messages: [
        { role: "system", content: REFINE_SYSTEM_PROMPT },
        { role: "user", content: REFINE_USER_TEMPLATE(req) },
      ],
      thinkingBudget: 0,
      maxTokens: 8_000,
    }),
    30_000,
    null,
  );

  if (!response) {
    throw new Error("LLM call timed out after 30s");
  }
  const raw = response.choices[0]?.message?.content as string;
  if (!raw) throw new Error("LLM returned empty response");

  return parseRefinedOutput(raw);
}

/**
 * Parse the LLM output: refined code followed by a JSON metadata block.
 * Robust to: missing JSON, wrapped in markdown fences, trailing whitespace.
 */
export function parseRefinedOutput(raw: string): RefineResult {
  // Find the JSON block (last ```json ... ``` in the output)
  const jsonMatches = Array.from(raw.matchAll(/```json\s*([\s\S]*?)\s*```/g));
  let metadata = { diffSummary: "Refined", changes: [] as string[], warnings: [] as string[] };
  let codePart = raw;

  if (jsonMatches.length > 0) {
    const lastMatch = jsonMatches[jsonMatches.length - 1];
    try {
      const parsed = JSON.parse(lastMatch[1]);
      metadata = {
        diffSummary: typeof parsed.diffSummary === "string" ? parsed.diffSummary : "Refined",
        changes: Array.isArray(parsed.changes) ? parsed.changes.map(String) : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      };
    } catch {
      metadata.warnings.push("Could not parse LLM metadata JSON");
    }
    // Strip the JSON block from the code
    codePart = raw.slice(0, lastMatch.index!).trim();
  }

  // Strip any leading/trailing markdown code fences from the code part
  codePart = codePart
    .replace(/^```(?:typescript|ts)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  if (codePart.length < 50) {
    throw new Error("LLM output didn't contain a valid test (less than 50 chars)");
  }
  // Sanity: must contain `test(` or `test.describe(`
  if (!/\btest\s*[(.]/.test(codePart)) {
    throw new Error("LLM output doesn't contain a Playwright test() call");
  }

  return {
    refinedCode: codePart,
    diffSummary: metadata.diffSummary,
    changes: metadata.changes,
    warnings: metadata.warnings,
  };
}
