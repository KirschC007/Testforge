/**
 * Helpers Generator — Unit Tests
 *
 * Verifies the generated package layout: api.ts, auth.ts, factories.ts, schemas.ts,
 * package.json, playwright.config.ts, GitHub Actions, validate-payloads.mjs, heal.mjs,
 * and stryker.config.json all produce valid output for various IR shapes.
 */
import { describe, it, expect } from "vitest";
import { generateHelpers } from "./helpers-generator";
import type { AnalysisResult, EndpointField, AnalysisIR } from "./types";

function makeAnalysis(overrides: Partial<AnalysisIR> = {}): AnalysisResult {
  return {
    ir: {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
      resources: [{ name: "users", table: "users", tenantKey: "tenantId", operations: ["create", "read"], hasPII: true }],
      apiEndpoints: [
        {
          name: "users.create",
          method: "POST /api/trpc/users.create",
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "email", type: "string", required: true },
            { name: "name", type: "string", required: true },
          ] as EndpointField[],
        },
        {
          name: "users.list",
          method: "GET /api/trpc/users.list",
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
          ] as EndpointField[],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [{
          name: "admin",
          envUserVar: "E2E_ADMIN_USER",
          envPassVar: "E2E_ADMIN_PASS",
          defaultUser: "test-admin",
          defaultPass: "TestPass2026x",
        }],
      },
      enums: {},
      statusMachine: null,
      ...overrides,
    },
    qualityScore: 8,
    specType: "test",
  };
}

describe("generateHelpers — file structure", () => {
  it("returns all required files", () => {
    const helpers = generateHelpers(makeAnalysis());
    const expected = [
      "helpers/api.ts",
      "helpers/auth.ts",
      "helpers/factories.ts",
      "helpers/reset.ts",
      "helpers/schemas.ts",
      "helpers/index.ts",
      "helpers/browser.ts",
      "playwright.config.ts",
      "package.json",
      "stryker.config.json",
      ".github/workflows/testforge.yml",
      "tsconfig.json",
      "README.md",
      ".env.example",
      "validate-payloads.mjs",
      "heal.mjs",
    ];
    for (const f of expected) {
      expect(helpers[f as keyof typeof helpers], `missing file: ${f}`).toBeDefined();
    }
  });
});

describe("generateHelpers — helpers/api.ts", () => {
  it("exports BASE_URL, loginAndGetCookie, trpcMutation, trpcQuery, pollUntil", () => {
    const api = generateHelpers(makeAnalysis())["helpers/api.ts"];
    expect(api).toContain("export const BASE_URL");
    expect(api).toContain("export async function loginAndGetCookie");
    expect(api).toContain("export async function trpcMutation");
    expect(api).toContain("export async function trpcQuery");
    expect(api).toContain("export async function pollUntil");
  });

  it("includes the configured login endpoint", () => {
    const api = generateHelpers(makeAnalysis())["helpers/api.ts"];
    expect(api).toContain("/api/trpc/auth.login");
  });

  it("strips HTTP method prefix from loginEndpoint URL", () => {
    const analysis = makeAnalysis({
      authModel: {
        loginEndpoint: "POST /api/auth/login",
        roles: [{ name: "admin", envUserVar: "X", envPassVar: "Y", defaultUser: "a", defaultPass: "b" }],
      },
    });
    const api = generateHelpers(analysis)["helpers/api.ts"];
    expect(api).toContain("/api/auth/login");
    // The URL string passed to fetch must not include "POST " prefix
    expect(api).toMatch(/`\$\{BASE_URL\}\/api\/auth\/login`/);
  });

  it("supports both tRPC and REST login endpoints", () => {
    const restAnalysis = makeAnalysis({
      authModel: {
        loginEndpoint: "/api/auth/login",
        roles: [{ name: "admin", envUserVar: "X", envPassVar: "Y", defaultUser: "a", defaultPass: "b" }],
      },
    });
    const api = generateHelpers(restAnalysis)["helpers/api.ts"];
    expect(api).toContain("isTrpc");
  });
});

