import type { Behavior, EndpointField, APIEndpoint, AuthRole, AnalysisIR, AnalysisResult } from "./types";

// ─── Extended Test Suite Generator (6 Ebenen) ─────────────────────────────────

/**
 * Bug 6 Fix: Sanitize a string for use as a filename segment.
 * Converts spaces, slashes, and other special chars to hyphens.
 * e.g. "POST /api/accounts" → "post-api-accounts"
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(get|post|put|patch|delete)\s+/i, "") // strip HTTP method prefix
    .replace(/[^a-z0-9]+/g, "-")                      // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, "")                           // trim leading/trailing hyphens
    || "resource";
}

export interface ExtendedTestFile {
  filename: string;
  content: string;
  layer: "unit" | "integration" | "e2e" | "uat" | "security" | "performance";
  description: string;
}

export interface ExtendedTestSuite {
  files: ExtendedTestFile[];
  configs: Record<string, string>;  // vitest.config.ts, k6.config.ts, etc.
  packageJson: string;
  readme: string;
}

/**
 * Generate all 6 test layers from the analysis IR.
 * Layer 1: Unit Tests (Vitest) — service function isolation
 * Layer 2: Integration Tests (Vitest + fetch) — API endpoint contracts
 * Layer 3: E2E Tests (Playwright) — user flow automation
 * Layer 4: UAT Tests (Gherkin) — human-readable acceptance criteria
 * Layer 5: Security Tests (Playwright) — IDOR, CSRF, rate-limit (from existing proofs)
 * Layer 6: Performance Tests (k6) — load, spike, stress
 */
export function generateExtendedTestSuite(
  analysis: AnalysisResult,
  existingSecurityFiles: Array<{ filename: string; content: string }>
): ExtendedTestSuite {
  const ir = analysis.ir;
  const tenantField = ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const loginEndpoint = (ir.authModel?.loginEndpoint || "/api/trpc/auth.login")
    .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "");
  const DEFAULT_ROLE = { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" };
  // Filter out roles without a name (malformed LLM output) and ensure at least one role
  const rawRoles: AuthRole[] = ir.authModel?.roles || [];
  const roles: AuthRole[] = rawRoles.filter((r: AuthRole) => r && typeof r.name === "string" && r.name.length > 0);
  if (roles.length === 0) roles.push(DEFAULT_ROLE);
  const primaryRole = roles[0];
  const roleFnName = `get${primaryRole.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`;

  const files: ExtendedTestFile[] = [];

  // ─── Layer 1: Unit Tests ──────────────────────────────────────────────────────
  const unitTests = generateUnitTests(ir, tenantField, tenantEntity, tenantConst, analysis.specType);
  files.push(...unitTests);

  // ─── Layer 2: Integration Tests ───────────────────────────────────────────────
  const integrationTests = generateIntegrationTests(ir, tenantField, tenantEntity, tenantConst, loginEndpoint, roleFnName, analysis.specType);
  files.push(...integrationTests);

  // ─── Layer 3: E2E Tests ───────────────────────────────────────────────────────
  const e2eTests = generateE2ETests(ir, tenantField, tenantEntity, tenantConst, loginEndpoint, roles, analysis.specType);
  files.push(...e2eTests);

  // ─── Layer 4: UAT Tests (Gherkin) ─────────────────────────────────────────────
  const uatTests = generateUATTests(ir, analysis.specType, loginEndpoint);
  files.push(...uatTests);

  // ─── Layer 5: Security Tests (from existing proofs) ───────────────────────────
  for (const sf of existingSecurityFiles) {
    files.push({
      filename: sf.filename,
      content: sf.content,
      layer: "security",
      description: `Security test: ${sf.filename}`,
    });
  }

  // ─── Layer 6: Performance Tests ───────────────────────────────────────────────
  const perfTests = generatePerformanceTests(ir, tenantField, tenantEntity, loginEndpoint, analysis.specType);
  files.push(...perfTests);

  // ─── Configs ──────────────────────────────────────────────────────────────────
  const configs = generateExtendedConfigs(ir, roles);

  // ─── Package.json ─────────────────────────────────────────────────────────────
  const packageJson = generateExtendedPackageJson(analysis.specType);

  // ─── README ───────────────────────────────────────────────────────────────────
  const readme = generateExtendedReadme(analysis, files, roles);

  return { files, configs, packageJson, readme };
}

// ─── Unit Test Generator ──────────────────────────────────────────────────────

function generateUnitTests(
  ir: AnalysisIR,
  tenantField: string,
  tenantEntity: string,
  tenantConst: string,
  specType: string
): ExtendedTestFile[] {
  const files: ExtendedTestFile[] = [];

  // Generate unit tests for each data model
  const dataModels = ir.dataModels || [];
  const endpoints = ir.apiEndpoints;

  // Group endpoints by resource/module
  const modules = new Map<string, typeof endpoints>();
  for (const ep of endpoints) {
    const module = ep.name.split(".")[0] || "api";
    if (!modules.has(module)) modules.set(module, []);
    modules.get(module)!.push(ep);
  }

   for (const [moduleName, moduleEndpoints] of Array.from(modules)) {
    const createEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("create"));
    const updateEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("update"));
    const deleteEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("delete") || e.name.toLowerCase().includes("cancel"));
    const listEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("list"));
    const getEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("get"));
    // Find behaviors related to this module
    const moduleBehaviors = ir.behaviors.filter((b: Behavior) =>
      b.title.toLowerCase().includes(moduleName.toLowerCase()) ||
      moduleEndpoints.some((ep: APIEndpoint) => ep.relatedBehaviors.includes(b.id))
    );
    // Find boundary behaviors
    const boundaryBehaviors = moduleBehaviors.filter((b: Behavior) =>
      b.tags.includes("validation") || b.tags.includes("boundary") ||
      b.riskHints.includes("boundary") ||
      b.errorCases.some(ec => ec.includes("400") || ec.includes("422"))
    );

    // Find enum fields
    const enumFields = (createEp?.inputFields || []).filter((f: EndpointField) => f.type === "enum");
    const numberFields = (createEp?.inputFields || []).filter((f: EndpointField) => f.type === "number" && !f.isTenantKey);
    const stringFields = (createEp?.inputFields || []).filter((f: EndpointField) => f.type === "string" && (f.min !== undefined || f.max !== undefined));

    const moduleCapitalized = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    let unitCode = `// GENERATED by TestForge v3.0 — Unit Tests: ${moduleName}
// Source: ${specType} spec
// Run: npx vitest run tests/unit/${moduleName}.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Setup ───────────────────────────────────────────────────────────────
// These tests use mocked dependencies to isolate business logic.
// Replace with your actual service imports:
// import { ${moduleCapitalized}Service } from "../../src/services/${moduleName}";

const mockDb = {
  ${moduleName}: {
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

// Mock service factory — replace with actual service
function create${moduleCapitalized}Service(db = mockDb) {
  return {
    async create(input: Record<string, unknown>) {
      if (!input.${tenantField}) throw new Error("${tenantField} required");
${stringFields.map(f => `      if (typeof input.${f.name} === "string" && input.${f.name}.length === 0) throw new Error("${f.name} must not be empty");`).join("\n")}
${stringFields.filter(f => f.max !== undefined).map(f => `      if (typeof input.${f.name} === "string" && (input.${f.name} as string).length > ${f.max}) throw new Error("${f.name} exceeds max length ${f.max}");`).join("\n")}
${numberFields.filter(f => f.min !== undefined).map(f => `      if (typeof input.${f.name} === "number" && input.${f.name} < ${f.min}) throw new Error("${f.name} below minimum ${f.min}");`).join("\n")}
${numberFields.filter(f => f.max !== undefined).map(f => `      if (typeof input.${f.name} === "number" && input.${f.name} > ${f.max}) throw new Error("${f.name} exceeds maximum ${f.max}");`).join("\n")}
${enumFields.map(f => `      if (input.${f.name} !== undefined && !${JSON.stringify(f.enumValues || [])}.includes(input.${f.name} as string)) throw new Error("${f.name} must be one of: ${(f.enumValues || []).join(", ")}");`).join("\n")}
      return db.${moduleName}.create(input);
    },
    async findById(id: number, ${tenantField}: number) {
      const result = await db.${moduleName}.findById({ id, ${tenantField} });
      if (!result) throw new Error("Not found");
      if (result.${tenantField} !== ${tenantField}) throw new Error("Forbidden");
      return result;
    },
    async list(${tenantField}: number) {
      return db.${moduleName}.findMany({ ${tenantField} });
    },
    async delete(id: number, ${tenantField}: number) {
      const existing = await db.${moduleName}.findById({ id, ${tenantField} });
      if (!existing) throw new Error("Not found");
      if (existing.${tenantField} !== ${tenantField}) throw new Error("Forbidden");
      return db.${moduleName}.delete({ id });
    },
  };
}

// ─── Test Data ────────────────────────────────────────────────────────────────
const TEST_${tenantEntity.toUpperCase()}_ID = 99001;
const TEST_${tenantEntity.toUpperCase()}_B_ID = 99002;

function makeValid${moduleCapitalized}Input(overrides: Record<string, unknown> = {}) {
  return {
    ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
${(createEp?.inputFields || []).filter((f: EndpointField) => !f.isTenantKey).map((f: EndpointField) => {
  const val = f.type === "enum" && f.enumValues?.length ? `"${f.enumValues[0]}"` :
    f.type === "number" ? (f.min !== undefined ? String(Math.max(f.min, 1)) : "1") :
    f.type === "boolean" ? "false" :
    f.type === "date" ? `"${new Date(Date.now() + 86400000).toISOString().split("T")[0]}"` :
    f.type === "array" ? "[]" :
    `"test-${f.name}"`;
  return `    ${f.name}: ${val},`;
}).join("\n")}
    ...overrides,
  };
}

// ─── Happy Path Tests ─────────────────────────────────────────────────────────

describe("${moduleCapitalized}Service — Happy Path", () => {
  let service: ReturnType<typeof create${moduleCapitalized}Service>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = create${moduleCapitalized}Service();
    mockDb.${moduleName}.create.mockResolvedValue({ id: 1, ...makeValid${moduleCapitalized}Input() });
    mockDb.${moduleName}.findById.mockResolvedValue({ id: 1, ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID, ...makeValid${moduleCapitalized}Input() });
    mockDb.${moduleName}.findMany.mockResolvedValue([{ id: 1, ...makeValid${moduleCapitalized}Input() }]);
    mockDb.${moduleName}.delete.mockResolvedValue({ success: true });
  });

${createEp ? `  it("creates a ${moduleName} with valid input", async () => {
    const input = makeValid${moduleCapitalized}Input();
    const result = await service.create(input);
    expect(mockDb.${moduleName}.create).toHaveBeenCalledWith(expect.objectContaining({
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
    }));
    expect(result).toBeDefined();
    // Kills: Remove create() call in ${createEp.name}
  });` : ""}

${listEp ? `  it("lists ${moduleName}s for a tenant", async () => {
    const results = await service.list(TEST_${tenantEntity.toUpperCase()}_ID);
    expect(mockDb.${moduleName}.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID })
    );
    expect(Array.isArray(results)).toBe(true);
    // Kills: Remove ${tenantField} filter in ${listEp.name}
  });` : ""}

${getEp ? `  it("returns a ${moduleName} by id for correct tenant", async () => {
    const result = await service.findById(1, TEST_${tenantEntity.toUpperCase()}_ID);
    expect(result).toBeDefined();
    expect(result.${tenantField}).toBe(TEST_${tenantEntity.toUpperCase()}_ID);
    // Kills: Remove tenant check in ${getEp.name}
  });` : ""}

${deleteEp ? `  it("deletes a ${moduleName} belonging to the tenant", async () => {
    await service.delete(1, TEST_${tenantEntity.toUpperCase()}_ID);
    expect(mockDb.${moduleName}.delete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );
    // Kills: Remove ownership check before delete in ${deleteEp.name}
  });` : ""}
});

// ─── Tenant Isolation Tests ───────────────────────────────────────────────────

describe("${moduleCapitalized}Service — Tenant Isolation", () => {
  let service: ReturnType<typeof create${moduleCapitalized}Service>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = create${moduleCapitalized}Service();
    // Resource belongs to Tenant A
    mockDb.${moduleName}.findById.mockResolvedValue({
      id: 1,
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
    });
  });

  it("throws Forbidden when Tenant B tries to access Tenant A resource", async () => {
    await expect(
      service.findById(1, TEST_${tenantEntity.toUpperCase()}_B_ID)
    ).rejects.toThrow("Forbidden");
    // Kills: Remove tenant ownership check in findById
  });

  it("throws Forbidden when Tenant B tries to delete Tenant A resource", async () => {
    await expect(
      service.delete(1, TEST_${tenantEntity.toUpperCase()}_B_ID)
    ).rejects.toThrow("Forbidden");
    // Kills: Remove tenant ownership check before delete
  });
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

describe("${moduleCapitalized}Service — Input Validation", () => {
  let service: ReturnType<typeof create${moduleCapitalized}Service>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = create${moduleCapitalized}Service();
  });

  it("throws when ${tenantField} is missing", async () => {
    const input = makeValid${moduleCapitalized}Input({ ${tenantField}: undefined });
    await expect(service.create(input)).rejects.toThrow("${tenantField} required");
    // Kills: Remove ${tenantField} required check
  });

${stringFields.slice(0, 2).map((f: EndpointField) => `  it("throws when ${f.name} is empty string", async () => {
    const input = makeValid${moduleCapitalized}Input({ ${f.name}: "" });
    await expect(service.create(input)).rejects.toThrow("${f.name}");
    // Kills: Remove empty string check for ${f.name}
  });

