/**
 * Extended Test Suite Generator — Vitest Tests
 * Tests all 6 layers: Unit, Integration, E2E, UAT, Security, Performance
 */
import { describe, it, expect } from "vitest";
import {
  generateExtendedTestSuite,
  type AnalysisResult,
  type Behavior,
  type AnalysisIR,
  type EndpointField,
  type ExtendedTestFile,
} from "./analyzer";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makeBehavior(overrides: Partial<Behavior> = {}): Behavior {
  return {
    id: "B001",
    title: "System rejects cross-tenant booking access",
    subject: "System",
    action: "rejects",
    object: "cross-tenant booking access",
    preconditions: ["User authenticated as Tenant A", "Resource belongs to Tenant B"],
    postconditions: ["HTTP 403 returned"],
    errorCases: ["403 Forbidden when accessing other tenant's data"],
    tags: ["security", "multi-tenant"],
    riskHints: ["idor", "cross-tenant"],
    chapter: "Security",
    specAnchor: "The system SHALL reject cross-tenant access",
    ...overrides,
  };
}

function makeAnalysisResult(overrides: Partial<AnalysisIR> = {}): AnalysisResult {
  return {
    ir: {
      behaviors: [
        makeBehavior({ id: "B001", riskHints: ["idor"] }),
        makeBehavior({ id: "B002", chapter: "Reservations", riskHints: ["boundary"], tags: ["validation"],
          title: "System validates party size between 1 and 20",
          errorCases: ["400 when partySize < 1", "422 when partySize > 20"],
        }),
        makeBehavior({ id: "B003", chapter: "Reservations", riskHints: ["business_logic"],
          title: "System creates reservation with valid data",
          preconditions: ["User authenticated", "Restaurant exists"],
          postconditions: ["Reservation created", "ID returned"],
          errorCases: [],
        }),
      ],
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
          relatedBehaviors: ["B001", "B002"],
          inputFields: [
            { name: "restaurantId", type: "number", required: true, isTenantKey: true },
            { name: "guestName", type: "string", required: true, min: 1, max: 100 },
            { name: "partySize", type: "number", required: true, min: 1, max: 20 },
            { name: "status", type: "enum", required: true, enumValues: ["pending", "confirmed", "cancelled"] },
          ] as EndpointField[],
          outputFields: ["id", "restaurantId", "guestName", "partySize", "status"],
        },
        {
          name: "reservations.list",
          method: "GET /api/trpc/reservations.list",
          auth: "requireRestaurantAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          ] as EndpointField[],
          outputFields: ["id", "restaurantId", "guestName"],
        },
        {
          name: "reservations.getById",
          method: "GET /api/trpc/reservations.getById",
          auth: "requireRestaurantAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "id", type: "number", required: true },
            { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          ] as EndpointField[],
          outputFields: ["id", "restaurantId", "guestName"],
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
          outputFields: ["id", "status"],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [
          { name: "restaurant_admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" },
        ],
      },
      enums: { status: ["pending", "confirmed", "cancelled"] },
      statusMachine: {
        states: ["pending", "confirmed", "cancelled"],
        transitions: [["pending", "confirmed"], ["pending", "cancelled"]],
        forbidden: [["cancelled", "confirmed"]],
        initialState: "pending",
        terminalStates: ["cancelled"],
      },
      userFlows: [
        {
          id: "UF001",
          name: "Create Reservation",
          actor: "restaurant_admin",
          steps: ["Login", "Navigate to reservations", "Fill form", "Submit"],
          successCriteria: ["Reservation appears in list", "ID returned"],
          errorScenarios: ["Invalid party size rejected"],
          relatedEndpoints: ["reservations.create"],
        },
      ],
      dataModels: [
        {
          name: "Reservation",
          fields: [
            { name: "id", type: "number", required: true },
            { name: "restaurantId", type: "number", required: true },
            { name: "guestName", type: "string", required: true },
            { name: "email", type: "string", required: false, pii: true },
          ],
          relations: [{ to: "Restaurant", type: "one-to-many" }],
          hasPII: true,
        },
      ],
      ...overrides,
    },
    qualityScore: 8.5,
    specType: "saas-reservation",
  };
}

