/**
 * End-to-end verification of the 3 wow features.
 *
 * What this checks (that unit tests can't):
 *   1. Compliance report MARKDOWN is actually readable — not template artifacts
 *   2. Failure analyzer HEURISTIC works on realistic playwright failure logs
 *   3. Refiner PARSER handles a real Gemini-style output format
 *
 * If any of these produces garbage, fix it BEFORE claiming "feature works."
 */
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  evaluateCompliance,
  renderComplianceReport,
  listPacks,
} from "../server/analyzer/compliance-packs";
import { quickHeuristic, parseSuggestion } from "../server/analyzer/failure-analyzer";
import { parseRefinedOutput } from "../server/analyzer/test-refiner";
import type { ValidatedProofSuite, ValidatedProof, AnalysisResult } from "../server/analyzer/types";

const outDir = "/tmp/testforge-samples/wow";
await mkdir(outDir, { recursive: true });

console.log("\n═══ WOW Features End-to-End Verification ═══\n");

// ─── 1. COMPLIANCE REPORTS — generate one for each framework ────────────────
console.log("[1/3] Generating compliance reports for all 4 frameworks...\n");

function makeProof(id: string, proofType: ValidatedProof["proofType"]): ValidatedProof {
  return {
    id, behaviorId: `B-${id}`, proofType, riskLevel: "high",
    filename: `tests/${proofType}/${id}.spec.ts`,
    code: "", mutationTargets: [],
    mutationScore: 0.85,
    validationNotes: ["✓ R1", "✓ R7"],
  };
}

const realisticSuite: ValidatedProofSuite = {
  proofs: [
    makeProof("PROOF-B001-IDOR", "idor"),
    makeProof("PROOF-B001-AUTH", "auth_matrix"),
    makeProof("PROOF-B002-AUDIT", "audit_log"),
    makeProof("PROOF-B003-DSGVO", "dsgvo"),
    makeProof("PROOF-B004-CONC", "concurrency"),
    makeProof("PROOF-B005-SQL", "sql_injection"),
    makeProof("PROOF-B005-MASS", "mass_assignment"),
    makeProof("PROOF-B006-XSS", "graphql"),
    makeProof("PROOF-B007-CSRF", "csrf"),
    makeProof("PROOF-B008-RATE", "rate_limit"),
  ],
  discardedProofs: [],
  verdict: { passed: 10, failed: 0, score: 10, summary: "10/10 passed" },
  coverage: { totalBehaviors: 10, coveredBehaviors: 10, coveragePercent: 100, uncoveredIds: [] },
};

const fakeAnalysis: AnalysisResult = {
  ir: {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    tenantModel: null, resources: [], apiEndpoints: [],
    authModel: null, enums: {}, statusMachine: null,
  },
  qualityScore: 8.5, specType: "fintech-platform",
};

for (const pack of listPacks()) {
  const report = evaluateCompliance(pack.framework, realisticSuite);
  const md = renderComplianceReport(report, fakeAnalysis);
  const file = join(outDir, `${pack.framework}-report.md`);
  await writeFile(file, md);
  const verdict = report.passed ? "✓ PASS" : "✗ FAIL";
  console.log(`  ${verdict.padEnd(8)} ${pack.framework.padEnd(10)} → ${report.mustCount.passed}/${report.mustCount.passed + report.mustCount.failed} must-criteria, ${report.passRate}% overall — ${file}`);
}

// ─── 2. FAILURE ANALYZER HEURISTIC — realistic log scenarios ────────────────
console.log("\n[2/3] Testing failure analyzer heuristic with realistic Playwright logs...\n");

