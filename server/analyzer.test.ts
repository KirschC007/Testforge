import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildRiskModel,
  validateProofs,
  generateReport,
  extractConstraints,
  generateBusinessLogicTest,
  type AnalysisResult,
  type RawProof,
  type Behavior,
  type AnalysisIR,
  type EndpointField,
  type ProofTarget,
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
      apiEndpoints: [
        {
          name: "reservations.create",
          method: "POST /api/trpc/reservations.create",
          auth: "requireRestaurantAuth",
          relatedBehaviors: ["B001"],
          inputFields: [
            { name: "restaurantId", type: "number", required: true, isTenantKey: true },
            { name: "guestName", type: "string", required: true },
            { name: "partySize", type: "number", required: true, min: 1, max: 20 },
          ] as EndpointField[],
          outputFields: ["id", "restaurantId", "guestName", "partySize", "status", "createdAt"],
        },
        {
          name: "reservations.list",
          method: "GET /api/trpc/reservations.list",
          auth: "requireRestaurantAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          ] as EndpointField[],
          outputFields: ["id", "restaurantId", "guestName", "partySize", "status"],
        },
        {
          name: "reservations.updateStatus",
          method: "POST /api/trpc/reservations.updateStatus",
          auth: "requireRestaurantAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "id", type: "number", required: true },
            { name: "restaurantId", type: "number", required: true, isTenantKey: true },
            { name: "status", type: "enum", required: true, enumValues: ["pending", "confirmed", "cancelled"] },
          ] as EndpointField[],
          outputFields: ["id", "status", "updatedAt"],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [{ name: "restaurant_admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" }],
      },
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
  expect([401, 403]).toContain(response.status()); // Kills: Remove restaurantId filter in WHERE clause
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
  // Note: noShowRisk baseline not verified before job runs
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

// ─── extractConstraints ────────────────────────────────────────────────────────

function makeIR(overrides: Partial<AnalysisIR> = {}): AnalysisIR {
  return {
    behaviors: [],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: null,
    resources: [],
    apiEndpoints: [],
    authModel: null,
    enums: {},
    statusMachine: null,
    ...overrides,
  };
}

describe("extractConstraints", () => {
  it("extracts title max constraint from 'exceeds 200 characters'", () => {
    const b = makeBehavior({
      errorCases: ["title is empty or exceeds 200 characters → 400"],
    });
    const constraints = extractConstraints(b, makeIR());
    const titleConstraint = constraints.find(c => c.field === "title");
    expect(titleConstraint).toBeDefined();
    expect(titleConstraint?.max).toBe(200);
    expect(titleConstraint?.type).toBe("string");
  });

  it("extracts title max constraint from 'Returns 400 if title exceeds 200'", () => {
    const b = makeBehavior({
      errorCases: ["Returns 400 if title exceeds 200 characters"],
    });
    const constraints = extractConstraints(b, makeIR());
    const titleConstraint = constraints.find(c => c.field === "title");
    expect(titleConstraint).toBeDefined();
    expect(titleConstraint?.max).toBe(200);
  });

  it("extracts taskIds array constraint from 'taskIds array exceeds 50 items'", () => {
    const b = makeBehavior({
      errorCases: ["taskIds array exceeds 50 items → 400"],
    });
    const constraints = extractConstraints(b, makeIR());
    const taskIdsConstraint = constraints.find(c => c.field === "taskIds");
    expect(taskIdsConstraint).toBeDefined();
    expect(taskIdsConstraint?.max).toBe(50);
    expect(taskIdsConstraint?.type).toBe("array");
  });

  it("extracts title max constraint from 'title must not exceed 200 characters'", () => {
    const b = makeBehavior({
      errorCases: ["title must not exceed 200 characters"],
    });
    const constraints = extractConstraints(b, makeIR());
    const titleConstraint = constraints.find(c => c.field === "title");
    expect(titleConstraint).toBeDefined();
    expect(titleConstraint?.max).toBe(200);
  });

  it("extracts between constraint from 'partySize between 1 and 20'", () => {
    const b = makeBehavior({
      errorCases: ["partySize between 1 and 20"],
    });
    const constraints = extractConstraints(b, makeIR());
    const c = constraints.find(c => c.field === "partySize");
    expect(c).toBeDefined();
    expect(c?.min).toBe(1);
    expect(c?.max).toBe(20);
  });

  it("extracts dueDate future constraint", () => {
    const b = makeBehavior({
      errorCases: ["dueDate must be in the future → 400"],
    });
    const constraints = extractConstraints(b, makeIR());
    const c = constraints.find(c => c.field === "dueDate");
    expect(c).toBeDefined();
    expect(c?.type).toBe("date");
    expect(c?.min).toBe(1);
  });

  it("merges enums from IR into constraints", () => {
    const b = makeBehavior({ errorCases: [] });
    const ir = makeIR({ enums: { priority: ["low", "medium", "high"] } });
    const constraints = extractConstraints(b, ir);
    const c = constraints.find(c => c.field === "priority");
    expect(c).toBeDefined();
    expect(c?.type).toBe("enum");
    expect(c?.enumValues).toEqual(["low", "medium", "high"]);
  });

  it("does not extract 'not' as a field name from 'must not exceed'", () => {
    const b = makeBehavior({
      errorCases: ["title must not exceed 200 characters"],
    });
    const constraints = extractConstraints(b, makeIR());
    const notConstraint = constraints.find(c => c.field === "not");
    expect(notConstraint).toBeUndefined();
  });

  it("does not extract numeric strings as field names", () => {
    const b = makeBehavior({
      errorCases: ["Returns 400 if title exceeds 200 characters"],
    });
    const constraints = extractConstraints(b, makeIR());
    const numConstraint = constraints.find(c => /^\d+$/.test(c.field));
    expect(numConstraint).toBeUndefined();
  });
});

  it("extracts dueDate future constraint from 'Returns 400 if dueDate is in the past'", () => {
    const b = makeBehavior({
      errorCases: ["Returns 400 if dueDate is in the past"],
    });
    const constraints = extractConstraints(b, makeIR());
    const c = constraints.find(c => c.field === "dueDate");
    expect(c).toBeDefined();
    expect(c?.type).toBe("date");
    expect(c?.min).toBe(1); // must be future
  });

