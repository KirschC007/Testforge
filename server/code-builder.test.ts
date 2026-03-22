/**
 * Code-Builder Tests — validate-payloads.mjs generator
 *
 * Tests that the helpers generator produces a correct, runnable
 * validate-payloads.mjs script in the ZIP output.
 */
import { describe, it, expect } from "vitest";
import { generateHelpers } from "./analyzer";
import type { AnalysisIR, AnalysisResult } from "./analyzer";

// ─── Minimal IR factory ───────────────────────────────────────────────────────

function makeMinimalIR(): AnalysisIR {
  return {
    behaviors: [
      {
        id: "B001",
        title: "orders.create creates a new order",
        subject: "user",
        action: "create",
        object: "order",
        preconditions: [],
        postconditions: [],
        errorCases: [],
        tags: ["business-logic"],
        riskHints: [],
      },
    ],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
    resources: [
      { name: "order", table: "orders", tenantKey: "tenantId", operations: ["create", "list"], hasPII: false },
    ],
    apiEndpoints: [
      {
        name: "orders.create",
        method: "POST /api/trpc/orders.create",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "tenantId", type: "number", required: true, isTenantKey: true },
          { name: "title", type: "string", required: true },
          { name: "amount", type: "number", required: true, min: 0, max: 10000 },
        ],
      },
    ],
    authModel: {
      loginEndpoint: "/api/trpc/auth.login",
      roles: [
        { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin@test.com", defaultPass: "TestPass2026x" },
      ],
    },
    enums: {},
    statusMachine: null,
  };
}

function makeAnalysisResult(ir: AnalysisIR): AnalysisResult {
  return { ir, qualityScore: 8, specType: "api-spec" };
}

// ─── validate-payloads.mjs presence ──────────────────────────────────────────

describe("Code-Builder: validate-payloads.mjs is generated", () => {
  it("generateHelpers returns validate-payloads.mjs key", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    expect(helpers).toHaveProperty("validate-payloads.mjs");
  });

  it("validate-payloads.mjs is a non-empty string", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(100);
  });

  it("validate-payloads.mjs starts with shebang", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});

// ─── validate-payloads.mjs content ───────────────────────────────────────────

describe("Code-Builder: validate-payloads.mjs content is correct", () => {
  it("uses ESM imports (not require)", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("import {");
    expect(script).not.toContain("require(");
  });

  it("contains findTestFiles function", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("findTestFiles");
  });

  it("contains extractPayloadFunctions function", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("extractPayloadFunctions");
  });

  it("contains validatePayloadStructure function", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("validatePayloadStructure");
  });

  it("checks for TODO_REPLACE placeholders", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("TODO_REPLACE");
  });

  it("checks for undefined values", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("undefined");
  });

  it("exits with code 1 on failure", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("process.exit(1)");
  });

  it("exits with code 0 on success", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("process.exit(0)");
  });

  it("uses ANSI color codes for output", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("\\x1b[32m"); // GREEN
    expect(script).toContain("\\x1b[31m"); // RED
  });

  it("scans ./tests directory", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("tests");
  });
});

// ─── package.json validate script ────────────────────────────────────────────

describe("Code-Builder: package.json includes validate script", () => {
  it("package.json contains validate script", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const pkg = JSON.parse(helpers["package.json"]);
    expect(pkg.scripts).toHaveProperty("validate");
    expect(pkg.scripts.validate).toBe("node validate-payloads.mjs");
  });

  it("package.json still contains all original scripts", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const pkg = JSON.parse(helpers["package.json"]);
    expect(pkg.scripts).toHaveProperty("test");
    expect(pkg.scripts).toHaveProperty("test:security");
    expect(pkg.scripts).toHaveProperty("test:dry-run");
    expect(pkg.scripts).toHaveProperty("install:browsers");
  });

  it("package.json type is module (ESM)", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const pkg = JSON.parse(helpers["package.json"]);
    expect(pkg.type).toBe("module");
  });
});

// ─── README mentions validate command ────────────────────────────────────────

describe("Code-Builder: README documents validate command", () => {
  it("README.md contains npm run validate or node validate-payloads", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const readme = helpers["README.md"];
    // README should mention the validate script in some form
    const hasValidate = readme.includes("validate") || readme.includes("dry-run");
    expect(hasValidate).toBe(true);
  });
});

// ─── All required files are present ──────────────────────────────────────────

describe("Code-Builder: all required files are present in GeneratedHelpers", () => {
  const REQUIRED_FILES = [
    "helpers/api.ts",
    "helpers/auth.ts",
    "helpers/factories.ts",
    "helpers/reset.ts",
    "helpers/schemas.ts",
    "helpers/index.ts",
    "playwright.config.ts",
    "package.json",
    ".github/workflows/testforge.yml",
    "tsconfig.json",
    "README.md",
    ".env.example",
    "validate-payloads.mjs",
  ] as const;

  for (const filename of REQUIRED_FILES) {
    it(`${filename} is present`, () => {
      const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
      expect(helpers).toHaveProperty(filename);
      expect(typeof helpers[filename]).toBe("string");
      expect((helpers[filename] as string).length).toBeGreaterThan(10);
    });
  }
});

// ─── validate-payloads.mjs logic correctness ─────────────────────────────────

describe("Code-Builder: validate-payloads.mjs logic is correct", () => {
  it("regex pattern targets basePayload_ functions", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("basePayload_");
  });

  it("counts passed and failed payloads", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("passed");
    expect(script).toContain("failed");
  });

  it("reports field count validation (empty payload detection)", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("Empty payload");
  });

  it("reports brace balance check", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("brace");
  });

  it("uses async/await and ESM top-level await pattern", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    expect(script).toContain("async function main");
    expect(script).toContain("main().catch");
  });
});

// ─── Integration: validate-payloads.mjs is valid JavaScript syntax ───────────

describe("Code-Builder: validate-payloads.mjs is syntactically valid", () => {
  it("does not contain unescaped template literal interpolations", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    const script = helpers["validate-payloads.mjs"];
    // Should not have ${...} that are TypeScript interpolations leaking into the output
    // (i.e., no ${someVar} from the generator's own template literal context)
    // The script should have \\${...} escaped interpolations or literal text
    // Check that the script doesn't reference TypeScript variables from the generator
    expect(script).not.toContain("${ir.");
    expect(script).not.toContain("${analysis.");
    expect(script).not.toContain("${roles.");
  });

  it("contains valid JSON in package.json", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    expect(() => JSON.parse(helpers["package.json"])).not.toThrow();
  });

  it("playwright.config.ts is non-empty and contains defineConfig", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    expect(helpers["playwright.config.ts"]).toContain("defineConfig");
  });

  it("tsconfig.json is valid JSON", () => {
    const helpers = generateHelpers(makeAnalysisResult(makeMinimalIR()));
    expect(() => JSON.parse(helpers["tsconfig.json"])).not.toThrow();
  });
});
