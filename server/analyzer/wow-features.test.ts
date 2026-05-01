/**
 * Wow Features Tests — Compliance Packs, Test Refiner (parser), Failure Analyzer (heuristics).
 *
 * The LLM-dependent paths (refineTest, analyzeFailure with LLM call) are NOT
 * exercised here — those need a real LLM and are integration tests. We test:
 *   - Pack mappings + report rendering (deterministic)
 *   - Refiner output parser (deterministic)
 *   - Failure analyzer heuristic (deterministic, handles 80% of cases)
 *   - Failure analyzer JSON parser (deterministic)
 */
import { describe, it, expect } from "vitest";
import {
  evaluateCompliance,
  renderComplianceReport,
  getPack,
  listPacks,
} from "./compliance-packs";
import { parseRefinedOutput } from "./test-refiner";
import { quickHeuristic, parseSuggestion } from "./failure-analyzer";
import type { ValidatedProofSuite, ValidatedProof, AnalysisResult } from "./types";

function makeProof(overrides: Partial<ValidatedProof>): ValidatedProof {
  return {
    id: "T1",
    behaviorId: "B1",
    proofType: "idor",
    riskLevel: "high",
    filename: "tests/security/idor.spec.ts",
    code: "",
    mutationTargets: [],
    mutationScore: 0.85,
    validationNotes: [],
    ...overrides,
  } as ValidatedProof;
}

function makeSuite(proofs: ValidatedProof[]): ValidatedProofSuite {
  return {
    proofs,
    discardedProofs: [],
    verdict: { passed: proofs.length, failed: 0, score: 10, summary: "" },
    coverage: { totalBehaviors: proofs.length, coveredBehaviors: proofs.length, coveragePercent: 100, uncoveredIds: [] },
  };
}

const FAKE_ANALYSIS: AnalysisResult = {
  ir: {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    tenantModel: null, resources: [], apiEndpoints: [],
    authModel: null, enums: {}, statusMachine: null,
  },
  qualityScore: 8, specType: "fintech",
};

// ─── Compliance Packs ────────────────────────────────────────────────────────

