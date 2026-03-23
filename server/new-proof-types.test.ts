/**
 * Tests for the three new proof types:
 * - concurrency: race condition detection via Promise.all
 * - idempotency: duplicate request handling
 * - auth_matrix: role-based access control matrix
 */
import { describe, it, expect } from "vitest";
import {
  buildRiskModel,
  generateProofs,
  determineProofTypes,
  buildProofTarget,
  generateConcurrencyTest,
  generateIdempotencyTest,
  generateAuthMatrixTest,
  type AnalysisResult,
  type AnalysisIR,
  type Behavior,
  type EndpointField,
  type ProofTarget,
  type ScoredBehavior,
  type ProofType,
} from "./analyzer";

// ─── Test fixtures ─────────────────────────────────────────────────────────────

function makeBehavior(overrides: Partial<Behavior> = {}): Behavior {
  return {
    id: "B001",
    title: "Test behavior",
    subject: "user",
    action: "create",
    object: "resource",
    preconditions: [],
    postconditions: [],
    errorCases: [],
    tags: [],
    riskHints: [],
    chapter: "Test",
    ...overrides,
  };
}

function makeNewProofIR(): AnalysisIR {
  return {
    behaviors: [
      {
        id: "B010",
        title: "Reserve seat",
        subject: "user",
        action: "reserve",
        object: "seat",
        tags: ["concurrency", "race-condition"],
        riskHints: ["double-booking", "race-condition"],
        chapter: "Reservations",
        preconditions: ["seat is available"],
        postconditions: ["seat.status = reserved"],
        errorCases: ["seat already reserved"],
      },
      {
        id: "B011",
        title: "Create order",
        subject: "user",
        action: "create",
        object: "order",
        tags: ["idempotency", "duplicate"],
        riskHints: ["duplicate", "retry"],
        chapter: "Orders",
        preconditions: ["user authenticated"],
        postconditions: ["order created"],
        errorCases: ["duplicate order"],
      },
      {
        id: "B012",
        title: "Delete account",
        subject: "admin",
        action: "delete",
        object: "account",
        tags: ["auth-matrix", "rbac"],
        riskHints: ["permission", "authorization"],
        chapter: "Accounts",
        preconditions: ["admin role required"],
        postconditions: ["account deleted"],
        errorCases: ["unauthorized"],
      },
    ],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
    resources: [
      { name: "seat", table: "seats", tenantKey: "restaurantId", operations: ["reserve", "list"], hasPII: false },
      { name: "order", table: "orders", tenantKey: "restaurantId", operations: ["create", "list"], hasPII: false },
      { name: "account", table: "accounts", tenantKey: "restaurantId", operations: ["delete", "list"], hasPII: true },
    ],
    apiEndpoints: [
      {
        name: "seats.reserve",
        method: "POST /api/trpc/seats.reserve",
        auth: "requireAuth",
        relatedBehaviors: ["B010"],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true } as EndpointField,
          { name: "seatId", type: "number", required: true } as EndpointField,
        ],
        outputFields: ["id", "status"],
      },
      {
        name: "orders.create",
        method: "POST /api/trpc/orders.create",
        auth: "requireAuth",
        relatedBehaviors: ["B011"],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true } as EndpointField,
          { name: "items", type: "array", required: true } as EndpointField,
        ],
        outputFields: ["id", "status"],
      },
      {
        name: "accounts.delete",
        method: "DELETE /api/trpc/accounts.delete",
        auth: "requireAdminAuth",
        relatedBehaviors: ["B012"],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true } as EndpointField,
          { name: "accountId", type: "number", required: true } as EndpointField,
        ],
        outputFields: ["success"],
      },
    ],
    authModel: {
      loginEndpoint: "/api/trpc/auth.login",
      csrfEndpoint: "/api/auth/csrf",
      roles: [
        { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" },
        { name: "staff", envUserVar: "E2E_STAFF_USER", envPassVar: "E2E_STAFF_PASS", defaultUser: "test-staff", defaultPass: "TestPass2026x" },
      ],
    },
    enums: {},
    statusMachine: null,
  };
}

function makeScoredBehavior(b: Behavior, proofTypes: ProofType[]): ScoredBehavior {
  return {
    behavior: b,
    riskLevel: "high",
    proofTypes,
    priority: 0,
    rationale: "Test behavior",
  };
}

// ─── determineProofTypes: new proof type detection ────────────────────────────