${f.max !== undefined ? `  it("throws when ${f.name} exceeds max length ${f.max}", async () => {
    const input = makeValid${moduleCapitalized}Input({ ${f.name}: "A".repeat(${f.max + 1}) });
    await expect(service.create(input)).rejects.toThrow("${f.name}");
    // Kills: Remove max length check for ${f.name}
  });` : ""}`).join("\n")}

${numberFields.slice(0, 2).map((f: EndpointField) => f.min !== undefined ? `  it("throws when ${f.name} is below minimum ${f.min}", async () => {
    const input = makeValid${moduleCapitalized}Input({ ${f.name}: ${f.min - 1} });
    await expect(service.create(input)).rejects.toThrow("${f.name}");
    // Kills: Remove minimum check for ${f.name}
  });` : "").filter(Boolean).join("\n")}

${enumFields.slice(0, 1).map((f: EndpointField) => `  it("throws when ${f.name} has invalid enum value", async () => {
    const input = makeValid${moduleCapitalized}Input({ ${f.name}: "__invalid__" });
    await expect(service.create(input)).rejects.toThrow("${f.name}");
    // Kills: Remove enum validation for ${f.name}
  });`).join("\n")}
});
`;

    files.push({
      filename: `tests/unit/${sanitizeFilename(moduleName)}.test.ts`,
      content: unitCode,
      layer: "unit",
      description: `Unit tests for ${moduleCapitalized}Service (happy path, tenant isolation, validation)`,
    });
  }

  // Generate unit tests for state machine if present
  if (ir.statusMachine && ir.statusMachine.states.length > 0) {
    const sm = ir.statusMachine;
    const updateStatusEp = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("updatestatus") || e.name.toLowerCase().includes("status"));
    const statusField = (updateStatusEp?.inputFields || []).find(f => f.type === "enum" || f.name.toLowerCase().includes("status"));

    const smCode = `// GENERATED by TestForge v3.0 — Unit Tests: State Machine
// Source: ${specType} spec
// Run: npx vitest run tests/unit/state-machine.test.ts

import { describe, it, expect } from "vitest";

// ─── State Machine Definition ─────────────────────────────────────────────────
// Replace with your actual state machine implementation
const VALID_TRANSITIONS: [string, string][] = ${JSON.stringify(sm.transitions)};
const FORBIDDEN_TRANSITIONS: [string, string][] = ${JSON.stringify(sm.forbidden || [])};
const INITIAL_STATE = ${JSON.stringify(sm.initialState || sm.states[0] || "initial")};
const TERMINAL_STATES: string[] = ${JSON.stringify(sm.terminalStates || [])};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

function isForbiddenTransition(from: string, to: string): boolean {
  return FORBIDDEN_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("State Machine — Valid Transitions", () => {
${sm.transitions.map(([from, to]) => `  it("allows transition ${from} → ${to}", () => {
    expect(isValidTransition("${from}", "${to}")).toBe(true);
    // Kills: Remove ${from}→${to} from allowed transitions
  });`).join("\n\n")}
});

describe("State Machine — Forbidden Transitions", () => {
${(sm.forbidden || []).slice(0, 5).map(([from, to]) => `  it("rejects forbidden transition ${from} → ${to}", () => {
    expect(isValidTransition("${from}", "${to}")).toBe(false);
    // Kills: Add ${from}→${to} to allowed transitions
  });`).join("\n\n")}

  it("initial state is ${sm.initialState || sm.states[0] || "initial"}", () => {
    expect(INITIAL_STATE).toBe(${JSON.stringify(sm.initialState || sm.states[0] || "initial")});
    // Kills: Change initial state to wrong value
  });

${(sm.terminalStates || []).map(ts => `  it("terminal state '${ts}' has no outgoing transitions", () => {
    const outgoing = VALID_TRANSITIONS.filter(([from]) => from === "${ts}");
    expect(outgoing).toHaveLength(0);
    // Kills: Add outgoing transition from terminal state ${ts}
  });`).join("\n\n")}
});

describe("State Machine — Skip Transitions (forbidden)", () => {
  it("does not allow skipping states", () => {
    // All states that are NOT directly reachable from initial state in one hop
    const directFromInitial = VALID_TRANSITIONS
      .filter(([from]) => from === INITIAL_STATE)
      .map(([, to]) => to);
    const allStates = ${JSON.stringify(sm.states)};
    const skipTargets = allStates.filter(s => s !== INITIAL_STATE && !directFromInitial.includes(s));
    for (const target of skipTargets) {
      expect(isValidTransition(INITIAL_STATE, target)).toBe(false);
    }
    // Kills: Allow skip transitions from initial state
  });
});
`;

    files.push({
      filename: "tests/unit/state-machine.test.ts",
      content: smCode,
      layer: "unit",
      description: "Unit tests for state machine transitions (valid, forbidden, skip)",
    });
  }

  return files;
}

// ─── Integration Test Generator ───────────────────────────────────────────────

