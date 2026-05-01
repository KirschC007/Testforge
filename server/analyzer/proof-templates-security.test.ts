/**
 * Security Proof Templates — Unit Tests
 *
 * Verifies all 7 security template generators produce valid Playwright code
 * with the right // Kills: comments and assertion structure.
 */
import { describe, it, expect } from "vitest";
import {
  generateSQLInjectionTest,
  generateHardcodedSecretTest,
  generateNegativeAmountTest,
  generateAMLBypassTest,
  generateCrossTenantChainTest,
  generateConcurrentWriteTest,
  generateMassAssignmentTest,
} from "./proof-templates-security";
import type { ProofTarget, AnalysisResult, EndpointField } from "./types";

function makeTarget(proofType: ProofTarget["proofType"], overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: `T_${proofType.toUpperCase()}_001`,
    behaviorId: "B001",
    proofType,
    riskLevel: "high",
    description: `${proofType} test`,
    preconditions: [],
    assertions: [],
    mutationTargets: [
      { description: "Mutation A", expectedKill: true },
    ],
    endpoint: "users.create",
    ...overrides,
  };
}

function makeAnalysis(): AnalysisResult {
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
            { name: "name", type: "string", required: true, max: 100 },
            { name: "email", type: "string", required: true },
            { name: "amount", type: "number", required: true, min: 0 },
            { name: "search", type: "string", required: false },
          ] as EndpointField[],
        },
        {
          name: "users.list",
          method: "GET /api/trpc/users.list",
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "search", type: "string", required: false },
          ] as EndpointField[],
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
    specType: "test",
  };
}

const SHARED_REQUIREMENTS = (code: string) => {
  // Every generated security test must:
  // 1. Import Playwright
  expect(code).toMatch(/import.*from "@playwright\/test"/);
  // 2. Have at least one test() block
  expect(code).toMatch(/test\(/);
  // 3. Have // Kills: comments (R7)
  expect(code).toContain("// Kills:");
  // 4. Have balanced braces
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  expect(opens).toBe(closes);
};

describe("generateSQLInjectionTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateSQLInjectionTest(makeTarget("sql_injection"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("includes classic SQL injection payloads", () => {
    const code = generateSQLInjectionTest(makeTarget("sql_injection"), makeAnalysis());
    expect(code).toMatch(/OR '1'='1/);
    expect(code).toMatch(/DROP TABLE/);
    expect(code).toMatch(/UNION SELECT/);
  });

  it("uses search field when present", () => {
    const code = generateSQLInjectionTest(
      makeTarget("sql_injection", { endpoint: "users.list" }),
      makeAnalysis(),
    );
    expect(code).toContain("search");
  });
});

describe("generateHardcodedSecretTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateHardcodedSecretTest(makeTarget("hardcoded_secret"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("checks for secret-like patterns in responses", () => {
    const code = generateHardcodedSecretTest(makeTarget("hardcoded_secret"), makeAnalysis());
    // Should match patterns indicating secret leakage testing
    expect(code).toMatch(/password|secret|key|token/i);
  });
});

describe("generateNegativeAmountTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateNegativeAmountTest(makeTarget("negative_amount"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("attempts negative numeric values", () => {
    const code = generateNegativeAmountTest(makeTarget("negative_amount"), makeAnalysis());
    expect(code).toMatch(/-\d+|negative/i);
  });
});

describe("generateAMLBypassTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateAMLBypassTest(makeTarget("aml_bypass"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("references AML / threshold concepts", () => {
    const code = generateAMLBypassTest(makeTarget("aml_bypass"), makeAnalysis());
    expect(code).toMatch(/aml|threshold|structuring|smurfing|velocity|10000|9999/i);
  });
});

describe("generateCrossTenantChainTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateCrossTenantChainTest(makeTarget("cross_tenant_chain"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("references multiple tenants", () => {
    const code = generateCrossTenantChainTest(makeTarget("cross_tenant_chain"), makeAnalysis());
    // Should test at least 2 tenants (A and B)
    expect(code).toMatch(/TENANT_B|TENANT_A|tenantB|tenantA|other/i);
  });
});

describe("generateConcurrentWriteTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateConcurrentWriteTest(makeTarget("concurrent_write"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("uses Promise.all to issue concurrent requests", () => {
    const code = generateConcurrentWriteTest(makeTarget("concurrent_write"), makeAnalysis());
    expect(code).toContain("Promise.all");
  });
});

describe("generateMassAssignmentTest", () => {
  it("produces valid Playwright code", () => {
    const code = generateMassAssignmentTest(makeTarget("mass_assignment"), makeAnalysis());
    SHARED_REQUIREMENTS(code);
  });

  it("attempts to inject privileged fields like role/isAdmin", () => {
    const code = generateMassAssignmentTest(makeTarget("mass_assignment"), makeAnalysis());
    // Mass assignment exploits typically inject role/isAdmin/permissions
    expect(code).toMatch(/role|admin|isAdmin|permission|privilege/i);
  });
});

describe("All security templates — common contracts", () => {
  const generators = [
    { name: "SQL Injection", fn: generateSQLInjectionTest, type: "sql_injection" as const },
    { name: "Hardcoded Secret", fn: generateHardcodedSecretTest, type: "hardcoded_secret" as const },
    { name: "Negative Amount", fn: generateNegativeAmountTest, type: "negative_amount" as const },
    { name: "AML Bypass", fn: generateAMLBypassTest, type: "aml_bypass" as const },
    { name: "Cross-Tenant Chain", fn: generateCrossTenantChainTest, type: "cross_tenant_chain" as const },
    { name: "Concurrent Write", fn: generateConcurrentWriteTest, type: "concurrent_write" as const },
    { name: "Mass Assignment", fn: generateMassAssignmentTest, type: "mass_assignment" as const },
  ];

  for (const { name, fn, type } of generators) {
    it(`${name} — uses adminCookie (no plain credentials in code)`, () => {
      const code = fn(makeTarget(type), makeAnalysis());
      // Should use a cookie variable, not plain text password
      expect(code).toMatch(/adminCookie|getAdminCookie|process\.env\./);
    });

    it(`${name} — does NOT contain TODO_REPLACE artifacts`, () => {
      const code = fn(makeTarget(type), makeAnalysis());
      expect(code).not.toContain("TODO_REPLACE_WITH_YOUR_ENDPOINT");
    });

    it(`${name} — references the target proof ID for traceability`, () => {
      const code = fn(makeTarget(type), makeAnalysis());
      expect(code).toContain("T_");
    });
  }
});
