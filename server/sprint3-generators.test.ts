/**
 * Tests for Sprint 3 new generators and type extensions:
 * - generateFlowTest
 * - generateCronJobTest
 * - generateWebhookTest
 * - generateFeatureGateTest
 * - structuredSideEffects in generateStatusTransitionTest
 * - errorCodes in generateBoundaryTest
 * - determineProofTypes: flow, cron_job, webhook, feature_gate detection
 */
import { describe, it, expect } from "vitest";
import {
  generateFlowTest,
  generateCronJobTest,
  generateWebhookTest,
  generateFeatureGateTest,
  determineProofTypes,
  buildProofTarget,
  type AnalysisResult,
  type AnalysisIR,
  type Behavior,
  type EndpointField,
  type ProofTarget,
  type ScoredBehavior,
  type ProofType,
  type StructuredSideEffect,
  type FlowStep,
  type FlowDefinition,
  type CronJobDef,
  type FeatureGate,
} from "./analyzer";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

function makeScoredBehavior(b: Behavior, proofTypes: ProofType[]): ScoredBehavior {
  return {
    behavior: b,
    riskLevel: "high",
    proofTypes,
    priority: 0,
    rationale: "Test",
  };
}

function makeBaseIR(): AnalysisIR {
  return {
    behaviors: [],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
    resources: [],
    apiEndpoints: [
      {
        name: "orders.create",
        method: "POST /api/trpc/orders.create",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true } as EndpointField,
        ],
        outputFields: ["id"],
      },
      {
        name: "orders.updateStatus",
        method: "POST /api/trpc/orders.updateStatus",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true } as EndpointField,
          { name: "id", type: "number", required: true } as EndpointField,
          { name: "status", type: "string", required: true } as EndpointField,
        ],
        outputFields: ["id", "status"],
      },
      {
        name: "orders.getById",
        method: "GET /api/trpc/orders.getById",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true } as EndpointField,
          { name: "id", type: "number", required: true } as EndpointField,
        ],
        outputFields: ["id", "status"],
      },
    ],
    authModel: {
      loginEndpoint: "/api/trpc/auth.login",
      csrfEndpoint: "/api/auth/csrf",
      roles: [
        { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" },
        { name: "user", envUserVar: "E2E_USER_USER", envPassVar: "E2E_USER_PASS", defaultUser: "test-user", defaultPass: "TestPass2026x" },
      ],
    },
    enums: {},
    statusMachine: null,
  };
}

function makeAnalysis(irOverrides: Partial<AnalysisIR> = {}): AnalysisResult {
  const ir: AnalysisIR = { ...makeBaseIR(), ...irOverrides };
  return {
    ir,
    specText: "Test spec",
    llmChecks: [],
    independentChecks: [],
    specHealth: {
      score: 80,
      grade: "B",
      dimensions: [],
      summary: "Good",
      topIssues: [],
    },
  };
}

function makeFlowTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "PT_FLOW_001",
    behaviorId: "B001",
    proofType: "flow",
    endpoint: "orders.create",
    description: "Complete order flow from creation to delivery",
    riskLevel: "high",
    assertions: [
      { id: "A1", description: "Flow completes successfully", killsMutant: "Skip step" },
      { id: "A2", description: "Cannot skip intermediate step", killsMutant: "Allow skip" },
    ],
    mutationTargets: [
      { id: "M1", description: "Skip intermediate step in flow", location: "orders.updateStatus" },
      { id: "M2", description: "Allow flow to complete with missing precondition", location: "orders.create" },
    ],
    sideEffects: [],
    ...overrides,
  };
}

function makeCronTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "PT_CRON_001",
    behaviorId: "B001",
    proofType: "cron_job",
    endpoint: "cron.processOrders",
    description: "Cron job processes pending orders",
    riskLevel: "high",
    assertions: [
      { id: "A1", description: "Cron processes pending records", killsMutant: "Remove cron logic" },
      { id: "A2", description: "Cron is idempotent", killsMutant: "Allow double-processing" },
    ],
    mutationTargets: [
      { id: "M1", description: "Remove cron job processing logic", location: "cron.processOrders" },
      { id: "M2", description: "Allow cron to run without precondition check", location: "cron.processOrders" },
    ],
    sideEffects: [],
    ...overrides,
  };
}

function makeWebhookTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "PT_WEBHOOK_001",
    behaviorId: "B001",
    proofType: "webhook",
    endpoint: "webhooks.payment",
    description: "Payment webhook validates HMAC signature",
    riskLevel: "critical",
    assertions: [
      { id: "A1", description: "Valid signature accepted", killsMutant: "Remove signature check" },
      { id: "A2", description: "Invalid signature rejected", killsMutant: "Accept any signature" },
      { id: "A3", description: "Missing signature rejected", killsMutant: "Allow unsigned" },
    ],
    mutationTargets: [
      { id: "M1", description: "Remove webhook signature verification", location: "webhooks.payment" },
    ],
    sideEffects: [],
    ...overrides,
  };
}

function makeFeatureGateTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "PT_GATE_001",
    behaviorId: "B001",
    proofType: "feature_gate",
    endpoint: "analytics.export",
    description: "Analytics export is gated behind professional plan",
    riskLevel: "high",
    assertions: [
      { id: "A1", description: "Free tier blocked", killsMutant: "Remove plan check" },
      { id: "A2", description: "Pro tier allowed", killsMutant: "Pro must succeed" },
      { id: "A3", description: "Unauthenticated rejected", killsMutant: "Allow unauthenticated" },
    ],
    mutationTargets: [
      { id: "M1", description: "Remove plan check from feature gate", location: "analytics.export" },
      { id: "M2", description: "Pro-tier must succeed", location: "analytics.export" },
    ],
    sideEffects: [],
    ...overrides,
  };
}

// ─── determineProofTypes: new type detection ──────────────────────────────────

describe("determineProofTypes — flow detection", () => {
  it("detects flow from 'flow' tag", () => {
    const b = makeBehavior({ tags: ["flow"] });
    expect(determineProofTypes(b)).toContain("flow");
  });

  it("detects flow from 'multi-step' riskHint", () => {
    const b = makeBehavior({ riskHints: ["multi-step"] });
    expect(determineProofTypes(b)).toContain("flow");
  });

  it("detects flow from 'workflow' riskHint", () => {
    const b = makeBehavior({ riskHints: ["workflow"] });
    expect(determineProofTypes(b)).toContain("flow");
  });

  it("detects flow from 'end-to-end' riskHint", () => {
    const b = makeBehavior({ riskHints: ["end-to-end"] });
    expect(determineProofTypes(b)).toContain("flow");
  });

  it("does NOT detect flow from unrelated tags", () => {
    const b = makeBehavior({ tags: ["auth"], riskHints: ["permission"] });
    expect(determineProofTypes(b)).not.toContain("flow");
  });
});

describe("determineProofTypes — cron_job detection", () => {
  it("detects cron_job from 'cron' tag", () => {
    const b = makeBehavior({ tags: ["cron"] });
    expect(determineProofTypes(b)).toContain("cron_job");
  });

  it("detects cron_job from 'scheduled' riskHint", () => {
    const b = makeBehavior({ riskHints: ["scheduled"] });
    expect(determineProofTypes(b)).toContain("cron_job");
  });

  it("detects cron_job from 'background-job' riskHint", () => {
    const b = makeBehavior({ riskHints: ["background-job"] });
    expect(determineProofTypes(b)).toContain("cron_job");
  });

  it("detects cron_job from 'periodic' riskHint", () => {
    const b = makeBehavior({ riskHints: ["periodic"] });
    expect(determineProofTypes(b)).toContain("cron_job");
  });

  it("does NOT detect cron_job from unrelated tags", () => {
    const b = makeBehavior({ tags: ["auth"], riskHints: [] });
    expect(determineProofTypes(b)).not.toContain("cron_job");
  });
});