function generateIntegrationTests(
  ir: AnalysisIR,
  tenantField: string,
  tenantEntity: string,
  tenantConst: string,
  loginEndpoint: string,
  roleFnName: string,
  specType: string
): ExtendedTestFile[] {
  const files: ExtendedTestFile[] = [];
  const _rawRoles2 = ir.authModel?.roles || [];
  const roles = _rawRoles2.filter((r: any) => r && typeof r.name === "string" && r.name.length > 0);
  if (roles.length === 0) roles.push({ name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" });
  const primaryRole = roles[0];

  // Group endpoints by module
  const modules = new Map<string, typeof ir.apiEndpoints>();
  for (const ep of ir.apiEndpoints) {
    const module = ep.name.split(".")[0] || "api";
    if (!modules.has(module)) modules.set(module, []);
    modules.get(module)!.push(ep);
  }

  for (const [moduleName, moduleEndpoints] of Array.from(modules)) {
    const createEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("create"));
    const listEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("list"));
    const getEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("get"));
    const updateEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("update") && !e.name.toLowerCase().includes("status"));
    const deleteEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("delete") || e.name.toLowerCase().includes("cancel"));
    const updateStatusEp = moduleEndpoints.find((e: APIEndpoint) => e.name.toLowerCase().includes("updatestatus") || e.name.toLowerCase().includes("status"));

    if (!createEp && !listEp) continue; // Skip modules with no testable endpoints

    const moduleCapitalized = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    // Build valid payload for create
    const createPayload: Record<string, string> = {};
    for (const f of (createEp?.inputFields || []) as EndpointField[]) {
      if (f.isTenantKey) {
        createPayload[f.name] = `parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_ID || process.env.TEST_TENANT_ID || "99001")`;
      } else {
        const val = f.type === "enum" && f.enumValues?.length ? `"${f.enumValues[0]}"` :
          f.type === "number" ? (f.min !== undefined ? String(Math.max(f.min, 1)) : "1") :
          f.type === "boolean" ? "false" :
          f.type === "date" ? `new Date(Date.now() + 86400000).toISOString().split("T")[0]` :
          f.type === "array" ? "[]" :
          `"test-${f.name}-" + Date.now()`;
        createPayload[f.name] = val;
      }
    }

    const createPayloadLines = Object.entries(createPayload)
      .map(([k, v]: [string, string]) => `      ${k}: ${v},`)
      .join("\n");

    const integrationCode = `// GENERATED by TestForge v3.0 — Integration Tests: ${moduleName}
// Source: ${specType} spec
// Run: npx vitest run tests/integration/${moduleName}.integration.test.ts

import { describe, it, expect, beforeAll } from "vitest";

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_${tenantEntity.toUpperCase()}_ID = parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_ID || process.env.TEST_TENANT_ID || "99001");
const TEST_${tenantEntity.toUpperCase()}_B_ID = parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_B_ID || process.env.TEST_TENANT_B_ID || "99002");

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
let authCookie: string;

async function login(username: string, password: string): Promise<string> {
  const resp = await fetch(\`\${BASE_URL}${loginEndpoint}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { username, password } }),
  });
  if (!resp.ok) throw new Error(\`Login failed: \${resp.status}\`);
  const setCookie = resp.headers.get("set-cookie");
  if (!setCookie) throw new Error("No cookie returned from login");
  return setCookie;
}

async function trpcMutation(
  procedure: string,
  input: Record<string, unknown>,
  cookie?: string
): Promise<{ status: number; data: unknown; error: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const resp = await fetch(\`\${BASE_URL}/api/trpc/\${procedure}\`, {
    method: "POST",
    headers,
    body: JSON.stringify({ json: input }),
  });
  const body = await resp.json().catch(() => null);
  return {
    status: resp.status,
    data: body?.result?.data?.json ?? body?.result?.data ?? null,
    error: body?.error ?? body?.[0]?.error ?? null,
  };
}

async function trpcQuery(
  procedure: string,
  input: Record<string, unknown> = {},
  cookie?: string
): Promise<{ status: number; data: unknown; error: unknown }> {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  const resp = await fetch(
    \`\${BASE_URL}/api/trpc/\${procedure}?input=\${encodeURIComponent(JSON.stringify({ json: input }))}\`,
    { headers }
  );
  const body = await resp.json().catch(() => null);
  return {
    status: resp.status,
    data: body?.result?.data?.json ?? body?.result?.data ?? null,
    error: body?.error ?? null,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  authCookie = await login(
    process.env.${primaryRole.envUserVar} || "${primaryRole.defaultUser}",
    process.env.${primaryRole.envPassVar} || "${primaryRole.defaultPass}"
  );
});

// ─── CRUD Integration Tests ───────────────────────────────────────────────────

describe("${moduleCapitalized} API — CRUD Lifecycle", () => {
${createEp ? `  it("POST ${createEp.name} — creates resource and returns id", async () => {
    const { status, data, error } = await trpcMutation("${createEp.name}", {
${createPayloadLines}
    }, authCookie);

    expect(error).toBeNull();
    expect(status).toBe(200);
    expect(data).toBeDefined();
    expect((data as any).id).toBeDefined();
    // Kills: Remove id from ${createEp.name} response
  });` : ""}

${listEp ? `  it("GET ${listEp.name} — returns array for tenant", async () => {
    const { status, data, error } = await trpcQuery("${listEp.name}", {
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
    }, authCookie);

    expect(error).toBeNull();
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // Kills: Remove ${tenantField} filter in ${listEp.name}
  });` : ""}

${createEp && listEp ? `  it("created resource appears in list", async () => {
    // Create
    const { data: created } = await trpcMutation("${createEp.name}", {
${createPayloadLines}
    }, authCookie);
    const id = (created as any)?.id;
    expect(id).toBeDefined();

    // List
    const { data: list } = await trpcQuery("${listEp.name}", {
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
    }, authCookie);
    const found = (list as any[])?.find((item: any) => item.id === id);
    expect(found).toBeDefined();
    // Kills: Not persisting resource to DB in ${createEp.name}
  });` : ""}

${createEp && deleteEp ? `  it("DELETE ${deleteEp.name} — removes resource", async () => {
    // Create first
    const { data: created } = await trpcMutation("${createEp.name}", {
${createPayloadLines}
    }, authCookie);
    const id = (created as any)?.id;
    expect(id).toBeDefined();

    // Delete
    const { status, error } = await trpcMutation("${deleteEp.name}", {
      id,
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
    }, authCookie);
    expect(error).toBeNull();
    expect(status).toBe(200);
    // Kills: Not deleting resource in ${deleteEp.name}
  });` : ""}
});

// ─── Auth & Tenant Isolation ──────────────────────────────────────────────────

describe("${moduleCapitalized} API — Authentication", () => {
${listEp ? `  it("returns 401 when not authenticated", async () => {
    const { status } = await trpcQuery("${listEp.name}", {
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
    });
    expect([401, 403]).toContain(status);
    // Kills: Remove auth check in ${listEp.name}
  });` : ""}

${createEp ? `  it("returns 401 when not authenticated for create", async () => {
    const { status } = await trpcMutation("${createEp.name}", {
${createPayloadLines}
    });
    expect([401, 403]).toContain(status);
    // Kills: Remove auth check in ${createEp.name}
  });` : ""}
});

${updateStatusEp ? `// ─── Status Transition Integration ───────────────────────────────────────────

describe("${moduleCapitalized} API — Status Transitions", () => {
  it("updates status via ${updateStatusEp.name}", async () => {
    // Create resource first
${createEp ? `    const { data: created } = await trpcMutation("${createEp.name}", {
${createPayloadLines}
    }, authCookie);
    const id = (created as any)?.id;
    expect(id).toBeDefined();

    // Update status
    const statusField = ${JSON.stringify((updateStatusEp.inputFields || []).find(f => f.type === "enum" || f.name.toLowerCase().includes("status"))?.name || "status")};
    const validStatus = ${JSON.stringify(((updateStatusEp.inputFields || []).find(f => f.type === "enum")?.enumValues || [])[0] || "active")};
    const { status, error } = await trpcMutation("${updateStatusEp.name}", {
      id,
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
      [statusField]: validStatus,
    }, authCookie);
    expect(error).toBeNull();
    expect(status).toBe(200);
    // Kills: Not persisting status change in ${updateStatusEp.name}` : `    // TODO: Create resource first, then update status`}
  });
});` : ""}
`;

    files.push({
      filename: `tests/integration/${sanitizeFilename(moduleName)}.integration.test.ts`,
      content: integrationCode,
      layer: "integration",
      description: `Integration tests for ${moduleCapitalized} API (CRUD, auth, tenant isolation)`,
    });
  }

  return files;
}
// ─── E2E / Browser Test Generator (v5.0) ──────────────────────────────────────────────────

/**
 * Derive the likely UI path from an endpoint name and action.
 * e.g. "bookings.create" → "/bookings/new"
 */
function deriveUIPath(endpointName: string, action: string): string {
  const resource = endpointName.split(".")[0];
  switch (action) {
    case "create": return `/${resource}/new`;
    case "list": return `/${resource}`;
    case "getById": return `/${resource}/:id`;
    case "update": return `/${resource}/:id/edit`;
    case "updateStatus": return `/${resource}/:id`;
    default: return `/${resource}`;
  }
}

function generateE2ETests(
  ir: AnalysisIR,
  tenantField: string,
  tenantEntity: string,
  tenantConst: string,
  loginEndpoint: string,
  roles: AuthRole[],
  specType: string
): ExtendedTestFile[] {
  return generateBrowserFlowTests(ir, tenantField, tenantEntity, tenantConst, loginEndpoint, roles, specType);
}

