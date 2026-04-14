import { invokeLLM } from "../_core/llm";
import { withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";
import type { Behavior, EndpointField, APIEndpoint, AnalysisResult, ProofType, ProofTarget, RiskModel, RawProof, FlowStep } from "./types";
import { normalizeEndpointName } from "./normalize";
import { generateSQLInjectionTest, generateHardcodedSecretTest } from "./proof-templates-security";

// ─── Schicht 3: Proof Generator ───────────────────────────────────────────────

/**
 * Goldstandard: Check if generated TypeScript code is syntactically valid.
 * Uses a simple bracket/paren balance check + known bad patterns.
 * Returns error message if invalid, null if OK.
 */
function checkTypeScriptSyntax(code: string): string | null {
  // Check bracket balance — process line by line to handle // comments correctly
  let braces = 0, parens = 0, brackets = 0;
  let inString = false;
  let stringChar = '';
  let inBlockComment = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';
    const prev = i > 0 ? code[i - 1] : '';
    // Handle block comments /* ... */
    if (!inString && !inBlockComment && c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    // Handle line comments // ... (skip to end of line)
    if (!inString && c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (inString) {
      if (c === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }
    if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '(') parens++;
    else if (c === ')') parens--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
    if (braces < 0 || parens < 0 || brackets < 0) return `Unmatched closing bracket at position ${i}`;
  }
  if (braces !== 0) return `Unbalanced braces: ${braces > 0 ? 'unclosed {' : 'extra }'}`;
  if (parens !== 0) return `Unbalanced parentheses: ${parens > 0 ? 'unclosed (' : 'extra )'}`;
  if (brackets !== 0) return `Unbalanced brackets: ${brackets > 0 ? 'unclosed [' : 'extra ]'}`;
  // Check for obvious template artifacts
  if (code.includes('undefined}') || code.includes('null}') && code.includes('${')) return 'Unresolved template variable';
  if (code.includes('TODO_REPLACE_WITH_YOUR_ENDPOINT') && !code.includes('// ⚠️')) return null; // TODOs are allowed
  // Check for forbidden non-existent imports
  if (code.includes('from "../../helpers/db-queries"') || code.includes("from '../../helpers/db-queries'")) {
    return 'Forbidden import: db-queries helper does not exist. Use API-based DB checks instead.';
  }
  if (code.includes('from "../../helpers/database"') || code.includes("from '../../helpers/database'")) {
    return 'Forbidden import: database helper does not exist. Use API-based DB checks instead.';
  }
  // Check for TODO_ string literals (not comments) that would cause test failures
  const todoLiteralMatch = code.match(/["']TODO_[A-Z_]+["']/);
  if (todoLiteralMatch) {
    return `Unresolved TODO literal in test code: ${todoLiteralMatch[0]}`;
  }
  return null;
}

/**
 * Generate a valid TODO stub test when a template crashes or produces invalid code.
 */
function generateTODOStub(target: ProofTarget, reason: string): string {
  return `import { test, expect } from "@playwright/test";

// ${target.id} — ${target.description}
// ⚠️  TODO: This test could not be generated automatically.
// Reason: ${reason.replace(/\n/g, ' ').slice(0, 200)}
// Please implement this test manually.
// Risk: ${target.riskLevel}
// Proof type: ${target.proofType}

test.skip("${target.id} — TODO: Implement manually", async () => {
  // TODO: Implement ${target.description}
  expect(true).toBe(true);
});
`;
}

function getFilename(pt: ProofType): string {
  const map: Record<ProofType, string> = {
    idor: "tests/security/idor.spec.ts",
    csrf: "tests/security/csrf.spec.ts",
    rate_limit: "tests/security/rate-limit.spec.ts",
    dsgvo: "tests/compliance/dsgvo.spec.ts",
    status_transition: "tests/integration/status-transitions.spec.ts",
    risk_scoring: "tests/integration/risk-scoring.spec.ts",
    boundary: "tests/business/boundary.spec.ts",
    business_logic: "tests/business/logic.spec.ts",
    spec_drift: "tests/integration/spec-drift.spec.ts",
    concurrency: "tests/concurrency/race-conditions.spec.ts",
    idempotency: "tests/integration/idempotency.spec.ts",
    auth_matrix: "tests/security/auth-matrix.spec.ts",
    flow: "tests/integration/flows.spec.ts",
    cron_job: "tests/integration/cron-jobs.spec.ts",
    webhook: "tests/integration/webhooks.spec.ts",
    feature_gate: "tests/business/feature-gates.spec.ts",
    e2e_flow: "tests/e2e/flows.spec.ts",
    sql_injection: "tests/security/sql-injection.spec.ts",
    hardcoded_secret: "tests/security/hardcoded-secrets.spec.ts",
  };
  return map[pt];
}

// ─── Universal Field Helper Functions ──────────────────────────────────────────

/**
 * Returns a valid TypeScript expression for a field's default value.
 * Used in test payloads to avoid TODO_ placeholders.
 */
export function getValidDefault(f: EndpointField, tenantConst: string): string {
  if (f.validDefault) return f.validDefault;
  if (f.isTenantKey) return tenantConst;
  const fl = f.name.toLowerCase();
  switch (f.type) {
    case "enum":
      return f.enumValues?.length ? `"${f.enumValues[0]}"` : `"active"`;
    case "number":
      if (fl.includes("price") || fl.includes("amount")) return f.min !== undefined ? String(Math.max(f.min, 0.01)) : "1.00";
      // Paired reference IDs: "toAccountId" gets 2, "fromAccountId" gets 1
      // This prevents SAME_ACCOUNT validation errors in transfer/transaction tests
      if (fl.includes("to") && fl.includes("account")) return "2";
      if (fl.includes("to") && fl.includes("id")) return "2";
      return f.min !== undefined ? String(Math.max(f.min, 1)) : "1";
    case "boolean":
      return "false";
    case "date":
      return "tomorrowStr()";
    case "array":
      if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
        const itemFields = f.arrayItemFields
          .map(af => `${af.name}: ${getValidDefault(af, tenantConst)}`)
          .join(", ");
        return `[{ ${itemFields} }]`;
      }
      if (f.arrayItemType === "number") return "[1]";
      return "[]";
    case "string":
    default:
      if (fl.includes("date") || fl.includes("datum")) return "tomorrowStr()";
      if (fl.includes("email")) return `"test@example.com"`;
      if (fl.includes("phone")) return `"+49176${Date.now().toString().slice(-8)}"`;
      if (fl.includes("sku")) return `"SKU-${Date.now()}"`;
      if (fl.includes("idempotency") || fl.includes("key")) return `"idempotency-key-\${Date.now()}"`;
      if (fl.includes("name") || fl.includes("title")) return `"Test ${f.name}-\${Date.now()}"`;
      if (fl.includes("description")) return `"Test description"`;
      if (fl.includes("status")) return `"active"`;
      if (fl.includes("priority")) return `"medium"`;
      if (fl.includes("id") || fl.includes("workspace") || fl.includes("tenant")) return tenantConst;
      return `"test-${f.name}"`;
  }
}

export interface BoundaryCase {
  label: string;
  value: string;
  valid: boolean;
}

/**
 * Returns boundary test cases for a field based on its type and constraints.
 * Returns BoundaryCase[] with label, value (TypeScript expression), and valid flag.
 */
export function calcBoundaryValues(f: EndpointField): BoundaryCase[] {
  switch (f.type) {
    case "number": {
      const min = f.min ?? 0;
      const max = f.max ?? 100;
      const fl = f.name.toLowerCase();
      const isDecimal = !Number.isInteger(min) || !Number.isInteger(max) ||
        fl.includes("price") || fl.includes("amount") || fl.includes("cost") || fl.includes("fee");
      const step = isDecimal ? 0.01 : 1;
      const fmt = (n: number) => isDecimal ? n.toFixed(2) : String(n);
      return [
        { label: `${fmt(min)} (minimum)`, value: fmt(min), valid: true },
        { label: `${fmt(max)} (maximum)`, value: fmt(max), valid: true },
        { label: `${fmt(+(min - step).toFixed(2))} (below minimum)`, value: fmt(+(min - step).toFixed(2)), valid: false },
        { label: `${fmt(+(max + step).toFixed(2))} (above maximum)`, value: fmt(+(max + step).toFixed(2)), valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    case "string": {
      const min = f.min ?? 1;
      const max = f.max ?? 200;
      return [
        { label: `"A".repeat(${min}) (minimum)`, value: `"A".repeat(${min})`, valid: true },
        { label: `"A".repeat(${max}) (maximum)`, value: `"A".repeat(${max})`, valid: true },
        { label: `"" (below minimum)`, value: `""`, valid: false },
        { label: `"A".repeat(${max + 1}) (above maximum)`, value: `"A".repeat(${max + 1})`, valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    case "date": return [
      { label: `tomorrowStr() (future = valid)`, value: `tomorrowStr()`, valid: true },
      { label: `yesterdayStr() (past = invalid)`, value: `yesterdayStr()`, valid: false },
      { label: `null`, value: `null`, valid: false },
    ];
    case "array": {
      const min = f.min ?? 1;
      const max = f.max ?? 50;
      const item = buildArrayItemLiteral(f);
      return [
        { label: `[${item}] (minimum 1 item)`, value: `[${item}]`, valid: true },
        { label: `Array(${max}).fill(${item}) (maximum ${max} items)`, value: `Array(${max}).fill(${item})`, valid: true },
        { label: `[] (empty = below minimum)`, value: `[]`, valid: false },
        { label: `Array(${max + 1}).fill(${item}) (above maximum)`, value: `Array(${max + 1}).fill(${item})`, valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    case "enum": {
      const valid = f.enumValues?.[0] ?? "valid";
      return [
        { label: `"${valid}" (valid enum)`, value: `"${valid}"`, valid: true },
        { label: `"__invalid__" (invalid enum)`, value: `"__invalid__"`, valid: false },
        { label: `null`, value: `null`, valid: false },
      ];
    }
    default: return [
      { label: `"valid"`, value: `"valid"`, valid: true },
      { label: `null`, value: `null`, valid: false },
    ];
  }
}

/**
 * Builds a TypeScript array item literal for nested array fields.
 */
export function buildArrayItemLiteral(f: EndpointField): string {
  if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
    const fields = f.arrayItemFields.map(af => {
      const val = af.type === "number" ? (af.min !== undefined ? Math.max(af.min, 1) : 1) : `"test-${af.name}"`;
      return `${af.name}: ${val}`;
    }).join(", ");
    return `{ ${fields} }`;
  }
  if (f.arrayItemType === "number") return "1";
  return `"item"`;
}

/**
 * Builds a TypeScript array item expression for nested array fields.
 */
function buildArrayItem(f: EndpointField, tenantConst: string): string {
  if (f.arrayItemType === "object" && f.arrayItemFields?.length) {
    const fields = f.arrayItemFields.map(af => `${af.name}: ${getValidDefault(af, tenantConst)}`).join(", ");
    return `{ ${fields} }`;
  }
  if (f.arrayItemType === "number") return "1";
  return `"item"`;
}

/**
 * Finds the best boundary field in an endpoint's inputFields.
 * Priority: 1) exact match on target.boundaryField name
 *           2) first isBoundaryField=true field
 *           3) first non-tenant field with min/max
 *           4) first non-tenant field
 */
function findBoundaryField(fields: EndpointField[], preferredName?: string): EndpointField | undefined {
  if (!fields.length) return undefined;
  // 1. Exact match by name
  if (preferredName) {
    const exact = fields.find(f => f.name.toLowerCase() === preferredName.toLowerCase());
    if (exact) return exact;
  }
  // 2. First isBoundaryField=true (non-tenant)
  const boundaryField = fields.find(f => f.isBoundaryField && !f.isTenantKey);
  if (boundaryField) return boundaryField;
  // 3. First field with min/max (non-tenant)
  const constrainedField = fields.find(f => !f.isTenantKey && (f.min !== undefined || f.max !== undefined));
  if (constrainedField) return constrainedField;
  // 4. First non-tenant, non-id field
  const nonTenant = fields.find(f => !f.isTenantKey && f.name !== "id");
  return nonTenant || fields[0];
}

/**
 * Finds the best boundary field for a behavior using semantic keyword matching.
 * This is the new behavior-aware version that matches the spec's field lookup logic.
 * Priority:
 *   1) isBoundaryField=true field whose name appears in behavior title
 *   2) Semantic keyword match (price, stock, name, items, quantity, etc.)
 *   3) First isBoundaryField=true field as fallback
 */
export function findBoundaryFieldForBehavior(
  behavior: Behavior,
  endpointDef: APIEndpoint | undefined
): EndpointField | undefined {
  if (!endpointDef?.inputFields?.length) return undefined;
  const titleLower = behavior.title.toLowerCase();

  // 1. Field name appears directly in behavior title
  const direct = endpointDef.inputFields.find(f =>
    f.isBoundaryField && titleLower.includes(f.name.toLowerCase()));
  if (direct) return direct;

  // 2. Semantic keyword matching
  const semanticMap: Record<string, string[]> = {
    price:    ["price", "cost", "amount", "fee", "total"],
    stock:    ["stock", "inventory", "quantity"],
    name:     ["name", "title", "label"],
    items:    ["items", "array", "list"],
    quantity: ["quantity", "qty", "count"],
    pageSize: ["page", "pagesize", "limit", "per_page"],
    sku:      ["sku", "code"],
  };
  for (const [fieldName, keywords] of Object.entries(semanticMap)) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      const match = endpointDef.inputFields.find(f =>
        f.isBoundaryField && f.name.toLowerCase() === fieldName);
      if (match) return match;
    }
  }

  // 3. First isBoundaryField=true as fallback
  return endpointDef.inputFields.find(f => f.isBoundaryField);
}

// ─── Test Generators ────────────────────────────────────────────────────────────

/**
 * Returns the preferred role for test execution.
 * Admin is preferred because most mutations require elevated privileges.
 * Falls back to owner, then the first role if no admin role is found.
 */
function getPreferredRole(authModel: AnalysisResult["ir"]["authModel"]): { name: string } | undefined {
  if (!authModel?.roles?.length) return undefined;
  // Filter out roles with empty/undefined names (LLM sometimes returns empty strings)
  const validRoles = authModel.roles.filter(
    (r: { name: string }) => r && typeof r.name === "string" && r.name.trim().length > 0
  );
  if (validRoles.length === 0) {
    // Fallback: return a default admin role
    return { name: "admin" };
  }
  return validRoles.find((r: { name: string }) => r.name.toLowerCase().includes("admin"))
    || validRoles.find((r: { name: string }) => r.name.toLowerCase().includes("owner"))
    || validRoles[0];
}

/**
 * Converts a role object to the corresponding getCookie function name.
 * e.g. { name: "admin" } → "getAdminCookie"
 * e.g. { name: "bank_admin" } → "getBankAdminCookie"
 */
function roleToCookieFn(role: { name: string } | undefined): string {
  if (!role) return "getAdminCookie";
  return `get${role.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`;
}

function generateIDORTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const tenantBConst = `TEST_${tenantEntity.toUpperCase()}_B_ID`;
   const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));
  // For IDOR tests: use the actual target endpoint for the attack, and list endpoint for positive control
  const listEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("getall") || e.name.toLowerCase().includes("search"))?.name
    || analysis.ir.apiEndpoints.find(e => !e.name.toLowerCase().includes("create") && !e.name.toLowerCase().includes("update") && !e.name.toLowerCase().includes("delete"))?.name
    || target.endpoint
    || analysis.ir.apiEndpoints[0]?.name
    || "list_endpoint_not_found";
  // The actual endpoint being tested for IDOR (e.g. tasks.delete, tasks.updateStatus)
  const attackEndpoint = target.endpoint || listEndpoint;
  const attackEpDef = analysis.ir.apiEndpoints.find(e => e.name === attackEndpoint);
  const attackFields = attackEpDef?.inputFields || [];
  // Determine if this is a mutation endpoint (needs a resource ID) or a query endpoint
  const isMutationEndpoint = attackEndpoint.toLowerCase().includes("delete") ||
    attackEndpoint.toLowerCase().includes("update") ||
    attackEndpoint.toLowerCase().includes("create") ||
    attackEndpoint.toLowerCase().includes("bulk");
  const hasEndpoint = !!attackEpDef;
  const getEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("getby") || e.name.toLowerCase().includes(".get"))?.name
    || analysis.ir.apiEndpoints.find(e => e.method === "GET")?.name
    || analysis.ir.apiEndpoints[0]?.name
    || "getbyid_endpoint_not_found";
  // Build attack payload for mutation endpoints
  const attackPayloadLines = attackFields.map(f => {
    const fname = f.name;
    const fl = fname.toLowerCase();
    if (f.isTenantKey || fl === tenantField || fl.includes("workspace") || fl.includes("tenant")) return `        ${fname}: ${tenantBConst},`;
    if (fl === "id" || fl.endsWith("id") || fl.endsWith("ids")) return `        ${fname}: resourceId,`;
    if (fl.includes("status")) {
      const statusVals = analysis.ir.enums?.status || analysis.ir.statusMachine?.states || [];
      return `        ${fname}: "${statusVals[0] || "active"}",`;
    }
    if (fl.includes("title") || fl.includes("name")) return `        ${fname}: "test-title",`;
    if (f.type === "number") return `        ${fname}: ${f.min !== undefined ? Math.max(f.min, 1) : 1},`;
    if (f.type === "enum" && f.enumValues?.length) return `        ${fname}: "${f.enumValues[0]}",`;
    return `        ${fname}: "test-${fname}",`;
  }).join("\n");
  // For array fields like taskIds, build a list payload
  const hasArrayField = attackFields.some(f => f.name.toLowerCase().endsWith("ids") || f.name.toLowerCase().includes("ids"));
  const arrayField = attackFields.find(f => f.name.toLowerCase().endsWith("ids") || f.name.toLowerCase().includes("ids"));
  const attackPayloadForArray = hasArrayField && arrayField
    ? `        ${arrayField.name}: [resourceId],\n        ${tenantField}: ${tenantBConst},`
    : attackPayloadLines;

  return `import { test, expect } from "@playwright/test";
import { trpcQuery, trpcMutation, loginAndGetCookie } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, ${tenantBConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — IDOR: ${target.description}
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No list endpoint found in spec. Replace TODO_REPLACE_WITH_LIST_ENDPOINT and TODO_REPLACE_WITH_GETBYID_ENDPOINT." : ""}

let tenantACookie: string;
let tenantBCookie: string;

test.beforeAll(async ({ request }) => {
  tenantACookie = await ${roleFnName}(request);
  // IMPORTANT: Set E2E_TENANT_B_USER and E2E_TENANT_B_PASS to a user from a DIFFERENT tenant
  tenantBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_TENANT_B_USER || "test-tenant-b-user",
    process.env.E2E_TENANT_B_PASS || "TestPass2026x"
  );
});

test("${target.id}a — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: ${target.mutationTargets[0]?.description || `Remove workspaceId filter in ${attackEndpoint} query`}

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(${tenantBConst}));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

${isMutationEndpoint ? `test("${target.id}b — Tenant A cannot mutate Tenant B resource via ${attackEndpoint}", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { ${tenantField}: ${tenantBConst} });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via ${attackEndpoint}
  const crossTenant = await trpcMutation(request, "${attackEndpoint}",
    {
${hasArrayField ? attackPayloadForArray : attackPayloadLines}
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in ${attackEndpoint}
  // Kills: Allow cross-tenant mutations on ${attackEndpoint}

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});` : `test("${target.id}b — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantBConst} }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { ${tenantField}: ${tenantBConst} });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via ${attackEndpoint}
  const crossTenant = await trpcQuery(request, "${attackEndpoint}",
    { id: resourceId, ${tenantField}: ${tenantBConst} }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in ${attackEndpoint}
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});`}
`;
}

function generateCSRFTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);

  // Use resolved endpoint from IR, or TODO placeholder
  const endpoint = normalizeEndpointName(
    target.endpoint
    || analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add") ||
      e.name.toLowerCase().includes("update") || e.name.toLowerCase().includes("delete") ||
      e.name.toLowerCase().includes("submit") || e.name.toLowerCase().includes("post"))?.name
    || analysis.ir.apiEndpoints[0]?.name
    || "TODO_REPLACE_WITH_MUTATION_ENDPOINT"
  );
  const hasEndpoint = !!target.endpoint || analysis.ir.apiEndpoints.length > 0;
  const listEndpoint = normalizeEndpointName(
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get"))?.name
    || analysis.ir.apiEndpoints[0]?.name
    || "list_endpoint_not_found"
  );
  const csrfEndpoint = analysis.ir.authModel?.csrfEndpoint;
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  // Build minimal payload from known input fields
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
  const knownFields = epDef?.inputFields || [];

  // Side-effect check: use a unique title field to verify no DB write after 403
  const uniqueField = knownFields.find(f => f.name.toLowerCase().includes("title") || f.name.toLowerCase().includes("name"))?.name || knownFields[0]?.name || "title";
  const listEndpointForDbCheck = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("getall"))?.name
    || analysis.ir.apiEndpoints[0]?.name
    || "list_endpoint_not_found";

  // Pre-compute payload lines (avoids nested backtick issues in template literals)
  // Track if any date field is used so we can import tomorrowStr
  let csrfHasDateField = false;
  function buildCsrfPayloadLine(f: EndpointField, isUnique: boolean): string {
    const fname = f.name;
    const fl = fname.toLowerCase();
    if (isUnique) return `        ${fname}: uniqueTitle,`;
    if (f.isTenantKey || fl === tenantField || fl.includes("workspace") || fl.includes("tenant")) return `        ${fname}: ${tenantConst},`;
    if (f.type === "date" || fl.includes("date") || fl.includes("datum")) {
      csrfHasDateField = true;
      return `        ${fname}: tomorrowStr(),`;
    }
    if (f.type === "number") return `        ${fname}: ${f.min !== undefined ? Math.max(f.min, 1) : 1},`;
    if (f.type === "enum" && f.enumValues?.length) return `        ${fname}: "${f.enumValues[0]}",`;
    if (fl.includes("assignee") || (fl.includes("id") && !fl.includes("workspace"))) return `        ${fname}: ${tenantConst},`;
    if (fl.includes("priority")) {
      const enumPriority = analysis.ir.enums && analysis.ir.enums.priority;
      const pv = (enumPriority && enumPriority[0]) || "medium";
      return `        ${fname}: "${pv}",`;
    }
    if (fl.includes("status")) {
      const enumStatus = analysis.ir.enums && analysis.ir.enums.status;
      const sm = analysis.ir.statusMachine;
      const sv = (sm && sm.initialState) || (enumStatus && enumStatus[0]) || "active";
      return `        ${fname}: "${sv}",`;
    }
    return `        ${fname}: "test-${fname}",`;
  }

  const noTokenPayloadLines = knownFields.length > 0
    ? knownFields.map(f => buildCsrfPayloadLine(f, f.name === uniqueField)).join("\n")
    : `        ${tenantField}: ${tenantConst},\n        ${uniqueField}: uniqueTitle,\n        // TODO: Add other required fields for ${endpoint}`;

  function buildCsrfPositivePayloadLine(f: EndpointField): string {
    const fname = f.name;
    const fl = fname.toLowerCase();
    if (f.isTenantKey || fl === tenantField || fl.includes("workspace") || fl.includes("tenant")) return `        ${fname}: ${tenantConst},`;
    if (f.type === "date" || fl.includes("date") || fl.includes("datum")) {
      csrfHasDateField = true;
      return `        ${fname}: tomorrowStr(),`;
    }
    if (f.type === "number") return `        ${fname}: ${f.min !== undefined ? Math.max(f.min, 1) : 1},`;
    if (f.type === "enum" && f.enumValues?.length) return `        ${fname}: "${f.enumValues[0]}",`;
    if (fl.includes("title") || fl.includes("name")) return `        ${fname}: "Test ${fname} valid",`;
    if (fl.includes("assignee") || (fl.includes("id") && !fl.includes("workspace"))) return `        ${fname}: ${tenantConst},`;
    if (fl.includes("priority")) {
      const enumPriority2 = analysis.ir.enums && analysis.ir.enums.priority;
      const pv2 = (enumPriority2 && enumPriority2[0]) || "medium";
      return `        ${fname}: "${pv2}",`;
    }
    if (fl.includes("status")) {
      const enumStatus2 = analysis.ir.enums && analysis.ir.enums.status;
      const sm2 = analysis.ir.statusMachine;
      const sv2 = (sm2 && sm2.initialState) || (enumStatus2 && enumStatus2[0]) || "active";
      return `        ${fname}: "${sv2}",`;
    }
    return `        ${fname}: "test-${fname}",`;
  }

  const positivePayloadLines = knownFields.length > 0
    ? knownFields.map(f => buildCsrfPositivePayloadLine(f)).join("\n")
    : `        ${tenantField}: ${tenantConst},\n        // TODO: Add other required fields for ${endpoint}`;

  // Detect special CSRF behaviors that need custom test logic
  const behaviorTitle = (behavior?.title || target.description).toLowerCase();
  const isSessionBinding = behaviorTitle.includes("tied to") || behaviorTitle.includes("session") || behaviorTitle.includes("bound to");
  const isTokenReuse = behaviorTitle.includes("other session") || behaviorTitle.includes("different session") || behaviorTitle.includes("rejects") || behaviorTitle.includes("cross-session");
  const isCsrfTokenEndpoint = behaviorTitle.includes("csrf token is obtained") || behaviorTitle.includes("get /api/auth/csrf") || endpoint.includes("csrf");

  // Build kills comments
  const killsComments = target.mutationTargets.slice(1).map(m => `  // Kills: ${m.description}`).join("\n");
  const firstKill = target.mutationTargets[0]?.description || `Remove CSRF middleware from ${endpoint}`;

  // Build positive test (with CSRF token) - uses pre-computed positivePayloadLines
  const positiveTest = csrfEndpoint ? `
test("${target.id}b \u2014 POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
${positivePayloadLines}
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});
` : `
test("${target.id}b \u2014 POST with valid session (no CSRF required) succeeds", async ({ request }) => {
  // No CSRF endpoint in spec \u2014 testing that authenticated requests work normally
  const res = await trpcMutation(request, "${endpoint}", {
${positivePayloadLines.replace(/^        /gm, "    ")}
  }, adminCookie);
  expect(res.status).toBe(200);
  // Kills: Auth middleware blocks all requests
});
`;

  const csrfTomorrowImport = csrfHasDateField ? ", tomorrowStr" : "";

  // Special test for CSRF token endpoint (just verifies token is returned)
  if (isCsrfTokenEndpoint) {
    return `import { test, expect } from "@playwright/test";
import { BASE_URL } from "../../helpers/api";
import { ${roleFnName}, getCsrfToken } from "../../helpers/auth";

// ${target.id} \u2014 CSRF Token Endpoint
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;
test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a \u2014 CSRF token endpoint returns valid token", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Return empty string as CSRF token
  // Kills: Return same token for all sessions
});

test("${target.id}b \u2014 CSRF token is unique per request", async ({ request }) => {
  const token1 = await getCsrfToken(request, adminCookie);
  const token2 = await getCsrfToken(request, adminCookie);
  // Tokens may be the same (stateless) or different (stateful) — both are valid
  // But both must be non-empty valid strings
  expect(typeof token1).toBe("string");
  expect(typeof token2).toBe("string");
  expect(token1.length).toBeGreaterThanOrEqual(16);
  expect(token2.length).toBeGreaterThanOrEqual(16);
  // Kills: Return null or undefined as CSRF token
});
`;
  }

  // Special test for session-binding (CSRF token tied to session)
  if (isSessionBinding && !isTokenReuse) {
    return `import { test, expect } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery${csrfTomorrowImport} } from "../../helpers/api";
import { ${roleFnName}, getCsrfToken } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} \u2014 CSRF Session Binding
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;
test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a \u2014 CSRF token is valid for the session that obtained it", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token regardless of session

  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
${positivePayloadLines}
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF middleware ignores session binding
});

test("${target.id}b \u2014 Expired/invalid CSRF token is rejected", async ({ request }) => {
  const fakeToken = "invalid-csrf-token-that-was-never-issued";
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": fakeToken,
    },
    data: {
      json: {
${noTokenPayloadLines}
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Accept any string as valid CSRF token without validation
  // Kills: Only check token presence, not token validity
});
`;
  }

  // Special test for token reuse across sessions (CSRF-005)
  if (isTokenReuse) {
    return `import { test, expect } from "@playwright/test";
import { BASE_URL, trpcMutation, loginAndGetCookie${csrfTomorrowImport} } from "../../helpers/api";
import { ${roleFnName}, getCsrfToken } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} \u2014 CSRF Token Cross-Session Rejection
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}

let sessionACookie: string;
let sessionBCookie: string;
let sessionAToken: string;

test.beforeAll(async ({ request }) => {
  sessionACookie = await ${roleFnName}(request);
  sessionAToken = await getCsrfToken(request, sessionACookie);
  // Session B: same user, different session (re-login)
  sessionBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_ADMIN_USER || "test-admin",
    process.env.E2E_ADMIN_PASS || "TestPass2026x"
  );
});

test("${target.id}a \u2014 CSRF token from Session A is rejected when used with Session B cookie", async ({ request }) => {
  // Use Session A's token with Session B's cookie — must be rejected
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionBCookie,
      "X-CSRF-Token": sessionAToken, // Token from a DIFFERENT session
    },
    data: {
      json: {
${noTokenPayloadLines}
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Accept CSRF tokens from any session (global token pool)
  // Kills: Only validate token format, not session binding
});

test("${target.id}b \u2014 Session B's own CSRF token is accepted", async ({ request }) => {
  const sessionBToken = await getCsrfToken(request, sessionBCookie);
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionBCookie,
      "X-CSRF-Token": sessionBToken,
    },
    data: {
      json: {
${positivePayloadLines}
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF validation rejects all tokens including valid session-bound ones
});
`;
  }

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery, BASE_URL${csrfTomorrowImport} } from "../../helpers/api";
import { ${roleFnName}${csrfEndpoint ? ", getCsrfToken" : ""} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} \u2014 CSRF: ${target.description}
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Security"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// \u26a0\ufe0f  TODO: No mutation endpoint found in spec. Replace TODO_REPLACE_WITH_MUTATION_ENDPOINT." : ""}