describe("generateHelpers — helpers/auth.ts", () => {
  it("generates getXCookie function for each role", () => {
    const analysis = makeAnalysis({
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [
          { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin", defaultPass: "p" },
          { name: "manager", envUserVar: "E2E_MANAGER_USER", envPassVar: "E2E_MANAGER_PASS", defaultUser: "mgr", defaultPass: "p" },
        ],
      },
    });
    const auth = generateHelpers(analysis)["helpers/auth.ts"];
    expect(auth).toContain("getAdminCookie");
    expect(auth).toContain("getManagerCookie");
  });

  it("provides getAdminCookie alias when no role generates it", () => {
    const analysis = makeAnalysis({
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [{ name: "owner", envUserVar: "E2E_OWNER_USER", envPassVar: "E2E_OWNER_PASS", defaultUser: "owner", defaultPass: "p" }],
      },
    });
    const auth = generateHelpers(analysis)["helpers/auth.ts"];
    expect(auth).toContain("getAdminCookie");
    expect(auth).toContain("getOwnerCookie");
  });
});

describe("generateHelpers — helpers/factories.ts", () => {
  it("exports TEST_TENANT_ID and TEST_TENANT_B_ID constants", () => {
    const factories = generateHelpers(makeAnalysis())["helpers/factories.ts"];
    expect(factories).toContain("TEST_TENANT_ID");
    expect(factories).toContain("TEST_TENANT_B_ID");
  });

  it("creates tenant-entity-specific aliases for non-tenant entities", () => {
    const analysis = makeAnalysis({
      tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
    });
    const factories = generateHelpers(analysis)["helpers/factories.ts"];
    expect(factories).toContain("TEST_RESTAURANT_ID");
    expect(factories).toContain("TEST_RESTAURANT_B_ID");
  });

  it("generates createTestResource for create endpoints", () => {
    const factories = generateHelpers(makeAnalysis())["helpers/factories.ts"];
    expect(factories).toContain("createTestResource");
  });
});

describe("generateHelpers — helpers/schemas.ts (Zod)", () => {
  it("imports zod", () => {
    const schemas = generateHelpers(makeAnalysis())["helpers/schemas.ts"];
    expect(schemas).toContain('import { z } from "zod"');
  });

  it("exports validateSchema helper", () => {
    const schemas = generateHelpers(makeAnalysis())["helpers/schemas.ts"];
    expect(schemas).toContain("validateSchema");
  });

  it("generates z.object schemas for endpoints with fields", () => {
    const schemas = generateHelpers(makeAnalysis())["helpers/schemas.ts"];
    expect(schemas).toContain("z.object");
  });

  it("uses z.enum for enum fields", () => {
    const analysis = makeAnalysis({
      apiEndpoints: [{
        name: "things.create",
        method: "POST",
        auth: "auth",
        relatedBehaviors: [],
        inputFields: [
          { name: "tenantId", type: "number", required: true, isTenantKey: true },
          { name: "status", type: "enum", required: true, enumValues: ["a", "b", "c"] },
        ] as EndpointField[],
      }],
    });
    const schemas = generateHelpers(analysis)["helpers/schemas.ts"];
    expect(schemas).toContain("z.enum");
  });
});

describe("generateHelpers — package.json", () => {
  it("is valid JSON", () => {
    const pkg = generateHelpers(makeAnalysis())["package.json"];
    expect(() => JSON.parse(pkg)).not.toThrow();
  });

  it("includes required dependencies", () => {
    const pkg = JSON.parse(generateHelpers(makeAnalysis())["package.json"]);
    expect(pkg.dependencies.zod).toBeDefined();
    expect(pkg.dependencies["fast-check"]).toBeDefined();
  });

  it("includes Playwright + axe-core + Stryker in devDependencies", () => {
    const pkg = JSON.parse(generateHelpers(makeAnalysis())["package.json"]);
    expect(pkg.devDependencies["@playwright/test"]).toBeDefined();
    expect(pkg.devDependencies["@axe-core/playwright"]).toBeDefined();
    expect(pkg.devDependencies["@stryker-mutator/core"]).toBeDefined();
  });

  it("includes test scripts: test, test:property, test:mutation, heal", () => {
    const pkg = JSON.parse(generateHelpers(makeAnalysis())["package.json"]);
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts["test:property"]).toBeDefined();
    expect(pkg.scripts["test:mutation"]).toBeDefined();
    expect(pkg.scripts.heal).toBeDefined();
  });
});