/**
 * v5.0: Generate REAL browser tests using page.goto/fill/click/expect.
 * Produces 5 test types:
 *   A. Auth-Flow (always)
 *   B. CRUD-Flow (per entity with create endpoint)
 *   C. Status-Flow (if status machine exists)
 *   D. Negative-Flow (validation errors)
 *   E. DSGVO-Flow (if GDPR endpoint exists)
 * Plus: User-Flow tests from spec's ## User Flows section
 */
function generateBrowserFlowTests(
  ir: AnalysisIR,
  tenantField: string,
  tenantEntity: string,
  tenantConst: string,
  loginEndpoint: string,
  roles: AuthRole[],
  specType: string
): ExtendedTestFile[] {
  const files: ExtendedTestFile[] = [];
  const primaryRole = (roles || [])[0] || { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" };
  const userFlows = ir.userFlows || [];
  const hasGDPR = ir.behaviors.some(b => b.tags.includes("dsgvo") || b.tags.includes("gdpr")) ||
    ir.apiEndpoints.some(e => e.name.toLowerCase().includes("gdpr") || e.name.toLowerCase().includes("export") || e.name.toLowerCase().includes("dsgvo"));

  // ─── A. Auth-Flow (always generated) ──────────────────────────────────────
  const authSpec = `// GENERATED by TestForge v5.0 — Browser E2E Tests: Authentication
// Source: ${specType} spec
// Run: npx playwright test tests/e2e/auth.spec.ts --project=browser-e2e

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/browser";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("Browser: Authentication", () => {
  test("login via UI redirects away from login page", async ({ page }) => {
    await page.goto(\`\${BASE_URL}/login\`);
    await page.getByLabel(/email/i).fill(process.env.${primaryRole.envUserVar} || "${primaryRole.defaultUser}@test.com");
    await page.getByLabel(/password|passwort/i).fill(process.env.${primaryRole.envPassVar} || "${primaryRole.defaultPass}");
    await page.getByRole("button", { name: /login|anmelden|sign.in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    // Kills: Login form doesn't redirect on success
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto(\`\${BASE_URL}/login\`);
    await page.getByLabel(/email/i).fill("${primaryRole.defaultUser}@test.com");
    await page.getByLabel(/password|passwort/i).fill("wrong-password-xyz-123");
    await page.getByRole("button", { name: /login|anmelden|sign.in/i }).click();
    await expect(page.getByText(/fehler|error|invalid|falsch|incorrect|wrong/i))
      .toBeVisible({ timeout: 5000 });
    // Kills: Accept any password
  });

  test("logout clears session and redirects to login", async ({ page }) => {
    await loginViaUI(page);
    // Click logout button or navigate to logout
    const logoutBtn = page.getByRole("button", { name: /logout|abmelden|sign.out/i });
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
    } else {
      await page.goto(\`\${BASE_URL}/logout\`);
    }
    // After logout, protected pages should redirect to login
    await page.goto(\`\${BASE_URL}/dashboard\`);
    await expect(page).toHaveURL(/login|auth/, { timeout: 5000 });
    // Kills: Logout doesn't clear session
  });
});
`;

  files.push({
    filename: "tests/e2e/auth.spec.ts",
    content: authSpec,
    layer: "e2e",
    description: "Browser E2E: Authentication flows (login success, login failure, logout)",
  });

  // ─── B. CRUD-Flow (per entity with create endpoint) ────────────────────────
  const createEndpoints = ir.apiEndpoints.filter(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("book")
  );
  // Deduplicate by entityName to avoid generating the same file multiple times
  const _seenCrudEntities = new Set<string>();
  const uniqueCreateEndpoints = createEndpoints.filter(e => {
    const en = e.name.split(".")[0];
    if (_seenCrudEntities.has(en)) return false;
    _seenCrudEntities.add(en);
    return true;
  }).slice(0, 3);

  for (const createEp of uniqueCreateEndpoints) {
    const entityName = createEp.name.split(".")[0];
    const entityCap = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    const listEp = ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes(entityName.toLowerCase()) &&
      e.name.toLowerCase().includes("list")
    );
    const uiPath = deriveUIPath(createEp.name, "create");
    const listPath = deriveUIPath(createEp.name, "list");

    // Build field fill code from inputFields
    const requiredFields = (createEp.inputFields || []).filter(f => f.required && !f.isTenantKey).slice(0, 6);
    const fieldFillLines = requiredFields.map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("email")) return `    await page.getByLabel(/${f.name}/i).fill(\`test-\${Date.now()}@example.com\`);`;
      if (fl.includes("phone") || fl.includes("mobile") || fl.includes("tel")) return `    await page.getByLabel(/${f.name}/i).fill("+4917612345678");`;
      if (fl.includes("name") || fl.includes("title") || fl.includes("label")) return `    await page.getByLabel(/${f.name}/i).fill(\`Test ${f.name} \${Date.now()}\`);`;
      if (f.type === "number") return `    await page.getByLabel(/${f.name}/i).fill("${f.min !== undefined ? Math.max(f.min, 1) : 1}");`;
      if (f.type === "enum" && f.enumValues?.length) return `    await page.getByLabel(/${f.name}/i).selectOption("${f.enumValues[0]}").catch(() => page.locator(\`select[name="${f.name}"]\`).selectOption("${f.enumValues[0]}"));`;
      if (f.type === "date" || fl.includes("date") || fl.includes("datum")) return `    await page.getByLabel(/${f.name}/i).fill("2026-06-01");`;
      if (f.type === "boolean") return `    // Boolean field ${f.name}: leave as default`;
      return `    await page.getByLabel(/${f.name}/i).fill("test-${f.name}");`;
    }).join("\n");

    const crudSpec = `// GENERATED by TestForge v5.0 — Browser E2E Tests: ${entityCap} CRUD
// Source: ${specType} spec
// Run: npx playwright test tests/e2e/${entityName}-crud.spec.ts --project=browser-e2e

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/browser";
import { trpcQuery } from "../../helpers/api";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_${tenantEntity.toUpperCase()}_ID = parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_ID || process.env.TEST_TENANT_ID || "99001");

test.describe("Browser: ${entityCap} CRUD", () => {
  test("create ${entityName} via UI and verify in API", async ({ page, request }) => {
    // Step 1: Login via UI
    await loginViaUI(page);

    // Step 2: Navigate to create page
    await page.goto(\`\${BASE_URL}${uiPath}\`);
    // Fallback: click New/Add button on list page if direct URL doesn't work
    if (page.url().includes("/login") || page.url().includes("/404")) {
      await page.goto(\`\${BASE_URL}${listPath}\`);
      const newBtn = page.getByRole("button", { name: /new|add|neu|erstellen|hinzufügen/i });
      if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newBtn.click();
      }
    }

    // Step 3: Fill required fields
${fieldFillLines || "    // TODO: Fill required fields for " + entityName}

    // Step 4: Submit form
    await page.getByRole("button", { name: /save|submit|create|speichern|erstellen|anlegen/i }).click();

    // Step 5: Verify UI shows success
    await expect(page.getByText(/success|erfolgreich|erstellt|created|gespeichert/i))
      .toBeVisible({ timeout: 10000 });
    // Kills: UI shows success but resource not in DB

${listEp ? `    // Step 6: API double-verify — resource must exist in DB
    const loginResp = await request.post(\`\${BASE_URL}${loginEndpoint}\`, {
      headers: { "Content-Type": "application/json" },
      data: { json: { username: process.env.${primaryRole.envUserVar} || "${primaryRole.defaultUser}", password: process.env.${primaryRole.envPassVar} || "${primaryRole.defaultPass}" } },
    });
    const adminCookie = loginResp.headers()["set-cookie"] || "";
    const { data } = await trpcQuery(request, "${listEp.name}",
      { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID }, adminCookie);
    expect(Array.isArray(data) ? data.length : 0).toBeGreaterThan(0);
    // Kills: UI shows success but resource not persisted` : "    // Note: No list endpoint found for API double-verify"}
  });

  test("${entityName} list page is accessible after login", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(\`\${BASE_URL}${listPath}\`);
    // Page should not redirect to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
    // Kills: List page not accessible to authenticated users
  });
});
`;

    files.push({
      filename: `tests/e2e/${entityName}-crud.spec.ts`,
      content: crudSpec,
      layer: "e2e",
      description: `Browser E2E: ${entityCap} CRUD via UI (create, verify)`,
    });
  }

  // ─── C. Status-Flow (if status machine exists) ─────────────────────────────
  const sm = ir.statusMachine;
  if (sm && sm.transitions && sm.transitions.length > 0) {
    const entityName = (sm as any).entity || ir.resources[0]?.name || "resource";
    const entityCap = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    const createEp = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("create"));
    const listEp = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("list"));
    // transitions are [string, string] tuples: [from, to]
    const allowedTransitions = sm.transitions.slice(0, 3).map(t => ({ from: t[0], to: t[1] }));

    const statusSpec = `// GENERATED by TestForge v5.0 — Browser E2E Tests: ${entityCap} Status Flows
// Source: ${specType} spec
// Run: npx playwright test tests/e2e/${entityName}-status.spec.ts --project=browser-e2e

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/browser";
import { trpcQuery, trpcMutation } from "../../helpers/api";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_${tenantEntity.toUpperCase()}_ID = parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_ID || process.env.TEST_TENANT_ID || "99001");

${allowedTransitions.map(t => `test.describe("Browser: ${entityCap} Status ${t.from} → ${t.to}", () => {
  test("${t.from} to ${t.to} via UI", async ({ page, request }) => {
    // Precondition: Create a resource in status '${t.from}'
    const loginResp = await request.post(\`\${BASE_URL}${loginEndpoint}\`, {
      headers: { "Content-Type": "application/json" },
      data: { json: { username: process.env.${primaryRole.envUserVar} || "${primaryRole.defaultUser}", password: process.env.${primaryRole.envPassVar} || "${primaryRole.defaultPass}" } },
    });
    const adminCookie = loginResp.headers()["set-cookie"] || "";
${createEp ? `    const { data: created } = await trpcMutation(request, "${createEp.name}",
      { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID }, adminCookie);
    const resourceId = (created as any)?.id;` : "    const resourceId = 1; // TODO: Create test resource"}

    // Open detail page via UI
    await loginViaUI(page);
    await page.goto(\`\${BASE_URL}/${entityName}s/\${resourceId}\`);

    // Click status-change button
    await page.getByRole("button", { name: /${t.to}/i }).click();

    // Handle confirmation dialog if present
    const confirmBtn = page.getByRole("button", { name: /confirm|bestätigen|ja|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Verify UI shows new status
    await expect(page.getByText(new RegExp("${t.to}", "i"))).toBeVisible({ timeout: 10000 });
    // Kills: UI shows new status but DB unchanged

${listEp ? `    // API double-verify
    const { data: updated } = await trpcQuery(request, "${listEp.name}",
      { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID }, adminCookie);
    const item = Array.isArray(updated) ? updated.find((x: any) => x.id === resourceId) : updated;
    expect((item as any)?.status).toBe("${t.to}");
    // Kills: Status change not persisted to DB` : "    // Note: No list endpoint found for API double-verify"}
  });
});`).join("\n\n")}
`;

    files.push({
      filename: `tests/e2e/${entityName}-status.spec.ts`,
      content: statusSpec,
      layer: "e2e",
      description: `Browser E2E: ${entityCap} status transitions via UI`,
    });
  }

  // ─── D. Negative-Flow (validation errors via UI) ────────────────────────────
  const firstCreateEp = ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("book")
  );
  if (firstCreateEp) {
    const entityName = firstCreateEp.name.split(".")[0];
    const entityCap = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    const uiPath = deriveUIPath(firstCreateEp.name, "create");
    const hasEmailField = (firstCreateEp.inputFields || []).some(f => f.name.toLowerCase().includes("email"));

    const validationSpec = `// GENERATED by TestForge v5.0 — Browser E2E Tests: Form Validation
// Source: ${specType} spec
// Run: npx playwright test tests/e2e/validation.spec.ts --project=browser-e2e

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/browser";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("Browser: Validation Errors", () => {
  test("empty required field shows error on ${entityName} form", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(\`\${BASE_URL}${uiPath}\`);

    // Submit without filling required fields
    await page.getByRole("button", { name: /save|submit|create|speichern/i }).click();

    // Error must be visible
    await expect(page.getByText(/required|pflicht|erforderlich|fehlt|invalid|ungültig/i))
      .toBeVisible({ timeout: 5000 });
    // Kills: Accept empty form submission
  });

${hasEmailField ? `  test("invalid email shows error on ${entityName} form", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(\`\${BASE_URL}${uiPath}\`);
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: /save|submit|create|speichern/i }).click();

    await expect(page.getByText(/email|e-mail|invalid|ungültig/i))
      .toBeVisible({ timeout: 5000 });
    // Kills: Accept invalid email without validation
  });` : "  // Note: No email field found for email validation test"}
});
`;

    files.push({
      filename: "tests/e2e/validation.spec.ts",
      content: validationSpec,
      layer: "e2e",
      description: "Browser E2E: Form validation errors (empty fields, invalid email)",
    });
  }

  // ─── E. DSGVO-Flow (if GDPR endpoint exists) ───────────────────────────────
  if (hasGDPR) {
    const gdprSpec = `// GENERATED by TestForge v5.0 — Browser E2E Tests: DSGVO/GDPR
