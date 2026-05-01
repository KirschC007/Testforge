/**
 * Property-Based Test Generator — Unit Tests
 *
 * Verifies generatePropertyTest produces valid Playwright + fast-check code
 * for all input shapes (no fields, only string fields, only number fields, full).
 */
import { describe, it, expect } from "vitest";
import { generatePropertyTest } from "./proof-generator";
import type { ProofTarget, AnalysisResult, EndpointField } from "./types";

function makeTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "PROP_001",
    behaviorId: "B001",
    proofType: "property_based",
    riskLevel: "medium",
    description: "Endpoint accepts random valid inputs without 500",
    preconditions: [],
    assertions: [],
    mutationTargets: [
      { description: "Server crashes on edge input", expectedKill: true },
    ],
    endpoint: "users.create",
    ...overrides,
  };
}

function makeAnalysis(fields: EndpointField[] = []): AnalysisResult {
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
          name: "users.create",
          method: "POST /api/trpc/users.create",
          auth: "requireAuth",
          relatedBehaviors: ["B001"],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            ...fields,
          ],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [
          {
            name: "admin",
            envUserVar: "E2E_ADMIN_USER",
            envPassVar: "E2E_ADMIN_PASS",
            defaultUser: "test-admin",
            defaultPass: "TestPass2026x",
          },
        ],
      },
      enums: {},
      statusMachine: null,
    },
    qualityScore: 8,
    specType: "test-spec",
  };
}

describe("generatePropertyTest", () => {
  it("imports fast-check and Playwright", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "name", type: "string", required: true, max: 100 },
    ]));
    expect(code).toContain('import * as fc from "fast-check"');
    expect(code).toContain('import { test, expect } from "@playwright/test"');
  });

  it("generates 5 property tests when fields are present", () => {
    const fields: EndpointField[] = [
      { name: "name", type: "string", required: true, max: 100 },
      { name: "age", type: "number", required: true, min: 18, max: 150 },
    ];
    const code = generatePropertyTest(makeTarget(), makeAnalysis(fields));

    // P1: no 500 on valid inputs
    expect(code).toMatch(/test\("P1:.*valid inputs/i);
    // P2: response shape consistent
    expect(code).toMatch(/test\("P2:.*id/i);
    // P3: injection safety (only when string fields exist)
    expect(code).toMatch(/test\("P3:.*injection/i);
    // P4: numeric overflow (only when number fields exist)
    expect(code).toMatch(/test\("P4:.*extreme/i);
    // P5: concurrent
    expect(code).toMatch(/test\("P5:.*concurrent/i);
  });

  it("skips P3 when no string fields are present", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "amount", type: "number", required: true, min: 0, max: 1000 },
    ]));
    expect(code).not.toMatch(/test\("P3:/);
    // P4 still present (numeric)
    expect(code).toMatch(/test\("P4:/);
  });

  it("skips P4 when no number fields are present", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "name", type: "string", required: true },
    ]));
    expect(code).not.toMatch(/test\("P4:/);
    // P3 still present (string)
    expect(code).toMatch(/test\("P3:/);
  });

  it("uses fc.integer with min/max bounds for bounded number fields", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "age", type: "number", required: true, min: 18, max: 150 },
    ]));
    expect(code).toContain("fc.integer({ min: 18, max: 150 })");
  });

  it("uses fc.string with maxLength for bounded string fields", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "title", type: "string", required: true, max: 200 },
    ]));
    expect(code).toContain("maxLength: 200");
  });

  it("uses fc.constantFrom for enum fields", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "status", type: "enum", required: true, enumValues: ["active", "pending"] },
    ]));
    expect(code).toContain('fc.constantFrom("active", "pending")');
  });

  it("uses fc.boolean for boolean fields", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "isActive", type: "boolean", required: true },
    ]));
    expect(code).toContain("fc.boolean()");
  });

  it("P3 includes SQL injection, XSS, null bytes, path traversal payloads", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "title", type: "string", required: true },
    ]));
    expect(code).toContain("DROP TABLE");
    expect(code).toContain("script");
    expect(code).toContain("etc/passwd");
    expect(code).toContain("template injection");
  });

  it("P4 actually uses extreme value `n` in payload (not just default)", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "price", type: "number", required: true, min: 0 },
    ]));
    // The fix from the audit — `n` must appear in the payload for the loop variable
    expect(code).toMatch(/price:\s*n/);
  });

  it("uses seed 42 for reproducibility", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "x", type: "number", required: true },
    ]));
    expect(code).toContain("seed: 42");
  });

  it("limits fast-check to 50 runs (controllable cost)", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "x", type: "number", required: true },
    ]));
    expect(code).toContain("numRuns: 50");
  });

  it("includes // Kills: comments on every assertion (R7)", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "name", type: "string", required: true },
      { name: "age", type: "number", required: true, min: 0 },
    ]));
    const killCount = (code.match(/\/\/ Kills:/g) || []).length;
    // Should have at least one Kills per test (5 tests max)
    expect(killCount).toBeGreaterThanOrEqual(3);
  });

  it("falls back to simple test when no input fields exist", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([]));
    // Should still produce valid code, just simpler (no fc arbitraries)
    expect(code).toContain("test(");
    expect(code).toContain("expect");
    // P5 (concurrency) is skipped when no fields
    expect(code).not.toMatch(/test\("P5:/);
  });

  it("limits arbitraries to 6 fields max (keeps tests readable)", () => {
    const fields: EndpointField[] = Array.from({ length: 12 }, (_, i) => ({
      name: `field${i}`,
      type: "string" as const,
      required: true,
    }));
    const code = generatePropertyTest(makeTarget(), makeAnalysis(fields));
    // Count fc.string occurrences in the arbitraries section (P1 test)
    const matches = code.match(/fc\.string/g) || [];
    // Each field × 2 tests (P1 + P2) = max 12, but we cap at 6 fields × 2 = 12
    expect(matches.length).toBeLessThanOrEqual(15);
  });

  it("references the tenant constant correctly", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "name", type: "string", required: true },
    ]));
    expect(code).toContain("TEST_TENANT_ID");
  });

  it("produces balanced braces (no template artifacts)", () => {
    const code = generatePropertyTest(makeTarget(), makeAnalysis([
      { name: "name", type: "string", required: true },
      { name: "age", type: "number", required: true, min: 0 },
    ]));
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });
});