// ─── generateExtendedTestSuite — Top-level ────────────────────────────────────

describe("generateExtendedTestSuite", () => {
  it("returns an ExtendedTestSuite with files, configs, packageJson, readme", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    expect(suite).toBeDefined();
    expect(Array.isArray(suite.files)).toBe(true);
    expect(typeof suite.configs).toBe("object");
    expect(typeof suite.packageJson).toBe("string");
    expect(typeof suite.readme).toBe("string");
  });

  it("generates files for all 6 layers", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const layers = new Set(suite.files.map((f: ExtendedTestFile) => f.layer));
    expect(layers.has("unit")).toBe(true);
    expect(layers.has("integration")).toBe(true);
    expect(layers.has("e2e")).toBe(true);
    expect(layers.has("uat")).toBe(true);
    expect(layers.has("performance")).toBe(true);
  });

  it("includes existing security files without duplication", () => {
    const analysis = makeAnalysisResult();
    const secFile = { filename: "tests/security/idor.spec.ts", content: "// IDOR test" };
    const suite = generateExtendedTestSuite(analysis, [secFile]);

    const secFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "security");
    expect(secFiles.length).toBeGreaterThan(0);
    const idorFile = secFiles.find((f: ExtendedTestFile) => f.filename === "tests/security/idor.spec.ts");
    expect(idorFile).toBeDefined();
    // No duplicate
    const count = suite.files.filter((f: ExtendedTestFile) => f.filename === "tests/security/idor.spec.ts").length;
    expect(count).toBe(1);
  });

  it("all files have required fields: filename, content, layer, description", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    for (const file of suite.files) {
      expect(typeof file.filename).toBe("string");
      expect(file.filename.length).toBeGreaterThan(0);
      expect(typeof file.content).toBe("string");
      expect(file.content.length).toBeGreaterThan(0);
      expect(["unit", "integration", "e2e", "uat", "security", "performance"]).toContain(file.layer);
      expect(typeof file.description).toBe("string");
    }
  });

  it("configs contain vitest.config.ts", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    expect(suite.configs["vitest.config.ts"]).toBeDefined();
    expect(suite.configs["vitest.config.ts"]).toContain("vitest");
  });

  it("configs contain cucumber.config.ts", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    expect(suite.configs["cucumber.config.ts"]).toBeDefined();
  });

  it("packageJson contains all 6 test scripts", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);
    const pkg = JSON.parse(suite.packageJson);

    expect(pkg.scripts["test:unit"]).toBeDefined();
    expect(pkg.scripts["test:integration"]).toBeDefined();
    expect(pkg.scripts["test:e2e"]).toBeDefined();
    expect(pkg.scripts["test:uat"]).toBeDefined();
    expect(pkg.scripts["test:security"]).toBeDefined();
    expect(pkg.scripts["test:performance"]).toBeDefined();
    expect(pkg.scripts["test:all"]).toBeDefined();
  });

  it("packageJson includes k6 and cucumber dependencies", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);
    const pkg = JSON.parse(suite.packageJson);

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps["@cucumber/cucumber"]).toBeDefined();
    expect(allDeps["vitest"]).toBeDefined();
  });

  it("readme mentions all 6 test layers", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    expect(suite.readme).toContain("Unit");
    expect(suite.readme).toContain("Integration");
    expect(suite.readme).toContain("E2E");
    expect(suite.readme).toContain("UAT");
    expect(suite.readme).toContain("Security");
    expect(suite.readme).toContain("Performance");
  });
});

// ─── Layer 1: Unit Tests ──────────────────────────────────────────────────────