describe("determineProofTypes — concurrency detection", () => {
  it("detects concurrency from 'race-condition' riskHint", () => {
    const b = makeBehavior({ tags: [], riskHints: ["race-condition"] });
    const types = determineProofTypes(b);
    expect(types).toContain("concurrency");
  });

  it("detects concurrency from 'double-booking' riskHint", () => {
    const b = makeBehavior({ tags: [], riskHints: ["double-booking"] });
    const types = determineProofTypes(b);
    expect(types).toContain("concurrency");
  });

  it("detects concurrency from 'overbooking' tag", () => {
    const b = makeBehavior({ tags: ["overbooking"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("concurrency");
  });

  it("detects concurrency from 'atomic' tag", () => {
    const b = makeBehavior({ tags: ["atomic"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("concurrency");
  });

  it("detects concurrency from 'concurren' prefix (concurrency/concurrent)", () => {
    const b = makeBehavior({ tags: ["concurrent"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("concurrency");
  });

  it("does NOT add concurrency for plain business-logic behavior", () => {
    const b = makeBehavior({ tags: ["business-logic"], riskHints: ["state-change"] });
    const types = determineProofTypes(b);
    expect(types).not.toContain("concurrency");
  });
});

describe("determineProofTypes — idempotency detection", () => {
  it("detects idempotency from 'duplicate' riskHint", () => {
    const b = makeBehavior({ tags: [], riskHints: ["duplicate"] });
    const types = determineProofTypes(b);
    expect(types).toContain("idempotency");
  });

  it("detects idempotency from 'retry' tag", () => {
    const b = makeBehavior({ tags: ["retry"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("idempotency");
  });

  it("detects idempotency from 'idempotent' riskHint", () => {
    const b = makeBehavior({ tags: [], riskHints: ["idempotent"] });
    const types = determineProofTypes(b);
    expect(types).toContain("idempotency");
  });

  it("detects idempotency from 'deduplication' tag", () => {
    const b = makeBehavior({ tags: ["deduplication"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("idempotency");
  });

  it("detects idempotency from 'dedup' abbreviation", () => {
    const b = makeBehavior({ tags: ["dedup"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("idempotency");
  });

  it("does NOT add idempotency for plain IDOR behavior", () => {
    const b = makeBehavior({ tags: [], riskHints: ["idor"] });
    const types = determineProofTypes(b);
    expect(types).not.toContain("idempotency");
  });
});

describe("determineProofTypes — auth_matrix detection", () => {
  it("detects auth_matrix from 'permission' riskHint", () => {
    const b = makeBehavior({ tags: [], riskHints: ["permission"] });
    const types = determineProofTypes(b);
    expect(types).toContain("auth_matrix");
  });

  it("detects auth_matrix from 'rbac' tag", () => {
    const b = makeBehavior({ tags: ["rbac"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("auth_matrix");
  });

  it("detects auth_matrix from 'authorization' riskHint", () => {
    const b = makeBehavior({ tags: [], riskHints: ["authorization"] });
    const types = determineProofTypes(b);
    expect(types).toContain("auth_matrix");
  });

  it("detects auth_matrix from 'role-based' tag", () => {
    const b = makeBehavior({ tags: ["role-based"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("auth_matrix");
  });

  it("detects auth_matrix from 'access-control' tag", () => {
    const b = makeBehavior({ tags: ["access-control"], riskHints: [] });
    const types = determineProofTypes(b);
    expect(types).toContain("auth_matrix");
  });

  it("can combine concurrency + idempotency for same behavior", () => {
    const b = makeBehavior({ tags: ["atomic", "retry"], riskHints: ["race-condition", "duplicate"] });
    const types = determineProofTypes(b);
    expect(types).toContain("concurrency");
    expect(types).toContain("idempotency");
  });
});

// ─── buildProofTarget: new proof type cases ───────────────────────────────────

describe("buildProofTarget — concurrency", () => {
  it("returns a ProofTarget with correct id suffix for concurrency", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[0], ["concurrency"]);
    const target = buildProofTarget(sb, "concurrency", analysis);
    expect(target).not.toBeNull();
    expect(target!.id).toContain("CONCURRENCY");
    expect(target!.proofType).toBe("concurrency");
  });

  it("concurrency ProofTarget has 3 mutation targets", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[0], ["concurrency"]);
    const target = buildProofTarget(sb, "concurrency", analysis);
    expect(target!.mutationTargets.length).toBeGreaterThanOrEqual(3);
    expect(target!.mutationTargets.every(m => m.expectedKill)).toBe(true);
  });

  it("concurrency ProofTarget description mentions race conditions", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[0], ["concurrency"]);
    const target = buildProofTarget(sb, "concurrency", analysis);
    expect(target!.description.toLowerCase()).toMatch(/race|concurrent/);
  });

  it("concurrency ProofTarget has 3 assertions", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[0], ["concurrency"]);
    const target = buildProofTarget(sb, "concurrency", analysis);
    expect(target!.assertions.length).toBe(3);
  });
});

describe("buildProofTarget — idempotency", () => {
  it("returns a ProofTarget with correct id suffix for idempotency", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[1], ["idempotency"]);
    const target = buildProofTarget(sb, "idempotency", analysis);
    expect(target).not.toBeNull();
    expect(target!.id).toContain("IDEMPOTENCY");
    expect(target!.proofType).toBe("idempotency");
  });

  it("idempotency ProofTarget has 3 mutation targets", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[1], ["idempotency"]);
    const target = buildProofTarget(sb, "idempotency", analysis);
    expect(target!.mutationTargets.length).toBeGreaterThanOrEqual(3);
  });

  it("idempotency ProofTarget description mentions duplicate", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[1], ["idempotency"]);
    const target = buildProofTarget(sb, "idempotency", analysis);
    expect(target!.description.toLowerCase()).toMatch(/idempotent|duplicate/);
  });

  it("idempotency ProofTarget has 3 assertions", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[1], ["idempotency"]);
    const target = buildProofTarget(sb, "idempotency", analysis);
    expect(target!.assertions.length).toBe(3);
  });
});

describe("buildProofTarget — auth_matrix", () => {
  it("returns a ProofTarget with correct id suffix for auth_matrix", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[2], ["auth_matrix"]);
    const target = buildProofTarget(sb, "auth_matrix", analysis);
    expect(target).not.toBeNull();
    expect(target!.id).toContain("AUTHMATRIX");
    expect(target!.proofType).toBe("auth_matrix");
  });

  it("auth_matrix ProofTarget has mutation targets for role removal", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[2], ["auth_matrix"]);
    const target = buildProofTarget(sb, "auth_matrix", analysis);
    expect(target!.mutationTargets.length).toBeGreaterThanOrEqual(2);
    const descriptions = target!.mutationTargets.map(m => m.description.toLowerCase());
    expect(descriptions.some(d => d.includes("role") || d.includes("access"))).toBe(true);
  });

  it("auth_matrix ProofTarget assertions include 401/403 check", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[2], ["auth_matrix"]);
    const target = buildProofTarget(sb, "auth_matrix", analysis);
    const statusAssertions = target!.assertions.filter(a => a.type === "http_status");
    expect(statusAssertions.length).toBeGreaterThanOrEqual(2);
    const hasUnauthorizedCheck = statusAssertions.some(a =>
      Array.isArray(a.value) && (a.value.includes(401) || a.value.includes(403))
    );
    expect(hasUnauthorizedCheck).toBe(true);
  });

  it("auth_matrix ProofTarget includes role names in mutation targets when roles defined", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const sb = makeScoredBehavior(ir.behaviors[2], ["auth_matrix"]);
    const target = buildProofTarget(sb, "auth_matrix", analysis);
    // Should have role-specific mutation targets (admin, staff)
    const descriptions = target!.mutationTargets.map(m => m.description);
    // At least one mutation target should mention a role name
    const hasRoleMutation = descriptions.some(d => d.includes("admin") || d.includes("staff"));
    expect(hasRoleMutation).toBe(true);
  });
});

// ─── generateConcurrencyTest: generated code quality ─────────────────────────

function makeConcurrencyTarget(ir: AnalysisIR): ProofTarget {
  return {
    id: "PROOF-B010-CONCURRENCY",
    behaviorId: "B010",
    proofType: "concurrency",
    riskLevel: "high",
    description: "Concurrent reserve on seat must not cause race conditions",
    preconditions: ["Authenticated user", "Shared resource exists"],
    assertions: [
      { type: "http_status", target: "responses[0]", operator: "in", value: [200, 201, 409], rationale: "Must succeed or conflict" },
    ],
    mutationTargets: [
      { description: "Remove mutex/lock around reserve", expectedKill: true },
      { description: "Allow both concurrent requests to succeed", expectedKill: true },
      { description: "Not using atomic DB operation", expectedKill: true },
    ],
    endpoint: "seats.reserve",
  };
}

describe("generateConcurrencyTest", () => {
  it("generates valid TypeScript with test.describe block", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("test.describe");
    expect(code).toContain("Concurrency:");
  });

  it("uses Promise.all for concurrent requests", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("Promise.all");
  });

  it("checks for no 500 errors after concurrent requests", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("500");
    expect(code).toContain("toBe(0)");
  });

  it("imports from helpers/api, helpers/auth, helpers/factories", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("helpers/api");
    expect(code).toContain("helpers/auth");
    expect(code).toContain("helpers/factories");
  });

  it("includes the endpoint name in the test", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("seats.reserve");
  });

  it("includes Kills comment with mutation targets", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("Kills:");
  });

  it("has no TODO_ placeholders in generated code", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).not.toContain("TODO_");
  });

  it("generates 3 separate test cases", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    const testCount = (code.match(/\btest\(/g) || []).length;
    expect(testCount).toBeGreaterThanOrEqual(3);
  });

  it("uses Array.from for generating concurrent requests", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeConcurrencyTarget(ir);
    const code = generateConcurrencyTest(target, analysis);
    expect(code).toContain("Array.from");
  });
});

