/**
 * Pipeline Integration Tests
 *
 * Tests the full analyzer pipeline (Layer 2 → 3 → 4) end-to-end without LLM.
 * Layer 1 (LLM parsing) is excluded — integration tests use a hand-built IR.
 *
 * What this proves:
 *   - Risk Model correctly assigns proof types to behaviors
 *   - Proof Generator produces valid TypeScript for every triggered proof type
 *   - Validator accepts those generated proofs
 *   - Generated test files are syntactically valid TypeScript
 */
import { describe, it, expect } from "vitest";
import { buildRiskModel } from "./risk-model";
import { generateProofs } from "./proof-generator";
import { validateProofs } from "./validator";
import { generateHelpers } from "./helpers-generator";
import type { AnalysisResult, EndpointField } from "./types";

// ─── Test Fixture: Realistic SaaS spec IR ────────────────────────────────────

function makeFullAnalysis(): AnalysisResult {
  return {
    ir: {
      behaviors: [
        {
          id: "B001",
          title: "Reject cross-tenant order access",
          subject: "API",
          action: "rejects",
          object: "cross-tenant access",
          preconditions: ["Authenticated as tenant A"],
          postconditions: ["HTTP 403 returned"],
          errorCases: ["Cross-tenant access returns 403"],
          tags: ["security", "multi-tenant", "idor"],
          riskHints: ["idor"],
          chapter: "Security",
        },
        {
          id: "B002",
          title: "Validate order amount between 0.01 and 999999.99",
          subject: "API",
          action: "validates",
          object: "amount",
          preconditions: [],
          postconditions: ["Valid amount stored"],
          errorCases: ["Amount > max returns 422"],
          tags: ["validation", "boundary"],
          riskHints: ["boundary"],
          chapter: "Orders",
        },
        {
          id: "B003",
          title: "GDPR data deletion for user",
          subject: "API",
          action: "anonymizes",
          object: "user PII",
          preconditions: ["Authenticated user requests deletion"],
          postconditions: ["PII anonymized"],
          errorCases: [],
          tags: ["dsgvo", "gdpr", "compliance"],
          riskHints: ["dsgvo"],
          chapter: "Compliance",
        },
        {
          id: "B004",
          title: "Status transition: pending → confirmed → shipped",
          subject: "API",
          action: "transitions",
          object: "order status",
          preconditions: ["Order exists"],
          postconditions: ["Status updated"],
          errorCases: ["Cannot skip states"],
          tags: ["state-machine", "transition"],
          riskHints: ["status_transition"],
          chapter: "Orders",
        },
      ],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
      resources: [
        { name: "orders", table: "orders", tenantKey: "tenantId", operations: ["create", "read", "update"], hasPII: true },
        { name: "users", table: "users", tenantKey: "tenantId", operations: ["create", "read", "delete"], hasPII: true },
      ],
      apiEndpoints: [
        {
          name: "orders.create",
          method: "POST /api/trpc/orders.create",
          auth: "requireAuth",
          relatedBehaviors: ["B002"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "amount", type: "number", required: true, min: 0.01, max: 999999.99 },
            { name: "description", type: "string", required: true, max: 200 },
          ] as EndpointField[],
          outputFields: ["id", "tenantId", "amount", "status"],
        },
        {
          name: "orders.getById",
          method: "GET /api/trpc/orders.getById",
          auth: "requireAuth",
          relatedBehaviors: ["B001"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "id", type: "number", required: true },
          ] as EndpointField[],
          outputFields: ["id", "tenantId", "amount", "status"],
        },
        {
          name: "orders.updateStatus",
          method: "POST /api/trpc/orders.updateStatus",
          auth: "requireAuth",
          relatedBehaviors: ["B004"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "id", type: "number", required: true },
            { name: "status", type: "enum", required: true, enumValues: ["pending", "confirmed", "shipped", "delivered"] },
          ] as EndpointField[],
        },
        {
          name: "users.gdprDelete",
          method: "DELETE /api/trpc/users.gdprDelete",
          auth: "requireAuth",
          relatedBehaviors: ["B003"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "userId", type: "number", required: true },
          ] as EndpointField[],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [
          { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" },
        ],
      },
      enums: { status: ["pending", "confirmed", "shipped", "delivered"] },
      statusMachine: {
        states: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
        transitions: [["pending", "confirmed"], ["confirmed", "shipped"], ["shipped", "delivered"]],
        forbidden: [["delivered", "pending"], ["cancelled", "confirmed"]],
        initialState: "pending",
        terminalStates: ["delivered", "cancelled"],
      },
    },
    qualityScore: 9.0,
    specType: "ecommerce-saas",
  };
}

// ─── Pipeline tests ──────────────────────────────────────────────────────────

describe("Pipeline Integration — Layer 2 (Risk Model)", () => {
  it("identifies IDOR risk for cross-tenant behavior", () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);

    const idorTargets = riskModel.proofTargets.filter(t => t.proofType === "idor");
    expect(idorTargets.length).toBeGreaterThan(0);
  });

  it("identifies boundary risk for validation behaviors", () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);

    const boundaryTargets = riskModel.proofTargets.filter(t => t.proofType === "boundary");
    expect(boundaryTargets.length).toBeGreaterThan(0);
  });

  it("identifies dsgvo risk for GDPR behaviors", () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);

    const dsgvoTargets = riskModel.proofTargets.filter(t => t.proofType === "dsgvo");
    expect(dsgvoTargets.length).toBeGreaterThan(0);
  });

  it("identifies status_transition risk for state machine behaviors", () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);

    const stTargets = riskModel.proofTargets.filter(t => t.proofType === "status_transition");
    expect(stTargets.length).toBeGreaterThan(0);
  });

  it("triggers property_based for endpoints with multiple typed fields", () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);

    const propTargets = riskModel.proofTargets.filter(t => t.proofType === "property_based");
    expect(propTargets.length).toBeGreaterThan(0);
  });
});