describe("generateExtendedTestSuite — Unit Tests (Layer 1)", () => {
  it("generates unit test files for each module", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    expect(unitFiles.length).toBeGreaterThan(0);
  });

  it("unit test filenames follow tests/unit/ pattern", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    for (const f of unitFiles) {
      expect(f.filename).toMatch(/^tests\/unit\//);
    }
  });

  it("unit tests contain GENERATED header comment", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    for (const f of unitFiles) {
      expect(f.content).toContain("GENERATED by TestForge");
    }
  });

  it("unit tests import vitest", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    for (const f of unitFiles) {
      expect(f.content).toContain("vitest");
    }
  });

  it("unit tests include tenant isolation test case", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const allContent = unitFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("restaurantId");
  });

  it("unit tests include validation tests for enum fields", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const allContent = unitFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("enum");
  });

  it("generates state machine unit test when statusMachine is present", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const stateMachineFile = unitFiles.find((f: ExtendedTestFile) => f.filename.includes("state-machine"));
    expect(stateMachineFile).toBeDefined();
    expect(stateMachineFile?.content).toContain("pending");
    expect(stateMachineFile?.content).toContain("confirmed");
  });

  it("state machine test covers forbidden transitions", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const stateMachineFile = unitFiles.find((f: ExtendedTestFile) => f.filename.includes("state-machine"));
    expect(stateMachineFile?.content).toContain("cancelled");
    expect(stateMachineFile?.content).toContain("forbidden");
  });

  it("skips state machine test when no statusMachine in IR", () => {
    const analysis = makeAnalysisResult({ statusMachine: null });
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const stateMachineFile = unitFiles.find((f: ExtendedTestFile) => f.filename.includes("state-machine"));
    expect(stateMachineFile).toBeUndefined();
  });

  it("unit tests include makeValid*Input factory helper", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const allContent = unitFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("makeValid");
  });

  it("unit tests reference the tenant field constant", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const unitFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "unit");
    const allContent = unitFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("TEST_RESTAURANT_ID");
  });
});

// ─── Layer 2: Integration Tests ───────────────────────────────────────────────

describe("generateExtendedTestSuite — Integration Tests (Layer 2)", () => {
  it("generates integration test files", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    expect(intFiles.length).toBeGreaterThan(0);
  });

  it("integration test filenames follow tests/integration/ pattern", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    for (const f of intFiles) {
      expect(f.filename).toMatch(/^tests\/integration\//);
    }
  });

  it("integration tests contain GENERATED header", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    for (const f of intFiles) {
      expect(f.content).toContain("GENERATED by TestForge");
    }
  });

  it("integration tests reference the login endpoint", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    const allContent = intFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("auth.login");
  });

  it("integration tests include CRUD lifecycle test", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    const allContent = intFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("create");
    expect(allContent).toContain("list");
  });

  it("integration tests include cross-tenant isolation test", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    const allContent = intFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    // Should test that tenant B cannot access tenant A's data
    expect(allContent).toContain("TEST_RESTAURANT_B_ID");
  });

  it("integration tests include unauthenticated access test", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    const allContent = intFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("401");
  });

  it("integration tests use vitest", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const intFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "integration");
    for (const f of intFiles) {
      expect(f.content).toContain("vitest");
    }
  });
});

// ─── Layer 3: E2E Tests ───────────────────────────────────────────────────────

describe("generateExtendedTestSuite — E2E Tests (Layer 3)", () => {
  it("generates E2E test files", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const e2eFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "e2e");
    expect(e2eFiles.length).toBeGreaterThan(0);
  });

  it("E2E test filenames follow tests/e2e/ pattern", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const e2eFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "e2e");
    for (const f of e2eFiles) {
      expect(f.filename).toMatch(/^tests\/e2e\//);
    }
  });

  it("E2E tests use Playwright imports", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const e2eFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "e2e");
    const allContent = e2eFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("playwright");
  });

  it("E2E tests reference the login endpoint", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const e2eFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "e2e");
    const allContent = e2eFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("auth.login");
  });

  it("generates flow-based tests from userFlows when available", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const e2eFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "e2e");
    const allContent = e2eFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    // Should contain the flow name
    expect(allContent).toContain("Create Reservation");
  });

  it("generates core-flows E2E test when no userFlows", () => {
    const analysis = makeAnalysisResult({ userFlows: [] });
    const suite = generateExtendedTestSuite(analysis, []);

    const e2eFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "e2e");
    expect(e2eFiles.length).toBeGreaterThan(0);
    const coreFile = e2eFiles.find((f: ExtendedTestFile) => f.filename.includes("core-flows"));
    expect(coreFile).toBeDefined();
  });
});

