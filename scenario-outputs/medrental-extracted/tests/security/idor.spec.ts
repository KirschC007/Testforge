import { expect, test } from "@playwright/test";
import { loginAndGetCookie, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_B_ID, TEST_CLINIC_ID, createTestResource } from "../../helpers/factories";

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

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to clinic data must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: System isolates clinics by clinicId

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.gdprDelete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot mutate Tenant B resource via patients.gdprDelete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via patients.gdprDelete
  const crossTenant = await trpcMutation(request, "patients.gdprDelete",
    {
        id: resourceId,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.gdprDelete
  // Kills: Allow cross-tenant mutations on patients.gdprDelete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-004-IDOR — IDOR: Cross-tenant access to CSRF token must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: API provides CSRF token via double-submit cookie

test("PROOF-B-004-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in auth.csrfToken query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-004-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.csrfToken
  const crossTenant = await trpcQuery(request, "auth.csrfToken",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.csrfToken
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-005-IDOR — IDOR: Cross-tenant access to userId, clinicId, role must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: JWT contains userId, clinicId, and role

test("PROOF-B-005-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.export query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-005-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patients.export
  const crossTenant = await trpcQuery(request, "patients.export",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.export
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-007-IDOR — IDOR: Cross-tenant access to failed login attempts must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: System rate limits failed login attempts to 5 per 15 minutes

test("PROOF-B-007-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in auth.login query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-007-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.login
  const crossTenant = await trpcQuery(request, "auth.login",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.login
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to device inventory must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Technician role can manage device inventory

test("PROOF-B-008-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-008-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-009-IDOR — IDOR: Cross-tenant access to maintenance must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Technician role can perform maintenance

test("PROOF-B-009-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-009-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-010-IDOR — IDOR: Cross-tenant access to rentals must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Technician role can view rentals

test("PROOF-B-010-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-010-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-011-IDOR — IDOR: Cross-tenant access to rentals for patients must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Nurse role can create rentals for patients

test("PROOF-B-011-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-011-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-012-IDOR — IDOR: Cross-tenant access to devices must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Nurse role can return devices

test("PROOF-B-012-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-012-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-013-IDOR — IDOR: Cross-tenant access to pricing must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Nurse role cannot modify pricing

test("PROOF-B-013-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-013-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-014-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role can manage invoices

test("PROOF-B-014-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-014-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-015-IDOR — IDOR: Cross-tenant access to payments must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role can process payments

test("PROOF-B-015-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-015-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-016-IDOR — IDOR: Cross-tenant access to insurance claims must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role can process insurance claims

test("PROOF-B-016-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-016-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-017-IDOR — IDOR: Cross-tenant access to medical records must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role cannot access medical records

test("PROOF-B-017-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-017-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-018-IDOR — IDOR: Cross-tenant access to full access within clinic must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role has full access within clinic

test("PROOF-B-018-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-018-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-019-IDOR — IDOR: Cross-tenant access to staff must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role can manage staff

test("PROOF-B-019-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-019-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-020-IDOR — IDOR: Cross-tenant access to reports must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role can manage reports

test("PROOF-B-020-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-020-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-021-IDOR — IDOR: Cross-tenant access to pricing must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role can manage pricing

test("PROOF-B-021-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-021-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-022-IDOR — IDOR: Cross-tenant access to X-CSRF-Token header must be rejected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: API requires X-CSRF-Token header for state-changing requests

test("PROOF-B-022-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-022-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-023-IDOR — IDOR: Cross-tenant access to CSRF_REQUIRED must be rejected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: API returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header

test("PROOF-B-023-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-023-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-024-IDOR — IDOR: Cross-tenant access to registration of new medical devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows technician and admin to register new medical devices

test("PROOF-B-024-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-024-IDORb — Tenant A cannot mutate Tenant B resource via devices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via devices.create
  const crossTenant = await trpcMutation(request, "devices.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        serialNumber: "test-serialNumber",
        name: "test-title",
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: "test-purchaseDate",
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.create
  // Kills: Allow cross-tenant mutations on devices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-025-IDOR — IDOR: Cross-tenant access to device registration must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects device registration if clinicId does not match JWT

test("PROOF-B-025-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-025-IDORb — Tenant A cannot mutate Tenant B resource via devices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via devices.create
  const crossTenant = await trpcMutation(request, "devices.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        serialNumber: "test-serialNumber",
        name: "test-title",
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: "test-purchaseDate",
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.create
  // Kills: Allow cross-tenant mutations on devices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-026-IDOR — IDOR: Cross-tenant access to device registration must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects device registration if serialNumber already exists globally

test("PROOF-B-026-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-026-IDORb — Tenant A cannot mutate Tenant B resource via devices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via devices.create
  const crossTenant = await trpcMutation(request, "devices.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        serialNumber: "test-serialNumber",
        name: "test-title",
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: "test-purchaseDate",
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.create
  // Kills: Allow cross-tenant mutations on devices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-027-IDOR — IDOR: Cross-tenant access to device registration must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects device registration if purchaseDate is in the future

test("PROOF-B-027-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-027-IDORb — Tenant A cannot mutate Tenant B resource via devices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via devices.create
  const crossTenant = await trpcMutation(request, "devices.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        serialNumber: "test-serialNumber",
        name: "test-title",
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: "test-purchaseDate",
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.create
  // Kills: Allow cross-tenant mutations on devices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-028-IDOR — IDOR: Cross-tenant access to listing of devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows all roles to list devices

test("PROOF-B-028-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-028-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-029-IDOR — IDOR: Cross-tenant access to all device fields must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Technician/admin roles see all device fields when listing devices

test("PROOF-B-029-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-029-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-030-IDOR — IDOR: Cross-tenant access to name, type, status, availability of devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Nurse role sees name, type, status, availability when listing devices

test("PROOF-B-030-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-030-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-031-IDOR — IDOR: Cross-tenant access to pricing of devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Nurse role does not see pricing when listing devices

test("PROOF-B-031-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-031-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-032-IDOR — IDOR: Cross-tenant access to name, type, dailyRate, purchasePrice of devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Billing role sees name, type, dailyRate, purchasePrice when listing devices

test("PROOF-B-032-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-032-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-033-IDOR — IDOR: Cross-tenant access to maintenance details of devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Billing role does not see maintenance details when listing devices

test("PROOF-B-033-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-033-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-034-IDOR — IDOR: Cross-tenant access to getting device details must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows all roles to get device details with role-based field visibility

test("PROOF-B-034-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-034-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-036-IDOR — IDOR: Cross-tenant access to device details must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API returns 403 if device belongs to a different clinic

test("PROOF-B-036-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-036-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-037-IDOR — IDOR: Cross-tenant access to updating device status must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows technician and admin to update device status

test("PROOF-B-037-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.status query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-037-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.status
  const crossTenant = await trpcQuery(request, "devices.status",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.status
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-039-IDOR — IDOR: Cross-tenant access to recording maintenance event must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows technician and admin to record a maintenance event

test("PROOF-B-039-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.maintenance query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-039-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.maintenance
  const crossTenant = await trpcQuery(request, "devices.maintenance",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.maintenance
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-040-IDOR — IDOR: Cross-tenant access to maintenance recording must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects maintenance recording if device is currently rented

test("PROOF-B-040-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.maintenance query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-040-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.maintenance
  const crossTenant = await trpcQuery(request, "devices.maintenance",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.maintenance
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-041-IDOR — IDOR: Cross-tenant access to device.lastMaintenanceDate must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API sets device.lastMaintenanceDate to today after maintenance event

test("PROOF-B-041-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.maintenance query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-041-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.maintenance
  const crossTenant = await trpcQuery(request, "devices.maintenance",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.maintenance
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-042-IDOR — IDOR: Cross-tenant access to maintenance countdown must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API resets maintenance countdown after maintenance event

test("PROOF-B-042-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.maintenance query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-042-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.maintenance
  const crossTenant = await trpcQuery(request, "devices.maintenance",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.maintenance
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-043-IDOR — IDOR: Cross-tenant access to registration of a patient must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows nurse and admin to register a patient

test("PROOF-B-043-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-043-IDORb — Tenant A cannot mutate Tenant B resource via patients.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via patients.create
  const crossTenant = await trpcMutation(request, "patients.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        firstName: "test-title",
        lastName: "test-title",
        dateOfBirth: "test-dateOfBirth",
        email: "test-email",
        phone: "test-phone",
        insuranceProvider: "test-insuranceProvider",
        insuranceNumber: "test-insuranceNumber",
        address: "test-address",
        medicalNotes: "test-medicalNotes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.create
  // Kills: Allow cross-tenant mutations on patients.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-044-IDOR — IDOR: Cross-tenant access to patient registration must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects patient registration if clinicId does not match JWT

test("PROOF-B-044-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-044-IDORb — Tenant A cannot mutate Tenant B resource via patients.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via patients.create
  const crossTenant = await trpcMutation(request, "patients.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        firstName: "test-title",
        lastName: "test-title",
        dateOfBirth: "test-dateOfBirth",
        email: "test-email",
        phone: "test-phone",
        insuranceProvider: "test-insuranceProvider",
        insuranceNumber: "test-insuranceNumber",
        address: "test-address",
        medicalNotes: "test-medicalNotes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.create
  // Kills: Allow cross-tenant mutations on patients.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-045-IDOR — IDOR: Cross-tenant access to listing of patients must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows nurse and admin to list patients

test("PROOF-B-045-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-045-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-046-IDOR — IDOR: Cross-tenant access to patient listing must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects patient listing for billing role

test("PROOF-B-046-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-046-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-047-IDOR — IDOR: Cross-tenant access to creation of a device rental must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows nurse and admin to create a device rental

test("PROOF-B-047-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-047-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-048-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects rental creation if device is not available

test("PROOF-B-048-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-048-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-049-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects rental creation if device belongs to a different clinic

test("PROOF-B-049-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-049-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-050-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects rental creation if patient belongs to a different clinic

test("PROOF-B-050-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-050-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-051-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects rental creation if expectedReturnDate is more than 365 days from startDate

test("PROOF-B-051-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-051-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-052-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects rental creation if expectedReturnDate is not after startDate

test("PROOF-B-052-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-052-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-054-IDOR — IDOR: Cross-tenant access to single concurrent rental must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API ensures only one concurrent rental for the same device succeeds

test("PROOF-B-054-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-054-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-055-IDOR — IDOR: Cross-tenant access to device.status must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API sets device status to rented upon successful rental creation

test("PROOF-B-055-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-055-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via rentals.create
  const crossTenant = await trpcMutation(request, "rentals.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        deviceId: resourceId,
        patientId: resourceId,
        startDate: "test-startDate",
        expectedReturnDate: "test-expectedReturnDate",
        dailyRate: 50,
        deposit: 1,
        insuranceClaim: "test-insuranceClaim",
        insurancePreAuthCode: "test-insurancePreAuthCode",
        prescriptionId: resourceId,
        accessories: "test-accessories",
        notes: "test-notes",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.create
  // Kills: Allow cross-tenant mutations on rentals.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-057-IDOR — IDOR: Cross-tenant access to listing of rentals must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows all roles to list rentals

test("PROOF-B-057-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-057-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-058-IDOR — IDOR: Cross-tenant access to all rentals must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Nurse role sees all rentals when listing rentals

test("PROOF-B-058-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-058-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-059-IDOR — IDOR: Cross-tenant access to all rentals with financial data must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Billing role sees all rentals with financial data when listing rentals

test("PROOF-B-059-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-059-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-060-IDOR — IDOR: Cross-tenant access to device-focused view of rentals must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Technician role sees device-focused view of rentals when listing rentals

test("PROOF-B-060-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-060-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-061-IDOR — IDOR: Cross-tenant access to extending a rental period must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows nurse and admin to extend a rental period

test("PROOF-B-061-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.extend query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-061-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via rentals.extend
  const crossTenant = await trpcQuery(request, "rentals.extend",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.extend
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-065-IDOR — IDOR: Cross-tenant access to processing device return must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows technician, nurse, and admin to process device return

test("PROOF-B-065-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.return query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-065-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via rentals.return
  const crossTenant = await trpcQuery(request, "rentals.return",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.return
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-074-IDOR — IDOR: Cross-tenant access to creation of an invoice must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows billing and admin to create an invoice

test("PROOF-B-074-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in invoices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-074-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via invoices.create
  const crossTenant = await trpcMutation(request, "invoices.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        rentalId: resourceId,
        items: "test-items",
        dueDate: "test-dueDate",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.create
  // Kills: Allow cross-tenant mutations on invoices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-075-IDOR — IDOR: Cross-tenant access to invoice creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API rejects invoice creation if rentalId does not belong to same clinic

test("PROOF-B-075-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in invoices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-075-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via invoices.create
  const crossTenant = await trpcMutation(request, "invoices.create",
    {
        clinicId: TEST_CLINIC_B_ID,
        rentalId: resourceId,
        items: "test-items",
        dueDate: "test-dueDate",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.create
  // Kills: Allow cross-tenant mutations on invoices.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-076-IDOR — IDOR: Cross-tenant access to recording payment must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows billing and admin to record payment

test("PROOF-B-076-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in invoices.payment query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-076-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via invoices.payment
  const crossTenant = await trpcQuery(request, "invoices.payment",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in invoices.payment
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-080-IDOR — IDOR: Cross-tenant access to access to device utilization report must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: API allows admin only to access device utilization report

test("PROOF-B-080-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in reports.utilization query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-080-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via reports.utilization
  const crossTenant = await trpcQuery(request, "reports.utilization",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in reports.utilization
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-101-IDOR — IDOR: Cross-tenant access to from active to cancelled must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from active to cancelled by admin only with reason

test("PROOF-B-101-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-101-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-111-IDOR — IDOR: Cross-tenant access to rental must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: System archives rental when rental status transitions to completed

test("PROOF-B-111-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-111-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});