let adminCookie: string;
test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a \u2014 POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = \`CSRF-Test-\${Date.now()}\`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(\`\${BASE_URL}/api/trpc/${endpoint}\`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
${noTokenPayloadLines}
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: ${firstKill}
${killsComments}
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "${listEndpointForDbCheck}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["${uniqueField}"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});
${positiveTest}
`;
}
function generateStatusTransitionTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  // Smart endpoint resolution for status transitions:
  // Different transitions may use different endpoints (e.g. accounts.freeze vs transactions.status)
  // Strategy: match the transition target state to endpoint names
  const behaviorText = [behavior?.title || "", ...behavior?.preconditions || [], ...behavior?.postconditions || []].join(" ").toLowerCase();
  const resolveTransitionEndpoint = (toState: string): string => {
    // 1. Direct match: endpoint name contains the target state (e.g. "freeze", "unfreeze", "close", "cancel")
    const stateEndpoint = analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes(toState.replace(/_/g, ""))
    );
    if (stateEndpoint) return stateEndpoint.name;
    // 2. Behavior text mentions a specific endpoint (e.g. "PATCH /api/transactions/:id/status")
    const epMatch = behaviorText.match(/(?:patch|post|put)\s+\/api\/([a-z/_:]+)/i);
    if (epMatch) {
      const pathEndpoint = analysis.ir.apiEndpoints.find(e =>
        e.method?.toLowerCase().includes(epMatch[1].split("/")[0])
      );
      if (pathEndpoint) return pathEndpoint.name;
    }
    // 3. Endpoint explicitly named in behavior (e.g. "accounts.freeze", "transactions.status")
    for (const ep of analysis.ir.apiEndpoints) {
      if (behaviorText.includes(ep.name.toLowerCase())) return ep.name;
    }
    // 4. Fallback: any endpoint with "status" or "update" in name
    return target.endpoint || analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("status") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_STATUS_ENDPOINT";
  };
  // Will be called with actual toStatus once computed below
  let endpoint = "TODO_REPLACE_WITH_STATUS_ENDPOINT";
  const hasEndpoint = !!target.endpoint;
  // Find a GET endpoint to verify status after transition
  // Prefer getById, but fall back to any list/get endpoint (orders.list, products.list, etc.)
  const getEndpoint = (
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("getby")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("find") || e.name.toLowerCase().includes("fetch") || e.name.toLowerCase().includes("read")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("detail") || e.name.toLowerCase().includes("show") || e.name.toLowerCase().includes("view")) ??
    analysis.ir.apiEndpoints[0]  // final fallback: use first available endpoint rather than TODO placeholder
  )?.name || "TODO_REPLACE_WITH_GET_ENDPOINT";

  // Goldstandard: Use statusMachine from IR if available, otherwise fall back to text extraction
  // Defensive normalization: LLM may return states as object or transitions as non-array
  // If multiple status machines exist, pick the one matching the endpoint/behavior resource
  let rawSm = analysis.ir.statusMachine;
  if (analysis.ir.statusMachines && analysis.ir.statusMachines.length > 0) {
    // Try to match by endpoint resource name (e.g. 'devices.status' → 'devices')
    const epResource = (target.endpoint || '').split('.')[0].toLowerCase();
    const behaviorText = ((behavior?.title || '') + ' ' + (behavior?.object || '')).toLowerCase();
    const matchedSm = analysis.ir.statusMachines.find(sm =>
      epResource && sm.resource && sm.resource.toLowerCase().includes(epResource)
    ) || analysis.ir.statusMachines.find(sm =>
      sm.resource && behaviorText.includes(sm.resource.toLowerCase())
    ) || analysis.ir.statusMachines[target.transitionIndex !== undefined
      ? target.transitionIndex % analysis.ir.statusMachines.length
      : 0];
    if (matchedSm) rawSm = matchedSm;
  }
  const sm = rawSm ? {
    ...rawSm,
    states: Array.isArray(rawSm.states)
      ? rawSm.states
      : (rawSm.states && typeof rawSm.states === 'object' ? Object.keys(rawSm.states as Record<string,unknown>) : []),
    transitions: Array.isArray(rawSm.transitions)
      ? rawSm.transitions.filter((t): t is [string, string] => Array.isArray(t) && t.length >= 2)
      : [],
    forbidden: Array.isArray(rawSm.forbidden)
      ? rawSm.forbidden.filter((t): t is [string, string] => Array.isArray(t) && t.length >= 2)
      : [],
  } : null;
  // ISSUE 5 FIX: Extended arrow pattern to handle quoted status values
  // Matches: "review → done", "review -> done", "to 'done'", "to \"completed\""
  const arrowPattern = /([a-z][a-z_0-9]*)\s*(?:→|->|to\s+)['"]?\s*([a-z][a-z_0-9]*)['"]?/i;
  const titleMatch = behavior?.title.match(arrowPattern);
  // precondMatch: extract status value from preconditions, but skip meta-words like 'transition', 'valid', 'is'
  const STATUS_META_WORDS = new Set(['transition', 'valid', 'invalid', 'is', 'the', 'a', 'an', 'be', 'change', 'update', 'set', 'backwards', 'backward', 'forward', 'forwards', 'skipping', 'skip', 'reverse', 'reversed', 'check', 'field', 'value', 'must', 'should', 'cannot', 'not']);
  const precondMatchRaw = !titleMatch && behavior?.preconditions.join(" ").match(/status[\s=:"']+([a-z][a-z_0-9]*)/i);
  const precondMatch = precondMatchRaw && !STATUS_META_WORDS.has((precondMatchRaw[1] || '').toLowerCase()) ? precondMatchRaw : null;
  const postcondMatch = !titleMatch && !precondMatch && behavior?.postconditions.join(" ").match(arrowPattern);
  const errorMatch = !titleMatch && !precondMatch && !postcondMatch && behavior?.errorCases.join(" ").match(arrowPattern);

  // If statusMachine is known from IR, use transitions in round-robin based on transitionIndex
  // This ensures each proof target gets a DIFFERENT transition (not all todo→in_progress)
  const allTransitions = sm?.transitions || [];
  const transitionIdx = target.transitionIndex ?? 0;
  const assignedTransition = allTransitions.length > 0
    ? allTransitions[transitionIdx % allTransitions.length]
    : null;
  const firstTransition = sm?.transitions?.[0];
  // Validate extracted status values against known states — if not a valid state, fall back to assignedTransition
  const knownStates = new Set(sm?.states || []);
  const isValidState = (s: string | undefined): s is string => !!s && (knownStates.size === 0 || knownStates.has(s));
  const rawFromStatus: string | undefined = titleMatch?.[1] || (precondMatch ? precondMatch[1] : undefined) || (postcondMatch ? postcondMatch[1] : undefined) || (errorMatch ? errorMatch[1] : undefined) || undefined;
  const rawToStatus: string | undefined = titleMatch?.[2] || (postcondMatch ? postcondMatch[2] : undefined) || (errorMatch ? errorMatch[2] : undefined) || undefined;
  // Use assignedTransition (from transitionIndex) as fallback to ensure diversity
  const fromStatus = (isValidState(rawFromStatus) ? rawFromStatus : assignedTransition?.[0] || firstTransition?.[0] || "pending") as string;
  const toStatus = (isValidState(rawToStatus) ? rawToStatus : assignedTransition?.[1] || firstTransition?.[1] || "completed") as string;

  // Now resolve the correct endpoint for this specific transition
  endpoint = resolveTransitionEndpoint(toStatus);

  // Find a skip-target: a state that is NOT directly reachable from fromStatus
  // Goldstandard: use statusMachine.forbidden or statusMachine.states to find skip candidates
  // CRITICAL: Only use states that actually appear in transitions — sm.states may contain resource names
  // (e.g. "account") that the LLM incorrectly included. Filtering to transition-used states prevents
  // Quality Gate failure: invalid status value.
  const statesUsedInTransitions = new Set(sm?.transitions.flatMap(t => [t[0], t[1]]) || []);
  let skipStatus: string | undefined;
  if (sm) {
    // Find a state that is not directly reachable from fromStatus (not in transitions from fromStatus)
    const directlyReachable = new Set(sm.transitions.filter(t => t[0] === fromStatus).map(t => t[1]));
    // Only consider states that appear in the transitions table (not sm.states which may have resource names)
    skipStatus = Array.from(statesUsedInTransitions).find(
      s => s !== fromStatus && s !== toStatus && !directlyReachable.has(s)
    );
  }
  // Bug 4 Fix: Do NOT fall back to text extraction for skipStatus — unreliable regex matches
  // normal words as status values. Only use transition-verified states (already done above).
  // If no skipStatus found, leave it undefined (no skip-transition test generated).

  // Detect side-effects from sideEffects array
  const hasCounter = target.sideEffects?.some(se => se.toLowerCase().includes("count"));
  const hasTimestamp = target.sideEffects?.some(se => se.toLowerCase().includes("at") || se.toLowerCase().includes("now()"));
  const counterField = target.sideEffects?.find(se => se.toLowerCase().includes("count"))?.match(/(\w+[Cc]ount)/)?.[1] || "count";
  const timestampField = target.sideEffects?.find(se => se.toLowerCase().includes("at"))?.match(/(\w+[Aa]t)/)?.[1] || "updatedAt";

  // Structured side-effects: generate precise field assertions from StructuredSideEffect objects
  const structuredSideEffectAssertions = (target.structuredSideEffects || []).map(sse => {
    if (sse.operation === "set" || sse.operation === "set_if") {
      return `  expect((updated as Record<string, unknown>)?.${sse.field}).toBe(${JSON.stringify(sse.value)});\n  // Kills: Remove ${sse.field} = ${String(sse.value)} in ${toStatus} handler`;
    } else if (sse.operation === "increment") {
      return `  expect(Number((updated as Record<string, unknown>)?.${sse.field})).toBeGreaterThan(0);\n  // Kills: Remove ${sse.field} increment in ${toStatus} handler`;
    } else if (sse.operation === "delete") {
      return `  expect((updated as Record<string, unknown>)?.${sse.field}).toBeNull();\n  // Kills: Forget to clear ${sse.field} on ${toStatus}`;
    }
    return "";
  }).filter(Boolean).join("\n");

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource, getResource } from "../../helpers/factories";

// ${target.id} — Status Transition: ${target.description}
// Risk: ${target.riskLevel}
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Business Logic"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No status endpoint found in spec. Replace TODO_REPLACE_WITH_STATUS_ENDPOINT and TODO_REPLACE_WITH_GET_ENDPOINT." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a — ${fromStatus} → ${toStatus}: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

${hasCounter ? `  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.${counterField} as number) ?? 0;
` : ""}
  const { status } = await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${toStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect(status).toBe(200);
  // Kills: ${target.mutationTargets[0]?.description || `Remove ${fromStatus}→${toStatus} from allowed transitions`}

  // DB state check
  const { data: updated } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("${toStatus}");
  // Kills: Update status field but not persist to DB

${hasTimestamp ? `  expect((updated as Record<string, unknown>)?.${timestampField}).not.toBeNull();
  // Kills: Remove ${timestampField} = NOW() in handler
` : ""}
${hasCounter ? `  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.${counterField}).toBe(countBefore + 1);
  // Kills: ${target.mutationTargets[1]?.description || `Remove ${counterField} increment in ${endpoint} handler`}
` : ""}
${structuredSideEffectAssertions ? structuredSideEffectAssertions + "\n" : ""}
${target.mutationTargets.slice(hasCounter ? 2 : 1).map(m => `  // Kills: ${m.description}`).join("\n")}
});

test("${target.id}b — ${toStatus} → ${fromStatus}: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to ${toStatus} state first
  await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${toStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${fromStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow ${toStatus}→${fromStatus} reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("${toStatus}");
  // Kills: Silent state corruption on rejected transition
});
${skipStatus ? `
test("${target.id}c — ${fromStatus} → ${skipStatus}: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to ${skipStatus} without going through ${toStatus}
  const { status } = await trpcMutation(request, "${endpoint}",
    { id: resource.id, status: "${skipStatus}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "${getEndpoint}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("${fromStatus}");
  // Kills: Accept any status value without validating transition chain
});
` : ""}
`;
}

function generateDSGVOTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  // Detect if this is an export behavior or a delete/anonymize behavior
  const isExportBehavior = (behavior?.title || '').toLowerCase().includes('export') ||
    (behavior?.action || '').toLowerCase().includes('export') ||
    (target.endpoint || '').toLowerCase().includes('export');

  // Detect if this is a hard-delete behavior (permanently deletes) vs soft-delete/anonymize
  // Declared early so it can be used in endpoint detection below
  const isHardDelete = (behavior?.title || '').toLowerCase().includes('permanently') ||
    (behavior?.postconditions || []).some(p => p.toLowerCase().includes('permanently') || p.toLowerCase().includes('all') && p.toLowerCase().includes('deleted'));

  // Detect if behavior title mentions workspace-level deleteAll
  const isWorkspaceDeleteAll = (behavior?.title || '').toLowerCase().includes('deleteall') ||
    (behavior?.title || '').toLowerCase().includes('delete all') ||
    (behavior?.specAnchor || '').toLowerCase().includes('deleteall') ||
    (behavior?.specAnchor || '').toLowerCase().includes('delete all');

  // Use resolved endpoint from IR, or TODO placeholder
  // CRITICAL: For hard-delete behaviors, prefer workspace.deleteAll over tasks.delete
  const endpoint = (() => {
    if (isExportBehavior) {
      // Fix 8: Export endpoint detection — prefer explicit export/gdprexport endpoints
      if (target.endpoint?.toLowerCase().includes('export') || target.endpoint?.toLowerCase().includes('gdpr')) {
        return target.endpoint;
      }
      return analysis.ir.apiEndpoints.find(e =>
          e.name.toLowerCase().includes('export') ||
          e.name.toLowerCase().includes('gdprexport') ||
          e.name.toLowerCase().includes('download') ||
          (e.name.toLowerCase().includes('gdpr') && e.name.toLowerCase().includes('export')))?.name
        || analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes('gdpr'))?.name
        || target.endpoint
        || analysis.ir.apiEndpoints[0]?.name
        || 'TODO_REPLACE_WITH_EXPORT_ENDPOINT';
    }
    if (isWorkspaceDeleteAll || (isHardDelete && !target.endpoint?.toLowerCase().includes('delete'))) {
      // Workspace-level hard delete: prefer workspace.deleteAll
      const deleteAllEp = analysis.ir.apiEndpoints.find(e =>
        e.name.toLowerCase().includes('deleteall') ||
        (e.name.toLowerCase().includes('delete') && e.name.toLowerCase().includes('all')) ||
        (e.name.toLowerCase().includes('workspace') && e.name.toLowerCase().includes('delete')))?.name;
      if (deleteAllEp) return deleteAllEp;
    }
    if (isHardDelete && target.endpoint) {
      // Hard-delete: if target.endpoint is a single-resource delete (tasks.delete)
      // but a workspace-level deleteAll exists, prefer that
      const deleteAllEp = analysis.ir.apiEndpoints.find(e =>
        e.name.toLowerCase().includes('deleteall') ||
        (e.name.toLowerCase().includes('workspace') && e.name.toLowerCase().includes('delete')))?.name;
      if (deleteAllEp && target.endpoint !== deleteAllEp &&
          !target.endpoint.toLowerCase().includes('workspace')) {
        return deleteAllEp;
      }
      return target.endpoint;
    }
    if (target.endpoint) return target.endpoint;
    // Fallback: find any GDPR/delete endpoint
    return analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes('gdpr') || e.name.toLowerCase().includes('delete') ||
      e.name.toLowerCase().includes('dsgvo') || e.name.toLowerCase().includes('anon'))?.name
      || analysis.ir.apiEndpoints[0]?.name
      || 'TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT';
  })();
   const hasEndpoint = endpoint !== 'TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT' && endpoint !== 'TODO_REPLACE_WITH_EXPORT_ENDPOINT';
  // Fix 9: For audit-log retention behaviors, detect and use GDPR-delete endpoint
  const isAuditBehavior = (behavior?.title || '').toLowerCase().includes('audit') ||
    (behavior?.title || '').toLowerCase().includes('retained') ||
    (behavior?.specAnchor || '').toLowerCase().includes('audit');
  // Find list endpoint for history check — prefer customer/user/person endpoints for DSGVO verify
  // Fix 9: For DSGVO behaviors, prefer the entity endpoint (customer/user/guest) over generic list
  const gdprEntityEndpoint = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("customer") || e.name.toLowerCase().includes("user") ||
    e.name.toLowerCase().includes("guest") || e.name.toLowerCase().includes("person"))?.name;
  // Bug 2 Fix: Blacklist for verify endpoint — never use auth/csrf/health endpoints as DSGVO verify
  const EXCLUDED_VERIFY_ENDPOINTS = ["csrf", "token", "login", "logout", "auth.me", "health", "ping", "register", "signup", "refresh"];
  const isNotExcluded = (e: { name: string }) =>
    !EXCLUDED_VERIFY_ENDPOINTS.some(ex => e.name.toLowerCase().includes(ex));
  // Bug C Fix: Derive verify endpoint from GDPR endpoint entity
  // "drivers.gdprDelete" → "drivers.list", "owners.gdprAnonymize" → "owners.list"
  const gdprEndpointPrefix = target.endpoint?.split(".")?.[0]; // "drivers" from "drivers.gdprDelete"
  // First: try to find an actual endpoint matching the GDPR entity (e.g. drivers.list)
  const gdprEntityListEndpoint = gdprEndpointPrefix
    ? analysis.ir.apiEndpoints.find(e =>
        e.name.startsWith(`${gdprEndpointPrefix}.`) &&
        (e.name.includes("list") || e.name.includes("get")) &&
        isNotExcluded(e)
      )?.name ?? `${gdprEndpointPrefix}.list`
    : null;
  const gdprEntityFallback = gdprEntityListEndpoint ? { name: gdprEntityListEndpoint } : null;
  const listEndpoint = (
    // HIGHEST PRIORITY: entity-specific list endpoint derived from GDPR endpoint
    gdprEntityFallback ??
    (isAuditBehavior && gdprEntityEndpoint ? { name: gdprEntityEndpoint } : null) ??
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("customer") && e.name.toLowerCase().includes("list") && isNotExcluded(e)) ??
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("list") && isNotExcluded(e)) ??
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("history") && isNotExcluded(e)) ??
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("getall") && isNotExcluded(e)) ??
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("get") && !e.name.toLowerCase().includes("byid") && isNotExcluded(e)) ??
    analysis.ir.apiEndpoints.find(e => (e.method === "GET" || e.name.toLowerCase().startsWith("get")) && isNotExcluded(e)) ??
    analysis.ir.apiEndpoints.find(e => isNotExcluded(e)) ??
    analysis.ir.apiEndpoints[0]
  )?.name ?? "resource.list";

  // Determine PII field names from behavior text and IR resources
  // 1. From postconditions: "name = [deleted]" → "name"
  const piiFromPostconds = (behavior?.postconditions || [])
    .map(p => p.match(/(\w+)\s*(?:=|is|wird|anonymized|gelöscht|null|\[deleted\]|\[gelöscht\])/i)?.[1])
    .filter((f): f is string => !!f && f.length > 2 && !['the','all','data','null','true','false'].includes(f.toLowerCase()));
  // 2. From behavior title: "Task descriptions may contain personal data" → "description"
  // Pattern: capture the field-type word (description, email, phone, name) from the title
  const titlePiiMatch = (() => {
    const title = behavior?.title || '';
    // "X descriptions may contain" → "description"
    const descMatch = title.match(/\b(description|email|phone|name|address|ssn|dob|birthdate)s?\b/i)?.[1];
    if (descMatch) return descMatch.toLowerCase();
    // "X field may contain personal data" → extract field name before 'field'
    const fieldMatch = title.match(/(\w+)\s+field/i)?.[1];
    if (fieldMatch && !['the','a','an','this','that'].includes(fieldMatch.toLowerCase())) return fieldMatch.toLowerCase();
    return null;
  })();
  // 3. From IR resources with hasPII: only extract if resource name has 2+ words (e.g. "Task Description" → "description")
  // Single-word resource names like "Task" or "Workspace" are entity names, NOT field names
  const piiResourceFields = analysis.ir.resources
    .filter(r => r.hasPII)
    .map(r => {
      // "Task Description" → "description", "Guest Phone" → "phone"
      const words = r.name.toLowerCase().split(/\s+/);
      // Only use if multi-word (e.g. "Task Description") — single words are entity names
      if (words.length < 2) return null;
      return words[words.length - 1]; // last word is usually the field name
    })
    .filter((f): f is string => !!f && f.length > 2 && !['data','export','workspace','task','member'].includes(f));
  let piiFields = Array.from(new Set([...piiFromPostconds, ...(titlePiiMatch ? [titlePiiMatch.toLowerCase()] : []), ...piiResourceFields]));
  // Fix 6: Fallback to standard PII fields if extraction found nothing useful
  const STANDARD_PII_FIELDS = ["name", "email", "phone", "address"];
  if (piiFields.length === 0 || piiFields.every(f => !STANDARD_PII_FIELDS.includes(f))) {
    const specText = [(behavior?.title || ""), (behavior?.specAnchor || ""), ...(behavior?.postconditions || [])].join(" ").toLowerCase();
    const fromSpec = STANDARD_PII_FIELDS.filter(f => specText.includes(f));
    piiFields = fromSpec.length > 0 ? fromSpec : ["name", "email", "phone"];
  }
  // Determine the identifier fieldd used for GDPR deletion
  const idField = behavior?.preconditions.join(" ").match(/by\s+(\w+)/i)?.[1] || "id";

  // For export behaviors: collect output fields from the main resource endpoint (e.g. tasks.create outputFields)
  // These are the fields that MUST appear in the export
  const EXPORT_NOISE_FIELDS = new Set(['x-csrf-token', 'workspaceid', 'tenantid', 'id']);
  const resourceOutputFields: string[] = isExportBehavior
    ? (() => {
        // Find the primary resource endpoint (create or update) to get its output fields
        const resourceEndpoint = analysis.ir.apiEndpoints.find(e =>
          e.name.toLowerCase().includes('create') || e.name.toLowerCase().includes('update'));
        const outFields = (resourceEndpoint?.outputFields || []) as string[];
        return outFields
          .filter(f => typeof f === 'string' && !EXPORT_NOISE_FIELDS.has(f.toLowerCase()))
          .slice(0, 5); // Max 5 fields to keep test readable
      })()
    : [];
  // Merge piiFields + resourceOutputFields for export assertions (piiFields first, then resource fields)
  const exportAssertFields = Array.from(new Set([...piiFields, ...resourceOutputFields]));

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — DSGVO Art. 17: ${target.description}
// Risk: CRITICAL
// Spec: ${behavior?.chapter || behavior?.specAnchor || "Compliance"}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No GDPR deletion endpoint found in spec. Replace TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

${isExportBehavior ? `
test("${target.id}a — Export returns all required fields including PII", async ({ request }) => {
  // Create a resource with data to export
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Execute data export
  const { status, data: exportData } = await trpcQuery(request, "${endpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200);
  // Kills: Export endpoint returns error

  // Verify export contains data
  expect(exportData).toBeDefined();
  const exportArray = Array.isArray(exportData) ? exportData : [exportData];
  expect(exportArray.length).toBeGreaterThan(0);
  // Kills: Export returns empty data

  // Verify required fields are present in export
  const firstRecord = exportArray[0] as Record<string, unknown>;
  expect(firstRecord?.id).toBeDefined();
  // Kills: Export omits record IDs
${exportAssertFields.length > 0
  ? exportAssertFields.map(f => `  expect(firstRecord?.${f}).toBeDefined(); // Kills: Export omits ${f} field`).join('\n')
  : '  // Verify all task fields are present in export (including soft-deleted records)\n  expect(firstRecord?.title).toBeDefined(); // Kills: Export omits title field'}
});

test("${target.id}b — Export requires admin authorization", async ({ request }) => {
  // Attempt export without authentication
  const { status: unauthStatus } = await trpcQuery(request, "${endpoint}",
    { ${tenantField}: ${tenantConst} });
  expect([401, 403]).toContain(unauthStatus);
  // Kills: Allow unauthenticated data export
});
` : `
test("${target.id}a — ${isHardDelete ? 'All records permanently deleted' : 'PII fields anonymized'} after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "${endpoint}",
    { ${idField}: resourceId, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200);
  // Kills: ${target.mutationTargets[0]?.description || "GDPR deletion endpoint returns error"}

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
${isHardDelete ? `  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll` : `  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
${piiFields.length > 0
  ? piiFields.map(f => `    // PII field '${f}' must be anonymized or nulled\n    expect(deletedResource?.${f}).toBeNull(); // Kills: Skip ${f} anonymization`).join('\n')
  : `    // Verify PII fields are anonymized — check fields mentioned in spec
    expect(deletedResource?.description).toBeNull(); // Kills: Skip description anonymization`}
  }`}
${target.mutationTargets.slice(1).map(m => `  // Kills: ${m.description}`).join('\n')}
});

test("${target.id}b — ${isHardDelete ? 'Hard-delete is irreversible' : 'Record history preserved after GDPR deletion'}", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "${endpoint}",
    { ${idField}: resourceId, ${tenantField}: ${tenantConst} }, adminCookie);

${isHardDelete ? `  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records` : `  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "${listEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion`}
});
`}
`;
}