// ─── generateIdempotencyTest: generated code quality ─────────────────────────

function makeIdempotencyTarget(ir: AnalysisIR): ProofTarget {
  return {
    id: "PROOF-B011-IDEMPOTENCY",
    behaviorId: "B011",
    proofType: "idempotency",
    riskLevel: "high",
    description: "Duplicate create on order must be idempotent",
    preconditions: ["Authenticated user", "First request already succeeded"],
    assertions: [
      { type: "http_status", target: "response2", operator: "in", value: [200, 201, 409], rationale: "Second call must not 500" },
      { type: "field_value", target: "db.count", operator: "eq", value: 1, rationale: "Only one record" },
    ],
    mutationTargets: [
      { description: "Remove duplicate-check before create", expectedKill: true },
      { description: "Not returning existing resource on duplicate create", expectedKill: true },
      { description: "Creating second record instead of returning existing one", expectedKill: true },
    ],
    endpoint: "orders.create",
  };
}

describe("generateIdempotencyTest", () => {
  it("generates valid TypeScript with test.describe block", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    expect(code).toContain("test.describe");
    expect(code).toContain("Idempotency:");
  });

  it("sends the same request twice (at least 2 trpcMutation calls)", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    const callCount = (code.match(/trpcMutation\(/g) || []).length;
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("checks that second call does not return 500 (expects 409 as valid conflict)", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    expect(code).toContain("409");
  });

  it("checks for duplicate records via list endpoint", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    expect(code).toContain("list");
  });

  it("includes idempotency key test", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    expect(code).toContain("idempotencyKey");
  });

  it("has no TODO_ placeholders", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    expect(code).not.toContain("TODO_");
  });

  it("generates 3 separate test cases", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    const testCount = (code.match(/\btest\(/g) || []).length;
    expect(testCount).toBeGreaterThanOrEqual(3);
  });

  it("checks that same resource ID is returned on duplicate", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeIdempotencyTarget(ir);
    const code = generateIdempotencyTest(target, analysis);
    expect(code).toContain(".id");
    expect(code).toContain("toBe(id1)");
  });
});