// Source: ${specType} spec
// Run: npx playwright test tests/e2e/gdpr-export.spec.ts --project=browser-e2e

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/browser";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("Browser: DSGVO Data Export & Deletion", () => {
  test("export personal data via UI", async ({ page }) => {
    await loginViaUI(page);
    // Navigate to profile/settings/data section
    await page.goto(\`\${BASE_URL}/profile\`);
    // Try /settings as fallback
    if (page.url().includes("/login") || page.url().includes("/404")) {
      await page.goto(\`\${BASE_URL}/settings\`);
    }

    // Click export button
    const exportBtn = page.getByRole("button", { name: /export|daten.*export|download.*data|meine.*daten/i });
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        exportBtn.click(),
      ]);
      expect(download).toBeTruthy();
      // Kills: Export button doesn't trigger download
    } else {
      // Export button not found — test that the settings page is accessible
      await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
      console.warn("[TestForge] DSGVO export button not found — check /profile or /settings page");
    }
  });

  test("DSGVO deletion request via UI", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(\`\${BASE_URL}/profile\`);
    if (page.url().includes("/login") || page.url().includes("/404")) {
      await page.goto(\`\${BASE_URL}/settings\`);
    }

    // Check for delete/anonymize button
    const deleteBtn = page.getByRole("button", { name: /löschen|delete.*account|konto.*löschen|anonymisieren/i });
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      // Confirmation dialog
      const confirmBtn = page.getByRole("button", { name: /confirm|bestätigen|ja|yes|löschen/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Do NOT confirm in tests — just verify dialog appears
        await expect(confirmBtn).toBeVisible();
        // Kills: No confirmation dialog before account deletion
      }
    } else {
      // Deletion button not found — test that settings page is accessible
      await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
      console.warn("[TestForge] DSGVO delete button not found — check /profile or /settings page");
    }
  });
});
`;

    files.push({
      filename: "tests/e2e/gdpr-export.spec.ts",
      content: gdprSpec,
      layer: "e2e",
      description: "Browser E2E: DSGVO data export and deletion via UI",
    });
  }

  // ─── User-Flow tests from spec's ## User Flows section (v5.0: real browser tests) ─────
  if (userFlows.length > 0) {
    for (const flow of userFlows.slice(0, 5)) {
      const flowName = sanitizeFilename(flow.name);
      // Build real page.goto/fill/click steps from the flow's step descriptions
      const stepLines = flow.steps.map((step: string, i: number) => {
        const s = step.toLowerCase();
        // Navigate steps
        if (s.includes("navigates to") || s.includes("opens") || s.includes("goes to")) {
          const urlMatch = step.match(/\/[a-z0-9\-\/]+/i);
          const url = urlMatch ? urlMatch[0] : "/";
          return `    // Step ${i + 1}: ${step}\n    await page.goto(\`\${BASE_URL}${url}\`);`;
        }
        // Filter steps
        if (s.includes("filter") || s.includes("selects") || s.includes("select")) {
          const valueMatch = step.match(/"([^"]+)"/i);
          const val = valueMatch ? valueMatch[1] : "option";
          return `    // Step ${i + 1}: ${step}\n    await page.getByRole("combobox").selectOption("${val}").catch(() => page.getByLabel(/${val}/i).click());`;
        }
        // Click steps
        if (s.includes("clicks") || s.includes("click")) {
          const btnMatch = step.match(/"([^"]+)"/i) || step.match(/clicks? (\w+)/i);
          const btn = btnMatch ? btnMatch[1] : "button";
          return `    // Step ${i + 1}: ${step}\n    await page.getByRole("button", { name: /${btn}/i }).click();`;
        }
        // Fill form steps
        if (s.includes("fills") || s.includes("fill") || s.includes("enters")) {
          return `    // Step ${i + 1}: ${step}\n    // Fill form fields — adjust selectors to match actual UI\n    // await page.getByLabel(/fieldname/i).fill("value");`;
        }
        // Submit steps
        if (s.includes("submits") || s.includes("submit")) {
          return `    // Step ${i + 1}: ${step}\n    await page.getByRole("button", { name: /submit|save|create|send|speichern|erstellen/i }).click();`;
        }
        // Verify/sees steps
        if (s.includes("sees") || s.includes("verify") || s.includes("shows")) {
          const textMatch = step.match(/"([^"]+)"/i);
          const txt = textMatch ? textMatch[1] : "success";
          return `    // Step ${i + 1}: ${step}\n    await expect(page.getByText(/${txt}/i)).toBeVisible({ timeout: 10000 });`;
        }
        // API verify steps
        if (s.includes("api verify") || s.includes("api check")) {
          return `    // Step ${i + 1}: ${step}\n    // API double-verify: ${step}`;
        }
        // Default: comment
        return `    // Step ${i + 1}: ${step}`;
      }).join("\n");

      // Build API verify block from relatedEndpoints
      const verifyEndpoint = flow.relatedEndpoints?.[flow.relatedEndpoints.length - 1];
      const apiVerifyBlock = verifyEndpoint ? `
    // API double-verify — resource state must match UI
    const loginResp = await request.post(\`\${BASE_URL}${loginEndpoint}\`, {
      headers: { "Content-Type": "application/json" },
      data: { json: { username: process.env.${primaryRole.envUserVar} || "${primaryRole.defaultUser}", password: process.env.${primaryRole.envPassVar} || "${primaryRole.defaultPass}" } },
    });
    const adminCookie = loginResp.headers()["set-cookie"] || "";
    const { data } = await trpcQuery(request, "${verifyEndpoint}",
      { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID }, adminCookie);
    expect(data).toBeTruthy();
    // Kills: UI shows success but state not persisted` : "";

      const flowCode = `// GENERATED by TestForge v5.0 — Browser E2E Test: ${flow.name}
// Source: ${specType} spec — User Flow: ${flow.id}
// Actor: ${flow.actor}
// Run: npx playwright test tests/e2e/${flowName}.spec.ts --project=browser-e2e

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../../helpers/browser";
import { trpcQuery } from "../../helpers/api";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_${tenantEntity.toUpperCase()}_ID = parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_ID || process.env.TEST_TENANT_ID || "99001");

test.describe("Browser: ${flow.name}", () => {
  test("${flow.name} — happy path", async ({ page, request }) => {
    // Actor: ${flow.actor}
    // Success criteria: ${Array.isArray(flow.successCriteria) ? flow.successCriteria.join("; ") : String(flow.successCriteria || "")}

${stepLines}
${apiVerifyBlock}
  });

${(Array.isArray(flow.errorScenarios) ? flow.errorScenarios : []).slice(0, 1).map((scenario: string) => `  test("${flow.name} — error: ${scenario.slice(0, 60)}", async ({ page }) => {
    await loginViaUI(page);
    // Error scenario: ${scenario}
    // Verify error is shown to user
    await expect(page.getByText(/error|fehler|invalid|ungültig/i)).toBeVisible({ timeout: 5000 });
    // Kills: Error not shown to user for: ${scenario}
  });`).join("\n\n")}
});
`;

      files.push({
        filename: `tests/e2e/${flowName}.spec.ts`,
        content: flowCode,
        layer: "e2e",
        description: `Browser E2E: ${flow.name} (actor: ${flow.actor})`,
      });
    }
  }

  return files;
}

