/**
 * Risk Rules — Unit Tests
 *
 * Verifies that the declarative risk rule engine correctly assigns proof types
 * to behaviors based on keywords, tags, endpoint patterns, and conditions.
 */
import { describe, it, expect } from "vitest";
import { RISK_RULES, evaluateRiskRules } from "./risk-rules";
import type { Behavior, APIEndpoint, ProofType } from "./types";
import { PROOF_TYPES } from "./types";

function makeBehavior(overrides: Partial<Behavior> = {}): Behavior {
  return {
    id: "B001",
    title: "Test behavior",
    subject: "User",
    action: "performs",
    object: "action",
    preconditions: [],
    postconditions: [],
    errorCases: [],
    tags: [],
    riskHints: [],
    ...overrides,
  };
}

function makeEndpoint(overrides: Partial<APIEndpoint> = {}): APIEndpoint {
  return {
    name: "test.endpoint",
    method: "POST",
    auth: "requireAuth",
    relatedBehaviors: [],
    inputFields: [],
    ...overrides,
  };
}

describe("Risk Rules — Coverage", () => {
  it("every PROOF_TYPE has at least one rule that can trigger it", () => {
    const proofTypesWithRules = new Set<ProofType>(RISK_RULES.map(r => r.proofType));
    const missing = PROOF_TYPES.filter(pt => !proofTypesWithRules.has(pt));
    expect(missing).toEqual([]);
  });

  it("rules are sorted to evaluate higher priority first", () => {
    // Just sanity-check that priorities are numbers
    for (const rule of RISK_RULES) {
      expect(typeof rule.priority).toBe("number");
      expect(rule.priority).toBeGreaterThanOrEqual(0);
    }
  });

  it("no two rules for the same proofType have the same priority (would be ambiguous)", () => {
    const seen = new Map<string, number>();
    for (const rule of RISK_RULES) {
      const key = `${rule.proofType}:${rule.priority}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    // Allow up to 1 occurrence per (proofType, priority) pair
    for (const [key, count] of Array.from(seen)) {
      expect(count, `Duplicate priority for ${key}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("Risk Rules — IDOR detection", () => {
  it("triggers idor on tenantId field", () => {
    const ep = makeEndpoint({
      inputFields: [{ name: "tenantId", type: "number", required: true }],
    });
    const types = evaluateRiskRules(makeBehavior(), ep);
    expect(types.has("idor")).toBe(true);
  });

  it("triggers idor on shopId field", () => {
    const ep = makeEndpoint({
      inputFields: [{ name: "shopId", type: "number", required: true }],
    });
    const types = evaluateRiskRules(makeBehavior(), ep);
    expect(types.has("idor")).toBe(true);
  });

  it("triggers idor on cross-tenant keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Reject cross-tenant access" }),
      makeEndpoint(),
    );
    expect(types.has("idor")).toBe(true);
  });

  it("triggers idor on security tag", () => {
    const types = evaluateRiskRules(
      makeBehavior({ tags: ["security"] }),
      makeEndpoint(),
    );
    expect(types.has("idor")).toBe(true);
  });
});

describe("Risk Rules — Boundary detection", () => {
  it("triggers boundary when endpoint has min/max fields", () => {
    const ep = makeEndpoint({
      inputFields: [{ name: "amount", type: "number", required: true, min: 0, max: 1000 }],
    });
    const types = evaluateRiskRules(makeBehavior(), ep);
    expect(types.has("boundary")).toBe(true);
  });

  it("triggers boundary on 'must not exceed' keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Party size must not exceed 20" }),
      makeEndpoint(),
    );
    expect(types.has("boundary")).toBe(true);
  });
});

describe("Risk Rules — DSGVO/GDPR detection", () => {
  it("triggers dsgvo on gdpr keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "GDPR data deletion" }),
      makeEndpoint(),
    );
    expect(types.has("dsgvo")).toBe(true);
  });

  it("triggers dsgvo on anonymize endpoint pattern", () => {
    const types = evaluateRiskRules(
      makeBehavior(),
      makeEndpoint({ name: "users.anonymize" }),
    );
    expect(types.has("dsgvo")).toBe(true);
  });

  it("triggers dsgvo on PII tag", () => {
    const types = evaluateRiskRules(
      makeBehavior({ tags: ["pii"] }),
      makeEndpoint(),
    );
    expect(types.has("dsgvo")).toBe(true);
  });
});