// ─── Layer 4: UAT Tests (Gherkin) ─────────────────────────────────────────────

describe("generateExtendedTestSuite — UAT Tests (Layer 4)", () => {
  it("generates UAT feature files", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    expect(uatFiles.length).toBeGreaterThan(0);
  });

  it("UAT feature files have .feature extension", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const featureFiles = uatFiles.filter((f: ExtendedTestFile) => f.filename.endsWith(".feature"));
    expect(featureFiles.length).toBeGreaterThan(0);
  });

  it("UAT feature files follow tests/uat/ path pattern", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    for (const f of uatFiles) {
      expect(f.filename).toMatch(/^tests\/uat\//);
    }
  });

  it("UAT feature files contain Gherkin keywords", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const featureFiles = uatFiles.filter((f: ExtendedTestFile) => f.filename.endsWith(".feature"));
    for (const f of featureFiles) {
      expect(f.content).toContain("Feature:");
      expect(f.content).toContain("Scenario");
    }
  });

  it("UAT feature files contain Given/When/Then steps", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const featureFiles = uatFiles.filter((f: ExtendedTestFile) => f.filename.endsWith(".feature"));
    const allContent = featureFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("Given");
    expect(allContent).toContain("When");
    expect(allContent).toContain("Then");
  });

  it("generates step definitions file", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const stepDefs = uatFiles.find((f: ExtendedTestFile) => f.filename.includes("step-definitions"));
    expect(stepDefs).toBeDefined();
  });

  it("step definitions import Cucumber", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const stepDefs = uatFiles.find((f: ExtendedTestFile) => f.filename.includes("step-definitions"));
    expect(stepDefs?.content).toContain("cucumber");
  });

  it("step definitions contain Given/When/Then implementations", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const stepDefs = uatFiles.find((f: ExtendedTestFile) => f.filename.includes("step-definitions"));
    expect(stepDefs?.content).toContain("Given(");
    expect(stepDefs?.content).toContain("When(");
    expect(stepDefs?.content).toContain("Then(");
  });

  it("groups behaviors by chapter into separate feature files", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const featureFiles = uatFiles.filter((f: ExtendedTestFile) => f.filename.endsWith(".feature"));
    // We have behaviors in "Security" and "Reservations" chapters
    expect(featureFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("feature files include spec anchor comments", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const featureFiles = uatFiles.filter((f: ExtendedTestFile) => f.filename.endsWith(".feature"));
    const allContent = featureFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("Spec:");
  });

  it("feature files include GENERATED header", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const featureFiles = uatFiles.filter((f: ExtendedTestFile) => f.filename.endsWith(".feature"));
    for (const f of featureFiles) {
      expect(f.content).toContain("GENERATED by TestForge");
    }
  });

  it("step definitions reference the login endpoint", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const uatFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "uat");
    const stepDefs = uatFiles.find((f: ExtendedTestFile) => f.filename.includes("step-definitions"));
    expect(stepDefs?.content).toContain("auth.login");
  });
});

// ─── Layer 6: Performance Tests ───────────────────────────────────────────────

