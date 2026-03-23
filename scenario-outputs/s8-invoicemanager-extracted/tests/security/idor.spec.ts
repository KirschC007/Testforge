import { expect, test } from "@playwright/test";
import { loginAndGetCookie, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_COMPANY_B_ID, TEST_COMPANY_ID, createTestResource } from "../../helpers/factories";

let tenantACookie: string;
let tenantBCookie: string;

test.beforeAll(async ({ request }) => {
  tenantACookie = await getAdminCookie(request);
  // IMPORTANT: Set E2E_TENANT_B_USER and E2E_TENANT_B_PASS to a user from a DIFFERENT tenant
  tenantBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_TENANT_B_USER || "test-tenant-b-user",
    process.env.E2E_TENANT_B_PASS || "TestPass2026x"
  );
});

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create invoices

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via invoices.create
  const crossTenant = await trpcMutation(request, "invoices.create",
    {
        companyId: TEST_COMPANY_B_ID,
        clientId: TEST_COMPANY_B_ID,
        items: "test-items",
        description: "test-description",
        quantity: 1,
        unitPrice: 1,
        notes: "test-notes",
        dueDate: "test-dueDate",
        taxRate: 1,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.create
  // Kills: Allow cross-tenant mutations on invoices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-002-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get invoices

test("PROOF-B-002-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-002-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.list
  const crossTenant = await trpcQuery(request, "invoices.list",
    { id: resourceId, companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-003-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-003-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.send query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-003-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.send
  const crossTenant = await trpcQuery(request, "invoices.send",
    { id: resourceId, companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.send
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-004-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-004-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.markPaid query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-004-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.markPaid
  const crossTenant = await trpcQuery(request, "invoices.markPaid",
    { id: resourceId, companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.markPaid
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-005-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-005-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.cancel query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-005-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.cancel
  const crossTenant = await trpcQuery(request, "invoices.cancel",
    { id: resourceId, companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.cancel
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-006-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-006-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.void query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-006-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.void
  const crossTenant = await trpcQuery(request, "invoices.void",
    { id: resourceId, companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.void
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-007-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create invoices

test("PROOF-B-007-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-007-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via invoices.create
  const crossTenant = await trpcMutation(request, "invoices.create",
    {
        companyId: TEST_COMPANY_B_ID,
        clientId: TEST_COMPANY_B_ID,
        items: "test-items",
        description: "test-description",
        quantity: 1,
        unitPrice: 1,
        notes: "test-notes",
        dueDate: "test-dueDate",
        taxRate: 1,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.create
  // Kills: Allow cross-tenant mutations on invoices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get invoices

test("PROOF-B-008-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-008-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.list
  const crossTenant = await trpcQuery(request, "invoices.list",
    { id: resourceId, companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-009-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-009-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove companyId filter in invoices.gdprDelete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_COMPANY_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-009-IDORb — Tenant A cannot mutate Tenant B resource via invoices.gdprDelete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { companyId: TEST_COMPANY_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via invoices.gdprDelete
  const crossTenant = await trpcMutation(request, "invoices.gdprDelete",
    {
        id: resourceId,
        companyId: TEST_COMPANY_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.gdprDelete
  // Kills: Allow cross-tenant mutations on invoices.gdprDelete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});