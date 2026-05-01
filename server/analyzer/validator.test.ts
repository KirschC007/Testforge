/**
 * Validator — Unit Tests
 *
 * Verifies all R1-R11 validation rules correctly accept/reject proofs.
 * Each rule has a "violates" and "passes" test to guard against false positives.
 */
import { describe, it, expect } from "vitest";
import { validateProofs, mergeProofsToFile } from "./validator";
import type { RawProof, ValidatedProof } from "./types";

function makeProof(overrides: Partial<RawProof> & { code: string }): RawProof {
  return {
    id: overrides.id || "T001",
    behaviorId: overrides.behaviorId || "B001",
    proofType: overrides.proofType || "business_logic",
    riskLevel: overrides.riskLevel || "medium",
    filename: overrides.filename || "tests/business/test.spec.ts",
    code: overrides.code,
    mutationTargets: overrides.mutationTargets || [
      { description: "Mutation 1", expectedKill: true },
    ],
  };
}

const MIN_VALID_BODY = `
  expect(status).toBe(200);
  // Kills: returns wrong status
  expect(data.id).toBe(42);
  // Kills: returns wrong id
`;

describe("Validator — R1: No if-wrapper assertions", () => {
  it("rejects assertions wrapped in if (x !== undefined)", () => {
    const proof = makeProof({
      code: `if (data !== undefined) {
        expect(data.id).toBe(1);
      }
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs).toHaveLength(1);
    expect(result.discardedProofs[0].reason).toBe("conditional_assertion");
  });

  it("accepts unconditional assertions", () => {
    const proof = makeProof({ code: MIN_VALID_BODY });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R2: Not existence-only", () => {
  it("rejects all-toBeDefined proofs", () => {
    const proof = makeProof({
      code: `expect(a).toBeDefined();
      expect(b).toBeDefined();
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("existence_only");
  });

  it("accepts proofs with at least one value assertion", () => {
    const proof = makeProof({
      code: `expect(a).toBeDefined();
      expect(b).toBe(42);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R3: No broad status codes", () => {
  it("rejects toBeGreaterThanOrEqual(400)", () => {
    const proof = makeProof({
      code: `expect(status).toBeGreaterThanOrEqual(400);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("broad_status_code");
  });

  it("accepts specific status code arrays", () => {
    const proof = makeProof({
      code: `expect([401, 403]).toContain(status);
      expect(data.id).toBe(1);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R4: Security tests need side-effect check", () => {
  it("rejects CSRF test without side-effect verification", () => {
    const proof = makeProof({
      proofType: "csrf",
      code: `expect(status).toBe(403);
      // Kills: csrf bypass`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("no_side_effect_check");
  });

  it("accepts CSRF test with toBeUndefined side-effect check", () => {
    const proof = makeProof({
      proofType: "csrf",
      code: `expect(status).toBe(200); // positive control
      expect(status).toBe(403);
      expect(updated).toBeUndefined();
      // Kills: csrf accepted`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R5: IDOR tests need positive control", () => {
  it("rejects IDOR test without toBe(200) positive control", () => {
    const proof = makeProof({
      proofType: "idor",
      code: `expect(status).toBe(403);
      expect(data).toBeUndefined();
      // Kills: idor`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("no_positive_control");
  });

  it("accepts IDOR test with positive + negative control", () => {
    const proof = makeProof({
      proofType: "idor",
      code: `// Positive: tenant A reads own data
      expect(status).toBe(200);
      // Negative: tenant A reads tenant B data
      expect(status).toBe(403);
      expect(data).toBeUndefined();
      // Kills: idor allows cross-tenant`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R7: Must have // Kills: comment", () => {
  it("rejects proof without any // Kills: comment", () => {
    const proof = makeProof({
      code: `expect(status).toBe(200);
      expect(data.id).toBe(1);`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("no_mutation_kill");
  });
});

describe("Validator — R7b: No fake IDOR with hardcoded small IDs", () => {
  it("rejects IDOR test using restaurantId: 2 hardcoded", () => {
    const proof = makeProof({
      proofType: "idor",
      code: `expect(status).toBe(200);
      const r = await request.get('/api/orders', { restaurantId: 2 });
      expect(status).toBe(403);
      expect(data).toBeUndefined();
      // Kills: idor`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("fake_idor");
  });

  it("accepts IDOR test using TEST_RESTAURANT_B_ID constant", () => {
    const proof = makeProof({
      proofType: "idor",
      code: `expect(status).toBe(200);
      const r = await request.get('/api/orders', { restaurantId: TEST_RESTAURANT_B_ID });
      expect(status).toBe(403);
      expect(data).toBeUndefined();
      // Kills: idor`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R9: Webhook/cron tests should poll (warning only)", () => {
  it("emits warning for webhook test without polling but does NOT reject", () => {
    const proof = makeProof({
      proofType: "webhook",
      code: `expect(status).toBe(200);
      expect(data.id).toBe(1);
      // Kills: webhook`,
    });
    const result = validateProofs([proof], ["B001"]);
    // R9 is a warning, not a hard reject — proof must pass
    expect(result.proofs).toHaveLength(1);
    // Warning emitted in validationNotes
    expect(result.proofs[0].validationNotes.some(n => n.includes("R9"))).toBe(true);
  });
});

describe("Validator — R11: No items[0] without sort", () => {
  it("rejects assertion on items[0] without explicit ordering", () => {
    const proof = makeProof({
      code: `expect(items[0].id).toBe(1);
      expect(status).toBe(200);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("unstable_ordering");
  });

  it("accepts items[0] when .sort() is also called", () => {
    const proof = makeProof({
      code: `const sorted = items.sort((a, b) => a.id - b.id);
      expect(sorted[0].id).toBe(1);
      expect(status).toBe(200);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });

  it("accepts items[0] with explicit // flaky-ok: marker", () => {
    const proof = makeProof({
      code: `// flaky-ok: only one item exists
      expect(items[0].id).toBe(1);
      expect(status).toBe(200);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — calcMutationScore edge cases", () => {
  it("returns 0 score when mutationTargets is empty", () => {
    const proof = makeProof({
      mutationTargets: [],
      code: MIN_VALID_BODY,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs[0].mutationScore).toBe(0);
  });

  it("returns 0 score when no mutationTargets have expectedKill=true", () => {
    const proof = makeProof({
      mutationTargets: [
        { description: "M1", expectedKill: false },
        { description: "M2", expectedKill: false },
      ],
      code: MIN_VALID_BODY,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs[0].mutationScore).toBe(0);
  });

  it("R10: does NOT cap when // flaky-ok: marker is present", () => {
    const proof = makeProof({
      mutationTargets: [
        { description: "M1", expectedKill: true },
      ],
      code: `// flaky-ok: timing-sensitive intentionally
      expect(Date.now()).toBeGreaterThan(0);
      expect(status).toBe(200);
      // Kills: M1`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs[0].mutationScore).toBe(1.0);
  });
});

describe("Validator — Mutation Score Calculation", () => {
  it("scores 1.0 when all mutation targets have // Kills: comments", () => {
    const proof = makeProof({
      mutationTargets: [
        { description: "M1", expectedKill: true },
        { description: "M2", expectedKill: true },
      ],
      code: `expect(status).toBe(200);
      // Kills: M1
      expect(data.id).toBe(1);
      // Kills: M2`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs[0].mutationScore).toBe(1.0);
  });

  it("scores 0.5 when half the mutations are killed", () => {
    const proof = makeProof({
      mutationTargets: [
        { description: "M1", expectedKill: true },
        { description: "M2", expectedKill: true },
      ],
      code: `expect(status).toBe(200);
      // Kills: M1
      expect(data.id).toBe(1);`,
    });
    const result = validateProofs([proof], ["B001"]);
    // Only 1 // Kills: comment → 0.5 score → R7 still passes (>=1)
    expect(result.proofs[0].mutationScore).toBe(0.5);
  });

  it("R10: caps score at 0.80 when expect uses Date.now() without flaky-ok marker", () => {
    const proof = makeProof({
      mutationTargets: [
        { description: "M1", expectedKill: true },
      ],
      code: `expect(Date.now()).toBeGreaterThan(0);
      expect(status).toBe(200);
      // Kills: M1`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs[0].mutationScore).toBeLessThanOrEqual(0.80);
  });
});

describe("Validator — verdict and coverage", () => {
  it("reports verdict score as percentage of passed/total", () => {
    const goodProof = makeProof({ code: MIN_VALID_BODY });
    const badProof = makeProof({ id: "T002", code: "// no kills" });
    const result = validateProofs([goodProof, badProof], ["B001"]);
    expect(result.verdict.passed).toBe(1);
    expect(result.verdict.failed).toBe(1);
    expect(result.verdict.score).toBe(5.0); // 50%
  });

  it("computes coverage based on covered behaviors", () => {
    const proof = makeProof({ behaviorId: "B001", code: MIN_VALID_BODY });
    const result = validateProofs([proof], ["B001", "B002", "B003"]);
    expect(result.coverage.totalBehaviors).toBe(3);
    expect(result.coverage.coveredBehaviors).toBe(1);
    expect(result.coverage.coveragePercent).toBe(33);
    expect(result.coverage.uncoveredIds).toEqual(["B002", "B003"]);
  });
});

describe("Validator — R8: risk_scoring precondition check", () => {
  it("rejects risk_scoring test without precondition check", () => {
    const proof = makeProof({
      proofType: "risk_scoring",
      code: `expect(status).toBe(200);
      expect(noShowRisk).toBeGreaterThan(0);
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.discardedProofs[0]?.reason).toBe("missing_precondition");
  });

  it("accepts risk_scoring test with noShowRisk = 0 baseline", () => {
    const proof = makeProof({
      proofType: "risk_scoring",
      code: `expect(noShowRisk).toBe(0); // baseline
      expect(status).toBe(200);
      expect(noShowRisk).toBeGreaterThan(0); // after job
      // Kills: x`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — R6: counter checks need baseline", () => {
  it("rejects counter assertion with + 1 but no baseline", () => {
    const proof = makeProof({
      code: `const visitCount = await getCount();
      expect(visitCount).toBe(visitCount + 1);
      // Kills: counter`,
    });
    const result = validateProofs([proof], ["B001"]);
    // R6 should trigger since "Count" appears + "+ 1" + no "Before"
    expect(result.discardedProofs[0]?.reason).toBe("missing_baseline");
  });

  it("accepts counter assertion with countBefore baseline", () => {
    const proof = makeProof({
      code: `const countBefore = await getCount();
      await doAction();
      const countAfter = await getCount();
      expect(countAfter).toBe(countBefore + 1);
      // Kills: counter`,
    });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs).toHaveLength(1);
  });
});

describe("Validator — empty inputs and edge cases", () => {
  it("returns empty result for empty proof list", () => {
    const result = validateProofs([], []);
    expect(result.proofs).toHaveLength(0);
    expect(result.verdict.score).toBe(0);
    expect(result.coverage.totalBehaviors).toBe(0);
    expect(result.coverage.coveragePercent).toBe(0);
  });

  it("computes 100% pass when all proofs are valid", () => {
    const proofs = [
      makeProof({ id: "T1", code: MIN_VALID_BODY }),
      makeProof({ id: "T2", behaviorId: "B002", code: MIN_VALID_BODY }),
    ];
    const result = validateProofs(proofs, ["B001", "B002"]);
    expect(result.verdict.score).toBe(10.0);
    expect(result.verdict.failed).toBe(0);
  });

  it("populates validationNotes with passed rule markers", () => {
    const proof = makeProof({ code: MIN_VALID_BODY });
    const result = validateProofs([proof], ["B001"]);
    expect(result.proofs[0].validationNotes.length).toBeGreaterThan(0);
    expect(result.proofs[0].validationNotes.some(n => n.includes("R1"))).toBe(true);
    expect(result.proofs[0].validationNotes.some(n => n.includes("R7"))).toBe(true);
  });
});

describe("Validator — mergeProofsToFile", () => {
  it("merges multiple proofs into single file with deduped imports", () => {
    const p1: ValidatedProof = {
      ...makeProof({ id: "T1", code: `import { test, expect } from "@playwright/test";\nimport { trpcMutation } from "../../helpers/api";\nimport { getAdminCookie } from "../../helpers/auth";\n\ntest("test1", async () => {\n  expect(1).toBe(1);\n});` }),
      mutationScore: 1.0,
      validationNotes: [],
    };
    const p2: ValidatedProof = {
      ...makeProof({ id: "T2", code: `import { test, expect } from "@playwright/test";\nimport { trpcMutation, trpcQuery } from "../../helpers/api";\nimport { getAdminCookie } from "../../helpers/auth";\n\ntest("test2", async () => {\n  expect(2).toBe(2);\n});` }),
      mutationScore: 1.0,
      validationNotes: [],
    };
    const merged = mergeProofsToFile([p1, p2]);
    // Single import per module, with merged symbols
    const importLines = merged.split("\n").filter(l => l.startsWith("import "));
    expect(importLines.length).toBeLessThanOrEqual(3);
    // Both test bodies present
    expect(merged).toContain("test1");
    expect(merged).toContain("test2");
  });
});