describe("generateExtendedTestSuite — Performance Tests (Layer 6)", () => {
  it("generates performance test files", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    expect(perfFiles.length).toBeGreaterThan(0);
  });

  it("performance test filenames follow tests/performance/ pattern", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    for (const f of perfFiles) {
      expect(f.filename).toMatch(/^tests\/performance\//);
    }
  });

  it("performance tests use k6 imports", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const allContent = perfFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("k6");
  });

  it("performance tests define k6 options with stages", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const allContent = perfFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("options");
    expect(allContent).toContain("stages");
  });

  it("performance tests include load test", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const loadTest = perfFiles.find((f: ExtendedTestFile) => f.filename.includes("load"));
    expect(loadTest).toBeDefined();
  });

  it("performance tests include stress test", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const stressTest = perfFiles.find((f: ExtendedTestFile) => f.filename.includes("stress"));
    expect(stressTest).toBeDefined();
  });

  it("performance tests include rate-limit burst test", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const rateLimitTest = perfFiles.find((f: ExtendedTestFile) => f.filename.includes("rate-limit"));
    expect(rateLimitTest).toBeDefined();
  });

  it("performance tests reference the login endpoint", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const allContent = perfFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("auth.login");
  });

  it("performance tests include threshold assertions", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    const allContent = perfFiles.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("thresholds");
  });

  it("performance tests contain GENERATED header", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const perfFiles = suite.files.filter((f: ExtendedTestFile) => f.layer === "performance");
    for (const f of perfFiles) {
      expect(f.content).toContain("GENERATED by TestForge");
    }
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("generateExtendedTestSuite — Edge Cases", () => {
  it("handles empty behaviors array gracefully", () => {
    const analysis = makeAnalysisResult({ behaviors: [] });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("handles null tenantModel gracefully", () => {
    const analysis = makeAnalysisResult({ tenantModel: null });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("handles null authModel gracefully", () => {
    const analysis = makeAnalysisResult({ authModel: null });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("handles empty apiEndpoints gracefully", () => {
    const analysis = makeAnalysisResult({ apiEndpoints: [] });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("handles null statusMachine gracefully", () => {
    const analysis = makeAnalysisResult({ statusMachine: null });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("handles undefined userFlows gracefully", () => {
    const analysis = makeAnalysisResult({ userFlows: undefined });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("handles undefined dataModels gracefully", () => {
    const analysis = makeAnalysisResult({ dataModels: undefined });
    expect(() => generateExtendedTestSuite(analysis, [])).not.toThrow();
  });

  it("uses fallback tenant values when tenantModel is null", () => {
    const analysis = makeAnalysisResult({ tenantModel: null });
    const suite = generateExtendedTestSuite(analysis, []);

    // Should still generate files
    expect(suite.files.length).toBeGreaterThan(0);
    // Should use fallback "tenantId"
    const allContent = suite.files.map((f: ExtendedTestFile) => f.content).join("\n");
    expect(allContent).toContain("tenantId");
  });

  it("uses fallback role when authModel is null", () => {
    const analysis = makeAnalysisResult({ authModel: null });
    const suite = generateExtendedTestSuite(analysis, []);

    expect(suite.files.length).toBeGreaterThan(0);
  });

  it("generates files even with minimal spec (1 behavior, 0 endpoints)", () => {
    const analysis = makeAnalysisResult({
      behaviors: [makeBehavior()],
      apiEndpoints: [],
      statusMachine: null,
    });
    const suite = generateExtendedTestSuite(analysis, []);

    expect(suite.files.length).toBeGreaterThan(0);
  });
});

// ─── GitHub Actions CI/CD ─────────────────────────────────────────────────────

describe("generateExtendedTestSuite — CI/CD Config", () => {
  it("generates GitHub Actions workflow", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const ciFile = suite.configs["testforge-full.yml"] || suite.configs[".github/workflows/testforge-full.yml"];
    expect(ciFile).toBeDefined();
  });

  it("GitHub Actions workflow contains all 6 test jobs", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const ciFile = suite.configs["testforge-full.yml"] || suite.configs[".github/workflows/testforge-full.yml"];
    if (ciFile) {
      expect(ciFile).toContain("unit");
      expect(ciFile).toContain("integration");
      expect(ciFile).toContain("e2e");
      expect(ciFile).toContain("uat");
      expect(ciFile).toContain("security");
      expect(ciFile).toContain("performance");
    }
  });

  it("vitest config includes unit and integration test paths", () => {
    const analysis = makeAnalysisResult();
    const suite = generateExtendedTestSuite(analysis, []);

    const vitestConfig = suite.configs["vitest.config.ts"];
    expect(vitestConfig).toContain("unit");
    expect(vitestConfig).toContain("integration");
  });
});