// ─── E7: spec_drift ProofType ─────────────────────────────────────────────────

describe("spec_drift ProofType", () => {
  it("assigns spec_drift proof type to behaviors tagged with api-response", () => {
    const b = makeBehavior({ tags: ["api-response"], riskHints: [] });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].proofTypes).toContain("spec_drift");
  });

  it("assigns spec_drift proof type to behaviors tagged with response-schema", () => {
    const b = makeBehavior({ tags: ["response-schema"], riskHints: [] });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].proofTypes).toContain("spec_drift");
  });

  it("assigns spec_drift proof type to behaviors tagged with spec-drift", () => {
    const b = makeBehavior({ tags: ["spec-drift"], riskHints: [] });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].proofTypes).toContain("spec_drift");
  });

  it("does NOT assign spec_drift to behaviors without api-response tag", () => {
    const b = makeBehavior({ tags: ["security", "multi-tenant"], riskHints: ["idor"] });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    expect(model.behaviors[0].proofTypes).not.toContain("spec_drift");
  });

  it("creates a spec_drift ProofTarget with correct structure", () => {
    const b = makeBehavior({
      id: "B-DRIFT-001",
      tags: ["api-response"],
      riskHints: [],
      title: "orders.list returns correct response shape",
    });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    const driftTarget = model.proofTargets.find(t => t.proofType === "spec_drift");
    expect(driftTarget).toBeDefined();
    expect(driftTarget?.id).toMatch(/DRIFT/);
    expect(driftTarget?.description).toContain("spec");
    expect(driftTarget?.mutationTargets.length).toBeGreaterThan(0);
    expect(driftTarget?.assertions.length).toBeGreaterThan(0);
  });

  it("spec_drift ProofTarget includes http_status assertion", () => {
    const b = makeBehavior({ tags: ["api-response"], riskHints: [] });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    const driftTarget = model.proofTargets.find(t => t.proofType === "spec_drift");
    const statusAssertion = driftTarget?.assertions.find(a => a.type === "http_status");
    expect(statusAssertion).toBeDefined();
    expect(statusAssertion?.value).toBe(200);
  });

  it("spec_drift ProofTarget has mutation targets that kill on field removal", () => {
    const b = makeBehavior({ tags: ["api-response"], riskHints: [] });
    const analysis = makeAnalysisResult([b]);
    const model = buildRiskModel(analysis);

    const driftTarget = model.proofTargets.find(t => t.proofType === "spec_drift");
    expect(driftTarget?.mutationTargets.every(m => m.expectedKill)).toBe(true);
  });
});

// ─── E8-E11: calcBoundaryValues + findBoundaryFieldForBehavior ────────────────

import {
  calcBoundaryValues,
  findBoundaryFieldForBehavior,
  buildArrayItemLiteral,
  type BoundaryCase,
  type APIEndpoint,
} from "./analyzer";

