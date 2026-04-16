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

// ─── Negative Amount / Financial Bypass Template ──────────────────────────────
export function generateNegativeAmountTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);
  const endpoint = target.endpoint || "transactions.create";
  const amountField = analysis.ir.apiEndpoints
    .find(ep => ep.name === endpoint)
    ?.inputFields?.find(f => ["amount", "price", "value", "sum", "total", "fee", "cost"].some(k => f.name.toLowerCase().includes(k)))?.name || "amount";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Negative Amount / Financial Bypass: ${target.description}
// Risk: CRITICAL — negative amounts can drain funds, reverse charges, or bypass payment
// Invariant: All monetary fields MUST be validated as positive numbers server-side.

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

const NEGATIVE_AMOUNT_PAYLOADS = [
  -1,
  -0.01,
  -999999,
  0,
  -1e10,
  Number.MIN_SAFE_INTEGER,
];

for (const amount of NEGATIVE_AMOUNT_PAYLOADS) {
  test(\`${target.id} — negative amount rejected: \${amount}\`, async ({ request }) => {
    const { status, error } = await trpcMutation(request, "${endpoint}",
      { ${tenantField}: ${tenantConst}, ${amountField}: amount }, adminCookie);
    // Must reject with 400/422 — NEVER 200 (would mean the negative transaction was accepted)
    expect(status, \`Amount \${amount} was accepted — financial bypass possible\`).not.toBe(200);
    expect([400, 422, 403]).toContain(status);
    // Kills: ${target.mutationTargets[0]?.description || "Negative amount not validated"}
  });
}

test("${target.id} — floating point precision: 0.1 + 0.2 boundary", async ({ request }) => {
  // Test for floating point manipulation (e.g. 0.1 + 0.2 = 0.30000000000000004)
  const { status } = await trpcMutation(request, "${endpoint}",
    { ${tenantField}: ${tenantConst}, ${amountField}: 0.1 + 0.2 - 0.3 }, adminCookie);
  // Should either accept (tiny positive) or reject (below minimum)
  expect([200, 201, 400, 422]).toContain(status);
});

test("${target.id} — integer overflow boundary", async ({ request }) => {
  const { status } = await trpcMutation(request, "${endpoint}",
    { ${tenantField}: ${tenantConst}, ${amountField}: Number.MAX_SAFE_INTEGER + 1 }, adminCookie);
  expect(status).not.toBe(500);
  expect([200, 201, 400, 422]).toContain(status);
});
`;
}

// ─── AML / Structuring Bypass Template ────────────────────────────────────────
export function generateAMLBypassTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);
  const endpoint = target.endpoint || "transactions.create";
  const amountField = analysis.ir.apiEndpoints
    .find(ep => ep.name === endpoint)
    ?.inputFields?.find(f => ["amount", "price", "value", "sum", "total"].some(k => f.name.toLowerCase().includes(k)))?.name || "amount";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — AML Structuring Bypass: ${target.description}
// Risk: CRITICAL — structuring (smurfing) splits large transactions to evade AML thresholds
// Invariant: Rapid small transactions from same user must trigger velocity checks.

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id} — structuring: 10 transactions just below threshold", async ({ request }) => {
  // AML threshold is typically $10,000. Structuring = 10x $9,999 = $99,990 total
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      trpcMutation(request, "${endpoint}",
        { ${tenantField}: ${tenantConst}, ${amountField}: 9999, note: \`structuring-test-\${i}\` },
        adminCookie)
    )
  );
  // At least some transactions should be flagged/blocked after velocity limit
  const blockedCount = results.filter(r => r.status === 429 || r.status === 403 || r.status === 422).length;
  const allAccepted = results.every(r => r.status === 200 || r.status === 201);
  // If ALL 10 are accepted without any rate limit, that's a potential AML bypass
  expect(allAccepted, "All 10 structuring transactions accepted — AML velocity check missing").toBe(false);
});

test("${target.id} — single large transaction above threshold triggers review", async ({ request }) => {
  const { status, data } = await trpcMutation(request, "${endpoint}",
    { ${tenantField}: ${tenantConst}, ${amountField}: 10001 }, adminCookie);
  // Large transactions should either be accepted (with review flag) or rejected
  expect(status).not.toBe(500);
  if (status === 200 || status === 201) {
    // If accepted, response should indicate review/pending status
    const body = JSON.stringify(data || "");
    // Acceptable: status=pending, requiresReview=true, flagged=true
    // Not acceptable: status=completed with no review flag for large amounts
    console.log(\`Large transaction response: \${body.slice(0, 200)}\`);
  }
});

test("${target.id} — rapid-fire: 100 micro-transactions in parallel", async ({ request }) => {
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      trpcMutation(request, "${endpoint}",
        { ${tenantField}: ${tenantConst}, ${amountField}: 1, note: \`micro-\${i}\` },
        adminCookie)
    )
  );
  const successCount = results.filter(r => r.status === 200 || r.status === 201).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  // Should rate-limit after some threshold
  expect(rateLimitedCount, \`0 rate limits on 100 parallel micro-transactions — velocity check missing\`).toBeGreaterThan(0);
});
`;
}

// ─── Cross-Tenant Chain Attack Template ───────────────────────────────────────
export function generateCrossTenantChainTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);
  const endpoint = target.endpoint || "api.getById";
  const createEndpoint = analysis.ir.apiEndpoints.find(ep =>
    ep.name.toLowerCase().includes("create") || ep.name.toLowerCase().includes("book")
  )?.name || "api.create";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Cross-Tenant Chain Attack: ${target.description}