// ─── generateAuthMatrixTest: generated code quality ──────────────────────────

function makeAuthMatrixTarget(ir: AnalysisIR): ProofTarget {
  return {
    id: "PROOF-B012-AUTHMATRIX",
    behaviorId: "B012",
    proofType: "auth_matrix",
    riskLevel: "critical",
    description: "Authorization matrix for accounts.delete",
    preconditions: ["Multiple roles configured", "Endpoint requires admin role"],
    assertions: [
      { type: "http_status", target: "unauthorizedResponse", operator: "in", value: [401, 403], rationale: "Unauthorized must be rejected" },
      { type: "http_status", target: "authorizedResponse", operator: "in", value: [200, 201], rationale: "Authorized must succeed" },
      { type: "field_absent", target: "unauthorizedResponse.data", operator: "eq", value: null, rationale: "Must not leak data" },
    ],
    mutationTargets: [
      { description: "Remove role check in accounts.delete", expectedKill: true },
      { description: "Allow lower-privileged role to access account", expectedKill: true },
    ],
    endpoint: "accounts.delete",
  };
}

describe("generateAuthMatrixTest", () => {
  it("generates valid TypeScript with test.describe block", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).toContain("test.describe");
    expect(code).toContain("Auth Matrix:");
  });

  it("tests that admin can perform the action (expects 200/201)", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).toContain("admin");
    expect(code).toContain("200");
  });

  it("tests that unauthenticated request is rejected (expects 401/403)", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).toContain("unauthenticated");
    expect(code).toContain("401");
  });

  it("tests cross-tenant access is rejected", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).toContain("cross-tenant");
    // Bug 3 Fix: cross-tenant payload now uses tenantConst + 99999 offset instead of a string literal
    expect(code).toMatch(/DIFFERENT_TENANT|\+ 99999/);
  });

  it("imports role-specific cookie functions from helpers/auth", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).toContain("getAdminCookie");
    expect(code).toContain("helpers/auth");
  });

  it("has no TODO_ placeholders", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).not.toContain("TODO_");
  });

  it("generates at least 3 test cases (admin, unauthenticated, cross-tenant)", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    const testCount = (code.match(/\btest\(/g) || []).length;
    expect(testCount).toBeGreaterThanOrEqual(3);
  });

  it("includes staff role test when staff role exists in IR", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    // Staff role is in the IR, should appear in the test
    expect(code).toContain("staff");
  });

  it("checks that unauthorized response does not leak data", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const target = makeAuthMatrixTarget(ir);
    const code = generateAuthMatrixTest(target, analysis);
    expect(code).toContain("toBeFalsy");
  });
});