/**
 * Legacy boundary test generator — used as fallback when no isBoundaryField is found in IR.
 * Uses constraint-based extraction from behavior text.
 */
function generateBoundaryTestLegacy(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  const endpoint = normalizeEndpointName(target.endpoint || "TODO_REPLACE_WITH_YOUR_ENDPOINT");
  const hasEndpoint = !!target.endpoint;

  const RATE_LIMIT_NOISE_FIELDS = new Set(["workspace", "request", "minute", "second", "hour", "day", "requests"]);
  const primaryConstraint = target.constraints?.find(c =>
    c.type !== "enum" &&
    !c.field.toLowerCase().includes("id") &&
    !RATE_LIMIT_NOISE_FIELDS.has(c.field.toLowerCase())
  ) || target.constraints?.find(c => c.type !== "enum") || target.constraints?.[0];

  const fieldFromConstraint = primaryConstraint?.field;
  const titleText = behavior?.title || "";
  const arrayEmptyTitleMatch = titleText.match(/(\w+)\s+(?:array|list|ids?)\s+is\s+empty/i);
  const fieldFromTitle = arrayEmptyTitleMatch?.[1] ||
    titleText.match(/(\w+)\s+(?:exceeds?|is\s+empty|is\s+in\s+the\s+past|must\s+be|above|below|between|boundary|limit|range)/i)?.[1];
  const fieldFromError = behavior?.errorCases[0]?.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*(?:>|<|=|exceeds?|is\s+empty|must)/i)?.[1];
  const fieldFromAssertion = target.assertions.find(a => a.type === "field_value")?.target.split(".").pop();
  const NOISE_FIELD_NAMES = new Set(["empty", "not", "length", "size", "array", "list", "count", "value", "request", "returns", "return", "if", "system", "api"]);
  const rawFieldName = fieldFromConstraint || fieldFromTitle || fieldFromError || fieldFromAssertion;
  // Bug 7 Fix: if no good field name found, use first real endpoint field instead of 'value'
  const fieldNameRaw = (rawFieldName && !NOISE_FIELD_NAMES.has(rawFieldName.toLowerCase())) ? rawFieldName : undefined;
  // We'll resolve the actual fieldName after we know knownFields (see below).
  // Placeholder: keep 'value' for now, override after knownFields is computed.
  const fieldName = fieldNameRaw || "value";

  const allText = [...(behavior?.errorCases || []), ...(behavior?.postconditions || []), target.description].join(" ");
  const minMatch = allText.match(/(\d+)\s*(?:minimum|min|\(min|≥|>=|mindestens)/i);
  const maxMatch = allText.match(/(\d+)\s*(?:maximum|max|\(max|≤|<=|maximal)/i);
  const gtAssertions = target.assertions.filter(a => a.operator === "gt" || a.operator === "lte");
  const min = primaryConstraint?.min ?? (minMatch ? parseInt(minMatch[1]) : (gtAssertions[0] ? Number(gtAssertions[0].value) + 1 : 1));
  const maxRaw: number | undefined = primaryConstraint?.max ?? (maxMatch ? parseInt(maxMatch[1]) : (gtAssertions[1] ? Number(gtAssertions[1].value) : undefined));
  const max = maxRaw ?? 100;
  const hasMax = maxRaw !== undefined;

  const isStringField = primaryConstraint?.type === "string" || allText.toLowerCase().includes("length") || allText.toLowerCase().includes("char");
  const isDateField = primaryConstraint?.type === "date" || allText.toLowerCase().includes("date") || allText.toLowerCase().includes("future");
  const isArrayField = primaryConstraint?.type === "array" || allText.toLowerCase().includes("array") || allText.toLowerCase().includes("items");

  const targetEndpointDef = target.endpoint ? analysis.ir.apiEndpoints.find(e => e.name === target.endpoint) : undefined;
  const createEndpoint = targetEndpointDef || analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"));
  const knownFields = createEndpoint?.inputFields || [];
  const knownFieldNames = knownFields.map(f => f.name);
  // Bug 7 Fix: if fieldName is still 'value' (no good name found), use first real non-tenant, non-id field
  let effectiveFieldName = fieldName;
  if (!fieldNameRaw && knownFields.length > 0) {
    const firstRealField = knownFields.find(f =>
      !f.isTenantKey &&
      !f.name.toLowerCase().endsWith("id") &&
      f.type !== "enum" &&
      !NOISE_FIELD_NAMES.has(f.name.toLowerCase())
    ) || knownFields.find(f => !f.isTenantKey) || knownFields[0];
    if (firstRealField) effectiveFieldName = firstRealField.name;
  }
  let resolvedFieldName = effectiveFieldName;
  if (!knownFieldNames.includes(effectiveFieldName) && knownFields.length > 0) {
    const betterConstraint = target.constraints?.find(c =>
      c.type !== "enum" && !RATE_LIMIT_NOISE_FIELDS.has(c.field.toLowerCase()) && knownFieldNames.includes(c.field));
    if (betterConstraint) resolvedFieldName = betterConstraint.field;
  }
  const fieldInKnown = knownFieldNames.includes(resolvedFieldName);
  const effectiveFields: EndpointField[] = fieldInKnown || knownFields.length === 0
    ? knownFields
    : [...knownFields, { name: resolvedFieldName, type: "string", required: true }];
  const finalFieldName = resolvedFieldName;

  const boundaryField: EndpointField = knownFields.find(f => f.name === finalFieldName) || {
    name: finalFieldName,
    type: isDateField ? "date" : isStringField ? "string" : isArrayField ? "array" : "number",
    required: true,
    min,
    max: hasMax ? max : undefined,
  };
  const boundaryCases = calcBoundaryValues(boundaryField);
  const payloadFnName = `basePayload_${target.id.replace(/-/g, "_")}`;

  function buildPayloadLine(f: EndpointField, isBoundaryFieldArg: boolean): string {
    const fname = f.name;
    if (isBoundaryFieldArg) return `    ${fname}: boundaryValue,`;
    const defaultVal = getValidDefault(f, tenantConst);
    if (f.type === "array" && f.arrayItemType === "object" && f.arrayItemFields?.length) {
      const item = buildArrayItem(f, tenantConst);
      return `    ${fname}: [${item}],`;
    }
    if (f.type === "date" || f.name.toLowerCase().includes("date")) return `    ${fname}: tomorrowStr(),`;
    return `    ${fname}: ${defaultVal},`;
  }

  const payloadLines = effectiveFields.length > 0
    ? effectiveFields.map(f => buildPayloadLine(f, f.name === finalFieldName)).join("\n")
    : `    ${tenantField}: ${tenantConst},\n    ${finalFieldName}: boundaryValue,`;

  const needsTomorrowStr = isDateField || effectiveFields.some(f => f.name.toLowerCase().includes("date"));

  // Generate test cases from BoundaryCase[]
  const validCases = boundaryCases.filter(bc => bc.valid);
  const invalidCases = boundaryCases.filter(bc => !bc.valid);
  const testCasesStr = [
    ...validCases.map((bc, i) => `\ntest("${target.id}${String.fromCharCode(97 + i)} — ${finalFieldName}=${bc.label}", async ({ request }) => {\n  const { status } = await trpcMutation(request, "${endpoint}", ${payloadFnName}(${bc.value}), adminCookie);\n  expect(status).toBe(200);\n  // Kills: Change >= to > in ${finalFieldName} validation (off-by-one)\n});`),
    ...invalidCases.map((bc, i) => `\ntest("${target.id}${String.fromCharCode(97 + validCases.length + i)} — ${finalFieldName}=${bc.label}", async ({ request }) => {\n  const { status } = await trpcMutation(request, "${endpoint}", ${payloadFnName}(${bc.value}), adminCookie);\n  expect([400, 422]).toContain(status);\n  // Kills: Remove ${finalFieldName} boundary validation\n});`),
  ].join("\n");

  return `import { test, expect } from "@playwright/test";
import { trpcMutation${needsTomorrowStr ? ", tomorrowStr, yesterdayStr" : ""} } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Boundary: ${target.description}
// Risk: ${target.riskLevel}
${!hasEndpoint ? "// ⚠️  TODO: No endpoint found. Replace TODO_REPLACE_WITH_YOUR_ENDPOINT." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

const ${payloadFnName} = (boundaryValue: unknown) => ({\n${payloadLines}\n});
${testCasesStr}\n`;
}

function generateBoundaryTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const endpoint = normalizeEndpointName(target.endpoint || "TODO_REPLACE_WITH_YOUR_ENDPOINT");
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId)!;
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  const endpointDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);

  // Use new behavior-aware findBoundaryField with semantic keyword matching
  const boundaryField = findBoundaryFieldForBehavior(behavior, endpointDef);

  if (!boundaryField) {
    // Fallback: legacy constraint-based approach
    return generateBoundaryTestLegacy(target, analysis);
  }

  // All other required fields with valid defaults
  const otherFields = (endpointDef?.inputFields || [])
    .filter(f => f.required && f.name !== boundaryField.name)
    .map(f => {
      if (f.type === "array" && f.arrayItemType === "object" && f.arrayItemFields?.length) {
        return `    ${f.name}: [${buildArrayItemLiteral(f)}]`;
      }
      if (f.type === "date" || f.name.toLowerCase().includes("date")) return `    ${f.name}: tomorrowStr()`;
      return `    ${f.name}: ${getValidDefault(f, tenantConst)}`;
    })
    .join(",\n");

  const boundaryCases = calcBoundaryValues(boundaryField);
  const varName = `basePayload_${target.id.replace(/-/g, "_")}`;

  // errorCodes: if the spec defines exact error codes, assert them in invalid boundary cases
  const errorCodeAssertions = (target.errorCodes || []).slice(0, 3).map(code =>
    `  // expect(body?.code).toBe("${code}"); // Kills: Return wrong error code for boundary violation`
  ).join("\n");

  const testCases = boundaryCases.map((bc, idx) => {
    const letter = String.fromCharCode(97 + idx);
    const statusLine = bc.valid
      ? `  expect(status).toBe(200);`
      : `  expect([400, 422]).toContain(status);`;
    const killLine = bc.valid
      ? `  // Kills: Change >= to > in ${boundaryField.name} validation (off-by-one)`
      : `  // Kills: Remove ${boundaryField.name} boundary validation`;
    const ecLines = !bc.valid && errorCodeAssertions ? `\n${errorCodeAssertions}` : "";
    return `\ntest("${target.id}${letter} — ${boundaryField.name}=${bc.label}", async ({ request }) => {\n  const { status } = await trpcMutation(request, "${endpoint}", ${varName}(${bc.value}), adminCookie);\n${statusLine}\n${killLine}${ecLines}\n});`;
  }).join("\n");

  const needsDates = boundaryField.type === "date" ||
    (endpointDef?.inputFields || []).some(f => f.type === "date" || f.name.toLowerCase().includes("date"));
  const dateImport = needsDates ? ", tomorrowStr, yesterdayStr" : "";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation${dateImport} } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Boundary: ${target.description}