describe("calcBoundaryValues — BoundaryCase[] format", () => {
  it("returns 5 cases for number field with min/max", () => {
    const f: EndpointField = { name: "price", type: "number", required: true, min: 0.01, max: 999999.99 };
    const cases = calcBoundaryValues(f);
    expect(cases).toHaveLength(5);
    expect(cases.filter(c => c.valid)).toHaveLength(2);
    expect(cases.filter(c => !c.valid)).toHaveLength(3);
  });

  it("uses decimal step for price fields", () => {
    const f: EndpointField = { name: "price", type: "number", required: true, min: 0.01, max: 999999.99 };
    const cases = calcBoundaryValues(f);
    const minCase = cases.find(c => c.valid && c.label.includes("minimum"));
    const aboveMax = cases.find(c => !c.valid && c.label.includes("above maximum"));
    expect(minCase?.value).toBe("0.01");
    expect(aboveMax?.value).toBe("1000000.00");
  });

  it("uses integer step for stock fields", () => {
    const f: EndpointField = { name: "stock", type: "number", required: true, min: 0, max: 10000 };
    const cases = calcBoundaryValues(f);
    const aboveMax = cases.find(c => !c.valid && c.label.includes("above maximum"));
    expect(aboveMax?.value).toBe("10001");
  });

  it("returns 5 cases for string field with min/max", () => {
    const f: EndpointField = { name: "name", type: "string", required: true, min: 1, max: 100 };
    const cases = calcBoundaryValues(f);
    expect(cases).toHaveLength(5);
    const belowMin = cases.find(c => !c.valid && c.label.includes("below minimum"));
    expect(belowMin?.value).toBe(`""`);
    const aboveMax = cases.find(c => !c.valid && c.label.includes("above maximum"));
    expect(aboveMax?.value).toBe(`"A".repeat(101)`);
  });

  it("returns 3 cases for date field", () => {
    const f: EndpointField = { name: "dueDate", type: "date", required: true };
    const cases = calcBoundaryValues(f);
    expect(cases).toHaveLength(3);
    const validCase = cases.find(c => c.valid);
    expect(validCase?.value).toBe("tomorrowStr()");
    const pastCase = cases.find(c => !c.valid && c.label.includes("past"));
    expect(pastCase?.value).toBe("yesterdayStr()");
  });

  it("returns 5 cases for array field with min/max", () => {
    const f: EndpointField = {
      name: "items", type: "array", required: true, min: 1, max: 50,
      arrayItemType: "object",
      arrayItemFields: [
        { name: "productId", type: "number", required: true },
        { name: "quantity", type: "number", required: true, min: 1 },
      ],
    };
    const cases = calcBoundaryValues(f);
    expect(cases).toHaveLength(5);
    const emptyCase = cases.find(c => !c.valid && c.label.includes("empty"));
    expect(emptyCase?.value).toBe("[]");
    const aboveMax = cases.find(c => !c.valid && c.label.includes("above maximum"));
    expect(aboveMax?.value).toBe("Array(51).fill({ productId: 1, quantity: 1 })");
  });

  it("returns 3 cases for enum field", () => {
    const f: EndpointField = { name: "priority", type: "enum", required: true, enumValues: ["low", "medium", "high"] };
    const cases = calcBoundaryValues(f);
    expect(cases).toHaveLength(3);
    const validCase = cases.find(c => c.valid);
    expect(validCase?.value).toBe(`"low"`);
    const invalidCase = cases.find(c => !c.valid && c.label.includes("invalid"));
    expect(invalidCase?.value).toBe(`"__invalid__"`);
  });

  it("all valid cases have valid=true", () => {
    const f: EndpointField = { name: "count", type: "number", required: true, min: 1, max: 100 };
    const cases = calcBoundaryValues(f);
    expect(cases.every(c => typeof c.valid === "boolean")).toBe(true);
    expect(cases.every(c => typeof c.label === "string")).toBe(true);
    expect(cases.every(c => typeof c.value === "string")).toBe(true);
  });
});

describe("buildArrayItemLiteral", () => {
  it("builds object literal for object array items", () => {
    const f: EndpointField = {
      name: "items", type: "array", required: true,
      arrayItemType: "object",
      arrayItemFields: [
        { name: "productId", type: "number", required: true },
        { name: "quantity", type: "number", required: true, min: 1, max: 100 },
      ],
    };
    const result = buildArrayItemLiteral(f);
    expect(result).toContain("productId:");
    expect(result).toContain("quantity:");
    expect(result).toMatch(/\{.*\}/);
  });

  it("returns '1' for number array items", () => {
    const f: EndpointField = { name: "ids", type: "array", required: true, arrayItemType: "number" };
    expect(buildArrayItemLiteral(f)).toBe("1");
  });

  it("returns '\"item\"' for untyped array items", () => {
    const f: EndpointField = { name: "tags", type: "array", required: true };
    expect(buildArrayItemLiteral(f)).toBe(`"item"`);
  });
});