describe("generateHelpers — playwright.config.ts", () => {
  it("includes all test directories in testMatch", () => {
    const config = generateHelpers(makeAnalysis())["playwright.config.ts"];
    expect(config).toContain("tests/security");
    expect(config).toContain("tests/business");
    expect(config).toContain("tests/compliance");
    expect(config).toContain("tests/integration");
    expect(config).toContain("tests/concurrency");
    expect(config).toContain("tests/property");
    expect(config).toContain("tests/traffic");
    expect(config).toContain("tests/accessibility");
    expect(config).toContain("tests/e2e");
  });

  it("uses defineConfig from @playwright/test", () => {
    const config = generateHelpers(makeAnalysis())["playwright.config.ts"];
    expect(config).toContain('from "@playwright/test"');
    expect(config).toContain("defineConfig");
  });

  it("includes 5 cross-browser/responsive projects", () => {
    const config = generateHelpers(makeAnalysis())["playwright.config.ts"];
    expect(config).toContain('name: "browser-e2e"');     // Chromium
    expect(config).toContain('name: "firefox-e2e"');      // Firefox
    expect(config).toContain('name: "webkit-e2e"');       // Safari engine
    expect(config).toContain('name: "mobile-chrome"');    // Pixel 5
    expect(config).toContain('name: "mobile-safari"');    // iPhone 13
  });
});

describe("generateHelpers — heal.mjs", () => {
  it("is an executable Node script", () => {
    const heal = generateHelpers(makeAnalysis())["heal.mjs"];
    expect(heal).toContain("#!/usr/bin/env node");
  });

  it("uses fetch with timeout (AbortSignal)", () => {
    const heal = generateHelpers(makeAnalysis())["heal.mjs"];
    expect(heal).toContain("AbortSignal");
  });

  it("exits 1 on broken endpoints (CI integration)", () => {
    const heal = generateHelpers(makeAnalysis())["heal.mjs"];
    expect(heal).toContain("process.exit(1)");
  });
});

describe("generateHelpers — stryker.config.json", () => {
  it("is valid JSON", () => {
    const cfg = generateHelpers(makeAnalysis())["stryker.config.json"];
    expect(() => JSON.parse(cfg)).not.toThrow();
  });

  it("includes thresholds and command runner (stryker has no playwright-runner package)", () => {
    const cfg = JSON.parse(generateHelpers(makeAnalysis())["stryker.config.json"]);
    // Stryker's "command" runner invokes `npm test` — works with any test framework.
    // We don't use "playwright" runner because @stryker-mutator/playwright-runner doesn't exist on npm.
    expect(cfg.testRunner).toBe("command");
    expect(cfg.commandRunner?.command).toBe("npm test");
    expect(cfg.thresholds).toBeDefined();
    expect(cfg.thresholds.high).toBeGreaterThan(0);
  });
});