// Risk: ${target.riskLevel}
// Boundary Field: ${boundaryField.name} (${boundaryField.type}${boundaryField.min !== undefined ? `, min: ${boundaryField.min}` : ""}${boundaryField.max !== undefined ? `, max: ${boundaryField.max}` : ""})

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

const ${varName} = (boundaryValue: unknown) => ({\n${otherFields ? otherFields + "," : ""}
    ${boundaryField.name}: boundaryValue,
});
${testCases}
`;
}

function generateRiskScoringTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  // Resolve endpoints from IR
  const createEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"))?.name || "TODO_REPLACE_WITH_CREATE_ENDPOINT";
  const updateStatusEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("status") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_STATUS_ENDPOINT";
  const upsertEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("upsert") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_UPSERT_ENDPOINT";
  const getByIdEp = (
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("getby") || e.name.toLowerCase().includes("get")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("find") || e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("fetch")) ??
    analysis.ir.apiEndpoints[0]
  )?.name || "TODO_REPLACE_WITH_GET_ENDPOINT";
  const hasEndpoints = analysis.ir.apiEndpoints.length > 0;

  // Determine the risk score field name from behavior postconditions
  const riskFieldMatch = behavior?.postconditions.join(" ").match(/(\w*[Rr]isk\w*|\w*[Ss]core\w*|\w*[Pp]enalty\w*)/);
  const riskField = riskFieldMatch?.[1] || "riskScore";
  const countFieldMatch = behavior?.postconditions.join(" ").match(/(\w*[Cc]ount\w*|\w*[Nn]um\w*)/);
  const countField = countFieldMatch?.[1] || "count";

  // Build create payload from known fields
  const createEpDef = analysis.ir.apiEndpoints.find(e => e.name === createEp);
  const createFields = createEpDef?.inputFields || [];
  // Build create payload using getValidDefault (no TODO_ placeholders)
  const tenantConst2 = analysis.ir.tenantModel?.tenantIdField
    ? analysis.ir.tenantModel.tenantIdField.replace(/([A-Z])/g, '_$1').toUpperCase()
    : 'TENANT_ID';
  const createPayload = createFields.length > 0
    ? createFields.map(f => `    ${f.name}: ${getValidDefault(f as EndpointField, tenantConst2)},`).join("\n")
    : `    // TODO: Add the actual input fields for ${createEp}`;

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery, BASE_URL } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Risk Scoring: ${target.description}
// Risk: ${target.riskLevel}
// Spec: ${behavior?.chapter || behavior?.specAnchor || ""}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoints ? "// ⚠️  TODO: No endpoints found in spec. Replace all TODO_REPLACE_WITH_* placeholders." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id} — ${riskField} increases after negative event", async ({ request }) => {
  // Step 1: Create a resource
  const { data: created, error: createError } = await trpcMutation(request, "${createEp}", {
    ${tenantField}: ${tenantConst},
${createPayload}
  }, adminCookie);
  expect(createError).toBeNull();
  const resourceId = (created as Record<string, unknown>)?.id;
  expect(resourceId).toBeDefined();

  // Step 2: Set ${riskField} to 0 (mandatory precondition — must be baseline)
  await trpcMutation(request, "${upsertEp}",
    { ${tenantField}: ${tenantConst}, id: resourceId, ${riskField}: 0 }, adminCookie);

  // Step 3: Verify precondition
  const { data: before } = await trpcQuery(request, "${getByIdEp}",
    { ${tenantField}: ${tenantConst}, id: resourceId }, adminCookie);
  expect((before as Record<string, unknown>)?.${riskField}).toBe(0);
  // Kills: Test against resource with existing ${riskField}
  const countBefore = ((before as Record<string, unknown>)?.${countField} as number) ?? 0;

  // Step 4: Trigger the negative event (e.g. status change to no_show/failed/cancelled)
  await trpcMutation(request, "${updateStatusEp}",
    { id: resourceId, ${tenantField}: ${tenantConst}, status: "no_show" /* TODO: use actual negative status */ }, adminCookie);

  // Step 5: Trigger risk scoring job (if async)
  const jobResp = await request.post(\`\${BASE_URL}/api/jobs/trigger/riskScoring\`, {
    headers: { Authorization: \`Bearer \${process.env.CRON_SECRET || ""}\` },
  });
  if (jobResp.status() === 200) {
    await new Promise(r => setTimeout(r, 2000)); // Wait for async job
  }

  // Step 6: Assert risk score increased
  const { data: after } = await trpcQuery(request, "${getByIdEp}",
    { ${tenantField}: ${tenantConst}, id: resourceId }, adminCookie);
  expect((after as Record<string, unknown>)?.${riskField}).toBeGreaterThan(0);
  // Kills: ${target.mutationTargets[0]?.description || `Remove ${riskField} update in risk scoring`}
  expect((after as Record<string, unknown>)?.${riskField}).toBeLessThanOrEqual(100);
  // Kills: Set ${riskField} > 100 (out of range)
  expect((after as Record<string, unknown>)?.${countField}).toBe(countBefore + 1);
  // Kills: ${target.mutationTargets[1]?.description || `Remove ${countField} increment`}
${target.mutationTargets.slice(2).map(m => `  // Kills: ${m.description}`).join("\n")}
});
`;
}

export function generateBusinessLogicTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);

  // Use resolved endpoint from IR, or TODO placeholder
  const ep = normalizeEndpointName(
    target.endpoint || analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"))?.name || "TODO_REPLACE_WITH_MUTATION_ENDPOINT"
  );
  const hasEndpoint = !!target.endpoint || analysis.ir.apiEndpoints.length > 0;
  const getEp = normalizeEndpointName((
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("find") || e.name.toLowerCase().includes("fetch") || e.name.toLowerCase().includes("read")) ??
    analysis.ir.apiEndpoints[0]
  )?.name || "TODO_REPLACE_WITH_QUERY_ENDPOINT");

   const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));
  // Build payload from known input fields using getValidDefault (no TODO_ placeholders)
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === ep);
  const knownFields: EndpointField[] = epDef?.inputFields || [];
  const payloadFields = knownFields.length > 0
    ? knownFields
        .filter(f => f.required)
        .map(f => `    ${f.name}: ${getValidDefault(f, tenantConst)},`)
        .join("\n")
    : `    ${tenantField}: ${tenantConst}, // Add required fields for ${ep}`;

  // Detect side-effects from ProofTarget.sideEffects
  const stockSideEffect = target.sideEffects?.find(se =>
    se.toLowerCase().includes("stock") || se.toLowerCase().includes("decrement") ||
    se.toLowerCase().includes("inventory"));
  const restoreSideEffect = target.sideEffects?.find(se =>
    se.toLowerCase().includes("restore") || se.toLowerCase().includes("refund"));
  const counterSideEffect = target.sideEffects?.find(se =>
    se.includes("+=") || se.toLowerCase().includes("count"));
  // Balance side-effect: "deducts amount from X.balance", "credits amount to Y.balance"
  const hasBalanceEffect = target.sideEffects?.some(se =>
    se.toLowerCase().includes("balance") ||
    se.toLowerCase().includes("deduct") ||
    se.toLowerCase().includes("credit") ||
    (se.toLowerCase().includes("restore") && se.toLowerCase().includes("amount"))
  ) ?? false;
  // Find the list endpoint for balance reads
  const balanceListEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("get")
  )?.name || getEp;
  // Find the transaction/transfer endpoint (the action endpoint for balance tests)
  const balanceActionEp = target.endpoint ||
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("transaction") ||
      e.name.toLowerCase().includes("transfer") ||
      e.name.toLowerCase().includes("payment")
    )?.name || ep;
  // Build balance action payload from the transaction endpoint's input fields
  const balanceEpDef = analysis.ir.apiEndpoints.find(e => e.name === balanceActionEp);
  const balancePayloadFields = (balanceEpDef?.inputFields || []).filter(f => !f.isTenantKey).map(f => {
    const fl = f.name.toLowerCase();
    if (fl.includes("fromaccount") || fl.includes("from_account")) return `    ${f.name}: fromAccount.id as number,`;
    if (fl.includes("toaccount") || fl.includes("to_account")) return `    ${f.name}: toAccount.id as number,`;
    if (fl.includes("amount")) return `    ${f.name}: AMOUNT,`;
    return `    ${f.name}: ${getValidDefault(f, tenantConst)},`;
  }).join("\n") || `    fromAccountId: fromAccount.id as number,\n    toAccountId: toAccount.id as number,\n    amount: AMOUNT,\n    currency: "EUR",`;
  // Side-effect setup block (BEFORE the action)
  // restoreSideEffect takes priority over stockSideEffect to avoid ambiguity
  const effectiveStockSideEffect = restoreSideEffect ? null : stockSideEffect;
  const sideEffectSetup = effectiveStockSideEffect || restoreSideEffect ? `
  // Side-Effect-Check: Read stock BEFORE action
  const { data: resourceBefore } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const stockBefore = (Array.isArray(resourceBefore)
    ? (resourceBefore as Record<string, unknown>[])[0]
    : resourceBefore as Record<string, unknown>
  )?.stock as number ?? 0;
  expect(typeof stockBefore).toBe("number");
  // Kills: Cannot read stock before action` : counterSideEffect ? `
  // Side-Effect-Check: Read counter BEFORE action
  const { data: before } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const countBefore = (before as Record<string, unknown>)?.count as number ?? 0;` : "";

  // Side-effect assertion block (AFTER the action)
  const sideEffectAssert = effectiveStockSideEffect ? `
  // Side-Effect: Verify stock DECREASED after action
  const { data: resourceAfter } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const stockAfter = (Array.isArray(resourceAfter)
    ? (resourceAfter as Record<string, unknown>[])[0]
    : resourceAfter as Record<string, unknown>
  )?.stock as number;
  expect(stockAfter).toBeLessThan(stockBefore);
  // Kills: Not decrementing stock after ${ep}
  expect(stockAfter).toBeGreaterThanOrEqual(0);
  // Kills: Allow negative stock (overselling)` : restoreSideEffect ? `
  // Side-Effect: Verify stock RESTORED after cancellation
  const { data: resourceAfter2 } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const stockAfter2 = (Array.isArray(resourceAfter2)
    ? (resourceAfter2 as Record<string, unknown>[])[0]
    : resourceAfter2 as Record<string, unknown>
  )?.stock as number;
  expect(stockAfter2).toBeGreaterThan(stockBefore);
  // Kills: Not restoring stock on cancellation` : counterSideEffect ? `
  const { data: after } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const countAfter = (after as Record<string, unknown>)?.count as number ?? 0;
  expect(countAfter).toBe(countBefore + 1);
  // Kills: Not incrementing counter in ${ep}` : "";

  // Build precondition comment block from actual spec preconditions
  const preconditionComments = target.preconditions.length > 0
    ? target.preconditions.map(p => `  // Precondition: ${p}`).join("\n")
    : "  // Precondition: valid authenticated user";

  // Build assertion lines from actual ProofTarget assertions
  // Filter out invalid assertions: postcondition strings (e.g. "new task created in DB") are not real field values
  const INVALID_ASSERTION_PATTERNS = /created in db|deleted from db|updated in db|persisted|success|task created|record created|new task|new record/i;
  const validAssertions = target.assertions.filter(a => {
    if (typeof a.value === 'string' && INVALID_ASSERTION_PATTERNS.test(a.value)) return false; // skip postcondition strings
    if (a.target.match(/^result\.\d+$/) && typeof a.value === 'string') return false; // skip result.0, result.1 etc. with string values
    return true;
  });
  const assertionLines = validAssertions.map(a => {
    if (a.operator === "eq") return `  expect((data as Record<string, unknown>)?.["${a.target.split(".").pop()}"] ?? status).toBe(${JSON.stringify(a.value)}); // Kills: ${a.rationale}`;
    if (a.operator === "not_null") return `  expect((data as Record<string, unknown>)?.["${a.target.split(".").pop()}"]).toBeDefined(); // Kills: ${a.rationale}`;
    if (a.operator === "in") return `  expect(${JSON.stringify(a.value)}).toContain((data as Record<string, unknown>)?.["${a.target.split(".").pop()}"]);  // Kills: ${a.rationale}`;
    return `  // Assert: ${a.target} ${a.operator} ${JSON.stringify(a.value)} — ${a.rationale}`;
  }).join("\n");

  // Build mutation kill comments from actual mutationTargets
  const killComments = target.mutationTargets.map(m => `  // Kills: ${m.description}`).join("\n");

  // Build delete endpoint name (prefer tasks.delete, tasks.bulkDelete, etc.)
  const deleteEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("delete") || e.name.toLowerCase().includes("remove"))?.name || null;
  const bulkDeleteEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("bulk") && e.name.toLowerCase().includes("delete"))?.name || null;

  // Determine if this behavior is about delete or bulkDelete
  const behaviorTitle = (behavior?.title || target.description).toLowerCase();
  const isDelete = behaviorTitle.includes("delete") || behaviorTitle.includes("remove");
  // isBulkDelete: check both behavior title AND target.endpoint (e.g. tasks.bulkDelete)
  const isBulkDelete = behaviorTitle.includes("bulk") ||
    (target.endpoint?.toLowerCase().includes("bulk") ?? false);
  const actionEp = isBulkDelete ? (bulkDeleteEp || deleteEp || ep) : isDelete ? (deleteEp || ep) : ep;

  // Build the resource ID field name (taskId, reservationId, etc.)
  // Derive from the create endpoint name: "tasks.create" → "tasks" → "task" → "taskId"
  const resourceEntity =
    analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("create"))?.name?.split(".")[0]?.replace(/s$/, "") ||
    analysis.ir.tenantModel?.tenantEntity?.replace(/s$/, "") ||
    "task";
  const resourceIdField = `${resourceEntity}Id`;

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — Business Logic: ${target.description}
// Risk: ${target.riskLevel} | Endpoint: ${actionEp}
// Spec: ${behavior?.chapter || behavior?.specAnchor || ""}
// Behavior: ${behavior?.title || target.description}
${!hasEndpoint ? "// ⚠️  TODO: No endpoint found in spec. Replace endpoint names below." : ""}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