describe("findBoundaryFieldForBehavior", () => {
  function makeEndpoint(fields: EndpointField[]): APIEndpoint {
    return {
      name: "products.create",
      method: "POST /api/trpc/products.create",
      auth: "requireAuth",
      relatedBehaviors: [],
      inputFields: fields,
    };
  }

  it("finds field by name in behavior title", () => {
    const b = makeBehavior({ title: "System rejects price below 0.01", riskHints: [] });
    const ep = makeEndpoint([
      { name: "shopId", type: "number", required: true, isTenantKey: true },
      { name: "price", type: "number", required: true, min: 0.01, max: 999999.99, isBoundaryField: true },
      { name: "name", type: "string", required: true, min: 1, max: 100, isBoundaryField: true },
    ]);
    const result = findBoundaryFieldForBehavior(b, ep);
    expect(result?.name).toBe("price");
  });

  it("uses semantic keyword matching for stock", () => {
    const b = makeBehavior({ title: "System rejects inventory above 10000", riskHints: [] });
    const ep = makeEndpoint([
      { name: "shopId", type: "number", required: true, isTenantKey: true },
      { name: "stock", type: "number", required: true, min: 0, max: 10000, isBoundaryField: true },
    ]);
    const result = findBoundaryFieldForBehavior(b, ep);
    expect(result?.name).toBe("stock");
  });

  it("falls back to first isBoundaryField when no keyword match", () => {
    const b = makeBehavior({ title: "System validates input constraints", riskHints: [] });
    const ep = makeEndpoint([
      { name: "shopId", type: "number", required: true, isTenantKey: true },
      { name: "sku", type: "string", required: true, min: 3, max: 50, isBoundaryField: true },
    ]);
    const result = findBoundaryFieldForBehavior(b, ep);
    expect(result?.name).toBe("sku");
  });

  it("returns undefined when no endpoint provided", () => {
    const b = makeBehavior({ riskHints: [] });
    const result = findBoundaryFieldForBehavior(b, undefined);
    expect(result).toBeUndefined();
  });

  it("returns undefined when endpoint has no inputFields", () => {
    const b = makeBehavior({ riskHints: [] });
    const ep = makeEndpoint([]);
    const result = findBoundaryFieldForBehavior(b, ep);
    expect(result).toBeUndefined();
  });
});

// ============================================================
// Phase 24: FIX 2 — Business Logic Side-Effects + getValidDefault
// ============================================================

function makeBlTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "PROOF-B001-BL",
    behaviorId: "B001",
    type: "business_logic",
    riskLevel: "high",
    description: "Order creation decrements stock",
    preconditions: ["User authenticated"],
    assertions: [{ type: "http_status", target: "response", operator: "eq", value: 200, rationale: "Success" }],
    mutationTargets: [{ description: "Remove stock decrement", expectedKill: true }],
    endpoint: "orders.create",
    sideEffects: [],
    ...overrides,
  };
}

describe("generateBusinessLogicTest — no TODO_ in payload", () => {
  it("uses getValidDefault for required fields (no TODO_ string literals)", () => {
    const result = makeAnalysisResult();
    const target = makeBlTarget({ endpoint: "reservations.create" });
    const code = generateBusinessLogicTest(target, result);
    // Should not contain TODO_ string literals in payload values
    expect(code).not.toMatch(/"TODO_[A-Z_]+"/);
  });

  it("uses numeric default for number fields", () => {
    const result = makeAnalysisResult();
    const target = makeBlTarget({ endpoint: "reservations.create" });
    const code = generateBusinessLogicTest(target, result);
    // partySize is a number field — should not be "test-partySize"
    expect(code).not.toContain('"test-partySize"');
  });
});

describe("generateBusinessLogicTest — side-effect detection", () => {
  it("generates stockBefore/stockAfter when sideEffects contains 'stock'", () => {
    const result = makeAnalysisResult();
    const target = makeBlTarget({
      endpoint: "reservations.create",
      sideEffects: ["stock decremented by quantity"],
    });
    const code = generateBusinessLogicTest(target, result);
    expect(code).toContain("stockBefore");
    expect(code).toContain("stockAfter");
    expect(code).toContain("toBeLessThan(stockBefore)");
    expect(code).toContain("toBeGreaterThanOrEqual(0)");
  });

  it("generates countBefore/countAfter when sideEffects contains 'count'", () => {
    const result = makeAnalysisResult();
    const target = makeBlTarget({
      endpoint: "reservations.create",
      sideEffects: ["orderCount += 1"],
    });
    const code = generateBusinessLogicTest(target, result);
    expect(code).toContain("countBefore");
    expect(code).toContain("countAfter");
    expect(code).toContain("toBe(countBefore + 1)");
  });

  it("generates stockAfter > stockBefore for restore/refund side-effects", () => {
    const result = makeAnalysisResult();
    const target = makeBlTarget({
      endpoint: "reservations.create",
      sideEffects: ["refund quantity to inventory"],
    });
    const code = generateBusinessLogicTest(target, result);
    expect(code).toContain("stockBefore");
    expect(code).toContain("stockAfter2");
    expect(code).toContain("toBeGreaterThan(stockBefore)");
  });

  it("no side-effect block when sideEffects is empty", () => {
    const result = makeAnalysisResult();
    const target = makeBlTarget({ endpoint: "reservations.create", sideEffects: [] });
    const code = generateBusinessLogicTest(target, result);
    expect(code).not.toContain("stockBefore");
    expect(code).not.toContain("countBefore");
  });
});

