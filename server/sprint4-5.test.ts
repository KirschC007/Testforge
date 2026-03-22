/**
 * Sprint 4+5 Tests
 * Covers: spec-diff, industry-proof-packs, playwright-mcp, repo-scanner, github-pr
 */
import { describe, it, expect } from "vitest";
import { diffAnalysisIR, type SpecDiffResult } from "./analyzer/spec-diff";
import { listProofPacks, getProofPack, applyProofPack } from "./analyzer/industry-proof-packs";
import { generatePlaywrightConfig, generateCIWorkflow, parsePlaywrightResults } from "./analyzer/playwright-mcp";
import { parseGitHubUrl } from "./analyzer/repo-scanner";
import { buildPRComment } from "./github-pr";
import type { AnalysisIR } from "./analyzer";

// ─── Spec Diff Tests ──────────────────────────────────────────────────────────
describe("spec-diff", () => {
  const baseIR: AnalysisIR = {
    behaviors: [
      {
        id: "b1",
        title: "Create product",
        endpoint: "POST /products",
        method: "POST",
        path: "/products",
        tags: ["products"],
        preconditions: ["authenticated"],
        postconditions: ["product created"],
        errorCases: ["400 if invalid"],
        invariants: [],
        sideEffects: [],
        tenantKey: "shopId",
        roles: ["user"],
        riskHints: [],
        statusMachine: null,
        boundaryFields: [],
        idempotencyKey: null,
        webhookEvent: null,
        cronSchedule: null,
        featureFlag: null,
      },
      {
        id: "b2",
        title: "Delete product",
        endpoint: "DELETE /products/:id",
        method: "DELETE",
        path: "/products/:id",
        tags: ["products"],
        preconditions: ["authenticated", "owner"],
        postconditions: ["product deleted"],
        errorCases: ["404 if not found"],
        invariants: [],
        sideEffects: [],
        tenantKey: "shopId",
        roles: ["admin"],
        riskHints: [],
        statusMachine: null,
        boundaryFields: [],
        idempotencyKey: null,
        webhookEvent: null,
        cronSchedule: null,
        featureFlag: null,
      },
    ],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "shop", tenantIdField: "shopId" },
    resources: [],
    apiEndpoints: [
      { name: "POST /products", method: "POST /products", auth: "bearer", relatedBehaviors: ["b1"], inputFields: [] },
      { name: "DELETE /products/:id", method: "DELETE /products/:id", auth: "bearer", relatedBehaviors: ["b2"], inputFields: [] },
    ],
    authModel: null,
    enums: {},
    statusMachine: null,
  };

  const headIR: AnalysisIR = {
    behaviors: [
      {
        id: "b1",
        title: "Create product",
        endpoint: "POST /products",
        method: "POST",
        path: "/products",
        tags: ["products"],
        preconditions: ["authenticated", "plan_check"], // Added precondition
        postconditions: ["product created"],
        errorCases: ["400 if invalid", "402 if plan limit reached"], // Added error case
        invariants: [],
        sideEffects: [],
        tenantKey: "shopId",
        roles: ["user"],
        riskHints: [],
        statusMachine: null,
        boundaryFields: [],
        idempotencyKey: null,
        webhookEvent: null,
        cronSchedule: null,
        featureFlag: "product_creation",
      },
      // b2 removed
      {
        id: "b3",
        title: "List products",
        endpoint: "GET /products",
        method: "GET",
        path: "/products",
        tags: ["products"],
        preconditions: ["authenticated"],
        postconditions: ["returns product list"],
        errorCases: [],
        invariants: [],
        sideEffects: [],
        tenantKey: "shopId",
        roles: ["user", "admin"],
        riskHints: [],
        statusMachine: null,
        boundaryFields: [],
        idempotencyKey: null,
        webhookEvent: null,
        cronSchedule: null,
        featureFlag: null,
      },
    ],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "shop", tenantIdField: "shopId" },
    resources: [],
    apiEndpoints: [
      { name: "POST /products", method: "POST /products", auth: "bearer", relatedBehaviors: ["b1"], inputFields: [] },
      { name: "GET /products", method: "GET /products", auth: "bearer", relatedBehaviors: ["b3"], inputFields: [] },
    ],
    authModel: null,
    enums: {},
    statusMachine: null,
  };

  it("detects changed behavior (b1 has new precondition and error case)", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    const b1Diff = diff.behaviorDiffs.find(d => d.id === "b1");
    expect(b1Diff).toBeDefined();
    expect(b1Diff?.type).toBe("changed");
    expect(b1Diff?.changes?.some(c => c.field.startsWith("preconditions"))).toBe(true);
  });

  it("detects removed behavior (b2 deleted)", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    const b2Diff = diff.behaviorDiffs.find(d => d.id === "b2");
    expect(b2Diff).toBeDefined();
    expect(b2Diff?.type).toBe("removed");
  });

  it("detects added behavior (b3 new)", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    const b3Diff = diff.behaviorDiffs.find(d => d.id === "b3");
    expect(b3Diff).toBeDefined();
    expect(b3Diff?.type).toBe("added");
  });

  it("detects added endpoint (GET /products)", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    expect(diff.endpointDiffs.some(e => e.type === "added" && e.name.includes("GET /products"))).toBe(true);
  });

  it("detects removed endpoint (DELETE /products/:id)", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    expect(diff.endpointDiffs.some(e => e.type === "removed" && e.name.includes("DELETE"))).toBe(true);
  });

  it("produces correct summary counts", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    expect(diff.summary.addedBehaviors).toBe(1);  // b3
    expect(diff.summary.removedBehaviors).toBe(1); // b2
    expect(diff.summary.changedBehaviors).toBe(1); // b1
  });

  it("assigns risk level based on changes", () => {
    const diff = diffAnalysisIR(baseIR, headIR);
    expect(["low", "medium", "high", "critical"]).toContain(diff.summary.riskLevel);
  });

  it("returns empty diff for identical IRs", () => {
    const diff = diffAnalysisIR(baseIR, baseIR);
    expect(diff.behaviorDiffs.filter(d => d.type !== "unchanged")).toHaveLength(0);
    expect(diff.summary.riskLevel).toBe("low");
  });
});

