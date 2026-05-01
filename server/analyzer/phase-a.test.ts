/**
 * Phase A — Killer Features Tests
 *
 * - generateStatefulSequenceTest (Schemathesis-killer)
 * - mock-server.mjs generation (Postman-killer)
 * - mutation-sandbox.mjs generation (Stryker integration)
 * - active-scanner.ts (ZAP-killer for API security)
 */
import { describe, it, expect } from "vitest";
import { generateStatefulSequenceTest } from "./proof-generator";
import { generateHelpers } from "./helpers-generator";
import { buildProbes, runActiveScan } from "./active-scanner";
import type { ProofTarget, AnalysisResult, EndpointField, AnalysisIR } from "./types";

function makeAnalysis(overrides: Partial<AnalysisIR> = {}): AnalysisResult {
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
          ] as EndpointField[],
        },
        {
          name: "users.getById",
          method: "GET /api/trpc/users.getById",
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "id", type: "number", required: true },
          ] as EndpointField[],
        },
        {
          name: "users.update",
          method: "POST /api/trpc/users.update",
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "id", type: "number", required: true },
            { name: "name", type: "string", required: false },
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
        {
          name: "users.delete",
          method: "POST /api/trpc/users.delete",
          auth: "requireAuth",
          relatedBehaviors: [],
          inputFields: [
            { name: "tenantId", type: "number", required: true, isTenantKey: true },
            { name: "id", type: "number", required: true },
          ] as EndpointField[],
        },
      ],
      authModel: {
        loginEndpoint: "/api/trpc/auth.login",
        roles: [{ name: "admin", envUserVar: "X", envPassVar: "Y", defaultUser: "a", defaultPass: "b" }],
      },
      enums: {},
      statusMachine: null,
      ...overrides,
    },
    qualityScore: 8,
    specType: "test",
  };
}

function makeTarget(overrides: Partial<ProofTarget> = {}): ProofTarget {
  return {
    id: "T_STATEFUL_001",
    behaviorId: "B001",
    proofType: "stateful_sequence",
    riskLevel: "high",
    description: "Full CRUD lifecycle",
    preconditions: [],
    assertions: [],
    mutationTargets: [
      { description: "Mutation A", expectedKill: true },
      { description: "Mutation B", expectedKill: true },
      { description: "Mutation C", expectedKill: true },
      { description: "Mutation D", expectedKill: true },
    ],
    endpoint: "users.create",
    ...overrides,
  };
}

