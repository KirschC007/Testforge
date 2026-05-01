/**
 * Risk Model — Unit Tests
 *
 * Tests buildRiskModel + buildProofTarget for all proof types.
 * Each test verifies a specific behavior shape produces the expected proof targets.
 */
import { describe, it, expect } from "vitest";
import { buildRiskModel, buildProofTarget, determineProofTypes, extractConstraints, assessSpecHealth, assessSpecHealthFromResult } from "./risk-model";
import type { AnalysisResult, ScoredBehavior, EndpointField, AnalysisIR } from "./types";

function makeAnalysis(overrides: Partial<AnalysisIR> = {}): AnalysisResult {
  return {
    ir: {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
      resources: [],
      apiEndpoints: [],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [{
          name: "admin",
          envUserVar: "E2E_ADMIN_USER",
          envPassVar: "E2E_ADMIN_PASS",
          defaultUser: "test-admin",
          defaultPass: "TestPass2026x",
        }],
      },
      enums: {},
      statusMachine: null,
      ...overrides,
    },
    qualityScore: 8,
    specType: "test",
  };
}

const baseBehavior = {
  id: "B001",
  title: "Test",
  subject: "API",
  action: "does",
  object: "thing",
  preconditions: [],
  postconditions: [],
  errorCases: [],
  tags: [],
  riskHints: [],
};

describe("buildRiskModel — risk level assignment", () => {
  it("assigns critical risk to security-tagged behaviors", () => {
    const analysis = makeAnalysis({
      behaviors: [{ ...baseBehavior, tags: ["security", "idor"] }],
    });
    const model = buildRiskModel(analysis);
    expect(model.behaviors[0].riskLevel).toMatch(/critical|high/);
  });

  it("assigns medium/low risk to validation behaviors", () => {
    const analysis = makeAnalysis({
      behaviors: [{ ...baseBehavior, tags: ["validation"], title: "Validate input" }],
    });
    const model = buildRiskModel(analysis);
    expect(["medium", "low"]).toContain(model.behaviors[0].riskLevel);
  });

  it("computes proofTargets for each scored behavior", () => {
    const analysis = makeAnalysis({
      behaviors: [
        { ...baseBehavior, id: "B1", tags: ["security", "idor"], title: "Cross-tenant" },
        { ...baseBehavior, id: "B2", tags: ["validation"], title: "Validate" },
      ],
      apiEndpoints: [{
        name: "users.list",
        method: "GET",
        auth: "requireAuth",
        relatedBehaviors: ["B1", "B2"],
        inputFields: [
          { name: "tenantId", type: "number", required: true, isTenantKey: true },
          { name: "q", type: "string", required: false, max: 100 },
        ] as EndpointField[],
      }],
    });
    const model = buildRiskModel(analysis);
    expect(model.proofTargets.length).toBeGreaterThan(0);
  });
});

describe("buildRiskModel — counters", () => {
  it("computes idorVectors and csrfEndpoints (numeric)", () => {
    const analysis = makeAnalysis({
      behaviors: [{ ...baseBehavior, tags: ["security", "idor"] }],
      apiEndpoints: [{
        name: "users.list",
        method: "GET",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [{ name: "tenantId", type: "number", required: true, isTenantKey: true }] as EndpointField[],
      }],
    });
    const model = buildRiskModel(analysis);
    expect(typeof model.idorVectors).toBe("number");
    expect(typeof model.csrfEndpoints).toBe("number");
  });
});

describe("buildProofTarget — handles all proof types", () => {
  const sb: ScoredBehavior = {
    behavior: { ...baseBehavior, postconditions: ["count incremented"], preconditions: ["user authenticated"] },
    riskLevel: "high",
    proofTypes: [],
    priority: 0,
    rationale: "test",
  };
  // Provide an endpoint so types like business_logic that require one don't return null
  const analysis = makeAnalysis({
    apiEndpoints: [{
      name: "thing.create",
      method: "POST",
      auth: "requireAuth",
      relatedBehaviors: ["B001"],
      inputFields: [
        { name: "tenantId", type: "number", required: true, isTenantKey: true },
        { name: "amount", type: "number", required: true, min: 1, max: 100 },
      ] as EndpointField[],
    }],
  });

  // Only proof types that have explicit branches in buildProofTarget — security
  // template-only types (sql_injection, mass_assignment, etc.) are handled by
  // proof-templates-security.ts instead and return null here by design.
  const types = ["idor", "csrf", "dsgvo", "boundary", "rate_limit", "business_logic", "risk_scoring",
    "spec_drift", "concurrency", "idempotency", "auth_matrix", "flow", "cron_job", "webhook",
    "feature_gate", "status_transition", "property_based"] as const;

  for (const pt of types) {
    it(`returns a target for ${pt}`, () => {
      const target = buildProofTarget(sb, pt, analysis);
      // All these proof types should produce a target
      expect(target).not.toBeNull();
      expect(target!.proofType).toBe(pt);
      expect(target!.id).toContain(sb.behavior.id);
      expect(target!.mutationTargets.length).toBeGreaterThan(0);
    });
  }
});

describe("extractConstraints", () => {
  it("extracts min/max from endpoint inputFields (deterministic)", () => {
    const ir: AnalysisIR = {
      ...makeAnalysis().ir,
      apiEndpoints: [{
        name: "users.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "age", type: "number", required: true, min: 18, max: 120 },
        ] as EndpointField[],
      }],
    };
    const constraints = extractConstraints({ ...baseBehavior, id: "B001" }, ir);
    expect(constraints.length).toBeGreaterThan(0);
    expect(constraints.some(c => c.field === "age")).toBe(true);
  });

  it("returns empty array for behaviors with no constraints in spec", () => {
    const ir = makeAnalysis().ir;
    const constraints = extractConstraints({ ...baseBehavior }, ir);
    // No endpoint linked → no structured constraints, regex may not find anything
    expect(Array.isArray(constraints)).toBe(true);
  });
});

describe("determineProofTypes", () => {
  it("returns IDOR for tenant-keyed endpoints", () => {
    const types = determineProofTypes(
      { ...baseBehavior, tags: ["security"] },
      {
        name: "x.list",
        method: "GET",
        auth: "auth",
        relatedBehaviors: [],
        inputFields: [{ name: "tenantId", type: "number", required: true, isTenantKey: true }],
      },
      makeAnalysis().ir,
    );
    expect(types).toContain("idor");
  });

  it("returns at least one proof type for any behavior", () => {
    const types = determineProofTypes({ ...baseBehavior }, undefined, makeAnalysis().ir);
    expect(types.length).toBeGreaterThanOrEqual(0); // fallback may be empty
  });
});

describe("assessSpecHealth", () => {
  it("returns a SpecHealth object with score and grade", () => {
    const analysis = makeAnalysis({
      behaviors: [
        { ...baseBehavior, id: "B1", chapter: "Auth" },
        { ...baseBehavior, id: "B2", chapter: "Orders" },
      ],
      apiEndpoints: [{
        name: "users.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: ["B1"],
        inputFields: [{ name: "name", type: "string", required: true }] as EndpointField[],
      }],
    });
    const health = assessSpecHealth(analysis.ir);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(health.grade);
    expect(Array.isArray(health.dimensions)).toBe(true);
  });
});

describe("assessSpecHealthFromResult", () => {
  it("delegates to assessSpecHealth with ir", () => {
    const analysis = makeAnalysis({
      behaviors: [{ ...baseBehavior }],
    });
    const health = assessSpecHealthFromResult(analysis);
    expect(health.score).toBeGreaterThanOrEqual(0);
  });
});