describe("determineProofTypes — webhook detection", () => {
  it("detects webhook from 'webhook' tag", () => {
    const b = makeBehavior({ tags: ["webhook"] });
    expect(determineProofTypes(b)).toContain("webhook");
  });

  it("detects webhook from 'hmac' riskHint", () => {
    const b = makeBehavior({ riskHints: ["hmac"] });
    expect(determineProofTypes(b)).toContain("webhook");
  });

  it("detects webhook from 'signature' riskHint", () => {
    const b = makeBehavior({ riskHints: ["signature"] });
    expect(determineProofTypes(b)).toContain("webhook");
  });

  it("detects webhook from 'callback' riskHint", () => {
    const b = makeBehavior({ riskHints: ["callback"] });
    expect(determineProofTypes(b)).toContain("webhook");
  });

  it("does NOT detect webhook from unrelated tags", () => {
    const b = makeBehavior({ tags: ["idempotency"], riskHints: ["duplicate"] });
    expect(determineProofTypes(b)).not.toContain("webhook");
  });
});

describe("determineProofTypes — feature_gate detection", () => {
  it("detects feature_gate from 'feature-gate' tag", () => {
    const b = makeBehavior({ tags: ["feature-gate"] });
    expect(determineProofTypes(b)).toContain("feature_gate");
  });

  it("detects feature_gate from 'plan-gated' riskHint", () => {
    const b = makeBehavior({ riskHints: ["plan-gated"] });
    expect(determineProofTypes(b)).toContain("feature_gate");
  });

  it("detects feature_gate from 'premium' riskHint", () => {
    const b = makeBehavior({ riskHints: ["premium"] });
    expect(determineProofTypes(b)).toContain("feature_gate");
  });

  it("detects feature_gate from 'tier' riskHint", () => {
    const b = makeBehavior({ riskHints: ["tier"] });
    expect(determineProofTypes(b)).toContain("feature_gate");
  });

  it("does NOT detect feature_gate from unrelated tags", () => {
    const b = makeBehavior({ tags: ["concurrency"], riskHints: ["race-condition"] });
    expect(determineProofTypes(b)).not.toContain("feature_gate");
  });
});

// ─── generateFlowTest ─────────────────────────────────────────────────────────

describe("generateFlowTest", () => {
  it("generates valid TypeScript test file", () => {
    const analysis = makeAnalysis();
    const target = makeFlowTarget();
    const code = generateFlowTest(target, analysis);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(100);
  });

  it("imports from @playwright/test", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toContain('from "@playwright/test"');
  });

  it("imports from helpers/api", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toContain('from "../../helpers/api"');
  });

  it("includes test ID in test name", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toContain("PT_FLOW_001");
  });

  it("has at least 2 test blocks", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    const testCount = (code.match(/^test\(/gm) || []).length;
    expect(testCount).toBeGreaterThanOrEqual(2);
  });

  it("includes end-to-end test", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toMatch(/end.to.end|complete.*flow|flow.*succeed/i);
  });

  it("includes step-skip prevention test", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toMatch(/skip|intermediate/i);
  });

  it("uses tenant constant", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toContain("TEST_RESTAURANT_ID");
  });

  it("includes Kills comments", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toContain("// Kills:");
  });

  it("uses flow steps from IR when available", () => {
    const flowDef: FlowDefinition = {
      name: "order flow",
      steps: [
        { action: "mutation", endpoint: "orders.create", expectedStatus: 201 },
        { action: "mutation", endpoint: "orders.updateStatus", expectedStatus: 200 },
      ],
      description: "Order lifecycle",
    };
    const analysis = makeAnalysis({ flows: [flowDef] });
    const target = makeFlowTarget({ behaviorId: "B001" });
    const behavior = makeBehavior({ id: "B001", object: "order" });
    analysis.ir.behaviors = [behavior];
    const code = generateFlowTest(target, analysis);
    expect(code).toContain("Step 1");
  });

  it("uses beforeAll for auth setup", () => {
    const code = generateFlowTest(makeFlowTarget(), makeAnalysis());
    expect(code).toContain("test.beforeAll");
  });
});

// ─── generateCronJobTest ──────────────────────────────────────────────────────

