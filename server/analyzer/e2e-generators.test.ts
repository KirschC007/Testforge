/**
 * True E2E Generators (Phase 1) — Unit Tests
 *
 * Verifies generateE2ESmartFormTest, generateE2EUserJourneyTest, and
 * generateE2EPerfBudgetTest produce valid Playwright code for all input shapes.
 */
import { describe, it, expect } from "vitest";
import {
  generateE2ESmartFormTest,
  generateE2EUserJourneyTest,
  generateE2EPerfBudgetTest,
} from "./proof-generator";
import type { ProofTarget, AnalysisResult, EndpointField, AnalysisIR } from "./types";

function makeTarget(proofType: ProofTarget["proofType"], overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: `T_${proofType.toUpperCase()}_001`,
    behaviorId: "B001",
    proofType,
    riskLevel: "high",
    description: `${proofType} test`,
    preconditions: [],
    assertions: [],
    mutationTargets: [
      { description: "Mutation A", expectedKill: true },
      { description: "Mutation B", expectedKill: true },
      { description: "Mutation C", expectedKill: true },
    ],
    endpoint: "users.create",
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<AnalysisIR> = {}): AnalysisResult {
  return {
    ir: {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
      resources: [],
      apiEndpoints: [
        {
          name: "users.create",
          method: "POST /api/trpc/users.create",
          auth: "requireAuth",
          relatedBehaviors: ["B001"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "name", type: "string", required: true, max: 100 },
            { name: "email", type: "string", required: true },
            { name: "role", type: "enum", required: true, enumValues: ["admin", "user"] },
            { name: "active", type: "boolean", required: false },
            { name: "age", type: "number", required: false, min: 0, max: 150 },
          ] as EndpointField[],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [{ name: "admin", envUserVar: "X", envPassVar: "Y", defaultUser: "a", defaultPass: "b" }],
      },
      enums: {},
      statusMachine: null,
      ...overrides,
    },
    qualityScore: 8,
    specType: "test",
  };
}

const SHARED = (code: string) => {
  // Every generated E2E test must:
  expect(code).toMatch(/import.*from "@playwright\/test"/);
  expect(code).toMatch(/test\(|test\.skip\(|test\.describe\(/);
  // Balanced braces
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  expect(opens, "unbalanced braces").toBe(closes);
};

// ─── Smart Form ──────────────────────────────────────────────────────────────

describe("generateE2ESmartFormTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    SHARED(code);
  });

  it("imports browser helpers (loginAsRole, smartFill, etc.)", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    expect(code).toContain("loginAsRole");
    expect(code).toContain("smartFill");
    expect(code).toContain("smartClick");
  });

  it("generates 3 tests: happy path (F1), validation (F2), persistence (F3)", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    expect(code).toMatch(/test\("T_E2E_SMART_FORM_001_F1/);
    expect(code).toMatch(/test\("T_E2E_SMART_FORM_001_F2/);
    expect(code).toMatch(/test\("T_E2E_SMART_FORM_001_F3/);
  });

  it("has // Kills: comments on every test (R7 compliance)", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    const killCount = (code.match(/\/\/ Kills:/g) || []).length;
    expect(killCount).toBeGreaterThanOrEqual(3);
  });

  it("uses smartSelect for enum fields", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    expect(code).toContain("smartSelect(page");
  });

  it("uses semantic test values (email contains @example.com)", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    // Field name "email" triggers semantic value; template literal generates @example.com
    expect(code).toContain("@example.com");
  });

  it("infers UI path from endpoint name (users.create → /users/new)", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    expect(code).toContain("/users/new");
  });

  it("F2 test does NOT pre-fill any fields (validates empty submit)", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), makeAnalysis());
    // Find F2 test block
    const f2Match = code.match(/test\("T_E2E_SMART_FORM_001_F2[^]*?\}\);/);
    expect(f2Match).not.toBeNull();
    // Within F2, smartFill should NOT appear before smartClick
    const f2 = f2Match![0];
    const fillIdx = f2.indexOf("smartFill");
    const clickIdx = f2.indexOf("smartClick");
    if (fillIdx !== -1 && clickIdx !== -1) {
      expect(clickIdx, "F2 must click submit before any fill").toBeLessThan(fillIdx);
    }
  });

  it("handles endpoint with NO fields gracefully (no broken syntax)", () => {
    const analysis = makeAnalysis({
      apiEndpoints: [{
        name: "users.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "tenantId", type: "number", required: true, isTenantKey: true },
        ] as EndpointField[],
      }],
    });
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), analysis);
    SHARED(code);
    // F3 (persistence) requires a string field — should be skipped or absent
    expect(code).not.toContain("test.skip(");
  });
});