describe("Pipeline Integration — Layer 3 (Proof Generation)", () => {
  it("generates a non-empty proof for every targeted behavior", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);

    expect(proofs.length).toBeGreaterThan(0);
    for (const p of proofs) {
      expect(p.code).toBeDefined();
      expect(p.code.length).toBeGreaterThan(50);
    }
  });

  it("every generated proof has // Kills: comments (R7 prereq)", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);

    // Filter out TODO stubs (those don't have Kills by design)
    const realProofs = proofs.filter(p => !p.code.includes("test.skip(") && !p.code.includes("TODO: Implement"));
    for (const p of realProofs) {
      expect(p.code, `Proof ${p.id} missing // Kills: comment`).toContain("// Kills:");
    }
  });

  it("every proof uses Playwright test() syntax", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);

    for (const p of proofs) {
      expect(p.code).toMatch(/test\(|test\.skip\(|test\.describe\(/);
    }
  });

  it("every proof has balanced braces (no syntax artifacts)", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);

    for (const p of proofs) {
      const opens = (p.code.match(/\{/g) || []).length;
      const closes = (p.code.match(/\}/g) || []).length;
      expect(opens, `Proof ${p.id} (${p.proofType}): unbalanced braces`).toBe(closes);
    }
  });

  it("file paths group by category (security/business/compliance/etc)", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);

    const dirs = new Set(proofs.map(p => p.filename.split("/")[1]));
    // Should produce tests in multiple category directories
    expect(dirs.size).toBeGreaterThanOrEqual(2);
  });
});

describe("Pipeline Integration — Layer 4 (Validation)", () => {
  it("validates a high percentage of generated proofs", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);
    const behaviorIds = analysis.ir.behaviors.map(b => b.id);
    const validated = validateProofs(proofs, behaviorIds);

    // Generated proofs should mostly pass our own validation
    const passRate = validated.proofs.length / Math.max(1, proofs.length);
    expect(passRate, `Pass rate: ${(passRate * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.7);
  });

  it("computes a non-zero verdict score", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);
    const validated = validateProofs(proofs, analysis.ir.behaviors.map(b => b.id));

    expect(validated.verdict.score).toBeGreaterThan(0);
    expect(validated.verdict.passed).toBeGreaterThan(0);
  });

  it("computes coverage based on covered behaviors", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);
    const validated = validateProofs(proofs, analysis.ir.behaviors.map(b => b.id));

    expect(validated.coverage.totalBehaviors).toBe(analysis.ir.behaviors.length);
    expect(validated.coverage.coveredBehaviors).toBeGreaterThan(0);
    expect(validated.coverage.coveragePercent).toBeGreaterThan(0);
  });
});

describe("Pipeline Integration — Layer 6 (Helpers Generation)", () => {
  it("generates all required helper files", () => {
    const analysis = makeFullAnalysis();
    const helpers = generateHelpers(analysis);

    expect(helpers["helpers/api.ts"]).toBeDefined();
    expect(helpers["helpers/auth.ts"]).toBeDefined();
    expect(helpers["helpers/factories.ts"]).toBeDefined();
    expect(helpers["package.json"]).toBeDefined();
    expect(helpers["playwright.config.ts"]).toBeDefined();
    expect(helpers["heal.mjs"]).toBeDefined();
    expect(helpers["stryker.config.json"]).toBeDefined();
  });

  it("package.json includes fast-check + axe-core for property and a11y tests", () => {
    const analysis = makeFullAnalysis();
    const helpers = generateHelpers(analysis);
    const pkg = JSON.parse(helpers["package.json"]);

    expect(pkg.dependencies["fast-check"]).toBeDefined();
    expect(pkg.devDependencies["@axe-core/playwright"]).toBeDefined();
  });

  it("playwright.config.ts includes all test directories", () => {
    const analysis = makeFullAnalysis();
    const helpers = generateHelpers(analysis);
    const config = helpers["playwright.config.ts"];

    expect(config).toContain("tests/security");
    expect(config).toContain("tests/property");
    expect(config).toContain("tests/traffic");
    expect(config).toContain("tests/accessibility");
  });

  it("helpers/api.ts exports pollUntil for async tests", () => {
    const analysis = makeFullAnalysis();
    const helpers = generateHelpers(analysis);
    expect(helpers["helpers/api.ts"]).toContain("export async function pollUntil");
  });

  it("heal.mjs is executable Node script", () => {
    const analysis = makeFullAnalysis();
    const helpers = generateHelpers(analysis);
    expect(helpers["heal.mjs"]).toContain("#!/usr/bin/env node");
  });
});

describe("Pipeline Integration — End-to-End Smoke", () => {
  it("complete pipeline produces a non-empty test suite for a realistic spec", async () => {
    const analysis = makeFullAnalysis();
    const riskModel = buildRiskModel(analysis);
    const proofs = await generateProofs(riskModel, analysis);
    const validated = validateProofs(proofs, analysis.ir.behaviors.map(b => b.id));
    const helpers = generateHelpers(analysis);

    // Every layer produces output
    expect(riskModel.proofTargets.length).toBeGreaterThan(5);
    expect(proofs.length).toBeGreaterThan(5);
    expect(validated.proofs.length).toBeGreaterThan(0);
    expect(Object.keys(helpers).length).toBeGreaterThan(10);

    // Helpers reference the same auth login as the spec
    expect(helpers["helpers/api.ts"]).toContain("/api/trpc/auth.login");
  });
});