describe("generateCronJobTest", () => {
  it("generates valid TypeScript test file", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(100);
  });

  it("imports from @playwright/test", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toContain('from "@playwright/test"');
  });

  it("imports from helpers/api", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toContain('from "../../helpers/api"');
  });

  it("includes test ID in test name", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toContain("PT_CRON_001");
  });

  it("has at least 2 test blocks", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    const testCount = (code.match(/^test\(/gm) || []).length;
    expect(testCount).toBeGreaterThanOrEqual(2);
  });

  it("includes trigger test", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toMatch(/trigger|process.*pending/i);
  });

  it("includes idempotency test", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toMatch(/idempotent|double.*trigger|trigger.*twice/i);
  });

  it("includes schedule comment", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toMatch(/Schedule:|every/i);
  });

  it("uses tenant constant", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toContain("TEST_RESTAURANT_ID");
  });

  it("includes Kills comments", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toContain("// Kills:");
  });

  it("uses cron schedule from IR when available", () => {
    const cronDef: CronJobDef = {
      name: "processOrders",
      frequency: "every 5 minutes",
      preconditions: ["pending orders exist"],
      expectedChanges: [],
    };
    const analysis = makeAnalysis({ cronJobs: [cronDef] });
    const behavior = makeBehavior({ id: "B001", object: "processOrders" });
    analysis.ir.behaviors = [behavior];
    const code = generateCronJobTest(makeCronTarget(), analysis);
    expect(code).toContain("every 5 minutes");
  });

  it("uses beforeAll for auth setup", () => {
    const code = generateCronJobTest(makeCronTarget(), makeAnalysis());
    expect(code).toContain("test.beforeAll");
  });
});

// ─── generateWebhookTest ──────────────────────────────────────────────────────

describe("generateWebhookTest", () => {
  it("generates valid TypeScript test file", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(100);
  });

  it("imports from @playwright/test", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain('from "@playwright/test"');
  });

  it("imports crypto", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("crypto");
  });

  it("includes test ID in test name", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("PT_WEBHOOK_001");
  });

  it("has exactly 4 test blocks (including delivery polling)", () => {
    // a: valid payload, b: invalid sig 401, c: missing sig 401, d: pollUntil delivery template
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    const testCount = (code.match(/^test\(/gm) || []).length;
    expect(testCount).toBe(4);
  });

  it("tests valid signature acceptance", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toMatch(/valid.*signature|signature.*accepted/i);
  });

  it("tests invalid signature rejection with 401", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("401");
    expect(code).toMatch(/invalid.*signature|signature.*rejected/i);
  });

  it("tests missing signature rejection with 401", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toMatch(/missing.*signature|unsigned/i);
  });

  it("uses HMAC sha256 for signature generation", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("sha256");
    expect(code).toContain("createHmac");
  });

  it("includes Kills comments", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("// Kills:");
  });

  it("uses WEBHOOK_SECRET env var", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("WEBHOOK_SECRET");
  });

  it("uses beforeAll for auth setup", () => {
    const code = generateWebhookTest(makeWebhookTarget(), makeAnalysis());
    expect(code).toContain("test.beforeAll");
  });
});

// ─── generateFeatureGateTest ──────────────────────────────────────────────────

describe("generateFeatureGateTest", () => {
  it("generates valid TypeScript test file", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(100);
  });

  it("imports from @playwright/test", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toContain('from "@playwright/test"');
  });

  it("imports from helpers/api", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toContain('from "../../helpers/api"');
  });

  it("includes test ID in test name", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toContain("PT_GATE_001");
  });

  it("has exactly 3 test blocks", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    const testCount = (code.match(/^test\(/gm) || []).length;
    expect(testCount).toBe(3);
  });

  it("tests pro-tier access succeeds (200/201)", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toMatch(/200|201/);
    expect(code).toMatch(/pro.*tier|admin.*access|can access/i);
  });

  it("tests free-tier is blocked (403)", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toContain("403");
    expect(code).toMatch(/free.*tier|blocked|free.*user/i);
  });

  it("tests unauthenticated rejected (401/403)", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toMatch(/401|403/);
    expect(code).toMatch(/unauthenticated|unauthorized/i);
  });

  it("includes required plan comment", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toMatch(/Required Plan:|professional/i);
  });

  it("includes Kills comments", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toContain("// Kills:");
  });

  it("uses feature gate from IR when available", () => {
    const gate: FeatureGate = {
      feature: "analytics",
      requiredPlan: "enterprise",
      blockedMessage: "Upgrade to enterprise",
    };
    const analysis = makeAnalysis({ featureGates: [gate] });
    const behavior = makeBehavior({ id: "B001", object: "analytics" });
    analysis.ir.behaviors = [behavior];
    const code = generateFeatureGateTest(makeFeatureGateTarget(), analysis);
    expect(code).toContain("enterprise");
  });

  it("uses beforeAll for auth setup", () => {
    const code = generateFeatureGateTest(makeFeatureGateTarget(), makeAnalysis());
    expect(code).toContain("test.beforeAll");
  });
});