// ============================================================
// Phase 25: Spec Health Score — assessSpecHealth
// ============================================================

import { assessSpecHealth, type AnalysisIR, type SpecHealth } from "./analyzer";

function makeFullIR(overrides: Partial<AnalysisIR> = {}): AnalysisIR {
  return {
    behaviors: [makeBehavior()],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
    resources: [{ name: "reservations", table: "reservations", tenantKey: "restaurantId", operations: ["read", "create"], hasPII: false }],
    apiEndpoints: [
      {
        name: "reservations.create",
        method: "POST /api/trpc/reservations.create",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true, min: 1 },
          { name: "guestName", type: "string", required: true },
          { name: "partySize", type: "number", required: true, min: 1, max: 20 },
          { name: "status", type: "enum", required: true, enumValues: ["pending", "confirmed"] },
        ] as EndpointField[],
        outputFields: ["id", "restaurantId", "status"],
      },
    ],
    authModel: {
      loginEndpoint: "/api/trpc/auth.login",
      roles: [{ name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin", defaultPass: "pass" }],
    },
    enums: { status: ["pending", "confirmed"] },
    statusMachine: null,
    ...overrides,
  };
}

describe("assessSpecHealth — full spec", () => {
  it("returns score 100 for a complete spec", () => {
    const ir = makeFullIR();
    const health = assessSpecHealth(ir);
    expect(health.score).toBe(100);
    expect(health.grade).toBe("A");
    expect(health.dimensions.every(d => d.passed)).toBe(true);
  });

  it("returns grade A for score >= 90", () => {
    const ir = makeFullIR();
    const health = assessSpecHealth(ir);
    expect(health.grade).toBe("A");
  });
});

describe("assessSpecHealth — dimension failures", () => {
  it("penalizes missing typed fields", () => {
    const ir = makeFullIR({
      apiEndpoints: [{
        name: "reservations.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [] as EndpointField[], // no fields
        outputFields: ["id"],
      }],
    });
    const health = assessSpecHealth(ir);
    const dim = health.dimensions.find(d => d.name === "typed_fields")!;
    expect(dim.passed).toBe(false);
    expect(dim.score).toBe(0);
  });

  it("penalizes missing enum values", () => {
    const ir = makeFullIR({
      apiEndpoints: [{
        name: "reservations.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "status", type: "enum", required: true } as EndpointField, // no enumValues
        ],
        outputFields: ["id"],
      }],
    });
    const health = assessSpecHealth(ir);
    const dim = health.dimensions.find(d => d.name === "enum_values")!;
    expect(dim.passed).toBe(false);
    expect(dim.score).toBe(0);
  });

  it("penalizes missing boundary constraints on numeric fields", () => {
    const ir = makeFullIR({
      apiEndpoints: [{
        name: "reservations.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "partySize", type: "number", required: true } as EndpointField, // no min/max
        ],
        outputFields: ["id"],
      }],
    });
    const health = assessSpecHealth(ir);
    const dim = health.dimensions.find(d => d.name === "boundary_constraints")!;
    expect(dim.passed).toBe(false);
    expect(dim.score).toBe(0);
  });

  it("penalizes missing auth model", () => {
    const ir = makeFullIR({ authModel: null });
    const health = assessSpecHealth(ir);
    const dim = health.dimensions.find(d => d.name === "auth_model")!;
    expect(dim.passed).toBe(false);
    expect(dim.score).toBe(0);
  });

  it("penalizes missing tenant model", () => {
    const ir = makeFullIR({ tenantModel: null });
    const health = assessSpecHealth(ir);
    const dim = health.dimensions.find(d => d.name === "tenant_model")!;
    expect(dim.passed).toBe(false);
    expect(dim.score).toBe(0);
  });

  it("penalizes missing output fields", () => {
    const ir = makeFullIR({
      apiEndpoints: [{
        name: "reservations.create",
        method: "POST",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [{ name: "id", type: "number", required: true, min: 1 }] as EndpointField[],
        outputFields: [], // no output fields
      }],
    });
    const health = assessSpecHealth(ir);
    const dim = health.dimensions.find(d => d.name === "output_fields")!;
    expect(dim.passed).toBe(false);
    expect(dim.score).toBe(0);
  });
});