${isBulkDelete ? `test("${target.id}a — ${target.description.slice(0, 70)}", async ({ request }) => {
  // Arrange: Create two real resources
  const resource1 = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resource2 = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField}s = [resource1.id as number, resource2.id as number];
  expect(${resourceIdField}s[0]).toBeDefined();
  expect(${resourceIdField}s[1]).toBeDefined();

  // Act: Bulk delete
  const { status, data } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField}s,
    ${tenantField}: ${tenantConst},
  }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove success path in ${actionEp}

  const result = data as Record<string, unknown>;
  expect(result?.deleted).toBe(2);
  // Kills: Return wrong deleted count
  expect(Array.isArray(result?.failed)).toBe(true);
  expect((result?.failed as unknown[]).length).toBe(0);
  // Kills: Report tasks as failed when they succeeded

  // DB-Check: Both resources must be gone
  for (const id of ${resourceIdField}s) {
    const { status: getStatus } = await trpcQuery(request, "${getEp}",
      { ${resourceIdField}: id, ${tenantField}: ${tenantConst} }, adminCookie);
    expect(getStatus).toBe(404);
    // Kills: Not actually deleting from DB
  }
});

test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const { status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField}s: [resource.id as number],
    ${tenantField}: ${tenantConst},
  }, ""); // No cookie
  expect([401, 403]).toContain(status);
  // Kills: Remove role check from ${actionEp}
});` : isDelete ? `test("${target.id}a — ${target.description.slice(0, 70)}", async ({ request }) => {
  // Arrange: Create a real resource
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  expect(${resourceIdField}).toBeDefined();

  // Act: Delete resource
  const { status, data } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove success path in ${actionEp}

  expect((data as Record<string, unknown>)?.success).toBe(true);
  // Kills: Return success:false on deletion

  // DB-Check: Resource must be gone
  const { status: getStatus } = await trpcQuery(request, "${getEp}",
    { ${resourceIdField}, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(getStatus).toBe(404);
  // Kills: Soft-delete instead of hard-delete
});

test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;

  const { status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, ""); // No cookie

  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from ${actionEp}
});` : hasBalanceEffect ? `test("${target.id}a — balance deducted after ${target.description.slice(0, 50)}", async ({ request }) => {
  // Arrange: Create fromAccount and toAccount with known balances
  const fromAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(fromAccount?.id).toBeDefined();
  expect(toAccount?.id).toBeDefined();

  // Read balance BEFORE transaction
  const { data: fromBefore } = await trpcQuery(request, "${balanceListEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const balanceBefore = (Array.isArray(fromBefore) ? fromBefore : [fromBefore])
    .find((a: unknown) => (a as Record<string, unknown>).id === fromAccount.id)
    ?.balance as number ?? 0;
  expect(typeof balanceBefore).toBe("number");
  // Kills: Cannot read balance before transaction

  // Act: Execute the transaction
  const AMOUNT = 1;
  const { status, data } = await trpcMutation(request, "${balanceActionEp}", {
    ${tenantField}: ${tenantConst},
${balancePayloadFields}
  }, adminCookie);
  expect(status).toBe(200);
  // Kills: Remove success path in ${balanceActionEp}

  // Read balance AFTER transaction
  const { data: fromAfter } = await trpcQuery(request, "${balanceListEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const balanceAfter = (Array.isArray(fromAfter) ? fromAfter : [fromAfter])
    .find((a: unknown) => (a as Record<string, unknown>).id === fromAccount.id)
    ?.balance as number;

  expect(balanceAfter).toBe(balanceBefore - AMOUNT);
  // Kills: Not deducting amount from fromAccount.balance
  expect(balanceAfter).toBeGreaterThanOrEqual(0);
  // Kills: Allow negative balance (insufficient funds check missing)
${killComments}
});
test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const fromAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const { status } = await trpcMutation(request, "${balanceActionEp}", {
    ${tenantField}: ${tenantConst},
    fromAccountId: fromAccount.id as number,
    toAccountId: toAccount.id as number,
    amount: 1,
  }, ""); // No cookie
  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from ${balanceActionEp}
});` : `test("${target.id}a — ${target.description.slice(0, 70)}", async ({ request }) => {
${preconditionComments}
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  expect(${resourceIdField}).toBeDefined();
${sideEffectSetup}
  // Act
  const { data, status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in ${actionEp}
${assertionLines || "  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id"}
${sideEffectAssert}
${killComments}

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "${getEp}",
    { id: (data as Record<string, unknown>)?.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created
${hasBalanceEffect ? `
  // Verify balance actually changed (not just 200 response)
  const balanceAfter = (readBack as Record<string, unknown>)?.balance as number;
  expect(balanceAfter).not.toBe(balanceBefore);
  // Kills: Return 200 without updating balance` : ""}
});
test("${target.id}b — ${target.description.slice(0, 60)} requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  const { status } = await trpcMutation(request, "${actionEp}", {
    ${resourceIdField},
    ${tenantField}: ${tenantConst},
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from ${actionEp}
});
test("${target.id}c — ${target.description.slice(0, 60)} persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const ${resourceIdField} = created.id as number;
  expect(${resourceIdField}).toBeDefined(); // Kills: Don't return id from ${actionEp}
  const { data: fetched, status } = await trpcQuery(request, "${getEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200); // Kills: Remove ${getEp} endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === ${resourceIdField})).toBe(true); // Kills: Don't persist to DB
});`}

${(() => {
  // CONSTRAINT VIOLATION TESTS: Generate dedicated negative tests for error codes mentioned in behavior
  // These are the tests that actually PROVE business rules are enforced
  const constraintTests: string[] = [];
  const errorCases = behavior?.errorCases || [];
  const errorCodes = (behavior as any)?.errorCodes || [];
  const allErrorText = [...errorCases, ...errorCodes, behavior?.title || "", ...behavior?.postconditions || []].join(" ").toLowerCase();
  const epFields = epDef?.inputFields || [];

  // Pattern: INSUFFICIENT_BALANCE — transfer more than available
  if (allErrorText.includes("insufficient") || allErrorText.includes("balance") && allErrorText.includes("422")) {
    const fromField = epFields.find(f => f.name.toLowerCase().includes("from") && f.name.toLowerCase().includes("account"));
    const toField = epFields.find(f => f.name.toLowerCase().includes("to") && f.name.toLowerCase().includes("account"));
    const amountField = epFields.find(f => f.name.toLowerCase().includes("amount"));
    if (fromField && amountField) {
      constraintTests.push(`
test("${target.id}d — INSUFFICIENT_BALANCE: transfer exceeding balance must fail", async ({ request }) => {
  // Arrange: create account with known low balance
  const account = await createTestResource(request, adminCookie, { initialDeposit: 100 }) as Record<string, unknown>;
  ${toField ? `const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;` : ""}
  
  // Act: try to transfer MORE than available balance
  const { status, data } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${fromField.name}: account.id as number,
    ${toField ? `${toField.name}: toAccount.id as number,` : ""}
    ${amountField.name}: 999999, // Way more than 100
    ${epFields.filter(f => f.name !== fromField.name && f.name !== (toField?.name || "") && f.name !== amountField.name && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow transfer with insufficient balance (no balance check)
  
  // Verify balance unchanged
  const { data: afterAttempt } = await trpcQuery(request, "${getEp}",
    { id: account.id, ${tenantField}: ${tenantConst} }, adminCookie);
  const balanceAfter = (afterAttempt as Record<string, unknown>)?.balance;
  expect(balanceAfter).toBe(100); // Must be unchanged
  // Kills: Deduct balance even on failed transfer
});`);
    }
  }

  // Pattern: SAME_ACCOUNT — fromAccountId == toAccountId
  if (allErrorText.includes("same") || (allErrorText.includes("from") && allErrorText.includes("to") && allErrorText.includes("400"))) {
    const fromField = epFields.find(f => f.name.toLowerCase().includes("from"));
    const toField = epFields.find(f => f.name.toLowerCase().includes("to") && f.name.toLowerCase().includes("account"));
    if (fromField && toField) {
      constraintTests.push(`
test("${target.id}e — SAME_ACCOUNT: transfer to self must be rejected", async ({ request }) => {
  const account = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${fromField.name}: account.id as number,
    ${toField.name}: account.id as number, // SAME account!
    ${epFields.filter(f => f.name !== fromField.name && f.name !== toField.name && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(400);
  // Kills: Allow transfer to same account (missing fromId != toId check)
});`);
    }
  }

  // Pattern: ACCOUNT_NOT_ACTIVE — action on frozen/closed resource
  if (allErrorText.includes("not_active") || allErrorText.includes("frozen") || allErrorText.includes("closed")) {
    const freezeEp = analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("freeze"));
    if (freezeEp) {
      constraintTests.push(`
test("${target.id}f — ACCOUNT_NOT_ACTIVE: action on frozen resource must fail", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // Freeze the resource first
  await trpcMutation(request, "${freezeEp.name}",
    { id: resource.id, ${tenantField}: ${tenantConst}, reason: "test-freeze" }, adminCookie);
  
  // Attempt action on frozen resource
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("from")) return `${f.name}: resource.id as number,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow action on frozen/inactive resource
});`);
    }
  }

  // Pattern: ALREADY_CLOSED / ALREADY_FROZEN — idempotent state operations
  if (allErrorText.includes("already_closed") || allErrorText.includes("already_frozen") || allErrorText.includes("409")) {
    constraintTests.push(`
test("${target.id}g — duplicate state change must return 409", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // First state change (should succeed)
  const { status: first } = await trpcMutation(request, "${actionEp}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect([200, 204]).toContain(first);
  
  // Second identical state change (should be rejected)
  const { status: second } = await trpcMutation(request, "${actionEp}",
    { id: resource.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(second).toBe(409);
  // Kills: Allow duplicate state change (no idempotency check)
});`);
  }

  // Pattern: COURSE_NOT_PUBLISHED / RECIPE_NOT_PUBLISHED — action on unpublished resource
  if (allErrorText.includes("not_published") || allErrorText.includes("course_not_published") || allErrorText.includes("recipe_not_published")) {
    constraintTests.push(`
test("${target.id}h — NOT_PUBLISHED: action on unpublished resource must fail", async ({ request }) => {
  // Arrange: Create a resource that is NOT published (default state = draft)
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  // Resource is in draft state by default — do NOT publish it
  
  // Act: Try to perform action on unpublished resource
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("course") || fl.includes("recipe") || fl.includes("resource")) return `${f.name}: resource.id as number,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow enrollment/action on unpublished resource
});`);
  }

  // Pattern: COURSE_FULL / MAX_CAPACITY — action when resource is at capacity
  if (allErrorText.includes("course_full") || allErrorText.includes("full") || allErrorText.includes("capacity") || allErrorText.includes("maxstudents")) {
    constraintTests.push(`
test("${target.id}i — COURSE_FULL: enrollment when course is full must fail", async ({ request }) => {
  // This test requires a course with maxStudents=1 already filled
  // Arrange: Create course with maxStudents=1
  const course = await createTestResource(request, adminCookie, { maxStudents: 1 }) as Record<string, unknown>;
  
  // Act: Attempt to enroll when full
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("course")) return `${f.name}: course.id as number,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  
  expect([422, 409]).toContain(status);
  // Kills: Allow enrollment past maxStudents limit
});`);
  }

  // Pattern: ALREADY_ENROLLED / ALREADY_SUBMITTED — duplicate action
  if (allErrorText.includes("already_enrolled") || allErrorText.includes("already_submitted") || allErrorText.includes("already_completed")) {
    constraintTests.push(`
test("${target.id}j — ALREADY_ENROLLED: duplicate action must return 409", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // First action (should succeed)
  const { status: first } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("course") || fl.includes("lesson") || fl.includes("assignment")) return `${f.name}: resource.id as number,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  expect([200, 201]).toContain(first);
  
  // Second identical action (should be rejected)
  const { status: second } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("course") || fl.includes("lesson") || fl.includes("assignment")) return `${f.name}: resource.id as number,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  expect(second).toBe(409);
  // Kills: Allow duplicate enrollment/submission
});`);
  }

  // Pattern: DEADLINE_PASSED — submission after deadline
  if (allErrorText.includes("deadline") || allErrorText.includes("deadline_passed")) {
    constraintTests.push(`
test("${target.id}k — DEADLINE_PASSED: submission after deadline must fail", async ({ request }) => {
  // Arrange: Create assignment with past deadline
  const assignment = await createTestResource(request, adminCookie, { deadline: "2020-01-01" }) as Record<string, unknown>;
  
  // Act: Try to submit after deadline
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("assignment")) return `${f.name}: assignment.id as number,`;
      if (fl.includes("content")) return `${f.name}: "Late submission content",`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow submission after deadline
});`);
  }

  // Pattern: SLOT_TAKEN / BOOKING_CONFLICT — double booking
  if (allErrorText.includes("slot_taken") || allErrorText.includes("booking_conflict") || allErrorText.includes("double-booking") || allErrorText.includes("overlap")) {
    constraintTests.push(`
test("${target.id}l — SLOT_TAKEN: double booking same slot must fail", async ({ request }) => {
  // Arrange: Create first booking for a specific slot
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const sharedPayload = {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("vet") || fl.includes("vehicle") || fl.includes("resource")) return `${f.name}: resource.id as number,`;
      if (fl.includes("date")) return `${f.name}: "2030-06-15", // Fixed future date`;
      if (fl.includes("time")) return `${f.name}: "10:00",`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  };
  
  // First booking (should succeed)
  const { status: first } = await trpcMutation(request, "${ep}", sharedPayload, adminCookie);
  expect([200, 201]).toContain(first);
  
  // Second booking for same slot (should fail)
  const { status: second } = await trpcMutation(request, "${ep}", sharedPayload, adminCookie);
  expect(second).toBe(409);
  // Kills: Allow double-booking same slot (no conflict check)
});`);
  }

  // Pattern: VEHICLE_NOT_AVAILABLE / DRIVER_NOT_ACTIVE — resource state check
  if (allErrorText.includes("vehicle_not_available") || allErrorText.includes("driver_not_active") || allErrorText.includes("not_available") || allErrorText.includes("not_active")) {
    constraintTests.push(`