// ─── StructuredSideEffect type shape ─────────────────────────────────────────

describe("StructuredSideEffect type", () => {
  it("can be constructed with required fields", () => {
    const sse: StructuredSideEffect = {
      entity: "guests",
      field: "visitCount",
      operation: "increment",
      verifyVia: "api_response",
    };
    expect(sse.entity).toBe("guests");
    expect(sse.field).toBe("visitCount");
    expect(sse.operation).toBe("increment");
  });

  it("supports all operation types", () => {
    const ops: StructuredSideEffect["operation"][] = [
      "increment", "decrement", "set", "set_if", "insert", "delete", "schedule"
    ];
    ops.forEach(op => {
      const sse: StructuredSideEffect = {
        entity: "test",
        field: "testField",
        operation: op,
        verifyVia: "not_verifiable",
      };
      expect(sse.operation).toBe(op);
    });
  });

  it("supports optional condition and value fields", () => {
    const sse: StructuredSideEffect = {
      entity: "guests",
      field: "isStammgast",
      operation: "set_if",
      value: true,
      condition: "visitCount >= 5",
      verifyVia: "get_endpoint",
      verifyEndpoint: "guests.getByPhone",
      verifyField: "isStammgast",
    };
    expect(sse.condition).toBe("visitCount >= 5");
    expect(sse.value).toBe(true);
  });
});

// ─── FlowDefinition type shape ────────────────────────────────────────────────

describe("FlowDefinition type", () => {
  it("can be constructed with required fields", () => {
    const flow: FlowDefinition = {
      name: "order-lifecycle",
      steps: [],
      description: "Order from creation to delivery",
    };
    expect(flow.name).toBe("order-lifecycle");
    expect(flow.steps).toHaveLength(0);
  });

  it("supports FlowStep with all action types", () => {
    const step: FlowStep = {
      action: "mutation",
      endpoint: "orders.create",
      expectedStatus: 201,
    };
    expect(step.action).toBe("mutation");
    expect(step.expectedStatus).toBe(201);
  });

  it("supports wait and cron_trigger actions", () => {
    const steps: FlowStep[] = [
      { action: "wait" },
      { action: "cron_trigger" },
      { action: "query", endpoint: "orders.getById" },
    ];
    expect(steps[0].action).toBe("wait");
    expect(steps[1].action).toBe("cron_trigger");
    expect(steps[2].endpoint).toBe("orders.getById");
  });
});

// ─── CronJobDef type shape ────────────────────────────────────────────────────

describe("CronJobDef type", () => {
  it("can be constructed with required fields", () => {
    const cron: CronJobDef = {
      name: "noShowRelease",
      frequency: "every minute",
      preconditions: ["reservation is no_show"],
      expectedChanges: [],
    };
    expect(cron.name).toBe("noShowRelease");
    expect(cron.frequency).toBe("every minute");
  });

  it("supports optional triggerEndpoint and raceConditionProtection", () => {
    const cron: CronJobDef = {
      name: "test",
      frequency: "every 15 min",
      preconditions: [],
      expectedChanges: [],
      triggerEndpoint: "/api/debug/cron/test",
      raceConditionProtection: "FOR UPDATE",
    };
    expect(cron.triggerEndpoint).toBe("/api/debug/cron/test");
    expect(cron.raceConditionProtection).toBe("FOR UPDATE");
  });
});

// ─── FeatureGate type shape ───────────────────────────────────────────────────

describe("FeatureGate type", () => {
  it("can be constructed with required fields", () => {
    const gate: FeatureGate = {
      feature: "analytics-export",
      requiredPlan: "professional",
      blockedMessage: "Upgrade to Professional to use this feature",
    };
    expect(gate.feature).toBe("analytics-export");
    expect(gate.requiredPlan).toBe("professional");
  });
});