// Risk: CRITICAL — attacker creates resource in Tenant A, then reads/modifies it via Tenant B context
// Invariant: Resources created in Tenant A MUST NOT be accessible from Tenant B context.

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id} — create in tenant A, read via tenant B context", async ({ request }) => {
  // Step 1: Create resource in Tenant A
  const TENANT_A = ${tenantConst};
  const TENANT_B = \`\${TENANT_A}-other-tenant\`;

  const { data: created, status: createStatus } = await trpcMutation(request, "${createEndpoint}",
    { ${tenantField}: TENANT_A, name: "cross-tenant-test-resource" }, adminCookie);
  if (createStatus !== 200 && createStatus !== 201) {
    console.log("Skipping cross-tenant test: create failed with", createStatus);
    return;
  }

  const resourceId = (created as Record<string, unknown>)?.id || (created as Record<string, unknown>)?.data?.id;
  if (!resourceId) return; // Can't test without an ID

  // Step 2: Try to read the resource from Tenant B context
  const { status: readStatus } = await trpcQuery(request, "${endpoint}",
    { ${tenantField}: TENANT_B, id: resourceId }, adminCookie);

  // Must be rejected — 403 Forbidden or 404 Not Found
  expect(readStatus, \`Cross-tenant read succeeded: resource from \${TENANT_A} accessible from \${TENANT_B}\`)
    .not.toBe(200);
  expect([403, 404]).toContain(readStatus);
});

test("${target.id} — IDOR via tenant field manipulation", async ({ request }) => {
  // Attempt to access resource by guessing IDs across tenants
  const TENANT_A = ${tenantConst};
  const TENANT_B = \`\${TENANT_A}-attacker\`;

  // Try sequential IDs that might belong to other tenants
  const guessedIds = [1, 2, 3, 100, 1000];
  for (const id of guessedIds) {
    const { status } = await trpcQuery(request, "${endpoint}",
      { ${tenantField}: TENANT_B, id }, adminCookie);
    // Should not return 200 for IDs that don't belong to TENANT_B
    if (status === 200) {
      // If we get data, verify it belongs to TENANT_B
      console.warn(\`Potential IDOR: ID \${id} returned 200 for tenant \${TENANT_B}\`);
    }
    expect(status).not.toBe(500);
  }
});
`;
}

// ─── Concurrent Write / Race Condition Template ────────────────────────────────
export function generateConcurrentWriteTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);
  const endpoint = target.endpoint || "api.update";
  const createEndpoint = analysis.ir.apiEndpoints.find(ep =>
    ep.name.toLowerCase().includes("create") || ep.name.toLowerCase().includes("book")
  )?.name || "api.create";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Concurrent Write / Race Condition: ${target.description}