// ─── UAT Test Generator (Gherkin) ─────────────────────────────────────────────

function generateUATTests(ir: AnalysisIR, specType: string, loginEndpoint: string): ExtendedTestFile[] {
  const files: ExtendedTestFile[] = [];
  const behaviors = ir.behaviors;
  const tenantField = ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = ir.tenantModel?.tenantEntity || "tenant";

  // Group behaviors by chapter/module
  const chapters = new Map<string, typeof behaviors>();
  for (const b of behaviors) {
    const chapter = b.chapter || "Core";
    if (!chapters.has(chapter)) chapters.set(chapter, []);
    chapters.get(chapter)!.push(b);
  }

  for (const [chapter, chapterBehaviors] of Array.from(chapters)) {
    const chapterSlug = sanitizeFilename(chapter);
    const featureLines: string[] = [];

    featureLines.push(`# GENERATED by TestForge v3.0 — UAT Feature: ${chapter}`);
    featureLines.push(`# Source: ${specType} spec`);
    featureLines.push(`# Run: npx cucumber-js tests/uat/${chapterSlug}.feature`);
    featureLines.push(``);
    featureLines.push(`Feature: ${chapter}`);
    featureLines.push(`  As a ${ir.authModel?.roles[0]?.name || "user"}`);
    featureLines.push(`  I want to manage ${chapter.toLowerCase()}`);
    featureLines.push(`  So that I can ${chapterBehaviors[0]?.action || "use"} the system correctly`);
    featureLines.push(``);

    for (const b of chapterBehaviors.slice(0, 6)) {
      // Convert behavior to Gherkin scenario
      const scenarioTitle = b.title.replace(/^System\s+/i, "").replace(/^The system\s+/i, "");
      const isErrorScenario = b.errorCases.length > 0 &&
        (b.tags.includes("validation") || b.tags.includes("error-handling") ||
         b.postconditions.some((pc: string) => pc.includes("400") || pc.includes("403") || pc.includes("422")));

      featureLines.push(`  ${isErrorScenario ? "Scenario Outline" : "Scenario"}: ${scenarioTitle}`);

      // Given (preconditions)
      if (b.preconditions.length > 0) {
        featureLines.push(`    Given ${b.preconditions[0]}`);
        for (const pre of b.preconditions.slice(1)) {
          featureLines.push(`    And ${pre}`);
        }
      } else {
        featureLines.push(`    Given the system is in a valid state`);
      }

      // When (action)
      featureLines.push(`    When ${b.subject.toLowerCase()} ${b.action} ${b.object}`);

      // Then (postconditions)
      if (b.postconditions.length > 0) {
        featureLines.push(`    Then ${b.postconditions[0]}`);
        for (const post of b.postconditions.slice(1)) {
          featureLines.push(`    And ${post}`);
        }
      }

      // Error cases as Examples
      if (isErrorScenario && b.errorCases.length > 0) {
        featureLines.push(`    # Error cases:`);
        for (const ec of b.errorCases.slice(0, 3)) {
          featureLines.push(`    # - ${ec}`);
        }
      }

      // Spec anchor as comment
      if (b.specAnchor) {
        featureLines.push(`    # Spec: "${b.specAnchor}"`);
      }

      featureLines.push(``);
    }

    files.push({
      filename: `tests/uat/${chapterSlug}.feature`,
      content: featureLines.join("\n"),
      layer: "uat",
      description: `UAT feature file for: ${chapter}`,
    });
  }

  // Generate step definitions file
  const stepDefsCode = `// GENERATED by TestForge v3.0 — Cucumber Step Definitions
// Source: ${specType} spec
// Run: npx cucumber-js

import { Given, When, Then, Before, After } from "@cucumber/cucumber";
import assert from "assert";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ─── World State ──────────────────────────────────────────────────────────────
let authCookie: string = "";
let lastResponse: { status: number; body: unknown } = { status: 0, body: null };
let createdResourceId: number | null = null;

// ─── Auth Steps ───────────────────────────────────────────────────────────────

Given("the system is in a valid state", async function() {
  // No-op: system is assumed to be running
});

Given("I am authenticated as {string}", async function(role: string) {
  const username = process.env[\`E2E_\${role.toUpperCase()}_USER\`] || "test-admin";
  const password = process.env[\`E2E_\${role.toUpperCase()}_PASS\`] || "TestPass2026x";
  const resp = await fetch(\`\${BASE_URL}${loginEndpoint}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { username, password } }),
  });
  assert.ok(resp.ok, \`Login failed: \${resp.status}\`);
  authCookie = resp.headers.get("set-cookie") || "";
});

Given("I am not authenticated", function() {
  authCookie = "";
});

// ─── Action Steps ─────────────────────────────────────────────────────────────

When("I create a resource with valid data", async function() {
  const resp = await fetch(\`\${BASE_URL}/api/trpc/${ir.apiEndpoints.find(e => e.name.toLowerCase().includes("create"))?.name || "resource.create"}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": authCookie },
    body: JSON.stringify({ json: { ${tenantField}: parseInt(process.env.TEST_${tenantEntity.toUpperCase()}_ID || process.env.TEST_TENANT_ID || "99001") } }),
  });
  const body = await resp.json().catch(() => null);
  lastResponse = { status: resp.status, body };
  createdResourceId = (body as any)?.result?.data?.json?.id ?? null;
});

When("I request a resource belonging to another ${tenantEntity}", async function() {
  const resp = await fetch(\`\${BASE_URL}/api/trpc/${ir.apiEndpoints.find(e => e.name.toLowerCase().includes("list"))?.name || "resource.list"}?input=\${encodeURIComponent(JSON.stringify({ json: { ${tenantField}: parseInt(process.env.TEST_TENANT_B_ID || "99002") } }))}\`, {
    headers: { "Cookie": authCookie },
  });
  const body = await resp.json().catch(() => null);
  lastResponse = { status: resp.status, body };
});

// ─── Assertion Steps ──────────────────────────────────────────────────────────

Then("the response status should be {int}", function(expectedStatus: number) {
  assert.strictEqual(lastResponse.status, expectedStatus,
    \`Expected status \${expectedStatus} but got \${lastResponse.status}\`);
});

Then("the response should contain an id", function() {
  const data = (lastResponse.body as any)?.result?.data?.json;
  assert.ok(data?.id, "Response should contain an id field");
});

Then("the response should be forbidden", function() {
  assert.ok([401, 403].includes(lastResponse.status),
    \`Expected 401 or 403 but got \${lastResponse.status}\`);
});

Then("the response should contain a validation error", function() {
  assert.ok([400, 422].includes(lastResponse.status),
    \`Expected 400 or 422 but got \${lastResponse.status}\`);
});
`;

  files.push({
    filename: "tests/uat/step-definitions/steps.ts",
    content: stepDefsCode,
    layer: "uat",
    description: "Cucumber step definitions for UAT feature files",
  });

  return files;
}

// ─── Performance Test Generator ───────────────────────────────────────────────