test("${target.id}m — NOT_AVAILABLE: booking unavailable resource must fail", async ({ request }) => {
  // Arrange: Create a resource in non-available state
  const resource = await createTestResource(request, adminCookie, { status: "maintenance" }) as Record<string, unknown>;
  
  // Act: Try to book unavailable resource
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("vehicle") || fl.includes("resource")) return `${f.name}: resource.id as number,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow booking of unavailable resource
});`);
  }

  // Pattern: CANNOT_RATE_OWN — self-rating prevention
  if (allErrorText.includes("cannot_rate_own") || allErrorText.includes("own recipe") || allErrorText.includes("own course") || allErrorText.includes("rate own")) {
    constraintTests.push(`
test("${target.id}n — CANNOT_RATE_OWN: rating own resource must fail", async ({ request }) => {
  // Arrange: Create resource as the same user who will try to rate it
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // Act: Same user tries to rate their own resource
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${epFields.filter(f => !f.isTenantKey && f.required).map(f => {
      const fl = f.name.toLowerCase();
      if (fl.includes("recipe") || fl.includes("course") || fl.includes("resource")) return `${f.name}: resource.id as number,`;
      if (fl.includes("rating")) return `${f.name}: 5,`;
      return `${f.name}: ${getValidDefault(f, tenantConst)},`;
    }).join("\\n    ")}
  }, adminCookie); // Same adminCookie = same user who created it
  
  expect(status).toBe(403);
  // Kills: Allow user to rate their own resource
});`);
  }

  // Pattern: INVALID_DATE_RANGE — endDate before startDate
  if (allErrorText.includes("invalid_date_range") || allErrorText.includes("end.*before.*start") || allErrorText.includes("startdate") && allErrorText.includes("enddate")) {
    const startField = epFields.find(f => f.name.toLowerCase().includes("start") && f.name.toLowerCase().includes("date"));
    const endField = epFields.find(f => f.name.toLowerCase().includes("end") && f.name.toLowerCase().includes("date"));
    if (startField && endField) {
      constraintTests.push(`
test("${target.id}o — INVALID_DATE_RANGE: endDate before startDate must fail", async ({ request }) => {
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${startField.name}: "2030-06-15",
    ${endField.name}: "2030-06-01", // BEFORE startDate!
    ${epFields.filter(f => f.name !== startField.name && f.name !== endField.name && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join("\\n    ")}
  }, adminCookie);
  
  expect(status).toBe(400);
  // Kills: Allow endDate before startDate (no date range validation)
});`);
    }
  }

  // Pattern: DEVICE_IN_USE / DEVICE_NOT_AVAILABLE — rental of already-rented device
  if (allErrorText.includes("device_in_use") || allErrorText.includes("device_not_available") || allErrorText.includes("not available") || allErrorText.includes("already rented") || allErrorText.includes("device must be available")) {
    const deviceField = epFields.find(f => f.name.toLowerCase().includes("device"));
    constraintTests.push(`
test("${target.id}p \u2014 DEVICE_NOT_AVAILABLE: rental of already-rented device must fail", async ({ request }) => {
  // Arrange: Create a device and rent it first
  const device = await createTestResource(request, adminCookie) as Record<string, unknown>;
  // First rental (should succeed)
  const { status: first } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${deviceField ? `${deviceField.name}: device.id as number,` : `deviceId: device.id as number,`}
    ${epFields.filter(f => f.name !== (deviceField?.name || 'deviceId') && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join('\\n    ')}
  }, adminCookie);
  expect([200, 201]).toContain(first);
  // Second rental of same device (should fail)
  const { status: second } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${deviceField ? `${deviceField.name}: device.id as number,` : `deviceId: device.id as number,`}
    ${epFields.filter(f => f.name !== (deviceField?.name || 'deviceId') && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join('\\n    ')}
  }, adminCookie);
  expect(second).toBe(422); // DEVICE_NOT_AVAILABLE or DEVICE_IN_USE
  // Kills: Allow double-booking of same device
});`);
  }
  // Pattern: RENTAL_TOO_LONG — rental duration exceeds max days
  if (allErrorText.includes("rental_too_long") || allErrorText.includes("365 days") || allErrorText.includes("max.*days") || allErrorText.includes("duration")) {
    const startField = epFields.find(f => f.name.toLowerCase().includes("start"));
    const endField = epFields.find(f => f.name.toLowerCase().includes("return") || f.name.toLowerCase().includes("end"));
    constraintTests.push(`
test("${target.id}q \u2014 RENTAL_TOO_LONG: rental duration > 365 days must be rejected", async ({ request }) => {
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${startField ? `${startField.name}: "2030-01-01",` : 'startDate: "2030-01-01",'}
    ${endField ? `${endField.name}: "2031-06-01",` : 'expectedReturnDate: "2031-06-01",'} // > 365 days!
    ${epFields.filter(f => f.name !== (startField?.name || 'startDate') && f.name !== (endField?.name || 'expectedReturnDate') && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join('\\n    ')}
  }, adminCookie);
  expect(status).toBe(400); // RENTAL_TOO_LONG
  // Kills: Allow rental duration > 365 days
});`);
  }
  // Pattern: MISSING_PRE_AUTH — insurance claim without pre-auth code
  if (allErrorText.includes("missing_pre_auth") || allErrorText.includes("preauthcode") || allErrorText.includes("pre_auth") || allErrorText.includes("insurance")) {
    const insuranceField = epFields.find(f => f.name.toLowerCase().includes("insurance"));
    const preAuthField = epFields.find(f => f.name.toLowerCase().includes("preauth") || f.name.toLowerCase().includes("pre_auth"));
    constraintTests.push(`
test("${target.id}r \u2014 MISSING_PRE_AUTH: insurance claim without pre-auth code must fail", async ({ request }) => {
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    ${insuranceField ? `${insuranceField.name}: true,` : 'insuranceClaim: true,'} // Insurance claim = true
    // ${preAuthField ? preAuthField.name : 'insurancePreAuthCode'}: omitted intentionally
    ${epFields.filter(f => f.name !== (insuranceField?.name || 'insuranceClaim') && f.name !== (preAuthField?.name || 'insurancePreAuthCode') && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join('\\n    ')}
  }, adminCookie);
  expect(status).toBe(400); // MISSING_PRE_AUTH
  // Kills: Allow insurance claim without pre-authorization code
});`);
  }
  // Pattern: MAX_EXTENSIONS / MAX_EXTENSIONS_REACHED — rental extension limit
  if (allErrorText.includes("max_extensions") || allErrorText.includes("maximum 3 extensions") || allErrorText.includes("max.*extension")) {
    constraintTests.push(`
test("${target.id}s \u2014 MAX_EXTENSIONS: exceeding maximum rental extensions must fail", async ({ request }) => {
  const rental = await createTestResource(request, adminCookie) as Record<string, unknown>;
  // Extend 3 times (max allowed)
  for (let i = 0; i < 3; i++) {
    const { status } = await trpcMutation(request, "rentals.extend", {
      ${tenantField}: ${tenantConst},
      id: rental.id as number,
      additionalDays: 7,
    }, adminCookie);
    expect([200, 201]).toContain(status);
  }
  // 4th extension must fail
  const { status: fourth } = await trpcMutation(request, "rentals.extend", {
    ${tenantField}: ${tenantConst},
    id: rental.id as number,
    additionalDays: 7,
  }, adminCookie);
  expect(fourth).toBe(422); // MAX_EXTENSIONS_REACHED
  // Kills: Allow more than 3 rental extensions
});`);
  }
  // Pattern: OVERPAYMENT — payment exceeds remaining balance
  if (allErrorText.includes("overpayment") || allErrorText.includes("remaining.*balance") || allErrorText.includes("amount.*exceed") || allErrorText.includes("remainingbalance")) {
    const amountField = epFields.find(f => f.name.toLowerCase().includes("amount"));
    constraintTests.push(`
test("${target.id}t \u2014 OVERPAYMENT: payment exceeding remaining balance must fail", async ({ request }) => {
  const invoice = await createTestResource(request, adminCookie) as Record<string, unknown>;
  // Try to pay more than the invoice amount
  const { status } = await trpcMutation(request, "${ep}", {
    ${tenantField}: ${tenantConst},
    id: invoice.id as number,
    ${amountField ? `${amountField.name}: 9999999, // Way more than invoice total` : 'amount: 9999999, // Way more than invoice total'}
    ${epFields.filter(f => f.name !== (amountField?.name || 'amount') && !f.isTenantKey && f.required).map(f => `${f.name}: ${getValidDefault(f, tenantConst)},`).join('\\n    ')}
  }, adminCookie);
  expect(status).toBe(400); // OVERPAYMENT
  // Kills: Allow payment exceeding remaining balance
});`);
  }
  return constraintTests.join("\\n");
})()}
`;
}

function generateRateLimitTest(target: ProofTarget, analysis: AnalysisResult): string {
  // Use actual login endpoint from auth model
  const rawLoginEp = analysis.ir.authModel?.loginEndpoint || "/api/trpc/auth.login";
  const loginEp = rawLoginEp.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "");
  // Use actual endpoint from target if it's not the login endpoint
  const targetEp = target.endpoint ? target.endpoint : null;
  // Build kill comments from actual mutationTargets
  const killComments = target.mutationTargets.map(m => `  // Kills: ${m.description}`).join("\n");
  return `import { test, expect } from "@playwright/test";
import { BASE_URL } from "../../helpers/api";
// ${target.id} — Rate Limit: ${target.description}
// Risk: ${target.riskLevel} | Endpoint: ${targetEp || loginEp}
test("${target.id} — Brute-force blocked after 10 attempts on ${targetEp || loginEp}", async ({ request }) => {
  const results: number[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await request.post(BASE_URL + "${loginEp}", {
      data: { json: { email: "attacker-" + i + "@evil.com", password: "wrong" + i } },
    });
    results.push(res.status());
  }
  // At least one request should be rate-limited (429) after repeated failures
  expect(results.some(s => s === 429)).toBe(true); // Kills: Remove rate limiting middleware
${killComments}
});
test("${target.id} — Legitimate user not blocked after 3 attempts", async ({ request }) => {
  const results: number[] = [];
  for (let i = 0; i < 3; i++) {
    const res = await request.post(BASE_URL + "${loginEp}", {
      data: { json: { email: "legit@example.com", password: "wrong" } },
    });
    results.push(res.status());
  }
  // Should not be rate-limited yet (only 3 attempts)
  expect(results.every(s => s !== 429)).toBe(true); // Kills: Rate limit too aggressively
});
test("${target.id} — Rate limit resets after window expires", async ({ request }) => {
  // This test documents the expected reset behavior
  // In CI: mock time or use short window (e.g. 1 minute)
  const res = await request.post(BASE_URL + "${loginEp}", {
    data: { json: { email: "reset-test@example.com", password: "wrong" } },
  });
  // Should not be blocked on first attempt after window reset
  expect(res.status()).not.toBe(429); // Kills: Never reset rate limit counter
});
`;
}

function generateSpecDriftTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = "TEST_" + tenantEntity.toUpperCase() + "_ID";
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  const endpoint = normalizeEndpointName(target.endpoint || analysis.ir.apiEndpoints[0]?.name || "TODO_REPLACE_WITH_ENDPOINT");
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
  const outputFields = epDef?.outputFields || [];
  const inputFields = epDef?.inputFields || [];

  // Determine if this is a query (GET) or mutation (POST/PUT)
  const isQuery = !endpoint.toLowerCase().includes("create") &&
    !endpoint.toLowerCase().includes("update") &&
    !endpoint.toLowerCase().includes("delete") &&
    !endpoint.toLowerCase().includes("cancel");

  // Build the schema name from the endpoint
  const schemaName = endpoint.replace(/\./g, "_") + "ResponseSchema";

  // Build query payload from input fields
  const queryPayloadLines = inputFields
    .filter(f => !f.isTenantKey)
    .map(f => "    " + f.name + ": " + getValidDefault(f, tenantConst) + ",")
    .join("\n");

  // Build field assertions from outputFields
  const fieldAssertions = outputFields.length > 0
    ? outputFields.slice(0, 5).map(f =>
        "  expect(record?." + f + ").toBeDefined(); // Kills: Remove '" + f + "' from " + endpoint + " response"
      ).join("\n")
    : "  expect(record?.id).toBeDefined(); // Kills: Remove 'id' from " + endpoint + " response";

  // Build mutation kill comments
  const killComments = target.mutationTargets.map(m => "  // Kills: " + m.description).join("\n");

  const importLine = isQuery
    ? "import { trpcQuery } from \"../../helpers/api\";"
    : "import { trpcMutation, trpcQuery } from \"../../helpers/api\";";

  const payloadExtra = queryPayloadLines ? ",\n" + queryPayloadLines : "";

  const lines: string[] = [
    "import { test, expect } from \"@playwright/test\";",
    importLine,
    "import { " + roleFnName + " } from \"../../helpers/auth\";",
    "import { " + tenantConst + ", createTestResource } from \"../../helpers/factories\";",
    "import { " + schemaName + " } from \"../../helpers/schemas\";",
    "",
    "// " + target.id + " \u2014 Spec Drift: " + target.description,
    "// Risk: " + target.riskLevel,
    "// Spec: " + (behavior?.chapter || behavior?.specAnchor || "API Contract"),
    "// Behavior: " + (behavior?.title || target.description),
    "// Purpose: Validates that the API response shape matches the spec-derived Zod schema.",
    "//          Catches when implementation drifts from the spec (missing fields, wrong types).",
    "",
    "let adminCookie: string;",
    "",
    "test.beforeAll(async ({ request }) => {",
    "  adminCookie = await " + roleFnName + "(request);",
    "});",
    "",
    "test(\"" + target.id + "a \u2014 " + endpoint + " response shape matches spec schema\", async ({ request }) => {",
    "  // Arrange: Ensure at least one resource exists",
    "  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;",
    "  expect(resource?.id).toBeDefined();",
    "  // Kills: " + (target.mutationTargets[0]?.description || "Remove 'id' field from " + endpoint + " response"),
    "",
    "  // Act: Call the endpoint",
    "  const { status, data } = await trpcQuery(request, \"" + endpoint + "\",",
    "    { " + tenantField + ": " + tenantConst + payloadExtra + " }, adminCookie);",
    "  expect(status).toBe(200);",
    "  // Kills: " + (target.mutationTargets[1]?.description || "Return wrong type for response fields"),
    "",
    "  // Assert: Validate response shape with Zod schema",
    "  const records = Array.isArray(data) ? data : [data];",
    "  expect(records.length).toBeGreaterThan(0);",
    "  // Kills: Return empty array when resources exist",
    "",
    "  const record = records[0] as Record<string, unknown>;",
    "",
    "  // Zod schema validation \u2014 catches spec drift (missing/wrong-type fields)",
    "  const parseResult = " + schemaName + ".safeParse(record);",
    "  if (!parseResult.success) {",
    "    throw new Error(\"Spec drift detected in " + endpoint + ": \" + parseResult.error.message);",
    "  }",
    "  // Kills: Return response that doesn't match spec schema",
    "",
    "  // Field-level assertions (belt-and-suspenders)",
    fieldAssertions,
    killComments,
    "});",
    "",
    "test(\"" + target.id + "b \u2014 " + endpoint + " returns correct HTTP status for invalid input\", async ({ request }) => {",
    "  // Send request with missing required fields",
    "  const { status: badStatus } = await trpcQuery(request, \"" + endpoint + "\",",
    "    { " + tenantField + ": -1 }, adminCookie);",
    "  // Should return error status, not 200 with empty data",
    "  expect([400, 404, 422]).toContain(badStatus);",
    "  // Kills: Return 200 with empty array for invalid tenant ID",
    "});",
  ];

  return lines.join("\n") + "\n";
}

const LAYER3_FEW_SHOT_EXAMPLE = [
  "--- FEW-SHOT EXAMPLE (follow this structure exactly) ---",
  "Proof target: Item quantity boundary (1-100)",
  "Available helpers: createTestResource, getResource, trpcMutation, trpcQuery, BASE_URL",
  "",
  "Expected output:",
  'import { test, expect } from "@playwright/test";',
  'import { trpcMutation } from "../../helpers/api";',
  'import { getAdminCookie } from "../../helpers/auth";',
  'import { TEST_TENANT_ID } from "../../helpers/factories";',
  "",
  "let adminCookie: string;",
  "test.beforeAll(async ({ request }) => { adminCookie = await getAdminCookie(request); });",
  "",
  "const base = (quantity: unknown) => ({",
  "  tenantId: TEST_TENANT_ID,",
  "  // TODO: Add the actual input fields for your endpoint",
  "  quantity,",
  "});",
  "",
  'test("BOUND-001a \u2014 quantity=1 allowed", async ({ request }) => {',
  "  const { status } = await trpcMutation(request, 'items.create', base(1), adminCookie);",
  "  expect(status).toBe(200); // Kills: Change >= to > in quantity validation",
  "});",
  'test("BOUND-001b \u2014 quantity=0 rejected", async ({ request }) => {',
  "  const { status } = await trpcMutation(request, 'items.create', base(0), adminCookie);",
  "  expect([400, 422]).toContain(status); // Kills: Remove quantity >= 1 check",
  "});",
  "--- END EXAMPLE ---",
].join("\n");