// ─── User Journey ────────────────────────────────────────────────────────────

describe("generateE2EUserJourneyTest", () => {
  it("produces valid Playwright code with userFlow defined", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1",
        name: "User signup",
        actor: "guest",
        steps: [
          "Navigate to /signup",
          "Fill email field",
          "Fill password field",
          "Click submit button",
          "Verify success message appears",
        ],
        successCriteria: ["Account created", "Welcome email sent"],
        errorScenarios: [],
        relatedEndpoints: ["users.create"],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    SHARED(code);
    expect(code).toContain("test(");
  });

  it("imports browser helpers when flow exists", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Navigate to /home"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("navigateTo");
  });

  it("translates 'Navigate to /path' to navigateTo()", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Navigate to /dashboard"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain('navigateTo(page, "/dashboard")');
  });

  it("translates 'Click X button' to smartClick()", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Click submit button"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("smartClick");
  });

  it("translates 'Fill X field' to smartFill()", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Fill email field"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("smartFill");
  });

  it("translates 'Verify X' to expectVisible()", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Verify success message appears"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("expectVisible");
  });

  it("translates 'Login as X' to loginAsRole()", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Login as admin"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("loginAsRole");
  });

  it("translates 'Wait X seconds' to waitForTimeout()", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Wait 2 seconds"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("waitForTimeout(2000)");
  });

  it("emits TODO comment for unrecognized step (no false-green)", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Quantum-tunnel through the firewall"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("TODO: implement this step manually");
  });

  it("skips with stub when NO userFlows in IR", () => {
    const analysis = makeAnalysis({ userFlows: [] });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("test.skip(");
    expect(code).toContain("No userFlow");
  });

  it("generates success criteria assertions", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test", actor: "user",
        steps: ["Navigate to /home"],
        successCriteria: ["Welcome message visible", "User logged in"],
        errorScenarios: [],
        relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    expect(code).toContain("Success criteria from spec");
  });

  it("escapes backticks/brackets in step strings (prevents injection)", () => {
    const analysis = makeAnalysis({
      userFlows: [{
        id: "F1", name: "Test`with`backticks", actor: "user",
        steps: ["Verify [error]: `something`"], successCriteria: [], errorScenarios: [], relatedEndpoints: [],
      }],
    });
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), analysis);
    SHARED(code); // brace balance must hold
  });
});

// ─── Performance Budget ──────────────────────────────────────────────────────

describe("generateE2EPerfBudgetTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    SHARED(code);
  });

  it("generates 3 tests: P1 (LCP), P2 (CLS), P3 (TTFB)", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toMatch(/test\("T_E2E_PERF_BUDGET_001_P1.*LCP/);
    expect(code).toMatch(/test\("T_E2E_PERF_BUDGET_001_P2.*CLS/);
    expect(code).toMatch(/test\("T_E2E_PERF_BUDGET_001_P3.*TTFB/);
  });

  it("uses PerformanceObserver for LCP", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toContain("PerformanceObserver");
    expect(code).toContain("largest-contentful-paint");
  });

  it("uses PerformanceObserver for CLS with hadRecentInput filter", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toContain("layout-shift");
    expect(code).toContain("hadRecentInput");
  });

  it("uses PerformanceNavigationTiming for TTFB", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toContain("PerformanceNavigationTiming");
    expect(code).toContain("responseStart");
  });

  it("asserts against Core Web Vitals 'good' thresholds", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toContain("toBeLessThan(2500)"); // LCP
    expect(code).toContain("toBeLessThan(0.1)");  // CLS
    expect(code).toContain("toBeLessThan(800)");  // TTFB
  });

  it("logs measured values for debugging", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toContain("console.log");
  });

  it("includes // Kills: comments per perf test", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    const killCount = (code.match(/\/\/ Kills:/g) || []).length;
    expect(killCount).toBeGreaterThanOrEqual(3);
  });

  it("authenticates via loginAsRole before measuring", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget"), makeAnalysis());
    expect(code).toContain("loginAsRole");
  });
});
