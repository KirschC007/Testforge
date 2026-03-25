import { invokeLLM } from "../_core/llm";
import { withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";
import type { AnalysisResult, RawProof, ValidatedProof, DiscardedProof, ValidatedProofSuite } from "./types";

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

  // R7b: No fake IDOR — generic for all common tenant/resource IDs (not just restaurantId)
  const FAKE_IDOR_PATTERN = /\b(?:restaurantId|tenantId|workspaceId|companyId|fleetId|orgId|organizationId|accountId|teamId|projectId|shopId|storeId|merchantId):\s*[1-9]\b/;
  if (proof.proofType === "idor" && FAKE_IDOR_PATTERN.test(code) && !code.includes("TEST_") && !code.includes("TENANT_B") && !code.includes("OTHER_")) {
    return { passed: false, notes: [], reason: "fake_idor", details: "R7b violation: IDOR test uses hardcoded small tenant/resource ID. Use TEST_<ENTITY>_B_ID constant instead." };
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
  let nestDepth = 0; // 0 = top-level, 1+ = inside test.describe

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip import lines
    if (trimmed.startsWith("import ")) continue;

    // Skip top-level let cookie declarations only
    if (nestDepth === 0 && /^let\s+(adminCookie|staffCookie|tenantACookie|tenantBCookie)/.test(trimmed)) continue;

    // Track nesting: entering test.describe increases depth
    if (trimmed.startsWith("test.describe(")) nestDepth++;

    // Only skip test.beforeAll at top level (nestDepth === 0)
    // Nested beforeAll inside test.describe must be preserved
    if (nestDepth === 0 && trimmed.startsWith("test.beforeAll(")) {
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

    // Track closing of test.describe blocks ("});") decrements nestDepth
    if (nestDepth > 0 && trimmed === "});") nestDepth--;

    result.push(line);
  }

  // Remove leading/trailing blank lines and collapse 3+ blank lines to 2
  return result.join("\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function mergeProofsToFile(proofs: ValidatedProof[]): string {
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
  // Bug 2 Fix: scan all proof code for get*Cookie functions and fix auth import
  const allProofCode = proofs.map(p => p.code).join("\n");
  const cookieFnPattern = /get\w+Cookie/g;
  const usedCookieFns = new Set<string>();
  let cookieMatch: RegExpExecArray | null;
  while ((cookieMatch = cookieFnPattern.exec(allProofCode)) !== null) {
    usedCookieFns.add(cookieMatch[0]);
  }
  // If we found actual cookie functions used, override the auth import
  if (usedCookieFns.size > 0) {
    const authMod = '"../../helpers/auth"';
    const existingAuthSyms = importsByModule.get(authMod) || new Set<string>();
    // Remove any get*Cookie symbols that were imported but may not match what's used
    for (const sym of Array.from(existingAuthSyms)) {
      if (sym.match(/^get\w+Cookie$/)) existingAuthSyms.delete(sym);
    }
    // Add all actually-used cookie functions
    for (const fn of Array.from(usedCookieFns)) existingAuthSyms.add(fn);
    importsByModule.set(authMod, existingAuthSyms);
  }

  // NOTE: mergedImports is built AFTER beforeAll so that primaryCookieFn is included in auth import
  // (see below — importsByModule.set(authMod, authSyms) must happen before building mergedImports)

  // Detect which cookie variables are actually used across all proofs
  const allCode = proofs.map(p => p.code).join("\n");
  const needsTenantCookies = allCode.includes("tenantACookie") || allCode.includes("tenantBCookie");
  const needsStaffCookie = allCode.includes("staffCookie");
  // Detect if all proofs have their own beforeAll inside test.describe (concurrency/idempotency/feature-gate)
  // These tests manage their own cookie initialization and don't need a top-level adminCookie beforeAll
  const allHaveOwnBeforeAll = proofs.every(p =>
    p.code.includes("test.describe(") && p.code.includes("test.beforeAll("));
  // Detect feature-gate tests (use proCookie/freeCookie, not adminCookie)
  const hasFeatureGate = allCode.includes("proCookie") || allCode.includes("freeCookie");

  // Determine the login function from the first proof's beforeAll
  const loginFnMatch = allCode.match(/tenantACookie = await (\w+)\(request\)/);
  const tenantLoginFn = loginFnMatch?.[1] || "getAdminCookie";

  // Derive the primary cookie function from what the proofs actually import/use.
  // Priority: any get*Cookie function that is NOT tenantACookie/tenantBCookie/staffCookie/proCookie/freeCookie.
  // This handles custom roles like getOrganizerAdminCookie, getDoctorCookie, etc.
  const primaryCookieFn = (() => {
    // First: look for what's used in beforeAll blocks inside proofs
    const beforeAllMatch = allCode.match(/adminCookie\s*=\s*await\s+(get\w+Cookie)\(request\)/);
    if (beforeAllMatch) return beforeAllMatch[1];
    // Second: find the first get*Cookie function that's imported and used (not tenant/staff/pro/free)
    const skipFns = new Set(["getTenantACookie", "getTenantBCookie", "getStaffCookie", "getProCookie", "getFreeCookie"]);
    for (const fn of Array.from(usedCookieFns)) {
      if (!skipFns.has(fn) && !fn.includes("Tenant")) return fn;
    }
    return "getAdminCookie";
  })();

  // Shared beforeAll block — skip if all proofs have their own beforeAll inside test.describe
  let beforeAll: string;
  if (allHaveOwnBeforeAll && !needsTenantCookies) {
    // Concurrency/idempotency/feature-gate: each test.describe has its own beforeAll — no top-level needed
    beforeAll = "";
  } else if (needsTenantCookies) {
    beforeAll = `
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
`;
  } else {
    beforeAll = `
let adminCookie: string;${needsStaffCookie ? "\nlet staffCookie: string;" : ""}

test.beforeAll(async ({ request }) => {
  adminCookie = await ${primaryCookieFn}(request);
${needsStaffCookie ? "  staffCookie = await getStaffCookie(request);\n" : ""}});
`;
    // Ensure the primary cookie function is imported (it's used in the generated beforeAll above)
    const authMod = '"../../helpers/auth"';
    const authSyms = importsByModule.get(authMod) || new Set<string>();
    authSyms.add(primaryCookieFn);
    if (needsStaffCookie) authSyms.add("getStaffCookie");
    importsByModule.set(authMod, authSyms);
  }

  // Build mergedImports HERE (after beforeAll) so that primaryCookieFn is in importsByModule
  const mergedImports = Array.from(importsByModule.entries()).map(([mod, syms]) => {
    const firstVal = Array.from(syms)[0];
    // If the only entry is a full import line (default import), use it directly
    if (firstVal && firstVal.startsWith("import ")) return firstVal;
    const sorted = Array.from(syms).sort();
    return `import { ${sorted.join(", ")} } from ${mod};`;
  });

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