const realScenarios = [
  {
    label: "API crash (500)",
    input: {
      testCode: `test("user can create reservation", async ({ request }) => {
        const { status } = await trpcMutation(request, "reservations.create",
          { restaurantId: TEST_RESTAURANT_ID, partySize: 4 }, adminCookie);
        expect(status).toBe(201);
      });`,
      failureLog: `Error: expect(received).toBe(expected)
Expected: 201
Received: 500
    at /tests/integration/reservations.spec.ts:7:24
Response body: {"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'tenantId')"}`,
      expectedStatus: 201,
      actualStatus: 500,
    },
    expectDiagnosis: "code_wrong",
  },
  {
    label: "Validation tightened (422)",
    input: {
      testCode: `test("partySize validation", async ({ request }) => {
        const { status } = await trpcMutation(request, "reservations.create",
          { restaurantId: 1, partySize: 4 }, cookie);
        expect(status).toBe(200);
      });`,
      failureLog: `Error: expect(received).toBe(expected)
Expected: 200
Received: 422
Response body: {"error":"Validation failed","field":"email","message":"email is required"}`,
      expectedStatus: 200,
      actualStatus: 422,
    },
    expectDiagnosis: "spec_wrong",
  },
  {
    label: "Auth missing (401)",
    input: {
      testCode: `test("admin can list", async ({ request }) => {
        const { status } = await trpcQuery(request, "users.list", { tenantId: 1 }, adminCookie);
        expect(status).toBe(200);
      });`,
      failureLog: `Error: expect(received).toBe(expected)
Expected: 200
Received: 401
Response body: {"error":"Unauthorized"}`,
      expectedStatus: 200,
      actualStatus: 401,
    },
    expectDiagnosis: "test_wrong",
  },
  {
    label: "Flaky (timeout)",
    input: {
      testCode: `test("eventual consistency", async ({ request }) => {
        await pollUntil(() => check(), 5000);
      });`,
      failureLog: `Test timeout of 30000ms exceeded.
AbortError: The operation was aborted.
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)`,
    },
    expectDiagnosis: "flaky",
  },
];

let scenarioPasses = 0;
for (const scenario of realScenarios) {
  const r = quickHeuristic(scenario.input as any);
  const ok = r.diagnosis === scenario.expectDiagnosis;
  console.log(`  ${ok ? "✓" : "✗"} ${scenario.label.padEnd(25)} → diagnosis=${r.diagnosis.padEnd(12)} confidence=${(r.confidence * 100).toFixed(0)}%  fix-target=${r.suggestedFix.target}`);
  if (ok) scenarioPasses++;
}
console.log(`\n  ${scenarioPasses}/${realScenarios.length} heuristic diagnoses correct on realistic logs`);

// ─── 3. REFINER PARSER — realistic Gemini-style output ──────────────────────
console.log("\n[3/3] Testing refiner parser with realistic LLM outputs...\n");

const realLLMOutputs = [
  {
    label: "Clean output with JSON metadata",
    raw: `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";

test.describe("IDOR — strengthened", () => {
  test("cross-tenant access rejected with full validation", async ({ request }) => {
    const { status, data } = await trpcQuery(request, "orders.getById",
      { tenantId: TEST_TENANT_B_ID, id: 1 }, tenantACookie);
    expect(status).toBe(403);
    expect(data).toBeNull();
    // Kills: missing tenant filter on read
    expect(response.headers["x-tenant-id"]).toBeUndefined();
    // Kills: tenant ID leaked in response headers
  });
});

\`\`\`json
{
  "diffSummary": "Added response header check + tightened to toBeNull",
  "changes": ["Added x-tenant-id header assertion", "Changed toBeUndefined to toBeNull for stricter check"],
  "warnings": []
}
\`\`\``,
  },
  {
    label: "Output without JSON (graceful)",
    raw: `import { test, expect } from "@playwright/test";
test("simple", async () => { expect(1).toBe(1); });`,
  },
  {
    label: "Output wrapped in markdown fences",
    raw: '```typescript\nimport { test } from "@playwright/test";\ntest("x", () => { expect(1).toBe(1); });\n```',
  },
];

let parserPasses = 0;
for (const out of realLLMOutputs) {
  try {
    const result = parseRefinedOutput(out.raw);
    const codeOk = result.refinedCode.includes("test(") && !result.refinedCode.includes("```");
    console.log(`  ${codeOk ? "✓" : "✗"} ${out.label.padEnd(40)} → code=${result.refinedCode.length}chars  changes=${result.changes.length}  warnings=${result.warnings.length}`);
    if (codeOk) parserPasses++;
  } catch (err: any) {
    console.log(`  ✗ ${out.label.padEnd(40)} → THREW: ${err.message}`);
  }
}
console.log(`\n  ${parserPasses}/${realLLMOutputs.length} parsings produced clean code`);

// ─── Final verdict ──────────────────────────────────────────────────────────
console.log("\n═══ Verdict ═══");
console.log(`Compliance reports:        ${listPacks().length}/4 generated and saved to ${outDir}`);
console.log(`Failure heuristic:         ${scenarioPasses}/${realScenarios.length} realistic scenarios diagnosed correctly`);
console.log(`Refiner parser:            ${parserPasses}/${realLLMOutputs.length} edge cases handled cleanly`);
console.log(`\nReview the .md compliance reports manually at ${outDir}/`);