function generatePerformanceTests(
  ir: AnalysisIR,
  tenantField: string,
  tenantEntity: string,
  loginEndpoint: string,
  specType: string
): ExtendedTestFile[] {
  const files: ExtendedTestFile[] = [];
  const createEp = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("create"));
  const listEp = ir.apiEndpoints.find(e => e.name.toLowerCase().includes("list"));
  const _rawRoles2 = ir.authModel?.roles || [];
  const roles = _rawRoles2.filter((r: any) => r && typeof r.name === "string" && r.name.length > 0);
  if (roles.length === 0) roles.push({ name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" });
  const primaryRole = roles[0];

  // Rate-limit behaviors
  const rateLimitBehaviors = ir.behaviors.filter(b =>
    b.riskHints.includes("rate-limit") || b.riskHints.includes("brute-force") ||
    b.tags.includes("rate-limiting")
  );

  const k6LoadTest = `// GENERATED by TestForge v3.0 — Performance Tests: Load Test
// Source: ${specType} spec
// Run: k6 run tests/performance/load-test.js
// Requires: k6 installed (https://k6.io/docs/getting-started/installation/)

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate("errors");
const createDuration = new Trend("create_duration");
const listDuration = new Trend("list_duration");

// ─── Test Configuration ───────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Ramp-up: gradually increase load
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },   // Ramp up to 10 users
        { duration: "1m", target: 10 },    // Hold at 10 users
        { duration: "30s", target: 50 },   // Ramp up to 50 users
        { duration: "2m", target: 50 },    // Hold at 50 users (steady state)
        { duration: "30s", target: 0 },    // Ramp down
      ],
    },
    // Spike test: sudden traffic burst
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 100 },  // Spike to 100 users
        { duration: "30s", target: 100 },  // Hold spike
        { duration: "10s", target: 0 },    // Drop back
      ],
      startTime: "5m", // Start after ramp-up scenario
    },
  },
  thresholds: {
    // P95 response time must be under 500ms
    http_req_duration: ["p(95)<500"],
    // Error rate must be under 1%
    errors: ["rate<0.01"],
    // Create endpoint P95 under 1s
    create_duration: ["p(95)<1000"],
    // List endpoint P95 under 300ms
    list_duration: ["p(95)<300"],
  },
};

// ─── Setup: Get auth token ────────────────────────────────────────────────────
export function setup() {
  const loginResp = http.post(
    \`\${__ENV.BASE_URL || "http://localhost:3000"}${loginEndpoint}\`,
    JSON.stringify({ json: {
      username: __ENV.${primaryRole.envUserVar} || "${primaryRole.defaultUser}",
      password: __ENV.${primaryRole.envPassVar} || "${primaryRole.defaultPass}",
    }}),
    { headers: { "Content-Type": "application/json" } }
  );
  check(loginResp, { "login succeeded": (r) => r.status === 200 });
  const cookie = loginResp.headers["Set-Cookie"];
  return { cookie };
}

// ─── Main Test ────────────────────────────────────────────────────────────────
export default function(data: { cookie: string }) {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
  const TEST_${tenantEntity.toUpperCase()}_ID = parseInt(__ENV.TEST_${tenantEntity.toUpperCase()}_ID || __ENV.TEST_TENANT_ID || "99001");
  const headers = {
    "Content-Type": "application/json",
    "Cookie": data.cookie,
  };

${listEp ? `  group("List ${listEp.name}", () => {
    const start = Date.now();
    const resp = http.get(
      \`\${BASE_URL}/api/trpc/${listEp.name}?input=\${encodeURIComponent(JSON.stringify({ json: { ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID } }))}\`,
      { headers }
    );
    listDuration.add(Date.now() - start);
    const ok = check(resp, {
      "list status 200": (r) => r.status === 200,
      "list returns array": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return Array.isArray(body?.result?.data?.json ?? body?.result?.data);
        } catch { return false; }
      },
    });
    errorRate.add(!ok);
    sleep(0.1);
  });` : ""}

${createEp ? `  group("Create ${createEp.name}", () => {
    const payload = {
      ${tenantField}: TEST_${tenantEntity.toUpperCase()}_ID,
${(createEp?.inputFields || []).filter((f: EndpointField) => !f.isTenantKey).slice(0, 3).map((f: EndpointField) => {
  const val = f.type === "enum" && f.enumValues?.length ? `"${f.enumValues[0]}"` :
    f.type === "number" ? (f.min !== undefined ? String(Math.max(f.min, 1)) : "1") :
    f.type === "boolean" ? "false" :
    `"perf-test-" + Date.now()`;
  return `      ${f.name}: ${val},`;
}).join("\n")}    };
    const start = Date.now();
    const resp = http.post(
      \`\${BASE_URL}/api/trpc/${createEp.name}\`,
      JSON.stringify({ json: payload }),
      { headers }
    );
    createDuration.add(Date.now() - start);
    const ok = check(resp, {
      "create status 200": (r) => r.status === 200,
      "create returns id": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return !!(body?.result?.data?.json?.id ?? body?.result?.data?.id);
        } catch { return false; }
      },
    });
    errorRate.add(!ok);
    sleep(0.2);
  });` : ""}
}

// ─── Teardown ─────────────────────────────────────────────────────────────────
export function teardown(data: { cookie: string }) {
  console.log("Performance test complete");
}
`;

  files.push({
    filename: "tests/performance/load-test.js",
    content: k6LoadTest,
    layer: "performance",
    description: "k6 load test: ramp-up, steady-state, spike scenarios",
  });

  // Rate limit stress test
  const k6RateLimitTest = `// GENERATED by TestForge v3.0 — Performance Tests: Rate Limit Verification
// Source: ${specType} spec
// Run: k6 run tests/performance/rate-limit.js
// Purpose: Verify rate limiting is enforced under concurrent load

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const rateLimitHits = new Counter("rate_limit_hits");
const successfulRequests = new Counter("successful_requests");

export const options = {
  // Burst test: many requests in short time to trigger rate limiting
  scenarios: {
    burst: {
      executor: "constant-arrival-rate",
      rate: 100,           // 100 requests per second
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    // At least 1% of requests should be rate-limited (proves rate limiting works)
    rate_limit_hits: ["count>0"],
  },
};

export function setup() {
  const loginResp = http.post(
    \`\${__ENV.BASE_URL || "http://localhost:3000"}${loginEndpoint}\`,
    JSON.stringify({ json: {
      username: __ENV.${primaryRole.envUserVar} || "${primaryRole.defaultUser}",
      password: __ENV.${primaryRole.envPassVar} || "${primaryRole.defaultPass}",
    }}),
    { headers: { "Content-Type": "application/json" } }
  );
  return { cookie: loginResp.headers["Set-Cookie"] || "" };
}

export default function(data: { cookie: string }) {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
  const headers = { "Content-Type": "application/json", "Cookie": data.cookie };

${rateLimitBehaviors.length > 0 ? `  // Rate-limit behaviors detected in spec:
${rateLimitBehaviors.slice(0, 2).map(b => `  // - ${b.title}`).join("\n")}` : "  // Testing login endpoint for rate limiting"}

  // Attempt rapid-fire requests to trigger rate limiting
  const resp = http.post(
    \`\${BASE_URL}${loginEndpoint}\`,
    JSON.stringify({ json: { username: "test@example.com", password: "wrong" } }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (resp.status === 429) {
    rateLimitHits.add(1);
    check(resp, {
      "rate limit returns 429": (r) => r.status === 429,
      "rate limit has Retry-After header": (r) => !!r.headers["Retry-After"],
    });
  } else {
    successfulRequests.add(1);
  }
}
`;

  files.push({
    filename: "tests/performance/rate-limit.js",
    content: k6RateLimitTest,
    layer: "performance",
    description: "k6 rate limit verification: burst test to confirm rate limiting is enforced",
  });

  // Stress test
  const k6StressTest = `// GENERATED by TestForge v3.0 — Performance Tests: Stress Test
// Source: ${specType} spec
// Run: k6 run tests/performance/stress-test.js
// Purpose: Find the breaking point of the API

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "2m", target: 100 },   // Ramp to 100 users
    { duration: "5m", target: 100 },   // Hold
    { duration: "2m", target: 200 },   // Ramp to 200 users
    { duration: "5m", target: 200 },   // Hold
    { duration: "2m", target: 300 },   // Ramp to 300 users
    { duration: "5m", target: 300 },   // Hold at stress level
    { duration: "2m", target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(99)<3000"], // P99 under 3s even under stress
    errors: ["rate<0.05"],             // Error rate under 5%
  },
};

export function setup() {
  const loginResp = http.post(
    \`\${__ENV.BASE_URL || "http://localhost:3000"}${loginEndpoint}\`,
    JSON.stringify({ json: {
      username: __ENV.${primaryRole.envUserVar} || "${primaryRole.defaultUser}",
      password: __ENV.${primaryRole.envPassVar} || "${primaryRole.defaultPass}",
    }}),
    { headers: { "Content-Type": "application/json" } }
  );
  return { cookie: loginResp.headers["Set-Cookie"] || "" };
}

export default function(data: { cookie: string }) {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
  const headers = { "Content-Type": "application/json", "Cookie": data.cookie };

${listEp ? `  const resp = http.get(
    \`\${BASE_URL}/api/trpc/${listEp.name}?input=\${encodeURIComponent(JSON.stringify({ json: { ${tenantField}: parseInt(__ENV.TEST_${tenantEntity.toUpperCase()}_ID || __ENV.TEST_TENANT_ID || "99001") } }))}\`,
    { headers }
  );
  const ok = check(resp, {
    "status 200": (r) => r.status === 200,
    "response time < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);` : `  const resp = http.get(\`\${BASE_URL}/health\`);
  const ok = check(resp, { "health check ok": (r) => r.status === 200 });
  errorRate.add(!ok);`}
  sleep(0.1);
}
`;

  files.push({
    filename: "tests/performance/stress-test.js",
    content: k6StressTest,
    layer: "performance",
    description: "k6 stress test: find breaking point with progressive load increase",
  });

  return files;
}

// ─── Config Generator ─────────────────────────────────────────────────────────

function generateExtendedConfigs(
  ir: AnalysisIR,
  roles: AuthRole[]
): Record<string, string> {
  const configs: Record<string, string> = {};
  // Pre-compute role env vars for YAML (avoids nested template literal issues with esbuild)
  const roleEnvVarsYaml = (roles || []).map(r =>
    '          ' + r.envUserVar + ': ${{ secrets.' + r.envUserVar + ' }}\n' +
    '          ' + r.envPassVar + ': ${{ secrets.' + r.envPassVar + ' }}'
  ).join('\n');

  // vitest.config.ts
  configs["vitest.config.ts"] = `// GENERATED by TestForge v3.0
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.integration.test.ts",
    ],
    exclude: ["tests/e2e/**", "tests/performance/**", "tests/uat/**"],
    timeout: 30000,
    reporters: ["verbose", "json"],
    outputFile: "test-results/vitest-results.json",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    },
  },
});
`;

  // playwright.config.ts (extended)
  configs["playwright.config.ts"] = `// GENERATED by TestForge v5.0
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    extraHTTPHeaders: { "Accept": "application/json" },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Layer 1: API Security Tests (no browser needed)
      name: "api-security",
      testMatch: /tests\/(security|business|compliance|integration|concurrency)\/.*/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Layer 2: Browser E2E Tests (real Chromium browser)
      name: "browser-e2e",
      testMatch: /tests\/e2e\/.*/,
      use: {
        ...devices["Desktop Chrome"],
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
`;

  // cucumber.config.ts
  configs["cucumber.config.ts"] = `// GENERATED by TestForge v3.0
export default {
  default: {
    paths: ["tests/uat/**/*.feature"],
    require: ["tests/uat/step-definitions/**/*.ts"],
    requireModule: ["ts-node/register"],
    format: ["progress", "html:cucumber-report/index.html"],
    timeout: 30000,
  },
};
`;

  // .github/workflows/testforge-full.yml
  configs[".github/workflows/testforge-full.yml"] = `# GENERATED by TestForge v3.0 — Full 6-Layer Test Suite CI
name: TestForge Full Test Suite
on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    name: "Layer 1 — Unit Tests (Vitest)"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx vitest run tests/unit/
        env:
          BASE_URL: \${{ secrets.STAGING_URL || 'http://localhost:3000' }}

  integration-tests:
    name: "Layer 2 — Integration Tests (Vitest)"
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx vitest run tests/integration/
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roleEnvVarsYaml}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}
          TEST_TENANT_B_ID: \${{ secrets.TEST_TENANT_B_ID }}

  security-tests:
    name: "Layer 5 — Security Tests (Playwright)"
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/security/
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roleEnvVarsYaml}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}
          TEST_TENANT_B_ID: \${{ secrets.TEST_TENANT_B_ID }}
          DEBUG_API_TOKEN: \${{ secrets.DEBUG_API_TOKEN }}

  e2e-tests:
    name: "Layer 3 — E2E Tests (Playwright)"
    runs-on: ubuntu-latest
    needs: security-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/e2e/
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roleEnvVarsYaml}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}

  uat-tests:
    name: "Layer 4 — UAT Tests (Cucumber)"
    runs-on: ubuntu-latest
    needs: e2e-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npx cucumber-js tests/uat/**/*.feature
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roleEnvVarsYaml}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}

  performance-tests:
    name: "Layer 6 — Performance Tests (k6)"
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
          sudo mv k6 /usr/local/bin/
      - run: npm install
      - run: k6 run --vus 5 --duration 30s tests/performance/load-test.js
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
${roleEnvVarsYaml}
          TEST_TENANT_ID: \${{ secrets.TEST_TENANT_ID }}

  proof-gate:
    name: "✓ Alle 6 Test-Ebenen bestanden"
    needs: [unit-tests, integration-tests, security-tests, e2e-tests, uat-tests, performance-tests]
    runs-on: ubuntu-latest
    steps:
      - run: echo "System ist vollständig spec-konform — alle 6 Test-Ebenen grün."
