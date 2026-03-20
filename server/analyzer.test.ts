import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildRiskModel,
  validateProofs,
  generateReport,
  type AnalysisResult,
  type RawProof,
  type Behavior,
} from "./analyzer";

// ─── Test fixtures ─────────────────────────────────────────────────────────────

function makeBehavior(overrides: Partial<Behavior> = {}): Behavior {
  return {
    id: "B001",
    title: "System rejects cross-tenant booking access",
    subject: "System",
    action: "rejects",
    object: "cross-tenant booking access",
    preconditions: ["User authenticated as Tenant A", "Resource belongs to Tenant B"],
    postconditions: ["HTTP 403 returned", "No data from Tenant B exposed"],
    errorCases: [],
    tags: ["security", "multi-tenant"],
    riskHints: ["idor", "cross-tenant"],
    chapter: "Kap. 6",
    ...overrides,
  };
}

function makeAnalysisResult(behaviors: Behavior[] = [makeBehavior()]): AnalysisResult {
  return {
    ir: {
      behaviors,
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
      resources: [
        { name: "reservations", table: "reservations", tenantKey: "restaurantId", operations: ["read", "create", "update"], hasPII: true },
      ],
    },
    qualityScore: 8.5,
    specType: "saas-reservation",
  };
}

// ─── Schicht 2: Risk Model ─────────────────────────────────────────────────────

describe("buildRiskModel", () => {
  it("assigns critical risk to IDOR behaviors", () => {
    const analysis = makeAnalysisResult([makeBehavior({ riskHints: ["idor", "cross-tenant"] })]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors).toHaveLength(1);
    expect(model.behaviors[0].riskLevel).toBe("critical");
  });

  it("assigns idor proof type to IDOR behaviors", () => {
    const analysis = makeAnalysisResult([makeBehavior({ riskHints: ["idor"] })]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].proofTypes).toContain("idor");
  });

  it("assigns critical risk to CSRF behaviors", () => {
    const analysis = makeAnalysisResult([makeBehavior({ riskHints: ["csrf", "state-change"] })]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].riskLevel).toBe("critical");
    expect(model.behaviors[0].proofTypes).toContain("csrf");
  });

  it("assigns high risk to no-show risk scoring behaviors", () => {
    const analysis = makeAnalysisResult([makeBehavior({ riskHints: ["no-show", "risk-scoring"], tags: [] })]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].riskLevel).toBe("high");
    expect(model.behaviors[0].proofTypes).toContain("risk_scoring");
  });

  it("assigns low risk to behaviors with no risk hints", () => {
    const analysis = makeAnalysisResult([makeBehavior({ riskHints: [], tags: [] })]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].riskLevel).toBe("low");
  });

  it("generates proof targets only for priority 0 behaviors", () => {
    const critical = makeBehavior({ id: "B001", riskHints: ["idor"] });
    const low = makeBehavior({ id: "B002", riskHints: [], tags: [] });
    const analysis = makeAnalysisResult([critical, low]);
    const model = buildRiskModel(analysis);

    const targetIds = model.proofTargets.map(t => t.behaviorId);
    expect(targetIds).toContain("B001");
    expect(targetIds).not.toContain("B002");
  });

  it("counts IDOR vectors from resources", () => {
    const analysis = makeAnalysisResult();
    // resources has 1 resource with ["read", "create", "update"] → 2 IDOR-relevant ops
    const model = buildRiskModel(analysis);
    expect(model.idorVectors).toBe(2);
  });

  it("counts CSRF endpoints from behaviors", () => {
    const b1 = makeBehavior({ id: "B001", riskHints: ["csrf"] });
    const b2 = makeBehavior({ id: "B002", riskHints: ["csrf"] });
    const b3 = makeBehavior({ id: "B003", riskHints: [] });
    const analysis = makeAnalysisResult([b1, b2, b3]);
    const model = buildRiskModel(analysis);
    expect(model.csrfEndpoints).toBe(2);
  });
});

// ─── Schicht 4: False-Green Validator ─────────────────────────────────────────

function makeRawProof(overrides: Partial<RawProof> = {}): RawProof {
  return {
    id: "PROOF-B001-IDOR",
    behaviorId: "B001",
    proofType: "idor",
    riskLevel: "critical",
    filename: "tests/security/idor.spec.ts",
    code: `
test("IDOR test", async ({ request }) => {
  const response = await request.get("/api/resource", { headers: { Cookie: cookieA } });
  expect([401, 403]).toContain(response.status()); // Must reject cross-tenant access
  const body = await response.text();
  expect(body).not.toMatch(/IDOR Canary/); // side-effect check
  // positive control
  const ok = await request.get("/api/resource", { headers: { Cookie: cookieA } });
  expect(ok.status()).toBe(200);
});`,
    mutationTargets: [
      { description: "Remove restaurantId check in WHERE clause", expectedKill: true },
    ],
    ...overrides,
  };
}