// ─── Industry Proof Packs Tests ───────────────────────────────────────────────
describe("industry-proof-packs", () => {
  it("lists all 4 packs", () => {
    const packs = listProofPacks();
    expect(packs).toHaveLength(4);
    expect(packs.map(p => p.id)).toEqual(expect.arrayContaining(["fintech", "healthtech", "ecommerce", "saas"]));
  });

  it("fintech pack has PSD2 compliance framework", () => {
    const pack = getProofPack("fintech");
    expect(pack.complianceFrameworks).toContain("PSD2");
  });

  it("healthtech pack has HIPAA compliance framework", () => {
    const pack = getProofPack("healthtech");
    expect(pack.complianceFrameworks).toContain("HIPAA");
  });

  it("ecommerce pack has PCI-DSS compliance framework", () => {
    const pack = getProofPack("ecommerce");
    expect(pack.complianceFrameworks).toContain("PCI-DSS");
  });

  it("saas pack has SOC 2 compliance framework", () => {
    const pack = getProofPack("saas");
    expect(pack.complianceFrameworks.some(f => f.includes("SOC 2"))).toBe(true);
  });

  it("each pack has at least 3 custom test patterns", () => {
    for (const id of ["fintech", "healthtech", "ecommerce", "saas"] as const) {
      const pack = getProofPack(id);
      expect(pack.customTestPatterns.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("applyProofPack merges proof types correctly", () => {
    const result = applyProofPack("fintech", ["idor", "csrf"]);
    expect(result.proofTypes).toContain("idor");
    expect(result.proofTypes).toContain("csrf");
    expect(result.proofTypes).toContain("idempotency"); // fintech adds idempotency
    expect(result.proofTypes).toContain("concurrency"); // fintech risk boost
  });

  it("applyProofPack returns compliance frameworks", () => {
    const result = applyProofPack("healthtech", []);
    expect(result.complianceFrameworks).toContain("HIPAA");
    expect(result.complianceFrameworks).toContain("GDPR");
  });

  it("each pack has risk hint boosts for relevant proof types", () => {
    const fintech = getProofPack("fintech");
    expect(fintech.riskHintBoosts["idor"]).toBeGreaterThan(0);
    expect(fintech.riskHintBoosts["idempotency"]).toBeGreaterThan(0);
  });
});

// ─── Playwright MCP Tests ─────────────────────────────────────────────────────
describe("playwright-mcp", () => {
  it("generatePlaywrightConfig produces valid config with baseUrl", () => {
    const config = generatePlaywrightConfig({ baseUrl: "https://api.example.com", timeout: 30000, workers: 1 });
    expect(config).toContain("https://api.example.com");
    expect(config).toContain("defineConfig");
    expect(config).toContain("30000");
  });

  it("generatePlaywrightConfig includes auth token when provided", () => {
    const config = generatePlaywrightConfig({ baseUrl: "https://api.example.com", authToken: "test-token-123" });
    expect(config).toContain("test-token-123");
    expect(config).toContain("Authorization");
  });

  it("generateCIWorkflow produces valid YAML with analysisId", () => {
    const workflow = generateCIWorkflow(42, "https://testforge.dev");
    expect(workflow).toContain("name: TestForge API Tests");
    expect(workflow).toContain("42");
    expect(workflow).toContain("testforge.dev");
    expect(workflow).toContain("playwright test");
  });

  it("parsePlaywrightResults handles empty suite", () => {
    const result = parsePlaywrightResults({ suites: [] });
    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.passRate).toBe(0);
  });

  it("parsePlaywrightResults calculates pass rate correctly", () => {
    const mockResults = {
      suites: [{
        tests: [
          { results: [{ status: "passed", duration: 100 }] },
          { results: [{ status: "passed", duration: 200 }] },
          { results: [{ status: "failed", duration: 50, error: { message: "Expected 200 but got 403" } }] },
        ],
        suites: [],
        file: "tests/security/idor.spec.ts",
        title: "IDOR tests",
      }],
    };
    const result = parsePlaywrightResults(mockResults);
    expect(result.total).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.passRate).toBe(67);
  });
});

// ─── Repo Scanner Tests ───────────────────────────────────────────────────────
describe("repo-scanner", () => {
  it("parseGitHubUrl parses simple repo URL", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");
    expect(result).toBeDefined();
    expect(result?.owner).toBe("owner");
    expect(result?.repo).toBe("repo");
    expect(result?.branch).toBe("main");
  });

  it("parseGitHubUrl parses URL with branch", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/tree/develop");
    expect(result?.branch).toBe("develop");
  });

  it("parseGitHubUrl parses URL with blob path", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/blob/main/api/openapi.yaml");
    expect(result?.owner).toBe("owner");
    expect(result?.repo).toBe("repo");
    expect(result?.branch).toBe("main");
  });

  it("parseGitHubUrl returns null for invalid URL", () => {
    expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseGitHubUrl("not-a-url")).toBeNull();
  });

  it("parseGitHubUrl handles .git suffix", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo.git");
    expect(result?.repo).toBe("repo");
  });
});

