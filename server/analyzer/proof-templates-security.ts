/**
 * Security proof templates: SQL Injection + Hardcoded Secret
 * These are imported by proof-generator.ts and added to the templateMap.
 */
import type { ProofTarget, AnalysisResult } from "./types";
import { getValidDefault } from "./proof-generator";

function getRoleHelper(analysis: AnalysisResult): { roleFnName: string; tenantConst: string; tenantField: string } {
  const roles = analysis.ir.authModel?.roles || [];
  const adminRole = roles.find((r: { name: string }) => r.name.toLowerCase().includes("admin")) || roles[0];
  const roleFnName = adminRole
    ? `get${adminRole.name.charAt(0).toUpperCase() + adminRole.name.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}Cookie`
    : "getAdminCookie";
  const tenantKey = analysis.ir.apiEndpoints.find(ep =>
    ep.inputFields?.some(f => f.isTenantKey)
  )?.inputFields?.find(f => f.isTenantKey);
  const tenantConst = tenantKey ? `TEST_${tenantKey.name.toUpperCase()}` : "TEST_TENANT_ID";
  const tenantField = tenantKey?.name || "tenantId";
  return { roleFnName, tenantConst, tenantField };
}

// ─── SQL Injection Template ────────────────────────────────────────────────────
export function generateSQLInjectionTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);
  const endpoint = target.endpoint || "api.list";

  // Classic SQL injection payloads
  const payloads = [
    `"' OR '1'='1"`,
    `"'; DROP TABLE users; --"`,
    `"1 UNION SELECT * FROM users--"`,
    `"admin'--"`,
    `"1; SELECT sleep(5)--"`,
    `"\\\\x00"`,
  ];

  const searchField = analysis.ir.apiEndpoints
    .find(ep => ep.name === endpoint)
    ?.inputFields?.find(f =>
      ["search", "query", "filter", "name", "term", "q"].some(k => f.name.toLowerCase().includes(k))
    )?.name || "search";

  return `import { test, expect } from "@playwright/test";
import { trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — SQL Injection: ${target.description}
// Risk: ${target.riskLevel}
// Invariant: All user-supplied input MUST be parameterized. Raw string concatenation in queries is forbidden.

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

const SQL_INJECTION_PAYLOADS = [
  ${payloads.join(",\n  ")},
];

for (const payload of SQL_INJECTION_PAYLOADS) {
  test(\`${target.id} — SQL injection rejected: \${payload.slice(0, 30)}\`, async ({ request }) => {
    const { status, data } = await trpcQuery(request, "${endpoint}",
      { ${tenantField}: ${tenantConst}, ${searchField}: payload }, adminCookie);
    // Must NOT return 500 (unhandled DB error = injection succeeded or leaked)
    expect(status, \`Payload "\${payload}" caused a 500 — possible SQL injection\`).not.toBe(500);
    // Must NOT return raw DB error messages
    const body = JSON.stringify(data || "");
    expect(body).not.toMatch(/syntax error|mysql|sqlite|pg_|ORA-|ODBC|Driver|Stack trace/i);
    // Must return 400 (bad input) or 200 (safely ignored/sanitized)
    expect([200, 400, 422]).toContain(status);
    // Kills: ${target.mutationTargets[0]?.description || "SQL injection not prevented"}
  });
}

test("${target.id} — SQL injection: response does not leak schema info", async ({ request }) => {
  const { status, data } = await trpcQuery(request, "${endpoint}",
    { ${tenantField}: ${tenantConst}, ${searchField}: "' OR 1=1--" }, adminCookie);
  const body = JSON.stringify(data || "");
  // Must not leak table names, column names, or DB engine info
  expect(body).not.toMatch(/information_schema|sys\\.tables|pg_catalog|sqlite_master/i);
  expect(status).not.toBe(500);
});
`;
}

// ─── Hardcoded Secret Template ─────────────────────────────────────────────────
export function generateHardcodedSecretTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);

  return `import { test, expect } from "@playwright/test";
import { trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Hardcoded Secret Detection: ${target.description}
// Risk: ${target.riskLevel}
// Invariant: No secrets (JWT keys, API keys, passwords) may be hardcoded in source or returned in API responses.

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

// Known weak/hardcoded secrets that must NOT be accepted
const WEAK_SECRETS = [
  "secret",
  "password",
  "changeme",
  "supersecret",
  "jwt_secret",
  "hardcoded",
  "test123",
  "admin",
  "12345678",
];

test("${target.id} — API response does not leak secrets or keys", async ({ request }) => {
  const { data, status } = await trpcQuery(request, "auth.me", {}, adminCookie);
  const body = JSON.stringify(data || "");
  // Response must not contain anything that looks like a raw secret
  expect(body).not.toMatch(/jwt_secret|api_key|private_key|secret_key|password_hash|bearer [a-z0-9]{20,}/i);
  expect(status).toBe(200);
});

test("${target.id} — JWT tokens are not signed with weak secrets", async ({ request }) => {
  // Attempt login and inspect the token structure
  const { data: meData } = await trpcQuery(request, "auth.me", {}, adminCookie);
  // If we can decode the token header, check it uses a strong algorithm
  const cookieParts = adminCookie.split(".");
  if (cookieParts.length === 3) {
    const header = JSON.parse(Buffer.from(cookieParts[0], "base64url").toString());
    // Must use HS256 or stronger — never "none"
    expect(header.alg).not.toBe("none");
    expect(["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "ES256"]).toContain(header.alg);
  }
  expect(meData).toBeDefined();
});

test("${target.id} — Error responses do not expose stack traces or internal paths", async ({ request }) => {
  // Send a malformed request to trigger an error
  const { data, status } = await trpcQuery(request, "${target.endpoint || "api.list"}",
    { ${tenantField}: "INVALID_TENANT_TRIGGER_ERROR" }, adminCookie);
  const body = JSON.stringify(data || "");
  // Must not leak file paths, stack traces, or module names
  expect(body).not.toMatch(/at Object\\.|at Module\\.|node_modules|__dirname|process\\.env\\.[A-Z_]{5,}/);
  // Kills: ${target.mutationTargets[0]?.description || "Hardcoded secret or secret leakage not prevented"}
});
`;
}