describe("validateProofs — False-Green Detection", () => {
  it("accepts a well-formed IDOR proof", () => {
    const proof = makeRawProof();
    const result = validateProofs([proof], ["B001"]);

    expect(result.proofs).toHaveLength(1);
    expect(result.discardedProofs).toHaveLength(0);
    expect(result.verdict.score).toBeGreaterThan(0);
  });

  it("rejects proof with if-wrapper assertion pattern", () => {
    const proof = makeRawProof({
      code: `
test("weak test", async () => {
  const data = await getResult();
  if (data !== undefined) {
    expect(data.id).toBeTruthy();
  }
});`,
    });
    const result = validateProofs([proof], ["B001"]);

    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("conditional_assertion");
  });

  it("rejects proof with only existence assertions (toBeDefined/toBeTruthy)", () => {
    const proof = makeRawProof({
      code: `
test("existence only", async () => {
  const data = await getResult();
  expect(data).toBeDefined();
  expect(data.id).toBeTruthy();
});`,
    });
    const result = validateProofs([proof], ["B001"]);

    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("existence_only");
  });

  it("rejects proof with broad status code check (toBeGreaterThanOrEqual(400))", () => {
    const proof = makeRawProof({
      code: `
test("broad status", async () => {
  const r = await request.post("/api/thing");
  expect(r.status()).toBeGreaterThanOrEqual(400);
  expect(r.status()).not.toMatch(/pii/);
});`,
    });
    const result = validateProofs([proof], ["B001"]);

    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("broad_status_code");
  });

  it("rejects IDOR proof without side-effect check", () => {
    const proof = makeRawProof({
      code: `
test("idor no side effect", async () => {
  const r = await request.get("/api/resource");
  expect([401, 403]).toContain(r.status());
  // No body check, no DB check
});`,
    });
    const result = validateProofs([proof], ["B001"]);

    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("no_side_effect_check");
  });

  it("rejects IDOR proof without positive control", () => {
    const proof = makeRawProof({
      code: `
test("idor no positive control", async () => {
  const r = await request.get("/api/resource");
  expect([401, 403]).toContain(r.status());
  const body = await r.text();
  expect(body).not.toMatch(/secret/); // side-effect check present
  // Intentionally missing: no legitimate access verification
});`,
    });
    const result = validateProofs([proof], ["B001"]);

    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("no_positive_control");
  });

  it("rejects risk scoring proof without precondition verification", () => {
    const proof = makeRawProof({
      proofType: "risk_scoring",
      code: `
test("risk scoring no precondition", async () => {
  await triggerJob();
  const guest = await getGuest();
  // Note: noShowRisk not set to 0 before job, and no .toBe(0) precondition check
  expect(guest.noShowRisk).toBeGreaterThan(0);
});`,
    });
    const result = validateProofs([proof], ["B001"]);

    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("missing_precondition");
  });

  it("calculates correct coverage percentage", () => {
    const proof1 = makeRawProof({ id: "P1", behaviorId: "B001" });
    const proof2 = makeRawProof({ id: "P2", behaviorId: "B002" });
    const result = validateProofs([proof1, proof2], ["B001", "B002", "B003"]);

    // B001 and B002 covered, B003 not
    expect(result.coverage.coveredBehaviors).toBe(2);
    expect(result.coverage.totalBehaviors).toBe(3);
    expect(result.coverage.coveragePercent).toBe(67);
    expect(result.coverage.uncoveredIds).toContain("B003");
  });

  it("calculates verdict score as ratio of passed/total", () => {
    const good = makeRawProof({ id: "P1", behaviorId: "B001" });
    const bad = makeRawProof({
      id: "P2",
      behaviorId: "B002",
      code: `test("bad", async () => { expect(data).toBeDefined(); })`,
    });
    const result = validateProofs([good, bad], ["B001", "B002"]);

    expect(result.verdict.passed).toBe(1);
    expect(result.verdict.failed).toBe(1);
    expect(result.verdict.score).toBe(5.0); // 1/2 * 10
  });
});

// ─── Report Generator ─────────────────────────────────────────────────────────

describe("generateReport", () => {
  it("includes project name in report header", () => {
    const analysis = makeAnalysisResult();
    const model = buildRiskModel(analysis);
    const suite = validateProofs([], []);
    const report = generateReport(analysis, model, suite, "my-saas-project");

    expect(report).toContain("my-saas-project");
  });

  it("includes verdict score in report", () => {
    const analysis = makeAnalysisResult();
    const model = buildRiskModel(analysis);
    const proof = makeRawProof();
    const suite = validateProofs([proof], ["B001"]);
    const report = generateReport(analysis, model, suite, "test");

    expect(report).toContain("Verdict Score");
    expect(report).toMatch(/\d+\.\d+\/10/);
  });

  it("includes ambiguity gate section when ambiguities exist", () => {
    const analysis = makeAnalysisResult();
    analysis.ir.ambiguities = [{
      behaviorId: "B001",
      problem: "Unclear error code",
      question: "Should it be 401 or 403?",
      impact: "blocks_test",
    }];
    const model = buildRiskModel(analysis);
    const suite = validateProofs([], []);
    const report = generateReport(analysis, model, suite, "test");

    expect(report).toContain("Ambiguity Gate");
    expect(report).toContain("BLOCKS TEST");
    expect(report).toContain("Should it be 401 or 403?");
  });

  it("includes discarded proofs section when proofs are rejected", () => {
    const analysis = makeAnalysisResult();
    const model = buildRiskModel(analysis);
    const badProof = makeRawProof({
      code: `test("bad", async () => { expect(data).toBeDefined(); })`,
    });
    const suite = validateProofs([badProof], ["B001"]);
    const report = generateReport(analysis, model, suite, "test");

    expect(report).toContain("Discarded Proofs");
    expect(report).toContain("existence_only");
  });
});