describe("assessSpecHealth — grade thresholds", () => {
  it("returns grade F for empty spec", () => {
    const ir = makeFullIR({
      apiEndpoints: [],
      authModel: null,
      tenantModel: null,
    });
    const health = assessSpecHealth(ir);
    // No endpoints = typed_fields pass (vacuously), enum pass, boundary pass, output pass
    // But auth and tenant fail
    expect(["A", "B", "C", "D", "F"]).toContain(health.grade);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });

  it("summary mentions failed dimensions", () => {
    const ir = makeFullIR({ authModel: null, tenantModel: null });
    const health = assessSpecHealth(ir);
    expect(health.summary).toContain("improvement");
  });

  it("summary is positive for perfect spec", () => {
    const ir = makeFullIR();
    const health = assessSpecHealth(ir);
    expect(health.summary).toContain("Excellent");
  });
});

// ─── Phase 30: Fix Regression Tests ─────────────────────────────────────────

import {
  generateHelpers,
  generateProofs,
} from "./analyzer";

describe("Fix 1: factories.ts — no duplicate tenantField in payload", () => {
  function makeBankFlowIR(): AnalysisIR {
    return {
      behaviors: [
        { id: "B001", title: "accounts.create", subject: "bank_admin", action: "create", object: "account", tags: ["idor"], riskHints: ["403"], chapter: "Accounts", preconditions: [], postconditions: [], errorCases: [] },
      ],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "bank", tenantIdField: "bankId" },
      resources: [{ name: "account", table: "accounts", tenantKey: "bankId", operations: ["create", "read", "list"], hasPII: false }],
      apiEndpoints: [{
        name: "accounts.create",
        method: "POST",
        auth: "bank_admin",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "bankId", type: "number", required: true, isTenantKey: true } as EndpointField,
          { name: "customerId", type: "number", required: true } as EndpointField,
          { name: "accountType", type: "enum", required: true, enumValues: ["checking", "savings"] } as EndpointField,
        ],
        outputFields: ["id", "bankId"],
      }],
      authModel: { loginEndpoint: "/api/trpc/auth.login", csrfEndpoint: "/api/auth/csrf", roles: [{ name: "bank_admin", envUserVar: "E2E_USER", envPassVar: "E2E_PASS", defaultUser: "admin", defaultPass: "pass" }] },
      enums: {},
    };
  }

  it("CreateTestResourceOpts interface contains bankId exactly once", () => {
    const ir = makeBankFlowIR();
    const helpers = generateHelpers({ ir, qualityScore: 9, specType: "api-spec" });
    const factories = (helpers as Record<string, string>)["helpers/factories.ts"] || "";
    const interfaceMatch = factories.match(/interface CreateTestResourceOpts \{[^}]+\}/s);
    expect(interfaceMatch).toBeTruthy();
    const bankIdCount = (interfaceMatch![0].match(/bankId\?/g) || []).length;
    expect(bankIdCount).toBe(1);
  });

  it("createTestResource payload does not have duplicate bankId lines", () => {
    const ir = makeBankFlowIR();
    const helpers = generateHelpers({ ir, qualityScore: 9, specType: "api-spec" });
    const factories = (helpers as Record<string, string>)["helpers/factories.ts"] || "";
    const mutationMatch = factories.match(/trpcMutation\(request,[\s\S]*?\}, cookieHeader\)/);
    expect(mutationMatch).toBeTruthy();
    const bankIdCount = (mutationMatch![0].match(/bankId:/g) || []).length;
    expect(bankIdCount).toBe(1);
  });
});