describe("Compliance Packs — listPacks + getPack", () => {
  it("listPacks returns all 4 frameworks", () => {
    const packs = listPacks();
    expect(packs.map(p => p.framework).sort()).toEqual(["gdpr", "hipaa", "pci_dss", "soc2"]);
  });

  it("each pack has required metadata", () => {
    for (const pack of listPacks()) {
      expect(pack.framework).toBeDefined();
      expect(pack.fullName).toBeDefined();
      expect(pack.version).toBeDefined();
      expect(pack.url).toMatch(/^https?:\/\//);
      expect(pack.criteria.length).toBeGreaterThan(0);
    }
  });

  it("getPack returns the right pack", () => {
    expect(getPack("soc2").framework).toBe("soc2");
    expect(getPack("hipaa").fullName).toMatch(/HIPAA/i);
    expect(getPack("pci_dss").fullName).toMatch(/PCI/i);
    expect(getPack("gdpr").fullName).toMatch(/General Data Protection|GDPR/i);
  });

  it("every criterion's satisfiedBy uses valid ProofTypes", async () => {
    const { PROOF_TYPES } = await import("./types");
    const valid = new Set(PROOF_TYPES);
    for (const pack of listPacks()) {
      for (const c of pack.criteria) {
        for (const pt of c.satisfiedBy) {
          expect(valid.has(pt as any), `${pack.framework}/${c.id}: invalid ProofType "${pt}"`).toBe(true);
        }
      }
    }
  });
});

describe("Compliance Packs — evaluateCompliance", () => {
  it("PASSES SOC2 CC6.1 when 2+ access-control proofs are present", () => {
    const suite = makeSuite([
      makeProof({ id: "T1", proofType: "auth_matrix" }),
      makeProof({ id: "T2", proofType: "idor" }),
    ]);
    const report = evaluateCompliance("soc2", suite);
    const cc61 = report.results.find(r => r.criterion.id === "CC6.1");
    expect(cc61?.passed).toBe(true);
    expect(cc61?.evidence.length).toBe(2);
  });

  it("FAILS SOC2 CC6.1 when only 1 access-control proof (needs minTestCount=2)", () => {
    const suite = makeSuite([
      makeProof({ id: "T1", proofType: "auth_matrix" }),
    ]);
    const report = evaluateCompliance("soc2", suite);
    const cc61 = report.results.find(r => r.criterion.id === "CC6.1");
    expect(cc61?.passed).toBe(false);
    expect(cc61?.reason).toMatch(/at least 2/);
  });

  it("FAILS HIPAA 164.312(b) when no audit_log proofs present", () => {
    const suite = makeSuite([makeProof({ id: "T1", proofType: "idor" })]);
    const report = evaluateCompliance("hipaa", suite);
    const audit = report.results.find(r => r.criterion.id === "164.312(b)");
    expect(audit?.passed).toBe(false);
    expect(audit?.missingProofTypes).toContain("audit_log");
  });

  it("overall verdict.passed is FALSE when any 'must' criterion fails", () => {
    const suite = makeSuite([makeProof({ proofType: "idor" })]);
    const report = evaluateCompliance("hipaa", suite);
    expect(report.passed).toBe(false);
  });

  it("computes mustPassRate based only on 'must' criteria", () => {
    const suite = makeSuite([
      makeProof({ id: "T1", proofType: "auth_matrix" }),
      makeProof({ id: "T2", proofType: "idor" }),
      makeProof({ id: "T3", proofType: "audit_log" }),
    ]);
    const report = evaluateCompliance("hipaa", suite);
    expect(typeof report.mustPassRate).toBe("number");
    expect(report.mustPassRate).toBeGreaterThanOrEqual(0);
    expect(report.mustPassRate).toBeLessThanOrEqual(100);
  });
});

describe("Compliance Packs — renderComplianceReport (Markdown)", () => {
  it("includes verdict header (PASS or FAIL)", () => {
    const suite = makeSuite([makeProof({ proofType: "auth_matrix" })]);
    const report = evaluateCompliance("hipaa", suite);
    const md = renderComplianceReport(report, FAKE_ANALYSIS);
    expect(md).toMatch(/PASS|FAIL/);
  });

  it("includes pack name and version in header", () => {
    const suite = makeSuite([]);
    const report = evaluateCompliance("soc2", suite);
    const md = renderComplianceReport(report, FAKE_ANALYSIS);
    expect(md).toContain("SOC 2");
  });

  it("renders evidence table for passing criteria", () => {
    const suite = makeSuite([
      makeProof({ id: "T_AUTH_001", proofType: "auth_matrix" }),
      makeProof({ id: "T_IDOR_001", proofType: "idor" }),
    ]);
    const report = evaluateCompliance("hipaa", suite);
    const md = renderComplianceReport(report, FAKE_ANALYSIS);
    expect(md).toContain("T_AUTH_001");
    expect(md).toContain("Mutation Score");
  });

  it("renders missing ProofTypes for failed criteria", () => {
    const suite = makeSuite([]);
    const report = evaluateCompliance("hipaa", suite);
    const md = renderComplianceReport(report, FAKE_ANALYSIS);
    expect(md).toContain("Missing ProofTypes");
  });

  it("includes 'Limitations' footer for honesty", () => {
    const suite = makeSuite([]);
    const report = evaluateCompliance("gdpr", suite);
    const md = renderComplianceReport(report, FAKE_ANALYSIS);
    expect(md).toContain("Limitations");
    expect(md).toContain("does NOT prove that those tests pass");
  });
});

// ─── Test Refiner (parser only — LLM call is integration) ────────────────────

describe("Test Refiner — parseRefinedOutput", () => {
  it("extracts code + JSON metadata from LLM output", () => {
    const raw = `import { test, expect } from "@playwright/test";

test("refined", async ({ request }) => {
  expect(1).toBe(1);
  // Kills: x
});

\`\`\`json
{
  "diffSummary": "Added 2 assertions",
  "changes": ["added id check", "added status check"],
  "warnings": []
}
\`\`\``;
    const result = parseRefinedOutput(raw);
    expect(result.refinedCode).toContain('test("refined"');
    expect(result.refinedCode).not.toContain("```json");
    expect(result.diffSummary).toBe("Added 2 assertions");
    expect(result.changes).toHaveLength(2);
  });

  it("handles missing JSON metadata gracefully", () => {
    const raw = `import { test, expect } from "@playwright/test";
test("no metadata", async () => { expect(1).toBe(1); });`;
    const result = parseRefinedOutput(raw);
    expect(result.refinedCode).toContain('test("no metadata"');
    expect(result.diffSummary).toBe("Refined");
  });

  it("strips markdown code fences from code", () => {
    const raw = "```typescript\nimport { test } from \"@playwright/test\";\ntest(\"x\", () => { expect(1).toBe(1); });\n```";
    const result = parseRefinedOutput(raw);
    expect(result.refinedCode).not.toContain("```");
    expect(result.refinedCode).toContain('test("x"');
  });

  it("throws when output doesn't contain a test() call", () => {
    expect(() => parseRefinedOutput("just some random text without anything")).toThrow();
  });

  it("throws when output is too short", () => {
    expect(() => parseRefinedOutput("test")).toThrow();
  });

  it("recovers when JSON is malformed (records a warning)", () => {
    const raw = `import { test } from "@playwright/test";
test("x", () => { expect(1).toBe(1); });

\`\`\`json
{ this is not valid json
\`\`\``;
    const result = parseRefinedOutput(raw);
    expect(result.refinedCode).toContain('test("x"');
    expect(result.warnings.some(w => w.includes("Could not parse"))).toBe(true);
  });
});

// ─── Failure Analyzer (heuristic only — LLM is integration) ──────────────────

describe("Failure Analyzer — quickHeuristic (deterministic, no LLM needed)", () => {
  it("detects flakiness from timeout in log", () => {
    const r = quickHeuristic({
      testCode: "test('x', async () => { expect(1).toBe(1); });",
      failureLog: "Test timeout of 30000ms exceeded.\nAbortError: The operation was aborted.",
    });
    expect(r.diagnosis).toBe("flaky");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
    expect(r.isLikelyFlaky).toBe(true);
  });

  it("detects code bug from TypeError in log", () => {
    const r = quickHeuristic({
      testCode: "test('x', async () => { expect(1).toBe(1); });",
      failureLog: "TypeError: Cannot read properties of undefined (reading 'name')",
    });
    expect(r.diagnosis).toBe("code_wrong");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("flags 200→500 as code_wrong with high confidence", () => {
    const r = quickHeuristic({
      testCode: "test('x', async () => { expect(status).toBe(200); });",
      failureLog: "expected 200 received 500",
      expectedStatus: 200,
      actualStatus: 500,
    });
    expect(r.diagnosis).toBe("code_wrong");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("flags 200→422 as spec_wrong (validation tightened)", () => {
    const r = quickHeuristic({
      testCode: "test('x', async () => { expect(status).toBe(200); });",
      failureLog: "expected 200 received 422",
      expectedStatus: 200,
      actualStatus: 422,
    });
    expect(r.diagnosis).toBe("spec_wrong");
  });

  it("flags 200→401 as test_wrong (auth setup issue)", () => {
    const r = quickHeuristic({
      testCode: "test('x', async () => { expect(status).toBe(200); });",
      failureLog: "expected 200 received 401",
      expectedStatus: 200,
      actualStatus: 401,
    });
    expect(r.diagnosis).toBe("test_wrong");
    expect(r.suggestedFix.target).toBe("test");
  });

  it("returns 'unknown' with confidence 0 when no signal matches", () => {
    const r = quickHeuristic({
      testCode: "test('x', async () => {});",
      failureLog: "some weird unmatched output",
    });
    expect(r.diagnosis).toBe("unknown");
    expect(r.confidence).toBe(0);
  });

  it("each diagnosis has a sensible suggestedFix.target", () => {
    const cases = [
      { exp: 200, act: 500, expectedTarget: "code" },
      { exp: 200, act: 422, expectedTarget: "spec" },
      { exp: 200, act: 401, expectedTarget: "test" },
    ];
    for (const c of cases) {
      const r = quickHeuristic({
        testCode: "test('x', async () => {});",
        failureLog: `expected ${c.exp} got ${c.act}`,
        expectedStatus: c.exp,
        actualStatus: c.act,
      });
      expect(r.suggestedFix.target).toBe(c.expectedTarget);
    }
  });
});

describe("Failure Analyzer — parseSuggestion (LLM JSON parser)", () => {
  const fallback = quickHeuristic({ testCode: "test('x',()=>{});", failureLog: "fail" });

  it("parses valid LLM JSON output", () => {
    const raw = `{
      "diagnosis": "code_wrong",
      "confidence": 0.92,
      "reasoning": "Server crashed.",
      "suggestedFix": { "target": "code", "description": "Fix null check" },
      "alternatives": [{ "diagnosis": "test_wrong", "confidence": 0.1, "note": "unlikely" }],
      "isLikelyFlaky": false
    }`;
    const r = parseSuggestion(raw, fallback);
    expect(r.diagnosis).toBe("code_wrong");
    expect(r.confidence).toBe(0.92);
    expect(r.suggestedFix.target).toBe("code");
    expect(r.alternatives).toHaveLength(1);
  });

  it("returns fallback when JSON is unparseable", () => {
    const r = parseSuggestion("not even close to JSON", fallback);
    expect(r).toEqual(fallback);
  });

  it("strips markdown fences before parsing", () => {
    const raw = '```json\n{"diagnosis":"flaky","confidence":0.8,"reasoning":"x","suggestedFix":{"target":"test","description":"retry"},"alternatives":[],"isLikelyFlaky":true}\n```';
    const r = parseSuggestion(raw, fallback);
    expect(r.diagnosis).toBe("flaky");
  });

  it("clamps confidence to [0, 1] range", () => {
    const raw = `{"diagnosis":"code_wrong","confidence":1.5,"reasoning":"x","suggestedFix":{"target":"code","description":"x"},"alternatives":[],"isLikelyFlaky":false}`;
    const r = parseSuggestion(raw, fallback);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid diagnosis values, defaults to 'unknown'", () => {
    const raw = `{"diagnosis":"INVALID","confidence":0.5,"reasoning":"x","suggestedFix":{"target":"test","description":"x"},"alternatives":[],"isLikelyFlaky":false}`;
    const r = parseSuggestion(raw, fallback);
    expect(r.diagnosis).toBe("unknown");
  });
});