// ─── GitHub PR Tests ──────────────────────────────────────────────────────────
describe("github-pr", () => {
  const mockAnalysis = {
    id: 1,
    userId: 1,
    projectName: "TestProject",
    status: "completed" as const,
    verdictScore: 85,
    coveragePercent: 92,
    validatedProofCount: 12,
    discardedProofCount: 2,
    behaviorCount: 8,
    specFileName: "openapi.yaml",
    specFileKey: "specs/1/openapi.yaml",
    outputZipUrl: "https://s3.example.com/output.zip",
    outputZipKey: "output/1/tests.zip",
    errorMessage: null,
    layer1Json: null,
    resultJson: null,
    createdAt: new Date(),
    completedAt: new Date(),
    plan: "free" as const,
  };

  it("buildPRComment produces markdown with score", () => {
    const comment = buildPRComment({ analysis: mockAnalysis as any, reportUrl: "https://testforge.dev/analysis/1" });
    expect(comment).toContain("85/100");
    expect(comment).toContain("TestProject");
    expect(comment).toContain("testforge.dev");
  });

  it("buildPRComment includes coverage and proof counts", () => {
    const comment = buildPRComment({ analysis: mockAnalysis as any, reportUrl: "https://testforge.dev/analysis/1" });
    expect(comment).toContain("92%");
    expect(comment).toContain("12");
  });

  it("buildPRComment includes diff section when diff provided", () => {
    const mockDiff = {
      summary: {
        addedBehaviors: 2,
        removedBehaviors: 1,
        changedBehaviors: 3,
        addedEndpoints: 1,
        removedEndpoints: 0,
        riskLevel: "medium" as const,
        affectedProofTypes: ["idor", "auth_matrix"],
      },
      behaviorDiffs: [],
      endpointDiffs: [],
      statusMachineDiffs: [],
    };
    const comment = buildPRComment({ analysis: mockAnalysis as any, reportUrl: "https://testforge.dev/analysis/1", diff: mockDiff });
    expect(comment).toContain("Spec Diff");
    expect(comment).toContain("MEDIUM");
    expect(comment).toContain("idor");
  });

  it("buildPRComment uses correct emoji for high score", () => {
    const comment = buildPRComment({ analysis: mockAnalysis as any, reportUrl: "https://testforge.dev/analysis/1" });
    expect(comment).toContain("✅"); // 85 >= 75
  });

  it("buildPRComment uses correct emoji for low score", () => {
    const lowScoreAnalysis = { ...mockAnalysis, verdictScore: 45 };
    const comment = buildPRComment({ analysis: lowScoreAnalysis as any, reportUrl: "https://testforge.dev/analysis/1" });
    expect(comment).toContain("❌"); // 45 < 60
  });
});