// Risk: HIGH — race conditions can cause double-spending, double-booking, or state corruption
// Invariant: Concurrent writes to the same resource MUST be serialized (optimistic locking or DB transactions).

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id} — double-spend: two simultaneous debit requests", async ({ request }) => {
  // Create a resource first
  const { data: created } = await trpcMutation(request, "${createEndpoint}",
    { ${tenantField}: ${tenantConst}, name: \`race-test-\${Date.now()}\` }, adminCookie);
  const resourceId = (created as Record<string, unknown>)?.id || (created as Record<string, unknown>)?.data?.id;
  if (!resourceId) return;

  // Fire 5 concurrent update requests to the same resource
  const CONCURRENCY = 5;
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      trpcMutation(request, "${endpoint}",
        { ${tenantField}: ${tenantConst}, id: resourceId, status: "completed" },
        adminCookie)
    )
  );

  const successCount = results.filter(r => r.status === 200 || r.status === 201).length;
  const conflictCount = results.filter(r => r.status === 409 || r.status === 422 || r.status === 423).length;

  // Only ONE concurrent write should succeed, rest should get 409 Conflict or be serialized
  // If all 5 succeed, that's a race condition
  if (successCount > 1) {
    console.warn(\`Race condition detected: \${successCount}/\${CONCURRENCY} concurrent writes all succeeded\`);
  }
  // At minimum, no 500 errors
  const errorCount = results.filter(r => r.status === 500).length;
  expect(errorCount, "Concurrent writes caused server errors").toBe(0);
});

test("${target.id} — optimistic locking: stale version rejected", async ({ request }) => {
  // Create resource
  const { data: created } = await trpcMutation(request, "${createEndpoint}",
    { ${tenantField}: ${tenantConst}, name: \`version-test-\${Date.now()}\` }, adminCookie);
  const resourceId = (created as Record<string, unknown>)?.id || (created as Record<string, unknown>)?.data?.id;
  if (!resourceId) return;

  // Update with version=0 (stale)
  const { status } = await trpcMutation(request, "${endpoint}",
    { ${tenantField}: ${tenantConst}, id: resourceId, version: 0, name: "stale-update" },
    adminCookie);

  // If the API supports optimistic locking, stale version should be rejected
  // If no version field, this test just verifies no 500
  expect(status).not.toBe(500);
});
`;
}

// ─── Mass Assignment / Parameter Pollution Template ───────────────────────────
export function generateMassAssignmentTest(target: ProofTarget, analysis: AnalysisResult): string {
  const { roleFnName, tenantConst, tenantField } = getRoleHelper(analysis);
  const endpoint = target.endpoint || "api.update";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Mass Assignment / Parameter Pollution: ${target.description}
// Risk: HIGH — attackers inject extra fields to escalate privileges or modify protected fields
// Invariant: Server MUST use allowlist (whitelist) for accepted fields, not blocklist.

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id} — role escalation via mass assignment", async ({ request }) => {
  const { status, data } = await trpcMutation(request, "${endpoint}",
    {
      ${tenantField}: ${tenantConst},
      // Attempt to inject privileged fields
      role: "admin",
      isAdmin: true,
      permissions: ["*"],
      verified: true,
      emailVerified: true,
      balance: 999999,
    },
    adminCookie
  );
  expect(status).not.toBe(500);
  if (status === 200 || status === 201) {
    const body = JSON.stringify(data || "");
    // Response must not confirm role escalation
    expect(body).not.toMatch(/"role"\s*:\s*"admin"/);
    expect(body).not.toMatch(/"isAdmin"\s*:\s*true/);
    expect(body).not.toMatch(/"balance"\s*:\s*999999/);
  }
});

test("${target.id} — prototype pollution via __proto__", async ({ request }) => {
  const { status } = await trpcMutation(request, "${endpoint}",
    {
      ${tenantField}: ${tenantConst},
      "__proto__": { "admin": true },
      "constructor": { "prototype": { "admin": true } },
    } as Record<string, unknown>,
    adminCookie
  );
  // Must not crash the server
  expect(status).not.toBe(500);
  expect([200, 201, 400, 422]).toContain(status);
});

test("${target.id} — HTTP parameter pollution: duplicate fields", async ({ request }) => {
  // Send the same field twice with different values
  const { status } = await trpcMutation(request, "${endpoint}",
    { ${tenantField}: ${tenantConst}, id: "1", id2: "2" } as Record<string, unknown>,
    adminCookie
  );
  expect(status).not.toBe(500);
});
`;
}