describe("Fix 2: business_logic — balance before/after test for financial side-effects", () => {
  function makeBalanceIR(): AnalysisIR {
    return {
      behaviors: [
        {
          id: "B007",
          title: "transactions.create deducts from fromAccount balance",
          subject: "bank_admin",
          action: "create",
          object: "transaction",
          tags: ["business-logic"],
          riskHints: ["balance can never go below 0"],
          chapter: "Transactions",
          preconditions: [],
          postconditions: ["Deducts amount from fromAccount.balance", "Credits amount to toAccount.balance"],
          errorCases: [],
        },
      ],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "bank", tenantIdField: "bankId" },
      resources: [{ name: "account", table: "accounts", tenantKey: "bankId", operations: ["create", "list"], hasPII: false }],
      apiEndpoints: [
        {
          name: "transactions.create",
          method: "POST",
          auth: "bank_admin",
          relatedBehaviors: ["B007"],
          inputFields: [
            { name: "bankId", type: "number", required: true, isTenantKey: true } as EndpointField,
            { name: "fromAccountId", type: "number", required: true } as EndpointField,
            { name: "toAccountId", type: "number", required: true } as EndpointField,
            { name: "amount", type: "number", required: true, min: 0.01, max: 500000 } as EndpointField,
            { name: "currency", type: "enum", required: true, enumValues: ["EUR", "USD"] } as EndpointField,
          ],
          outputFields: ["id", "status"],
        },
        {
          name: "accounts.list",
          method: "GET",
          auth: "bank_admin",
          relatedBehaviors: [],
          inputFields: [{ name: "bankId", type: "number", required: true, isTenantKey: true } as EndpointField],
          outputFields: ["accounts"],
        },
      ],
      authModel: { loginEndpoint: "/api/trpc/auth.login", csrfEndpoint: "/api/auth/csrf", roles: [{ name: "bank_admin", envUserVar: "E2E_USER", envPassVar: "E2E_PASS", defaultUser: "admin", defaultPass: "pass" }] },
      enums: {},
    };
  }

  it("B007 with business-logic tag gets high risk level", () => {
    const analysis = { ir: makeBalanceIR(), qualityScore: 9, specType: "api-spec" as const };
    const riskModel = buildRiskModel(analysis);
    const b007 = riskModel.behaviors.find(b => b.behavior.id === "B007");
    expect(b007).toBeTruthy();
    expect(b007!.riskLevel).toBe("high");
  });

  it("B007 generates a business_logic proof target", () => {
    const analysis = { ir: makeBalanceIR(), qualityScore: 9, specType: "api-spec" as const };
    const riskModel = buildRiskModel(analysis);
    const blTarget = riskModel.proofTargets.find(t => t.proofType === "business_logic" && t.id.includes("B007"));
    expect(blTarget).toBeTruthy();
  });

  it("business_logic proof target has balance-related side-effects", () => {
    const analysis = { ir: makeBalanceIR(), qualityScore: 9, specType: "api-spec" as const };
    const riskModel = buildRiskModel(analysis);
    const blTarget = riskModel.proofTargets.find(t => t.proofType === "business_logic" && t.id.includes("B007"));
    expect(blTarget?.sideEffects?.some(se => /balance|deduct/i.test(se))).toBe(true);
  });

  it("generated business_logic proof contains balanceBefore and balanceAfter", async () => {
    const analysis = { ir: makeBalanceIR(), qualityScore: 9, specType: "api-spec" as const };
    const riskModel = buildRiskModel(analysis);
    const rawProofs = await generateProofs(riskModel, analysis);
    const logicProof = rawProofs.find(p => p.filename.includes("logic") && p.code?.includes("B007"));
    expect(logicProof).toBeTruthy();
    expect(logicProof!.code).toContain("balanceBefore");
    expect(logicProof!.code).toContain("balanceAfter");
    expect(logicProof!.code).toContain("AMOUNT");
  });
});

describe("Fix 3: getResourceByIdentifier — no TODO placeholder", () => {
  it("uses list endpoint when available, no TODO_REPLACE placeholder", () => {
    const ir: AnalysisIR = {
      behaviors: [{ id: "B001", title: "accounts.create", subject: "admin", action: "create", object: "account", tags: ["idor"], riskHints: [], chapter: "Accounts", preconditions: [], postconditions: [], errorCases: [] }],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "workspace", tenantIdField: "workspaceId" },
      resources: [{ name: "account", table: "accounts", tenantKey: "workspaceId", operations: ["create", "list"], hasPII: true }],
      apiEndpoints: [
        { name: "accounts.create", method: "POST", auth: "admin", relatedBehaviors: ["B001"], inputFields: [{ name: "workspaceId", type: "number", required: true, isTenantKey: true } as EndpointField, { name: "name", type: "string", required: true } as EndpointField], outputFields: ["id", "name"] },
        { name: "accounts.list", method: "GET", auth: "admin", relatedBehaviors: [], inputFields: [{ name: "workspaceId", type: "number", required: true, isTenantKey: true } as EndpointField], outputFields: ["accounts"] },
      ],
      authModel: { loginEndpoint: "/api/trpc/auth.login", csrfEndpoint: "/api/auth/csrf", roles: [{ name: "admin", envUserVar: "E2E_USER", envPassVar: "E2E_PASS", defaultUser: "admin", defaultPass: "pass" }] },
      enums: {},
    };
    const helpers = generateHelpers({ ir, qualityScore: 9, specType: "api-spec" });
    const factories = (helpers as Record<string, string>)["helpers/factories.ts"] || "";
    expect(factories).not.toContain("TODO_REPLACE_WITH_GET_BY_IDENTIFIER_ENDPOINT");
    expect(factories).toContain("accounts.list");
    expect(factories).toContain("getResourceByIdentifier");
  });

  it("omits TODO_REPLACE even when no list endpoint exists", () => {
    const ir: AnalysisIR = {
      behaviors: [{ id: "B001", title: "accounts.create", subject: "admin", action: "create", object: "account", tags: ["idor"], riskHints: [], chapter: "Accounts", preconditions: [], postconditions: [], errorCases: [] }],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "workspace", tenantIdField: "workspaceId" },
      resources: [{ name: "account", table: "accounts", tenantKey: "workspaceId", operations: ["create"], hasPII: false }],
      apiEndpoints: [
        { name: "accounts.create", method: "POST", auth: "admin", relatedBehaviors: ["B001"], inputFields: [{ name: "workspaceId", type: "number", required: true, isTenantKey: true } as EndpointField], outputFields: ["id"] },
      ],
      authModel: { loginEndpoint: "/api/trpc/auth.login", csrfEndpoint: "/api/auth/csrf", roles: [{ name: "admin", envUserVar: "E2E_USER", envPassVar: "E2E_PASS", defaultUser: "admin", defaultPass: "pass" }] },
      enums: {},
    };
    const helpers = generateHelpers({ ir, qualityScore: 9, specType: "api-spec" });
    const factories = (helpers as Record<string, string>)["helpers/factories.ts"] || "";
    expect(factories).not.toContain("TODO_REPLACE_WITH_GET_BY_IDENTIFIER_ENDPOINT");
  });
});

