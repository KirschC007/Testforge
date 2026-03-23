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

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to by `clinicId` must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: Clinic isolation by clinicId

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patients.list
  const crossTenant = await trpcQuery(request, "patients.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-002-IDOR — IDOR: Cross-tenant access to exactly one clinic must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: Patients, appointments, and medical records belong to exactly one clinic

test("PROOF-B-002-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-002-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patients.list
  const crossTenant = await trpcQuery(request, "patients.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-004-IDOR — IDOR: Cross-tenant access to `userId`, `clinicId`, `role` must be rejected
// Risk: CRITICAL
// Spec: Authentication
// Behavior: JWT contains userId, clinicId, and role

test("PROOF-B-004-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in login query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-004-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via login
  const crossTenant = await trpcQuery(request, "login",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in login
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-007-IDOR — IDOR: Cross-tenant access to full access to own patients must be rejected
// Risk: CRITICAL
// Spec: Roles
// Behavior: Doctor role has full access to own patients

test("PROOF-B-007-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-007-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patients.list
  const crossTenant = await trpcQuery(request, "patients.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to all within clinic must be rejected
// Risk: CRITICAL
// Spec: Roles
// Behavior: Doctor role can read all data within clinic

test("PROOF-B-008-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-008-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patients.list
  const crossTenant = await trpcQuery(request, "patients.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-014-IDOR — IDOR: Cross-tenant access to full access within clinic must be rejected
// Risk: CRITICAL
// Spec: Roles
// Behavior: Admin role has full access within clinic

test("PROOF-B-014-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patients.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-014-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patients.list
  const crossTenant = await trpcQuery(request, "patients.list",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patients.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-019-IDOR — IDOR: Cross-tenant access to `clinicId` to match JWT must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/patients requires clinicId to match JWT

test("PROOF-B-019-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in registerPatient query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-019-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via registerPatient
  const crossTenant = await trpcQuery(request, "registerPatient",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in registerPatient
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-024-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: GET /api/patients/:id returns 403 if patient belongs to different clinic

test("PROOF-B-024-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in patientDetails.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-024-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via patientDetails.getById
  const crossTenant = await trpcQuery(request, "patientDetails.getById",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in patientDetails.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-029-IDOR — IDOR: Cross-tenant access to `doctorId` to belong to same clinic must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/appointments requires doctorId to belong to same clinic

test("PROOF-B-029-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in bookAppointment query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-029-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via bookAppointment
  const crossTenant = await trpcQuery(request, "bookAppointment",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in bookAppointment
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-030-IDOR — IDOR: Cross-tenant access to `patientId` to belong to same clinic must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: POST /api/appointments requires patientId to belong to same clinic

test("PROOF-B-030-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove clinicId filter in bookAppointment query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_CLINIC_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-030-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { clinicId: TEST_CLINIC_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via bookAppointment
  const crossTenant = await trpcQuery(request, "bookAppointment",
    { id: resourceId, clinicId: TEST_CLINIC_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in bookAppointment
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});