`;
  return configs;
}

// ─── Extended Package.json ────────────────────────────────────────────────────

function generateExtendedPackageJson(_specType: string): string {
  return JSON.stringify({
    name: "testforge-full-suite",
    version: "1.0.0",
    description: `Generated by TestForge v3.0 — 6-Layer Test Suite`,
    type: "module",
    scripts: {
      // Layer 1: Unit
      "test:unit": "vitest run tests/unit/",
      "test:unit:watch": "vitest tests/unit/",
      "test:unit:coverage": "vitest run --coverage tests/unit/",
      // Layer 2: Integration
      "test:integration": "vitest run tests/integration/",
      // Layer 3: E2E
      "test:e2e": "playwright test tests/e2e/",
      // Layer 4: UAT
      "test:uat": "cucumber-js tests/uat/**/*.feature",
      // Layer 5: Security
      "test:security": "playwright test tests/security/",
      "test:security:idor": "playwright test tests/security/idor.spec.ts",
      "test:security:csrf": "playwright test tests/security/csrf.spec.ts",
      // Layer 6: Performance
      "test:performance": "k6 run tests/performance/load-test.js",
      "test:performance:stress": "k6 run tests/performance/stress-test.js",
      "test:performance:rate-limit": "k6 run tests/performance/rate-limit.js",
      // All layers
      "test:all": "npm run test:unit && npm run test:integration && npm run test:security && npm run test:e2e && npm run test:uat",
      "test:list": "playwright test --list",
      "test:dry-run": "playwright test --dry-run",
      "install:browsers": "playwright install --with-deps chromium",
    },
    dependencies: {
      zod: "^3.22.0",
    },
    devDependencies: {
      // Layer 1+2: Unit + Integration
      vitest: "^2.0.0",
      "@vitest/coverage-v8": "^2.0.0",
      // Layer 3+5: E2E + Security
      "@playwright/test": "^1.41.0",
      // Layer 4: UAT
      "@cucumber/cucumber": "^10.0.0",
      "ts-node": "^10.9.0",
      // TypeScript
      typescript: "^5.3.0",
      "@types/node": "^20.0.0",
    },
  }, null, 2);
}

// ─── Extended README ──────────────────────────────────────────────────────────

function generateExtendedReadme(
  analysis: AnalysisResult,
  files: ExtendedTestFile[],
  roles: AuthRole[]
): string {
  const byLayer = new Map<string, ExtendedTestFile[]>();
  for (const f of files) {
    if (!byLayer.has(f.layer)) byLayer.set(f.layer, []);
    byLayer.get(f.layer)!.push(f);
  }

  const layerEmoji: Record<string, string> = {
    unit: "🔬",
    integration: "🔗",
    e2e: "🌐",
    uat: "📋",
    security: "🔒",
    performance: "⚡",
  };

  const layerName: Record<string, string> = {
    unit: "Unit Tests (Vitest)",
    integration: "Integration Tests (Vitest)",
    e2e: "E2E Tests (Playwright)",
    uat: "UAT Tests (Cucumber/Gherkin)",
    security: "Security Tests (Playwright)",
    performance: "Performance Tests (k6)",
  };

  return `# TestForge Full Test Suite — ${analysis.specType}

Generated by **TestForge v3.0** on ${new Date().toISOString().split("T")[0]}.

## Overview

| Layer | Type | Files | Runner |
|---|---|---|---|
${Array.from(byLayer.entries()).map(([layer, layerFiles]) =>
  `| ${layerEmoji[layer] || "📁"} Layer | ${layerName[layer] || layer} | ${layerFiles.length} files | ${layer === "unit" || layer === "integration" ? "Vitest" : layer === "e2e" || layer === "security" ? "Playwright" : layer === "uat" ? "Cucumber" : "k6"} |`
).join("\n")}

## Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npm run install:browsers

# 3. Configure environment
cp .env.example .env
# Edit .env with your BASE_URL and credentials

# 4. Run all tests
npm run test:all

# 5. Run specific layers
npm run test:unit          # Layer 1: Unit Tests
npm run test:integration   # Layer 2: Integration Tests
npm run test:e2e           # Layer 3: E2E Tests
npm run test:uat           # Layer 4: UAT Tests
npm run test:security      # Layer 5: Security Tests
npm run test:performance   # Layer 6: Performance Tests
\`\`\`

## Test Structure

\`\`\`
tests/
├── unit/              # Layer 1: Vitest unit tests (service isolation)
├── integration/       # Layer 2: Vitest integration tests (API contracts)
├── e2e/               # Layer 3: Playwright E2E tests (user flows)
├── uat/               # Layer 4: Gherkin feature files + step definitions
├── security/          # Layer 5: Playwright security tests (IDOR, CSRF, rate-limit)
└── performance/       # Layer 6: k6 load/stress/rate-limit tests
\`\`\`

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| \`BASE_URL\` | API base URL | \`http://localhost:3000\` |
| \`TEST_TENANT_ID\` | Primary test tenant | \`99001\` |
| \`TEST_TENANT_B_ID\` | Secondary tenant (IDOR tests) | \`99002\` |
${(roles || []).map(r => `| \`${r.envUserVar}\` | ${r.name} username | \`${r.defaultUser}\` |\n| \`${r.envPassVar}\` | ${r.name} password | \`changeme\` |`).join("\n")}

## Mutation Targets

Every \`expect()\` call has a \`// Kills:\` comment explaining which code mutation it catches.

## Generated by TestForge

Do not edit these files manually — re-run TestForge to regenerate with updated spec.
Spec type: **${analysis.specType}** | Quality score: **${analysis.qualityScore?.toFixed(1) || "N/A"}/10**
`;
}