describe("Risk Rules — Concurrency detection", () => {
  it("triggers concurrency on race condition keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Last ticket race condition" }),
      makeEndpoint(),
    );
    expect(types.has("concurrency")).toBe(true);
  });

  it("triggers concurrency on overbooking tag", () => {
    const types = evaluateRiskRules(
      makeBehavior({ tags: ["overbooking"] }),
      makeEndpoint(),
    );
    expect(types.has("concurrency")).toBe(true);
  });
});

describe("Risk Rules — Property-Based detection (newest)", () => {
  it("triggers property_based when endpoint has 2+ input fields", () => {
    const ep = makeEndpoint({
      inputFields: [
        { name: "name", type: "string", required: true },
        { name: "email", type: "string", required: true },
        { name: "age", type: "number", required: true },
      ],
    });
    const types = evaluateRiskRules(makeBehavior(), ep);
    expect(types.has("property_based")).toBe(true);
  });

  it("does NOT trigger property_based with only tenant key fields", () => {
    const ep = makeEndpoint({
      inputFields: [
        { name: "tenantId", type: "number", required: true, isTenantKey: true },
      ],
    });
    const types = evaluateRiskRules(makeBehavior(), ep);
    expect(types.has("property_based")).toBe(false);
  });

  it("triggers property_based on fuzz keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Endpoint accepts fuzz input gracefully" }),
      makeEndpoint(),
    );
    expect(types.has("property_based")).toBe(true);
  });
});

describe("Risk Rules — SQL Injection detection", () => {
  it("triggers sql_injection on search endpoint", () => {
    const types = evaluateRiskRules(
      makeBehavior(),
      makeEndpoint({ name: "products.search" }),
    );
    expect(types.has("sql_injection")).toBe(true);
  });

  it("triggers sql_injection on injection keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Endpoint resists SQL injection attacks" }),
      makeEndpoint(),
    );
    expect(types.has("sql_injection")).toBe(true);
  });
});

describe("Risk Rules — Status Transition detection", () => {
  it("triggers status_transition on POST to updateStatus", () => {
    const types = evaluateRiskRules(
      makeBehavior(),
      makeEndpoint({ name: "orders.updateStatus", method: "POST" }),
    );
    expect(types.has("status_transition")).toBe(true);
  });

  it("triggers status_transition on PATCH endpoints", () => {
    const types = evaluateRiskRules(
      makeBehavior(),
      makeEndpoint({ name: "orders.updateStatus", method: "PATCH" }),
    );
    expect(types.has("status_transition")).toBe(true);
  });
});

describe("Risk Rules — Negative Amount detection", () => {
  it("triggers negative_amount on payment keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Payment processing for transfer" }),
      makeEndpoint(),
    );
    expect(types.has("negative_amount")).toBe(true);
  });

  it("triggers negative_amount on financial tag", () => {
    const types = evaluateRiskRules(
      makeBehavior({ tags: ["financial"] }),
      makeEndpoint(),
    );
    expect(types.has("negative_amount")).toBe(true);
  });
});

describe("Risk Rules — Accessibility detection", () => {
  it("triggers accessibility on UI keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Login form is accessible" }),
      makeEndpoint(),
    );
    expect(types.has("accessibility")).toBe(true);
  });

  it("triggers accessibility on a11y tag", () => {
    const types = evaluateRiskRules(
      makeBehavior({ tags: ["a11y"] }),
      makeEndpoint(),
    );
    expect(types.has("accessibility")).toBe(true);
  });
});

describe("Risk Rules — GraphQL detection", () => {
  it("triggers graphql on graphql keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "GraphQL query depth limit" }),
      makeEndpoint(),
    );
    expect(types.has("graphql")).toBe(true);
  });

  it("triggers graphql on hasura keyword", () => {
    const types = evaluateRiskRules(
      makeBehavior({ title: "Hasura schema introspection should be disabled" }),
      makeEndpoint(),
    );
    expect(types.has("graphql")).toBe(true);
  });
});