// ─── Integration: buildRiskModel generates new proof types ───────────────────

describe("buildRiskModel — new proof types integration", () => {
  it("generates concurrency proof targets for race-condition behaviors", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const concurrencyTargets = model.proofTargets.filter(t => t.proofType === "concurrency");
    expect(concurrencyTargets.length).toBeGreaterThanOrEqual(1);
  });

  it("generates idempotency proof targets for duplicate behaviors", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const idempotencyTargets = model.proofTargets.filter(t => t.proofType === "idempotency");
    expect(idempotencyTargets.length).toBeGreaterThanOrEqual(1);
  });

  it("generates auth_matrix proof targets for permission behaviors", () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const authMatrixTargets = model.proofTargets.filter(t => t.proofType === "auth_matrix");
    expect(authMatrixTargets.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── generateProofs: new proof types produce valid test files ─────────────────

describe("generateProofs — new proof types produce valid test files", () => {
  it("concurrency proof goes to tests/concurrency/race-conditions.spec.ts", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const concurrencyProof = rawProofs.find(p => p.proofType === "concurrency");
    if (concurrencyProof) {
      expect(concurrencyProof.filename).toBe("tests/concurrency/race-conditions.spec.ts");
    }
  });

  it("idempotency proof goes to tests/integration/idempotency.spec.ts", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const idempotencyProof = rawProofs.find(p => p.proofType === "idempotency");
    if (idempotencyProof) {
      expect(idempotencyProof.filename).toBe("tests/integration/idempotency.spec.ts");
    }
  });

  it("auth_matrix proof goes to tests/security/auth-matrix.spec.ts", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const authMatrixProof = rawProofs.find(p => p.proofType === "auth_matrix");
    if (authMatrixProof) {
      expect(authMatrixProof.filename).toBe("tests/security/auth-matrix.spec.ts");
    }
  });

  it("generated concurrency test code contains Promise.all", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const concurrencyProof = rawProofs.find(p => p.proofType === "concurrency");
    if (concurrencyProof) {
      expect(concurrencyProof.code).toContain("Promise.all");
    }
  });

  it("generated idempotency test code checks for 409 conflict", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const idempotencyProof = rawProofs.find(p => p.proofType === "idempotency");
    if (idempotencyProof) {
      expect(idempotencyProof.code).toContain("409");
    }
  });

  it("generated auth_matrix test code checks 401/403", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const authMatrixProof = rawProofs.find(p => p.proofType === "auth_matrix");
    if (authMatrixProof) {
      expect(authMatrixProof.code).toContain("401");
    }
  });

  it("all new proof type proofs pass syntax check (no TODO_REPLACE in code)", async () => {
    const ir = makeNewProofIR();
    const analysis: AnalysisResult = { ir, qualityScore: 9, specType: "api-spec" };
    const model = buildRiskModel(analysis);
    const rawProofs = await generateProofs(model, analysis);
    const newTypeProofs = rawProofs.filter(p =>
      p.proofType === "concurrency" || p.proofType === "idempotency" || p.proofType === "auth_matrix"
    );
    for (const proof of newTypeProofs) {
      expect(proof.code).not.toContain("TODO_REPLACE_WITH_YOUR_ENDPOINT");
    }
  });
});