describe("generateHelpers — Phase 3 utilities", () => {
  it("includes analyze-flakiness.mjs", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["analyze-flakiness.mjs"]).toBeDefined();
    expect(helpers["analyze-flakiness.mjs"]).toContain("#!/usr/bin/env node");
    expect(helpers["analyze-flakiness.mjs"]).toContain("FLAKINESS_THRESHOLD");
  });

  it("analyze-flakiness.mjs reads playwright-report/results.json by default", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["analyze-flakiness.mjs"]).toContain("playwright-report");
    expect(helpers["analyze-flakiness.mjs"]).toContain("results.json");
  });

  it("analyze-flakiness.mjs detects retried tests as flaky", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["analyze-flakiness.mjs"]).toMatch(/attempts\.length\s*>\s*1/);
  });

  it("analyze-flakiness.mjs exits 1 when threshold exceeded", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["analyze-flakiness.mjs"]).toContain("process.exit(1)");
  });

  it("includes visual-diff-report.mjs", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["visual-diff-report.mjs"]).toBeDefined();
    expect(helpers["visual-diff-report.mjs"]).toContain("#!/usr/bin/env node");
  });

  it("visual-diff-report.mjs walks test-results for diff PNGs", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["visual-diff-report.mjs"]).toContain("test-results");
    expect(helpers["visual-diff-report.mjs"]).toContain("-diff.png");
  });

  it("visual-diff-report.mjs generates HTML output", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["visual-diff-report.mjs"]).toContain("<!DOCTYPE html>");
  });

  it("includes codegen-wrapper.mjs", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["codegen-wrapper.mjs"]).toBeDefined();
    expect(helpers["codegen-wrapper.mjs"]).toContain("playwright");
    expect(helpers["codegen-wrapper.mjs"]).toContain("codegen");
  });

  it("codegen-wrapper.mjs accepts URL via argv or BASE_URL env", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["codegen-wrapper.mjs"]).toContain("process.argv[2]");
    expect(helpers["codegen-wrapper.mjs"]).toContain("BASE_URL");
  });

  it("package.json scripts include all Phase 3 utilities", () => {
    const pkg = JSON.parse(generateHelpers(makeAnalysis())["package.json"]);
    expect(pkg.scripts["analyze:flakiness"]).toBeDefined();
    expect(pkg.scripts["report:visual-diff"]).toBeDefined();
    expect(pkg.scripts.codegen).toBeDefined();
  });
});

describe("generateHelpers — playwright debug artifacts", () => {
  it("enables trace, screenshot, video on failure", () => {
    const config = generateHelpers(makeAnalysis())["playwright.config.ts"];
    expect(config).toContain("trace:");
    expect(config).toContain("screenshot:");
    expect(config).toContain("video:");
    expect(config).toContain("retain-on-failure");
  });
});

describe("generateHelpers — README.md", () => {
  it("documents Quick Start", () => {
    const readme = generateHelpers(makeAnalysis())["README.md"];
    expect(readme).toContain("Quick Start");
    expect(readme).toContain("npm install");
    expect(readme).toContain("npm test");
  });
});

describe("generateHelpers — .env.example", () => {
  it("documents required env vars", () => {
    const env = generateHelpers(makeAnalysis())[".env.example"];
    expect(env).toContain("BASE_URL");
    expect(env).toContain("TEST_TENANT_ID");
    expect(env).toContain("TEST_TENANT_B_ID");
  });
});

describe("generateHelpers — robust to edge case IRs", () => {
  it("handles spec with no resources", () => {
    const analysis = makeAnalysis({ resources: [] });
    expect(() => generateHelpers(analysis)).not.toThrow();
  });

  it("handles spec with no apiEndpoints", () => {
    const analysis = makeAnalysis({ apiEndpoints: [] });
    expect(() => generateHelpers(analysis)).not.toThrow();
  });

  it("handles spec with null tenantModel (defaults to 'tenant')", () => {
    const analysis = makeAnalysis({ tenantModel: null });
    const helpers = generateHelpers(analysis);
    expect(helpers["helpers/factories.ts"]).toContain("TEST_TENANT_ID");
  });

  it("handles spec with null authModel (defaults to admin role)", () => {
    const analysis = makeAnalysis({ authModel: null });
    expect(() => generateHelpers(analysis)).not.toThrow();
    const helpers = generateHelpers(analysis);
    expect(helpers["helpers/auth.ts"]).toContain("Cookie");
  });
});