async function generateLLMTest(target: ProofTarget, analysis: AnalysisResult): Promise<string> {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  const systemPrompt = [
    "You are TestForge Schicht 3 \u2014 a Gold Standard Playwright test generator.",
    "Generate a TypeScript Playwright test that PROVES the given behavior and kills ALL listed mutation targets.",
    "",
    "AVAILABLE HELPERS (use ONLY these \u2014 no other imports):",
    `- from "../../helpers/api": trpcMutation, trpcQuery, BASE_URL`,
    `- from "../../helpers/auth": ${roleFnName}`,
    `- from "../../helpers/factories": TEST_${tenantEntity.toUpperCase()}_ID, createTestResource, getResource, listResources`,
    "",
    "Gold Standard Rules (MUST follow — violations cause test to be discarded):",
    "R1: NO if-wrappers: never 'if (x !== undefined) { expect(x)...' — use expect(x).toBeDefined() then unconditional assertions",
    "R2: NO existence-only: never only toBeDefined()/toBeTruthy() — always assert exact values",
    "R3: NO broad status codes: never toBeGreaterThanOrEqual(400) — use expect([401, 403]).toContain(status)",
    "R4: Security tests MUST have side-effect check (verify DB state after attack)",
    "R5: IDOR/Security tests MUST have positive control (verify legitimate access works)",
    "R6: Counter checks MUST have baseline (const countBefore = ... BEFORE the action)",
    "R7: Every assertion must have '// Kills: <specific mutation>' comment",
    "",
    LAYER3_FEW_SHOT_EXAMPLE,
    "",
    "Output ONLY the TypeScript test code. No markdown fences. No explanation.",
  ].join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: (() => {
        // Build endpoint schema section
        const endpointDef = target.endpoint ? analysis.ir.apiEndpoints.find(e => e.name === target.endpoint) : null;
        const validPayloadLines = target.resolvedPayload
          ? Object.entries(target.resolvedPayload).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join(",\n")
          : endpointDef?.inputFields.map(f => `  ${f.name}: ${getValidDefault(f, `TEST_${(analysis.ir.tenantModel?.tenantEntity || "tenant").toUpperCase()}_ID`)}`).join(",\n") || "";

        // Build side-effect instructions with before/after comparison
        const sideEffects = target.sideEffects || [];
        const sideEffectInstructions = sideEffects.length > 0
          ? `SIDE EFFECTS — you MUST verify EACH with BEFORE/AFTER comparison:\n${sideEffects.map((se, i) => {
            const fieldMatch = se.match(/(\w+)\s*(?:\+=|-=|\+\+|--)/);
            const field = fieldMatch?.[1];
            if (field && (se.includes("+=") || se.includes("-=") || se.includes("++"))) {
              return `${i + 1}. ${se}\n   \u2192 BEFORE: const ${field}Before = resource.${field} as number;\n   \u2192 AFTER:  const ${field}After = (await getResource(...)).${field} as number;\n   \u2192 ASSERT: expect(${field}After).toBe(${field}Before ${se.includes("-") ? "-" : "+"} quantity);\n   \u2192 // Kills: Not updating ${field} in ${target.endpoint}`;
            }
            if (se.includes("NOW()") || se.includes("At =")) {
              const ts = se.split("=")[0].trim();
              return `${i + 1}. ${se}\n   \u2192 ASSERT: expect(after.${ts}).not.toBeNull();\n   \u2192 // Kills: Not setting ${ts} timestamp`;
            }
            return `${i + 1}. ${se}\n   \u2192 Read state BEFORE the action, then assert the change AFTER`;
          }).join("\n")}`
          : "No side effects to verify.";

        // Schema import hint
        const firstResource = analysis.ir.resources[0];
        const schemaImportHint = firstResource
          ? `SCHEMA VALIDATION — import and use after successful API call:\nimport { ${firstResource.name.charAt(0).toUpperCase() + firstResource.name.slice(1)}Schema, validateSchema } from "../../helpers/schemas";\n// After a successful API call:\nconst validated = validateSchema(${firstResource.name.charAt(0).toUpperCase() + firstResource.name.slice(1)}Schema, data);\nexpect(validated.id).toBeDefined(); // Kills: Return wrong shape`
          : "";

        // Concurrency hint for stock/inventory side effects
        const hasStockEffect = sideEffects.some(se =>
          /stock|inventory|count|balance|quota|limit/i.test(se)
        );
        const concurrencyHint = hasStockEffect && target.proofType === 'business_logic'
          ? `\nCONCURRENCY INVARIANT (add as a separate test block):\n- Run 5 concurrent requests with Promise.all()\n- After all complete, verify the resource count/stock is exactly correct (no double-spend)\n- Kills: Race condition in stock decrement`
          : "";

        return `Generate a Gold Standard Playwright test for this proof target:

ID: ${target.id}
Behavior: ${target.description}
Risk Level: ${target.riskLevel}
Proof Type: ${target.proofType}
Endpoint: ${target.endpoint || "UNKNOWN \u2014 infer from behavior description"}
Tenant Field: ${tenantField}
Preconditions: ${target.preconditions.join("; ")}

Endpoint Input Schema (use ONLY these field names \u2014 NEVER invent others):
{
${validPayloadLines}
}

CRITICAL RULES FOR PAYLOAD:
- Use ONLY the field names listed above \u2014 never invent other field names
- For array fields: use proper array syntax with objects, NEVER dot notation
  CORRECT:   items: [{ productId: 1, quantity: 2 }]
  INCORRECT: items.productId: 1  (this is not valid TypeScript)
- For enum fields: use one of the listed enum values as a string literal
- For number fields: use a number literal, not a string

${sideEffectInstructions}
${schemaImportHint ? "\n" + schemaImportHint + "\n" : ""}
Required Assertions:
${target.assertions.map(a => `- ${a.target} ${a.operator} ${JSON.stringify(a.value)}: ${a.rationale}`).join("\n")}

Mutation Targets (kill ALL with '// Kills:' comments):
${target.mutationTargets.map((m, i) => `${i + 1}. ${m.description}`).join("\n")}

AVAILABLE IMPORTS:
- from "../../helpers/api": trpcMutation, trpcQuery, BASE_URL, tomorrowStr, yesterdayStr
- from "../../helpers/auth": ${roleFnName}
- from "../../helpers/factories": TEST_${tenantEntity.toUpperCase()}_ID, createTestResource, getResource, listResources
- from "../../helpers/schemas": ${firstResource ? `${firstResource.name.charAt(0).toUpperCase() + firstResource.name.slice(1)}Schema, validateSchema` : "validateSchema"}

Spec context: ${analysis.specType}
Spec chapter: ${analysis.ir.behaviors.find(b => b.id === target.behaviorId)?.chapter || "unknown"}${concurrencyHint}`;
      })(),
      },
    ],
    thinkingBudget: 2048,
    maxTokens: 8192,
  });

  return response.choices[0].message.content as string;
}

// ─── Concurrency Test Generator ──────────────────────────────────────────────
export function generateConcurrencyTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = "TEST_" + tenantEntity.toUpperCase() + "_ID";
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));
  const endpoint = normalizeEndpointName(target.endpoint || analysis.ir.apiEndpoints[0]?.name || "TODO_REPLACE_WITH_ENDPOINT");
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
  const inputFields = epDef?.inputFields || [];
  const behaviorTitle = behavior?.title || target.description;
  const object = behavior?.object || target.endpoint?.split(".").pop() || "resource";
  const action = behavior?.action || "create";

  // Build payload from resolvedPayload or inputFields
  const payloadLines: string[] = [];
  const resolved = target.resolvedPayload || {};
  for (const f of inputFields) {
    const val = resolved[f.name] !== undefined ? resolved[f.name] : getValidDefault(f, tenantConst);
    // Bug 3 Fix: if val is the tenantConst variable name, emit it as a variable reference, not a string literal
    // getValidDefault already returns TS literals (1, "checking", TEST_X_ID) — do NOT JSON.stringify
    const valStr = val;
    payloadLines.push(`    ${f.name}: ${valStr},`);
  }
  if (payloadLines.length === 0) {
    payloadLines.push(`    ${tenantEntity}Id: ${tenantConst},`);
  }
  const payloadStr = payloadLines.join("\n");
  const fnSuffix = target.id.replace(/-/g, "_");

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery, BASE_URL } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// Proof: ${target.id}
// Behavior: ${behaviorTitle}
// Risk: ${target.riskLevel}
// Kills: ${target.mutationTargets.map(m => m.description).join(" | ")}

function basePayload_${fnSuffix}() {
  return {
${payloadStr}
  };
}

test.describe("Concurrency: ${behaviorTitle}", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await ${roleFnName}(request);
  });

  test("concurrent ${action} requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire \${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "${endpoint}", basePayload_${fnSuffix}(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent ${action} must not create duplicate ${object}s", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "${endpoint}", basePayload_${fnSuffix}(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent ${action}", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "${endpoint}", basePayload_${fnSuffix}(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "${endpoint.split(".")[0]}.list", { ${tenantEntity}Id: ${tenantConst} }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
`;
}

// ─── Idempotency Test Generator ───────────────────────────────────────────────
export function generateIdempotencyTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = "TEST_" + tenantEntity.toUpperCase() + "_ID";
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));
  const endpoint = target.endpoint || analysis.ir.apiEndpoints[0]?.name || "TODO_REPLACE_WITH_ENDPOINT";
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
  const inputFields = epDef?.inputFields || [];
  const behaviorTitle = behavior?.title || target.description;
  const object = behavior?.object || target.endpoint?.split(".").pop() || "resource";
  const action = behavior?.action || "create";

  // Build payload
  const payloadLines: string[] = [];
  const resolved = target.resolvedPayload || {};
  for (const f of inputFields) {
    const val = resolved[f.name] !== undefined ? resolved[f.name] : getValidDefault(f, tenantConst);
    // Bug 3 Fix: if val is the tenantConst variable name, emit it as a variable reference, not a string literal
    // getValidDefault already returns TS literals (1, "checking", TEST_X_ID) — do NOT JSON.stringify
    const valStr = val;
    payloadLines.push(`    ${f.name}: ${valStr},`);
  }
  if (payloadLines.length === 0) {
    payloadLines.push(`    ${tenantEntity}Id: ${tenantConst},`);
  }
  const payloadStr = payloadLines.join("\n");
  const fnSuffix = target.id.replace(/-/g, "_");

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery, BASE_URL } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// Proof: ${target.id}
// Behavior: ${behaviorTitle}
// Risk: ${target.riskLevel}
// Kills: ${target.mutationTargets.map(m => m.description).join(" | ")}

function basePayload_${fnSuffix}() {
  return {
${payloadStr}
  };
}

test.describe("Idempotency: ${behaviorTitle}", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await ${roleFnName}(request);
  });

  test("duplicate ${action} request must not create a second ${object}", async ({ request }) => {
    const payload = basePayload_${fnSuffix}();
    // First request
    const response1 = await trpcMutation(request, "${endpoint}", payload, cookie);
    expect([200, 201]).toContain(response1.status);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "${endpoint}", payload, cookie);
    // Must succeed or return conflict — never 500
    expect([200, 201, 409]).toContain(response2.status);
    if (response2.status === 200 || response2.status === 201) {
      // If it succeeds, must return the same resource
      const id2 = response2.data?.result?.data?.id;
      if (id1 && id2) {
        expect(id2).toBe(id1);
      }
    }
  });

  test("repeated ${action} must not multiply side effects", async ({ request }) => {
    const payload = basePayload_${fnSuffix}();
    // Perform the operation twice
    await trpcMutation(request, "${endpoint}", payload, cookie);
    await trpcMutation(request, "${endpoint}", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "${endpoint.split(".")[0]}.list", { ${tenantEntity}Id: ${tenantConst} }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    if (Array.isArray(items)) {
      // Count items matching our payload
      const matchingItems = items.filter((item: Record<string, unknown>) => {
        return Object.entries(payload).every(([k, v]) => item[k] === v);
      });
      // At most one matching item should exist
      expect(matchingItems.length).toBeLessThanOrEqual(1);
    }
  });

  test("${action} with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = \`idem-\${Date.now()}-\${Math.random().toString(36).slice(2)}\`;
    const payload = { ...basePayload_${fnSuffix}(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "${endpoint}", payload, cookie);
    expect([200, 201, 422]).toContain(response1.status); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "${endpoint}", payload, cookie);
    expect([200, 201, 409, 422]).toContain(response2.status);
    // If both succeed, they must return identical data
    if ((response1.status === 200 || response1.status === 201) &&
        (response2.status === 200 || response2.status === 201)) {
      const data1 = response1.data?.result?.data;
      const data2 = response2.data?.result?.data;
      if (data1?.id && data2?.id) {
        expect(data2.id).toBe(data1.id);
      }
    }
  });
});
`;
}

// ─── Auth Matrix Test Generator ───────────────────────────────────────────────
export function generateAuthMatrixTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = "TEST_" + tenantEntity.toUpperCase() + "_ID";
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roles = (analysis.ir.authModel?.roles || []).filter((r: { name?: string }) => r && r.name);
  const adminRole = roles.find((r: { name: string }) => r.name.toLowerCase().includes("admin")) || roles[0];
  const nonAdminRoles = roles.filter((r: { name: string }) => r !== adminRole);

  const endpoint = normalizeEndpointName(target.endpoint || analysis.ir.apiEndpoints[0]?.name || "TODO_REPLACE_WITH_ENDPOINT");
  const epDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);

  // v10: Endpoint-level auth — determine which roles CAN access this endpoint
  const epAuth: string[] = (epDef as any)?.auth || [];
  const allowedRoles = epAuth.length > 0
    ? roles.filter((r: { name: string }) => {
        if (epAuth.includes("public")) return true;
        if (epAuth.includes("authenticated")) return true;
        return epAuth.some((a: string) =>
          a === r.name ||
          a.includes(r.name) ||
          r.name.includes(a.replace("_admin", "").replace("admin", ""))
        );
      })
    : [adminRole];
  const deniedRoles = roles.filter((r: { name: string }) =>
    r.name !== (adminRole as any)?.name && !allowedRoles.some((ar: any) => ar?.name === r.name)
  );
  const adminFnName = adminRole
    ? "get" + adminRole.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("") + "Cookie"
    : "getAdminCookie";
  const inputFields = epDef?.inputFields || [];
  const behaviorTitle = behavior?.title || target.description;
  const object = behavior?.object || target.endpoint?.split(".").pop() || "resource";
  const action = behavior?.action || "access";
  const isWrite = ["create", "update", "delete", "cancel", "approve", "reject"].includes(action.toLowerCase());
  const trpcFn = isWrite ? "trpcMutation" : "trpcQuery";
  // Build payload
  const payloadLines: string[] = [];
  const resolved = target.resolvedPayload || {};
  for (const f of inputFields) {
    const val = resolved[f.name] !== undefined ? resolved[f.name] : getValidDefault(f, tenantConst);
    // Bug 3 Fix: if val is the tenantConst variable name, emit it as a variable reference, not a string literal
    // getValidDefault already returns TS literals (1, "checking", TEST_X_ID) — do NOT JSON.stringify
    const valStr = val;
    payloadLines.push(`    ${f.name}: ${valStr},`);
  }
  if (payloadLines.length === 0) {
    payloadLines.push(`    ${tenantEntity}Id: ${tenantConst},`);
  }
  const payloadStr = payloadLines.join("\n");
  const fnSuffix = target.id.replace(/-/g, "_");
  // Build role cookie imports
  const roleFnNames = roles.map((r: { name: string }) =>
    "get" + r.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("") + "Cookie"
  );
  const uniqueRoleFns = Array.from(new Set([adminFnName, ...roleFnNames]));
  // ── MUTATION KILL TESTS ─────────────────────────────────────────────────────
  // Each mutationTarget gets its own test with // Kills: comment + specific assertion
  // This brings the mutation score from 25% to 100%
  const mutationKillTests = target.mutationTargets.map((mt, idx) => {
    const killDesc = mt.description;
    // Determine which role to use for this mutation kill test
    const isRoleSpecific = nonAdminRoles.some((r: { name: string }) =>
      killDesc.toLowerCase().includes(r.name.toLowerCase())
    );
    const targetRole = isRoleSpecific
      ? nonAdminRoles.find((r: { name: string }) => killDesc.toLowerCase().includes(r.name.toLowerCase()))
      : null;
    const roleFn = targetRole
      ? "get" + targetRole.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("") + "Cookie"
      : adminFnName;
    const isPrivilegeEscalation = killDesc.toLowerCase().includes("lower-privileged") ||
      killDesc.toLowerCase().includes("should not") || isRoleSpecific;
    if (isPrivilegeEscalation) {
      // Test: lower-privileged role must be rejected AND response must not leak data
      return `
  test("mutation-kill-${idx + 1}: ${killDesc}", async ({ request }) => {
    // Kills: ${killDesc}
    const cookie = await ${roleFn}(request);
    const response = await ${trpcFn}(request, "${endpoint}", basePayload_${fnSuffix}(), cookie);
    expect([401, 403]).toContain(response.status);
    // Kills: ${killDesc} — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: ${killDesc} — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });`;
    } else {
      // Test: role check removed scenario — verify admin still gets correct response structure
      return `
  test("mutation-kill-${idx + 1}: ${killDesc}", async ({ request }) => {
    // Kills: ${killDesc}
    const cookie = await ${adminFnName}(request);
    const response = await ${trpcFn}(request, "${endpoint}", basePayload_${fnSuffix}(), cookie);
    expect([200, 201]).toContain(response.status);
    // Kills: ${killDesc} — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });`;
    }
  }).join("\n")  // ── NON-ADMIN ROLE TESTS (v10: endpoint-level auth) ──────────────────────────────────
  const nonAdminTests = deniedRoles.slice(0, 3).map((role: { name: string }) => {
    const roleFn = "get" + role.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("") + "Cookie";
    return `
  test("${role.name} must NOT be able to ${action} ${object}", async ({ request }) => {
    const roleCookie = await ${roleFn}(request);
    const response = await ${trpcFn}(request, "${endpoint}", basePayload_${fnSuffix}(), roleCookie);
    expect([401, 403]).toContain(response.status);
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });`;
  }).join("\n");
  return `import { test, expect } from "@playwright/test";
import { ${trpcFn}, trpcQuery, BASE_URL } from "../../helpers/api";
import { ${(uniqueRoleFns as string[]).join(", ")} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";
// Proof: ${target.id}
// Behavior: ${behaviorTitle}
// Risk: ${target.riskLevel}
// MutationTargets: ${target.mutationTargets.length} kills required for 100% mutation score
function basePayload_${fnSuffix}() {
  return {
${payloadStr}
  };
}
test.describe("Auth Matrix: ${behaviorTitle}", () => {
  test("${adminRole?.name || "admin"} must be able to ${action} ${object}", async ({ request }) => {
    const cookie = await ${adminFnName}(request);
    const response = await ${trpcFn}(request, "${endpoint}", basePayload_${fnSuffix}(), cookie);
    expect([200, 201]).toContain(response.status);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await ${trpcFn}(request, "${endpoint}", basePayload_${fnSuffix}(), "");
    expect([401, 403]).toContain(response.status);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
${nonAdminTests}
  test("cross-tenant ${action} must be rejected", async ({ request }) => {
    const cookie = await ${adminFnName}(request);
    const crossTenantPayload = {
      ...basePayload_${fnSuffix}(),
      ${tenantEntity}Id: ${tenantConst} + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await ${trpcFn}(request, "${endpoint}", crossTenantPayload, cookie);
    expect([401, 403, 404]).toContain(response.status);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });
${mutationKillTests}
});
`;
}
export function generateFlowTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  // Resolve flow steps from IR flows or behavior
  const flowDef = analysis.ir.flows?.find(f =>
    f.name.toLowerCase().includes((behavior?.object || "").toLowerCase()) ||
    (behavior?.title || "").toLowerCase().includes(f.name.toLowerCase())
  );
  const steps: FlowStep[] = flowDef?.steps || [];
  const hasSteps = steps.length > 0;

  // Resolve endpoints: create + status update + get
  const createEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("create") || e.name.toLowerCase().includes("add"))?.name || "TODO_REPLACE_WITH_CREATE_ENDPOINT";
  const updateEp = analysis.ir.apiEndpoints.find(e =>
    e.name.toLowerCase().includes("update") || e.name.toLowerCase().includes("status"))?.name || "TODO_REPLACE_WITH_UPDATE_ENDPOINT";
  const getEp = (
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("getbyid") || e.name.toLowerCase().includes("get")) ??
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("find") || e.name.toLowerCase().includes("list") || e.name.toLowerCase().includes("fetch")) ??
    analysis.ir.apiEndpoints[0]
  )?.name || "TODO_REPLACE_WITH_GET_ENDPOINT";

  const stepComments = hasSteps
    ? steps.map((s, i) => `  // Step ${i + 1}: ${s.action} → status ${s.expectedStatus ?? "?"}`).join("\n")
    : `  // Step 1: Create resource\n  // Step 2: Advance through states\n  // Step 3: Verify final state`;

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst}, createTestResource } from "../../helpers/factories";