const SHARED = (code: string) => {
  expect(code).toMatch(/import.*from "@playwright\/test"/);
  expect(code).toMatch(/test\(|test\.skip\(|test\.describe\(/);
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  expect(opens, "unbalanced braces").toBe(closes);
};

// ─── A1: Stateful Sequences ──────────────────────────────────────────────────

describe("generateStatefulSequenceTest", () => {
  it("produces valid Playwright code for full CRUD lifecycle", () => {
    SHARED(generateStatefulSequenceTest(makeTarget(), makeAnalysis()));
  });

  it("includes all CRUD steps when endpoints exist", () => {
    const code = generateStatefulSequenceTest(makeTarget(), makeAnalysis());
    expect(code).toContain("Step 1: CREATE");
    expect(code).toContain("Step 2: READ");
    expect(code).toContain("Step 3: UPDATE");
    expect(code).toContain("Step 4: LIST");
    expect(code).toContain("Step 5: DELETE");
    expect(code).toContain("Step 6: READ-AFTER-DELETE");
  });

  it("uses unique marker to track created data through steps", () => {
    const code = generateStatefulSequenceTest(makeTarget(), makeAnalysis());
    expect(code).toContain("uniqueMarker");
    expect(code).toContain("Date.now()");
  });

  it("verifies created data persists (kills silent rollback)", () => {
    const code = generateStatefulSequenceTest(makeTarget(), makeAnalysis());
    expect(code).toContain("silent rollback");
  });

  it("verifies update invalidates cache (kills stale cache bug)", () => {
    const code = generateStatefulSequenceTest(makeTarget(), makeAnalysis());
    expect(code).toMatch(/cache.*broken|stale|cache invalidation/i);
  });

  it("verifies delete actually removes (kills soft-delete leak)", () => {
    const code = generateStatefulSequenceTest(makeTarget(), makeAnalysis());
    expect(code).toContain("soft delete leak");
    expect(code).toMatch(/\[404,\s*410,\s*204\]/);
  });

  it("falls back to create-only when only create endpoint exists", () => {
    const analysis = makeAnalysis({
      apiEndpoints: [{
        name: "users.create",
        method: "POST",
        auth: "auth",
        relatedBehaviors: ["B001"],
        inputFields: [{ name: "tenantId", type: "number", required: true, isTenantKey: true }] as EndpointField[],
      }],
    });
    const code = generateStatefulSequenceTest(makeTarget(), analysis);
    SHARED(code);
    expect(code).toContain("Step 1: CREATE");
    // No READ/UPDATE/LIST/DELETE because no endpoints for them
    expect(code).not.toContain("Step 2: READ");
  });

  it("returns TODO stub when no create endpoint exists", () => {
    const analysis = makeAnalysis({ apiEndpoints: [] });
    const code = generateStatefulSequenceTest(makeTarget(), analysis);
    expect(code).toContain("test.skip");
    expect(code).toContain("No create endpoint");
  });

  it("has // Kills: comments for each verification step (R7)", () => {
    const code = generateStatefulSequenceTest(makeTarget(), makeAnalysis());
    expect((code.match(/\/\/ Kills:/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

// ─── A2: Mutation Sandbox ────────────────────────────────────────────────────

describe("Mutation Sandbox script (mutation-sandbox.mjs)", () => {
  it("is generated as part of helpers package", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["mutation-sandbox.mjs"]).toBeDefined();
    expect(helpers["mutation-sandbox.mjs"]).toContain("#!/usr/bin/env node");
  });

  it("defines actual mutation operators (not just heuristics)", () => {
    const code = generateHelpers(makeAnalysis())["mutation-sandbox.mjs"];
    expect(code).toContain("MUTATIONS");
    expect(code).toContain("Remove auth header");
    expect(code).toContain("Always return status 200");
    expect(code).toContain("Strip cookie from request");
  });

  it("backs up original file before mutating", () => {
    const code = generateHelpers(makeAnalysis())["mutation-sandbox.mjs"];
    expect(code).toContain("BACKUP_FILE");
    expect(code).toContain("copyFile(BACKUP_FILE");
  });

  it("restores file on SIGINT (no orphaned mutations)", () => {
    const code = generateHelpers(makeAnalysis())["mutation-sandbox.mjs"];
    expect(code).toContain('process.on("SIGINT"');
  });

  it("requires baseline test pass before running mutations", () => {
    const code = generateHelpers(makeAnalysis())["mutation-sandbox.mjs"];
    expect(code).toContain("Baseline tests failed");
  });

  it("exits 1 if kill rate below MUTATION_THRESHOLD", () => {
    const code = generateHelpers(makeAnalysis())["mutation-sandbox.mjs"];
    expect(code).toContain("MUTATION_THRESHOLD");
    expect(code).toContain("process.exit(1)");
  });

  it("script is in package.json scripts", () => {
    const pkg = JSON.parse(generateHelpers(makeAnalysis())["package.json"]);
    expect(pkg.scripts["mutation:sandbox"]).toBeDefined();
  });
});

// ─── A3: Mock-Server Generator ───────────────────────────────────────────────

describe("Mock Server (mock-server.mjs)", () => {
  it("is generated as part of helpers package", () => {
    const helpers = generateHelpers(makeAnalysis());
    expect(helpers["mock-server.mjs"]).toBeDefined();
    expect(helpers["mock-server.mjs"]).toContain("#!/usr/bin/env node");
  });

  it("includes endpoints from the IR", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain("ENDPOINTS");
    expect(code).toContain("users.create");
    expect(code).toContain("users.getById");
    expect(code).toContain("users.list");
  });

  it("uses native http (no extra deps)", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain('import http from "http"');
    expect(code).not.toContain("express");
  });

  it("provides /health endpoint", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain('"/health"');
  });

  it("returns tRPC-shaped responses ({ result: { data: { json } } })", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain("result: { data: { json:");
  });

  it("supports CORS for frontend dev", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain("Access-Control-Allow-Origin");
  });

  it("simulates CRUD: stores created data in memory, returns it on read", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain("storage.set");
    expect(code).toContain("storage.get");
  });

  it("listens on PORT env var (default 4001)", () => {
    const code = generateHelpers(makeAnalysis())["mock-server.mjs"];
    expect(code).toContain('process.env.PORT || "4001"');
  });

  it("script is in package.json scripts as 'mock'", () => {
    const pkg = JSON.parse(generateHelpers(makeAnalysis())["package.json"]);
    expect(pkg.scripts.mock).toBeDefined();
  });
});

// ─── A5: Active Security Scanner ─────────────────────────────────────────────

describe("Active Security Scanner — buildProbes", () => {
  it("generates auth-bypass probes for authenticated endpoints", () => {
    const probes = buildProbes(makeAnalysis());
    const authProbes = probes.filter(p => p.category === "auth_bypass");
    expect(authProbes.length).toBeGreaterThan(0);
    // No headers means: try without auth
    expect(authProbes[0].headers).toEqual({});
  });

  it("generates SQL injection probes for endpoints with string fields", () => {
    const probes = buildProbes(makeAnalysis());
    const sqlProbes = probes.filter(p => p.category === "sql_injection");
    expect(sqlProbes.length).toBeGreaterThan(0);
    expect(JSON.stringify(sqlProbes[0].payload)).toMatch(/OR.*'1'='1|DROP TABLE/);
  });

  it("generates XSS probes targeting string fields", () => {
    const probes = buildProbes(makeAnalysis());
    const xssProbes = probes.filter(p => p.category === "xss");
    expect(xssProbes.length).toBeGreaterThan(0);
    expect(JSON.stringify(xssProbes[0].payload)).toContain("<script>");
  });

  it("generates mass-assignment probes for create/update endpoints", () => {
    const probes = buildProbes(makeAnalysis());
    const massProbes = probes.filter(p => p.category === "mass_assignment");
    expect(massProbes.length).toBeGreaterThan(0);
    const payload = massProbes[0].payload as Record<string, unknown>;
    expect(payload.role).toBe("admin");
    expect(payload.isAdmin).toBe(true);
  });

  it("respects maxPerEndpoint cap", () => {
    const probes = buildProbes(makeAnalysis(), { maxPerEndpoint: 1 });
    // With cap=1, each endpoint contributes at most 1 SQL probe (was 4)
    const sqlProbes = probes.filter(p => p.category === "sql_injection");
    // 5 endpoints with string field × 1 SQL each = 5 max (some endpoints don't have string fields)
    expect(sqlProbes.length).toBeLessThanOrEqual(5);
  });

  it("does not generate auth probes for public endpoints", () => {
    const analysis = makeAnalysis({
      apiEndpoints: [{
        name: "public.health",
        method: "GET",
        auth: "public",
        relatedBehaviors: [],
        inputFields: [],
      }],
    });
    const probes = buildProbes(analysis);
    expect(probes.filter(p => p.category === "auth_bypass")).toHaveLength(0);
  });
});

describe("Active Security Scanner — runActiveScan SSRF guard", () => {
  it("rejects scan against localhost", async () => {
    await expect(
      runActiveScan(makeAnalysis(), { targetUrl: "http://localhost:8080" })
    ).rejects.toThrow(/SSRF|private|localhost/i);
  });

  it("rejects scan against private IP 10.0.0.1", async () => {
    await expect(
      runActiveScan(makeAnalysis(), { targetUrl: "http://10.0.0.1" })
    ).rejects.toThrow(/SSRF|private/i);
  });

  it("rejects scan against AWS metadata IP", async () => {
    await expect(
      runActiveScan(makeAnalysis(), { targetUrl: "http://169.254.169.254" })
    ).rejects.toThrow(/SSRF|private|169/i);
  });

  it("rejects scan against file:// URL", async () => {
    await expect(
      runActiveScan(makeAnalysis(), { targetUrl: "file:///etc/passwd" })
    ).rejects.toThrow(/SSRF|protocol/i);
  });
});
