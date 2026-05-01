/**
 * True E2E Generators (Phase 2) — Unit Tests
 *
 * Verifies generateE2EVisualTest, generateE2ENetworkTest, and
 * generateE2EAccessibilityFullTest produce valid Playwright code.
 */
import { describe, it, expect } from "vitest";
import {
  generateE2EVisualTest,
  generateE2ENetworkTest,
  generateE2EAccessibilityFullTest,
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
      { description: "Mutation D", expectedKill: true },
      { description: "Mutation E", expectedKill: true },
    ],
    endpoint: "users.list",
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
          name: "users.list",
          method: "GET /api/trpc/users.list",
          auth: "requireAuth",
          relatedBehaviors: ["B001"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
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
  expect(code).toMatch(/import.*from "@playwright\/test"/);
  expect(code).toMatch(/test\(|test\.skip\(|test\.describe\(/);
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  expect(opens, "unbalanced braces").toBe(closes);
};

// ─── Visual Regression ───────────────────────────────────────────────────────

describe("generateE2EVisualTest", () => {
  it("produces valid Playwright code", () => {
    SHARED(generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis()));
  });

  it("generates 3 tests: V1 full page, V2 viewport, V3 interaction", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    expect(code).toMatch(/test\("T_E2E_VISUAL_001_V1.*full page/i);
    expect(code).toMatch(/test\("T_E2E_VISUAL_001_V2.*viewport/i);
    expect(code).toMatch(/test\("T_E2E_VISUAL_001_V3.*interaction/i);
  });

  it("uses toHaveScreenshot with maxDiffPixelRatio threshold", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    expect(code).toContain("toHaveScreenshot");
    expect(code).toContain("maxDiffPixelRatio");
  });

  it("V2 (viewport) uses stricter threshold than V1 (full page)", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    // V2: 0.005 (0.5%), V1: 0.01 (1%)
    expect(code).toContain("0.005");
    expect(code).toContain("0.01");
  });

  it("masks dynamic content (timestamps, avatars, time elements)", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    expect(code).toContain("timestamp");
    expect(code).toContain("user-avatar");
    expect(code).toContain("'time'");
  });

  it("waits for fonts and networkidle before capture (anti-flakiness)", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    expect(code).toContain("document.fonts.ready");
    expect(code).toContain("networkidle");
  });

  it("authenticates via loginAsRole before navigation", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    expect(code).toContain("loginAsRole");
  });

  it("has // Kills: comments for each test (R7 compliance)", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual"), makeAnalysis());
    expect((code.match(/\/\/ Kills:/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Network Conditions ──────────────────────────────────────────────────────

describe("generateE2ENetworkTest", () => {
  it("produces valid Playwright code", () => {
    SHARED(generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis()));
  });

  it("generates 4 tests: N1 slow 3G, N2 offline, N3 API 500, N4 timeout", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect(code).toMatch(/test\("T_E2E_NETWORK_001_N1.*slow 3G/);
    expect(code).toMatch(/test\("T_E2E_NETWORK_001_N2.*offline/);
    expect(code).toMatch(/test\("T_E2E_NETWORK_001_N3.*500/);
    expect(code).toMatch(/test\("T_E2E_NETWORK_001_N4.*timeout/);
  });

  it("N1 uses CDP session for network throttling", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect(code).toContain("newCDPSession");
    expect(code).toContain("Network.emulateNetworkConditions");
  });

  it("N2 uses context.setOffline(true) and restores offline on cleanup", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect(code).toContain("context.setOffline(true)");
    expect(code).toContain("context.setOffline(false)");
  });

  it("N3 uses page.route to mock 500 responses", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect(code).toContain("page.route");
    expect(code).toContain("status: 500");
  });

  it("N4 uses page.route with delay to simulate timeout", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect(code).toContain("setTimeout(resolve, 30_000)");
  });

  it("each test has // Kills: comment (R7)", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect((code.match(/\/\/ Kills:/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("expects loading UI / error UI / retry UI (graceful degradation)", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network"), makeAnalysis());
    expect(code).toMatch(/loading|spinner|skeleton/);
    expect(code).toMatch(/offline|error|retry/i);
  });
});

// ─── Full WCAG 2.1 AA Audit ──────────────────────────────────────────────────

describe("generateE2EAccessibilityFullTest", () => {
  it("produces valid Playwright code", () => {
    SHARED(generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis()));
  });

  it("imports AxeBuilder from @axe-core/playwright", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect(code).toContain('import AxeBuilder from "@axe-core/playwright"');
  });

  it("generates 5 categorized tests: A1-A5", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect(code).toMatch(/test\("T_E2E_A11Y_FULL_001_A1.*color contrast/);
    expect(code).toMatch(/test\("T_E2E_A11Y_FULL_001_A2.*keyboard/);
    expect(code).toMatch(/test\("T_E2E_A11Y_FULL_001_A3.*form labels/);
    expect(code).toMatch(/test\("T_E2E_A11Y_FULL_001_A4.*heading/);
    expect(code).toMatch(/test\("T_E2E_A11Y_FULL_001_A5.*ARIA/);
  });

  it("A1 uses axe color-contrast rule scoping", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect(code).toContain('"color-contrast"');
  });

  it("A2 manually verifies keyboard nav (tab focus moves)", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect(code).toContain('keyboard.press("Tab")');
    expect(code).toContain("focusedTags");
  });

  it("A4 enforces exactly one h1 per page (WCAG 1.3.1)", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect(code).toContain('locator("h1")');
    expect(code).toMatch(/h1Count.*toBe\(1\)/);
  });

  it("A5 checks comprehensive ARIA rules", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect(code).toContain("aria-valid-attr");
    expect(code).toContain("aria-required-attr");
    expect(code).toContain("aria-allowed-attr");
  });

  it("each test has // Kills: comment per WCAG criterion (R7)", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full"), makeAnalysis());
    expect((code.match(/\/\/ Kills:/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