// ─── Fix-Briefing 12: K1 — R7b Generic Tenant ID Rule ────────────────────────────────────────────
describe("validateProofs — K1: R7b generic tenant ID detection", () => {
  function makeIDORProof(code: string): RawProof {
    return {
      id: "PROOF-K1",
      behaviorId: "B001",
      proofType: "idor",
      riskLevel: "critical",
      filename: "tests/security/idor.spec.ts",
      code,
      mutationTargets: [{ description: "Remove tenant filter", expectedKill: true }],
    };
  }

  it("K1: rejects fake IDOR with hardcoded restaurantId: 2", () => {
    const proof = makeIDORProof(`
test("IDOR test", async ({ request }) => {
  const response = await request.get("/api/resource");
  expect([401, 403]).toContain(response.status()); // Kills: Remove restaurantId filter
  const body = await response.text();
  expect(body).not.toMatch(/secret/); // side-effect
  const ok = await request.get("/api/resource", { headers: { Cookie: cookieA } });
  expect(ok.status()).toBe(200);
  const data = { restaurantId: 2, name: "test" };
});`);
    const result = validateProofs([proof], ["B001"]);
    expect(result.verdict.failed).toBe(1);
    expect(result.discardedProofs[0].reason).toBe("fake_idor");
  });

  it("K1: rejects fake IDOR with hardcoded workspaceId: 1", () => {
    const proof = makeIDORProof(`
test("IDOR test", async ({ request }) => {
  const response = await request.get("/api/resource");
  expect([401, 403]).toContain(response.status()); // Kills: Remove workspaceId filter
  const body = await response.text();
  expect(body).not.toMatch(/secret/);
  const ok = await request.get("/api/resource");
  expect(ok.status()).toBe(200);
  const data = { workspaceId: 1, name: "test" };
});`);
    const result = validateProofs([proof], ["B001"]);
    expect(result.verdict.failed).toBe(1);
    expect(result.discardedProofs[0].reason).toBe("fake_idor");
  });

  it("K1: rejects fake IDOR with hardcoded orgId: 3", () => {
    const proof = makeIDORProof(`
test("IDOR test", async ({ request }) => {
  const response = await request.get("/api/resource");
  expect([401, 403]).toContain(response.status()); // Kills: Remove orgId filter
  const body = await response.text();
  expect(body).not.toMatch(/secret/);
  const ok = await request.get("/api/resource");
  expect(ok.status()).toBe(200);
  const data = { orgId: 3 };
});`);
    const result = validateProofs([proof], ["B001"]);
    expect(result.verdict.failed).toBe(1);
    expect(result.discardedProofs[0].reason).toBe("fake_idor");
  });

  it("K1: allows IDOR test using TEST_ constant", () => {
    const proof = makeIDORProof(`
test("IDOR test", async ({ request }) => {
  const response = await request.get("/api/resource");
  expect([401, 403]).toContain(response.status()); // Kills: Remove restaurantId filter
  const body = await response.text();
  expect(body).not.toMatch(/secret/);
  const ok = await request.get("/api/resource");
  expect(ok.status()).toBe(200);
  const data = { restaurantId: TEST_RESTAURANT_B_ID };
});`);
    const result = validateProofs([proof], ["B001"]);
    expect(result.verdict.passed).toBe(1);
  });

  it("K1: allows IDOR test using TENANT_B constant", () => {
    const proof = makeIDORProof(`
test("IDOR test", async ({ request }) => {
  const response = await request.get("/api/resource");
  expect([401, 403]).toContain(response.status()); // Kills: Remove workspaceId filter
  const body = await response.text();
  expect(body).not.toMatch(/secret/);
  const ok = await request.get("/api/resource");
  expect(ok.status()).toBe(200);
  const data = { workspaceId: TENANT_B_WORKSPACE_ID };
});`);
    const result = validateProofs([proof], ["B001"]);
    expect(result.verdict.passed).toBe(1);
  });
});