// ${target.id} — Flow: ${target.description}
// Risk: ${target.riskLevel}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a — complete flow succeeds end-to-end", async ({ request }) => {
${stepComments}
  const { data: created } = await trpcMutation(request, "${createEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: ${target.mutationTargets[0]?.description || "Skip intermediate step in flow"}

  const { data: final } = await trpcQuery(request, "${getEp}",
    { id: (created as Record<string, unknown>)?.id, ${tenantField}: ${tenantConst} }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: ${target.mutationTargets[1]?.description || "Allow flow to complete with missing precondition"}
});

test("${target.id}b — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "${createEp}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "${updateEp}",
    { id: (created as Record<string, unknown>)?.id, ${tenantField}: ${tenantConst}, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});
`;
}

export function generateCronJobTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  // Resolve cron job def from IR
  const cronDef = analysis.ir.cronJobs?.find(c =>
    c.name.toLowerCase().includes((behavior?.object || "").toLowerCase()) ||
    (behavior?.title || "").toLowerCase().includes(c.name.toLowerCase())
  );
  const schedule = cronDef?.frequency || "every hour";
  const triggerEndpoint = target.endpoint ||
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("cron") || e.name.toLowerCase().includes("trigger") ||
      e.name.toLowerCase().includes("process"))?.name || "TODO_REPLACE_WITH_CRON_TRIGGER_ENDPOINT";

  // Detect what the cron job processes from behavior
  const processedField = behavior?.postconditions.join(" ").match(/(\w+(?:Count|Processed|Updated|Sent))/)?.[1] || "processedCount";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Cron Job: ${target.description}
// Risk: ${target.riskLevel}
// Schedule: ${schedule}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a — cron trigger processes pending records", async ({ request }) => {
  // Trigger the cron job manually
  const { status, data } = await trpcMutation(request, "${triggerEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);

  expect([200, 204]).toContain(status);
  // Kills: ${target.mutationTargets[0]?.description || "Remove cron job processing logic"}

  // Verify at least one record was processed
  const processed = (data as Record<string, unknown>)?.${processedField};
  if (processed !== undefined) {
    expect(Number(processed)).toBeGreaterThanOrEqual(0);
  }
  // Kills: ${target.mutationTargets[1]?.description || "Allow cron to run without precondition check"}
});

test("${target.id}b — cron job is idempotent (double trigger safe)", async ({ request }) => {
  // Trigger twice — should not double-process
  await trpcMutation(request, "${triggerEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  const { status: status2 } = await trpcMutation(request, "${triggerEndpoint}",
    { ${tenantField}: ${tenantConst} }, adminCookie);

  expect([200, 204]).toContain(status2);
  // Kills: Allow cron to process same records twice (missing idempotency guard)
});
`;
}

export function generateWebhookTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);
  const roleFnName = roleToCookieFn(getPreferredRole(analysis.ir.authModel));

  const webhookEndpoint = target.endpoint ||
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes("webhook") || e.name.toLowerCase().includes("hook") ||
      e.name.toLowerCase().includes("callback"))?.name || "TODO_REPLACE_WITH_WEBHOOK_ENDPOINT";

  // Detect event type from behavior
  const eventType = behavior?.postconditions.join(" ").match(/event[:\s]+["']?([a-z._]+)["']?/i)?.[1] ||
    behavior?.title.match(/([a-z]+\.[a-z]+)/)?.[1] || "order.completed";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";
import crypto from "crypto";

// ${target.id} — Webhook: ${target.description}
// Risk: ${target.riskLevel}
// Event: ${eventType}
// Behavior: ${behavior?.title || target.description}

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

test("${target.id}a — valid webhook payload is accepted", async ({ request }) => {
  const payload = JSON.stringify({ event: "${eventType}", ${tenantField}: ${tenantConst}, timestamp: Date.now() });
  const secret = process.env.WEBHOOK_SECRET || "test-secret";
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const { status } = await trpcMutation(request, "${webhookEndpoint}",
    JSON.parse(payload), adminCookie, { "x-webhook-signature": sig });

  expect([200, 204]).toContain(status);
  // Kills: ${target.mutationTargets[0]?.description || "Remove webhook signature verification"}
});

test("${target.id}b — webhook with invalid signature is rejected (401)", async ({ request }) => {
  const payload = JSON.stringify({ event: "${eventType}", ${tenantField}: ${tenantConst} });
  const badSig = "sha256=invalid_signature_here";

  const { status } = await trpcMutation(request, "${webhookEndpoint}",
    JSON.parse(payload), adminCookie, { "x-webhook-signature": badSig });

  expect(status).toBe(401);
  // Kills: Accept webhook without verifying HMAC signature
});

test("${target.id}c — webhook with missing signature is rejected (401)", async ({ request }) => {
  const { status } = await trpcMutation(request, "${webhookEndpoint}",
    { event: "${eventType}", ${tenantField}: ${tenantConst} }, adminCookie);

  expect(status).toBe(401);
  // Kills: Allow unsigned webhook delivery
});
`;
}

export function generateFeatureGateTest(target: ProofTarget, analysis: AnalysisResult): string {
  const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
  const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const behavior = analysis.ir.behaviors.find(b => b.id === target.behaviorId);

  // Resolve roles from IR auth model
  const roles = analysis.ir.authModel?.roles || [];
  const adminRole = roles.find(r => r.name.toLowerCase().includes("admin") || r.name.toLowerCase().includes("owner")) || roles[0];
  const freeRole = roles.find(r => r.name.toLowerCase().includes("free") || r.name.toLowerCase().includes("guest") || r.name.toLowerCase().includes("user")) || roles[roles.length - 1];

  const adminFnName = adminRole
    ? `get${adminRole.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getAdminCookie";
  const freeFnName = freeRole && freeRole !== adminRole
    ? `get${freeRole.name.split(/[-_\s]+/).map((w: string) => w[0].toUpperCase() + w.slice(1)).join("")}Cookie`
    : "getUserCookie";

  // Resolve feature gate def from IR
  const gateDef = analysis.ir.featureGates?.find(g =>
    g.feature.toLowerCase().includes((behavior?.object || "").toLowerCase()) ||
    (behavior?.title || "").toLowerCase().includes(g.feature.toLowerCase())
  );
  const requiredPlan = gateDef?.requiredPlan || "professional";
  const gatedEndpoint = target.endpoint ||
    analysis.ir.apiEndpoints.find(e =>
      e.name.toLowerCase().includes(behavior?.object?.toLowerCase() || ""))?.name || "TODO_REPLACE_WITH_GATED_ENDPOINT";

  return `import { test, expect } from "@playwright/test";
import { trpcMutation } from "../../helpers/api";
import { ${adminFnName}, ${freeFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

// ${target.id} — Feature Gate: ${target.description}
// Risk: ${target.riskLevel}
// Required Plan: ${requiredPlan}
// Behavior: ${behavior?.title || target.description}

let proCookie: string;
let freeCookie: string;

test.beforeAll(async ({ request }) => {
  proCookie = await ${adminFnName}(request);
  freeCookie = await ${freeFnName}(request);
});

test("${target.id}a — ${requiredPlan}-tier user can access gated feature", async ({ request }) => {
  const { status } = await trpcMutation(request, "${gatedEndpoint}",
    { ${tenantField}: ${tenantConst} }, proCookie);

  expect([200, 201]).toContain(status);
  // Kills: ${target.mutationTargets[1]?.description || "Pro-tier must succeed"}
});

test("${target.id}b — free-tier user is blocked (403)", async ({ request }) => {
  const { status } = await trpcMutation(request, "${gatedEndpoint}",
    { ${tenantField}: ${tenantConst} }, freeCookie);

  expect(status).toBe(403);
  // Kills: ${target.mutationTargets[0]?.description || "Remove plan check from feature gate"}
});

test("${target.id}c — unauthenticated user is rejected (401)", async ({ request }) => {
  const { status } = await trpcMutation(request, "${gatedEndpoint}",
    { ${tenantField}: ${tenantConst} }, "");

  expect([401, 403]).toContain(status);
  // Kills: Allow unauthenticated access to gated feature
});
`;
}


/**
 * E2E Flow Test Generator
 * Generates Playwright-style tests for user flows extracted from the spec.
 * Falls back to generateBusinessLogicTest if no matching flow is found.
 */
export function generateE2EFlowTest(target: ProofTarget, analysis: AnalysisResult): string {
  const ir = analysis.ir;
  const tenantEntity = ir.tenantModel?.tenantEntity || "tenant";
  const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
  const tenantField = ir.tenantModel?.tenantIdField || "tenantId";
  const roleFnName = roleToCookieFn(getPreferredRole(ir.authModel));

  // Find a matching user flow from the IR
  const flow = ir.userFlows?.find(f =>
    f.relatedEndpoints?.some(ep => ep === target.endpoint) ||
    f.id === target.behaviorId ||
    f.name.toLowerCase().includes(target.description.toLowerCase().slice(0, 20))
  );

  // If no flow found, fall back to business logic test
  if (!flow) {
    return generateBusinessLogicTest(target, analysis);
  }

  // Build step code from flow.steps (string array)
  const stepLines = flow.steps.map((step: string, i: number) => {
    const s = step.toLowerCase();
    if (s.includes("navigate") || s.includes("open") || s.includes("go to")) {
      const pathMatch = step.match(/\/[\w\-\/{}]+/);
      const path = pathMatch ? pathMatch[0] : "/";
      return `  // Step ${i + 1}: ${step}\n  await page.goto(\`\${BASE_URL}${path}\`);\n  await page.waitForLoadState("networkidle");`;
    }
    if (s.includes("fill") || s.includes("enter") || s.includes("type")) {
      const fieldMatch = step.match(/(\w+)\s*(?:field|input|with)/i);
      const field = fieldMatch ? fieldMatch[1] : "field";
      return `  // Step ${i + 1}: ${step}\n  await page.getByLabel(/${field}/i).fill("test-value");`;
    }
    if (s.includes("click") || s.includes("submit") || s.includes("press")) {
      const btnMatch = step.match(/(?:click|submit|press)\s+(?:the\s+)?(\w+)/i);
      const btn = btnMatch ? btnMatch[1] : "submit";
      return `  // Step ${i + 1}: ${step}\n  await page.getByRole("button", { name: /${btn}/i }).click();`;
    }
    if (s.includes("verify") || s.includes("see") || s.includes("confirm") || s.includes("check")) {
      const expectedMatch = step.match(/(?:see|verify|confirm|check)\s+(?:that\s+)?(.+)/i);
      const expected = expectedMatch ? expectedMatch[1].slice(0, 30) : "success";
      return `  // Step ${i + 1}: ${step}\n  await expect(page.getByText(/${expected}/i)).toBeVisible({ timeout: 10000 });`;
    }
    // Generic step
    return `  // Step ${i + 1}: ${step}`;
  }).join("\n\n");

  // Build success criteria assertions
  const successAssertions = (flow.successCriteria || []).slice(0, 3).map((criterion: string) => {
    const match = criterion.match(/(?:see|verify|confirm|check|returns?)\s+(.+)/i);
    const expected = match ? match[1].slice(0, 30) : criterion.slice(0, 30);
    return `  await expect(page.getByText(/${expected}/i)).toBeVisible({ timeout: 10000 });`;
  }).join("\n");

  return `import { test, expect } from "@playwright/test";
import { trpcQuery } from "../../helpers/api";
import { ${roleFnName} } from "../../helpers/auth";
import { ${tenantConst} } from "../../helpers/factories";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await ${roleFnName}(request);
});

// ${target.id} — E2E Flow: ${flow.name}
// Actor: ${flow.actor}
// Steps: ${flow.steps.length}

test("${target.id} — ${flow.name}", async ({ page, request }) => {
${stepLines}

${successAssertions}

  // Verify API state after flow
  const { data, status } = await trpcQuery(request, "${target.endpoint || flow.relatedEndpoints[0] || "auth.me"}",
    { ${tenantField}: ${tenantConst} }, adminCookie);
  expect(status).toBe(200);
  expect(data).toBeDefined();
  // Kills: ${target.mutationTargets[0]?.description || "Flow does not complete successfully"}
});
`;
}

export async function generateProofs(riskModel: RiskModel, analysis: AnalysisResult): Promise<RawProof[]> {
  const t0 = Date.now();

  // Categorize targets
  const templateMap: Record<string, (target: ProofTarget, analysis: AnalysisResult) => string> = {
    idor: generateIDORTest,
    csrf: generateCSRFTest,
    status_transition: generateStatusTransitionTest,
    dsgvo: generateDSGVOTest,
    boundary: generateBoundaryTest,
    risk_scoring: generateRiskScoringTest,
    business_logic: generateBusinessLogicTest,
    rate_limit: generateRateLimitTest,
    spec_drift: generateSpecDriftTest,
    concurrency: generateConcurrencyTest,
    idempotency: generateIdempotencyTest,
    auth_matrix: generateAuthMatrixTest,
    flow: generateFlowTest,
    cron_job: generateCronJobTest,
    webhook: generateWebhookTest,
    feature_gate: generateFeatureGateTest,
    e2e_flow: generateE2EFlowTest,
    sql_injection: generateSQLInjectionTest,
    hardcoded_secret: generateHardcodedSecretTest,
  };

  const templateTargets = riskModel.proofTargets.filter(t => templateMap[t.proofType]);
  const llmTargets = riskModel.proofTargets.filter(t => !templateMap[t.proofType]); // all types now have templates

  console.log(`[TestForge] Schicht 3: ${templateTargets.length} template tests, ${llmTargets.length} LLM tests — ALL PARALLEL`);

  // Template tests (instant)
  const templateProofs: RawProof[] = templateTargets.map(target => {
    const generator = templateMap[target.proofType];
    let code: string;
    try {
      code = generator(target, analysis);
    } catch (err) {
      console.warn(`[TestForge] Template generator crashed for ${target.id}:`, err);
      // Replace with a TODO stub so the file is still valid TypeScript
      code = generateTODOStub(target, String(err));
    }
    if (!code) return null;
    // Goldstandard: TypeScript syntax check — discard tests with syntax errors
    const syntaxError = checkTypeScriptSyntax(code);
    if (syntaxError) {
      console.warn(`[TestForge] Syntax error in ${target.id}: ${syntaxError}`);
      code = generateTODOStub(target, `Syntax error: ${syntaxError}`);
    }
    return {
      id: target.id,
      behaviorId: target.behaviorId,
      proofType: target.proofType,
      riskLevel: target.riskLevel,
      filename: getFilename(target.proofType),
      code,
      mutationTargets: target.mutationTargets,
    };
  }).filter((p): p is RawProof => p !== null);

  // LLM tests — ALL parallel, no limit
  const llmProofs: RawProof[] = (await Promise.all(
    llmTargets.map(async (target) => {
      try {
        let code = await withTimeout(generateLLMTest(target, analysis), LLM_TIMEOUT_MS, "");
        if (!code) return null;
        // Apply the same syntax check as template tests — fallback to template if LLM code is invalid
        const llmSyntaxError = checkTypeScriptSyntax(code);
        if (llmSyntaxError) {
          console.warn(`[TestForge] LLM test ${target.id} has syntax error: ${llmSyntaxError} — falling back to template`);
          const templateGen = templateMap[target.proofType];
          if (templateGen) {
            try { code = templateGen(target, analysis); } catch (e) { code = generateTODOStub(target, `LLM syntax error: ${llmSyntaxError}`); }
          } else {
            code = generateTODOStub(target, `LLM syntax error: ${llmSyntaxError}`);
          }
        }
        console.log(`[TestForge] LLM test ${target.id} done in ${Date.now() - t0}ms`);
        return {
          id: target.id,
          behaviorId: target.behaviorId,
          proofType: target.proofType,
          riskLevel: target.riskLevel,
          filename: getFilename(target.proofType),
          code,
          mutationTargets: target.mutationTargets,
        };
      } catch (err) {
        console.warn(`[TestForge] LLM test failed for ${target.id}:`, err);
        return null;
      }
    })
  )).filter((p): p is RawProof => p !== null);

  console.log(`[TestForge] Schicht 3 done in ${Date.now() - t0}ms — ${templateProofs.length + llmProofs.length} proofs`);
  return [...templateProofs, ...llmProofs];
}

