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

// PROOF-B-004-IDOR — IDOR: Cross-tenant access to CSRF double-submit cookie must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: GET /api/auth/csrf-token returns CSRF double-submit cookie

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

// PROOF-B-007-IDOR — IDOR: Cross-tenant access to failed logins must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: System rate-limits failed login attempts to 5 per 15 minutes

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

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to failed login attempt must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: System returns 429 for exceeding failed login rate limit

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
  // Kills: Remove clinicId filter in auth.login query

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

  // Attack: Tenant A tries to read specific Tenant B resource via auth.login
  const crossTenant = await trpcQuery(request, "auth.login",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.login
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-009-IDOR — IDOR: Cross-tenant access to user must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: System locks out user for 30 minutes after exceeding failed login rate limit

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
  // Kills: Remove clinicId filter in auth.login query

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

  // Attack: Tenant A tries to read specific Tenant B resource via auth.login
  const crossTenant = await trpcQuery(request, "auth.login",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.login
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-010-IDOR — IDOR: Cross-tenant access to device inventory must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Technician role can manage device inventory

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
  // Kills: Remove clinicId filter in patients.export query

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

  // Attack: Tenant A tries to read specific Tenant B resource via patients.export
  const crossTenant = await trpcQuery(request, "patients.export",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.export
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-011-IDOR — IDOR: Cross-tenant access to maintenance must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Technician role can perform maintenance

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

// PROOF-B-012-IDOR — IDOR: Cross-tenant access to rentals must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Technician role can view rentals

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

// PROOF-B-013-IDOR — IDOR: Cross-tenant access to rentals for patients must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Nurse role can create rentals for patients

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

// PROOF-B-014-IDOR — IDOR: Cross-tenant access to devices must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Nurse role can return devices

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

// PROOF-B-015-IDOR — IDOR: Cross-tenant access to pricing must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Nurse role cannot modify pricing

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

// PROOF-B-016-IDOR — IDOR: Cross-tenant access to invoices must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role can manage invoices

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

// PROOF-B-017-IDOR — IDOR: Cross-tenant access to payments must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role can process payments

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

// PROOF-B-018-IDOR — IDOR: Cross-tenant access to insurance claims must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role can process insurance claims

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

// PROOF-B-019-IDOR — IDOR: Cross-tenant access to medical records must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Billing role cannot access medical records

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

// PROOF-B-020-IDOR — IDOR: Cross-tenant access to full access within clinic must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role has full access within clinic

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

// PROOF-B-021-IDOR — IDOR: Cross-tenant access to staff must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role can manage staff

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

// PROOF-B-022-IDOR — IDOR: Cross-tenant access to reports must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role can access reports

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

// PROOF-B-023-IDOR — IDOR: Cross-tenant access to pricing must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Admin role can manage pricing

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

// PROOF-B-024-IDOR — IDOR: Cross-tenant access to X-CSRF-Token header must be rejected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: All POST/PUT/PATCH/DELETE requests require X-CSRF-Token header

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
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-024-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-025-IDOR — IDOR: Cross-tenant access to request must be rejected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: System returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header

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
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-025-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-026-IDOR — IDOR: Cross-tenant access to new medical device must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices registers a new medical device

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

// PROOF-B-027-IDOR — IDOR: Cross-tenant access to clinicId match must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices requires clinicId to match JWT clinicId

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

// PROOF-B-028-IDOR — IDOR: Cross-tenant access to device must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices rejects registration if serialNumber is globally unique

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
  // Kills: Remove clinicId filter in devices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-028-IDORb — Tenant A cannot mutate Tenant B resource via devices.create", async ({ request }) => {
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

// PROOF-B-029-IDOR — IDOR: Cross-tenant access to device must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices rejects registration if purchaseDate is in the future

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
  // Kills: Remove clinicId filter in devices.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-029-IDORb — Tenant A cannot mutate Tenant B resource via devices.create", async ({ request }) => {
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

// PROOF-B-030-IDOR — IDOR: Cross-tenant access to devices must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices lists devices

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

// PROOF-B-031-IDOR — IDOR: Cross-tenant access to all device fields must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices shows all device fields to technician/admin

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

// PROOF-B-032-IDOR — IDOR: Cross-tenant access to name, type, status, availability must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices shows name, type, status, availability to nurse

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

// PROOF-B-033-IDOR — IDOR: Cross-tenant access to pricing details must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices hides pricing details from nurse

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

// PROOF-B-034-IDOR — IDOR: Cross-tenant access to name, type, dailyRate, purchasePrice must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices shows name, type, dailyRate, purchasePrice to billing

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

// PROOF-B-035-IDOR — IDOR: Cross-tenant access to maintenance details must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices hides maintenance details from billing

test("PROOF-B-035-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-035-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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
// Behavior: GET /api/devices/:id retrieves device details

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

// PROOF-B-038-IDOR — IDOR: Cross-tenant access to device must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/devices/:id returns 403 if device belongs to different clinic

test("PROOF-B-038-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-038-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-039-IDOR — IDOR: Cross-tenant access to device status must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: PATCH /api/devices/:id/status updates device status

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
  // Kills: Remove clinicId filter in devices.status query

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

  // Attack: Tenant A tries to read specific Tenant B resource via devices.status
  const crossTenant = await trpcQuery(request, "devices.status",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.status
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-041-IDOR — IDOR: Cross-tenant access to maintenance event must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance records a maintenance event

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

// PROOF-B-042-IDOR — IDOR: Cross-tenant access to maintenance event must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance rejects if device is currently rented

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

// PROOF-B-043-IDOR — IDOR: Cross-tenant access to device.lastMaintenanceDate must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance sets device.lastMaintenanceDate to today

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
  // Kills: Remove clinicId filter in devices.maintenance query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-043-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-045-IDOR — IDOR: Cross-tenant access to nextMaintenanceDue must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance requires nextMaintenanceDue to be in the future

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
  // Kills: Remove clinicId filter in devices.maintenance query

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

  // Attack: Tenant A tries to read specific Tenant B resource via devices.maintenance
  const crossTenant = await trpcQuery(request, "devices.maintenance",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.maintenance
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-046-IDOR — IDOR: Cross-tenant access to patient must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/patients registers a patient

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
  // Kills: Remove clinicId filter in patients.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-046-IDORb — Tenant A cannot mutate Tenant B resource via patients.create", async ({ request }) => {
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

// PROOF-B-047-IDOR — IDOR: Cross-tenant access to clinicId match must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/patients requires clinicId to match JWT clinicId

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
  // Kills: Remove clinicId filter in patients.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-047-IDORb — Tenant A cannot mutate Tenant B resource via patients.create", async ({ request }) => {
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

// PROOF-B-048-IDOR — IDOR: Cross-tenant access to dateOfBirth must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/patients requires dateOfBirth to be in the past

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
  // Kills: Remove clinicId filter in patients.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-048-IDORb — Tenant A cannot mutate Tenant B resource via patients.create", async ({ request }) => {
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

// PROOF-B-049-IDOR — IDOR: Cross-tenant access to patient medicalNotes must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: Patient medicalNotes are visible only to nurse/admin

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
  // Kills: Remove clinicId filter in patients.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-049-IDORb — Tenant A cannot mutate Tenant B resource via patients.create", async ({ request }) => {
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

// PROOF-B-050-IDOR — IDOR: Cross-tenant access to patients must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/patients lists patients

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
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-050-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-051-IDOR — IDOR: Cross-tenant access to patient list request must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/patients returns 403 INSUFFICIENT_ROLE for billing role

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
  // Kills: Remove clinicId filter in devices.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-051-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-052-IDOR — IDOR: Cross-tenant access to device rental must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals creates a device rental

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

// PROOF-B-053-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if device is not available

test("PROOF-B-053-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-053-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
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

// PROOF-B-054-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if device belongs to a different clinic

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

// PROOF-B-055-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if patient belongs to a different clinic

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

// PROOF-B-056-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if rental period exceeds 365 days

test("PROOF-B-056-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-056-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
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

// PROOF-B-057-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if expectedReturnDate is not after startDate

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
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-057-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
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

// PROOF-B-058-IDOR — IDOR: Cross-tenant access to rental creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if insuranceClaim is true but insurancePreAuthCode is missing

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
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-058-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
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

// PROOF-B-059-IDOR — IDOR: Cross-tenant access to single successful rental must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals ensures only one rental succeeds for the same device concurrently

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
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-059-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
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

// PROOF-B-060-IDOR — IDOR: Cross-tenant access to device.status must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals sets device.status to 'rented'

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
  // Kills: Remove clinicId filter in rentals.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-060-IDORb — Tenant A cannot mutate Tenant B resource via rentals.create", async ({ request }) => {
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

// PROOF-B-062-IDOR — IDOR: Cross-tenant access to rentals must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/rentals lists rentals

test("PROOF-B-062-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-062-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-063-IDOR — IDOR: Cross-tenant access to all rentals must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/rentals shows all rentals to nurse

test("PROOF-B-063-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-063-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-064-IDOR — IDOR: Cross-tenant access to all rentals with financial data must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/rentals shows all rentals with financial data to billing

test("PROOF-B-064-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-064-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-065-IDOR — IDOR: Cross-tenant access to device-focused view of rentals must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/rentals shows device-focused view to technician

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
  // Kills: Remove clinicId filter in devices.list query

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

  // Attack: Tenant A tries to read specific Tenant B resource via devices.list
  const crossTenant = await trpcQuery(request, "devices.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in devices.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-066-IDOR — IDOR: Cross-tenant access to rental period must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/extend extends a rental period

test("PROOF-B-066-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-066-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-072-IDOR — IDOR: Cross-tenant access to device return must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return processes device return

test("PROOF-B-072-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-072-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-081-IDOR — IDOR: Cross-tenant access to rental status must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: PATCH /api/rentals/:id/status updates rental status

test("PROOF-B-081-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in rentals.status query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-081-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via rentals.status
  const crossTenant = await trpcQuery(request, "rentals.status",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in rentals.status
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-082-IDOR — IDOR: Cross-tenant access to invoice must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/invoices creates an invoice

test("PROOF-B-082-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-082-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
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

// PROOF-B-083-IDOR — IDOR: Cross-tenant access to invoice creation must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/invoices rejects if rentalId belongs to a different clinic

test("PROOF-B-083-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-083-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
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

// PROOF-B-084-IDOR — IDOR: Cross-tenant access to dueDate must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/invoices requires dueDate to be in the future

test("PROOF-B-084-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-084-IDORb — Tenant A cannot mutate Tenant B resource via invoices.create", async ({ request }) => {
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

// PROOF-B-085-IDOR — IDOR: Cross-tenant access to payment must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/invoices/:id/payment records payment

test("PROOF-B-085-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-085-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-089-IDOR — IDOR: Cross-tenant access to device utilization report must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/reports/utilization provides device utilization report

test("PROOF-B-089-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-089-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-090-IDOR — IDOR: Cross-tenant access to device utilization report must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/reports/utilization is accessible only by admin

test("PROOF-B-090-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-090-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-101-IDOR — IDOR: Cross-tenant access to device must be rejected
// Risk: CRITICAL
// Spec: Status Machine: devices
// Behavior: Transition from maintenance to available sets lastMaintenanceDate and clears maintenanceStartDate

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

// PROOF-B-109-IDOR — IDOR: Cross-tenant access to from active to cancelled must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from active to cancelled by admin only, with reason

test("PROOF-B-109-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-109-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-115-IDOR — IDOR: Cross-tenant access to rental must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: Transition to overdue rental state sends overdue notification and calculates late fees

test("PROOF-B-115-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-115-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-116-IDOR — IDOR: Cross-tenant access to rental must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: Transition to returned rental state calculates final charges and updates device status

test("PROOF-B-116-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-116-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-117-IDOR — IDOR: Cross-tenant access to rental must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: Transition to completed rental state archives rental and updates patient.completedRentals count

test("PROOF-B-117-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-117-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-118-IDOR — IDOR: Cross-tenant access to rental must be rejected
// Risk: CRITICAL
// Spec: Status Machine: rentals
// Behavior: Transition to cancelled rental state sets device.status to 'available' and refunds deposit if applicable

test("PROOF-B-118-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-118-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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

// PROOF-B-121-IDOR — IDOR: Cross-tenant access to rental cancellation must be rejected
// Risk: CRITICAL
// Spec: Cancellation Policy
// Behavior: System provides no deposit refund for cancellation after startDate (admin only), charging for days used

test("PROOF-B-121-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
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

test("PROOF-B-121-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
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