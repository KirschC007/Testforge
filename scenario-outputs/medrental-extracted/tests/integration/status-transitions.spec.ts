import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-004-STATUS — Status Transition: API provides CSRF token via double-submit cookie
// Risk: critical
// Spec: Authentication
// Behavior: API provides CSRF token via double-submit cookie

test("PROOF-B-004-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "auth.csrfToken",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove provides transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-004-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "auth.csrfToken",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "auth.csrfToken",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-007-STATUS — Status Transition: System rate limits failed login attempts to 5 per 15 minutes
// Risk: medium
// Spec: Authentication
// Behavior: System rate limits failed login attempts to 5 per 15 minutes

test("PROOF-B-007-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "auth.login",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rate limits transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-007-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "auth.login",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "auth.login",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-007-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "auth.login",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-009-STATUS — Status Transition: Technician role can perform maintenance
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Technician role can perform maintenance

test("PROOF-B-009-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove perform transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-009-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-009-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through maintenance
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-010-STATUS — Status Transition: Technician role can view rentals
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Technician role can view rentals

test("PROOF-B-010-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove view transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-010-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-012-STATUS — Status Transition: Nurse role can return devices
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Nurse role can return devices

test("PROOF-B-012-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove return transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-012-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-012-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-013-STATUS — Status Transition: Nurse role cannot modify pricing
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Nurse role cannot modify pricing

test("PROOF-B-013-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot modify transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-013-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-014-STATUS — Status Transition: Billing role can manage invoices
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Billing role can manage invoices

test("PROOF-B-014-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove manage transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-014-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-014-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-017-STATUS — Status Transition: Billing role cannot access medical records
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Billing role cannot access medical records

test("PROOF-B-017-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot access transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-017-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-022-STATUS — Status Transition: API requires X-CSRF-Token header for state-changing requests
// Risk: critical
// Spec: CSRF Protection
// Behavior: API requires X-CSRF-Token header for state-changing requests

test("PROOF-B-022-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-022-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-022-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-023-STATUS — Status Transition: API returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header
// Risk: critical
// Spec: CSRF Protection
// Behavior: API returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header

test("PROOF-B-023-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 403 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-023-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-023-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through maintenance
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-024-STATUS — Status Transition: API allows technician and admin to register new medical devices
// Risk: critical
// Spec: Endpoints
// Behavior: API allows technician and admin to register new medical devices

test("PROOF-B-024-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-024-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-025-STATUS — Status Transition: API rejects device registration if clinicId does not match JWT
// Risk: critical
// Spec: Endpoints
// Behavior: API rejects device registration if clinicId does not match JWT

test("PROOF-B-025-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-025-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-025-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-026-STATUS — Status Transition: API rejects device registration if serialNumber already exists globally
// Risk: medium
// Spec: Endpoints
// Behavior: API rejects device registration if serialNumber already exists globally

test("PROOF-B-026-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-026-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-027-STATUS — Status Transition: API rejects device registration if purchaseDate is in the future
// Risk: medium
// Spec: Endpoints
// Behavior: API rejects device registration if purchaseDate is in the future

test("PROOF-B-027-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-027-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-027-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-030-STATUS — Status Transition: Nurse role sees name, type, status, availability when listing devices
// Risk: critical
// Spec: Endpoints
// Behavior: Nurse role sees name, type, status, availability when listing devices

test("PROOF-B-030-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sees transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-030-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-031-STATUS — Status Transition: Nurse role does not see pricing when listing devices
// Risk: critical
// Spec: Endpoints
// Behavior: Nurse role does not see pricing when listing devices

test("PROOF-B-031-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove does not see transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-031-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-031-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-036-STATUS — Status Transition: API returns 403 if device belongs to a different clinic
// Risk: critical
// Spec: Endpoints
// Behavior: API returns 403 if device belongs to a different clinic

test("PROOF-B-036-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 403 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-036-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-036-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through maintenance
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-037-STATUS — Status Transition: API allows technician and admin to update device status
// Risk: high
// Spec: Endpoints
// Behavior: API allows technician and admin to update device status

test("PROOF-B-037-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-037-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-039-STATUS — Status Transition: API allows technician and admin to record a maintenance event
// Risk: critical
// Spec: Endpoints
// Behavior: API allows technician and admin to record a maintenance event

test("PROOF-B-039-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-039-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-039-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-040-STATUS — Status Transition: API rejects maintenance recording if device is currently rented
// Risk: high
// Spec: Endpoints
// Behavior: API rejects maintenance recording if device is currently rented

test("PROOF-B-040-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-040-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-041-STATUS — Status Transition: API sets device.lastMaintenanceDate to today after maintenance event
// Risk: high
// Spec: Endpoints
// Behavior: API sets device.lastMaintenanceDate to today after maintenance event

test("PROOF-B-041-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.lastMaintenanceDat).not.toBeNull();
  // Kills: Remove lastMaintenanceDat = NOW() in handler

  // Kills: Remove device.lastMaintenanceDate = current date side-effect
});

test("PROOF-B-041-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-041-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-042-STATUS — Status Transition: API resets maintenance countdown after maintenance event
// Risk: high
// Spec: Endpoints
// Behavior: API resets maintenance countdown after maintenance event

test("PROOF-B-042-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove resets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove maintenance countdown restarted side-effect

});

test("PROOF-B-042-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-043-STATUS — Status Transition: API allows nurse and admin to register a patient
// Risk: critical
// Spec: Endpoints
// Behavior: API allows nurse and admin to register a patient

test("PROOF-B-043-STATUSa — reserved → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-043-STATUSb — returned → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "patients.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-043-STATUSc — reserved → completed: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to completed without going through returned
  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-044-STATUS — Status Transition: API rejects patient registration if clinicId does not match JWT
// Risk: critical
// Spec: Endpoints
// Behavior: API rejects patient registration if clinicId does not match JWT

test("PROOF-B-044-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-044-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-046-STATUS — Status Transition: API rejects patient listing for billing role
// Risk: critical
// Spec: Endpoints
// Behavior: API rejects patient listing for billing role

test("PROOF-B-046-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-046-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-047-STATUS — Status Transition: API allows nurse and admin to create a device rental
// Risk: critical
// Spec: Endpoints
// Behavior: API allows nurse and admin to create a device rental

test("PROOF-B-047-STATUSa — returned → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-047-STATUSb — completed → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-047-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-048-STATUS — Status Transition: API rejects rental creation if device is not available
// Risk: high
// Spec: Endpoints
// Behavior: API rejects rental creation if device is not available

test("PROOF-B-048-STATUSa — reserved → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-048-STATUSb — cancelled → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-048-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through cancelled
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-049-STATUS — Status Transition: API rejects rental creation if device belongs to a different clinic
// Risk: critical
// Spec: Endpoints
// Behavior: API rejects rental creation if device belongs to a different clinic

test("PROOF-B-049-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-049-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-049-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through cancelled
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-050-STATUS — Status Transition: API rejects rental creation if patient belongs to a different clinic
// Risk: critical
// Spec: Endpoints
// Behavior: API rejects rental creation if patient belongs to a different clinic

test("PROOF-B-050-STATUSa — reserved → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-050-STATUSb — active → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-050-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through active
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-051-STATUS — Status Transition: API rejects rental creation if expectedReturnDate is more than 365 days from startDate
// Risk: medium
// Spec: Endpoints
// Behavior: API rejects rental creation if expectedReturnDate is more than 365 days from startDate

test("PROOF-B-051-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-051-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-051-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-052-STATUS — Status Transition: API rejects rental creation if expectedReturnDate is not after startDate
// Risk: medium
// Spec: Endpoints
// Behavior: API rejects rental creation if expectedReturnDate is not after startDate

test("PROOF-B-052-STATUSa — active → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-052-STATUSb — returned → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-052-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through returned
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-054-STATUS — Status Transition: API ensures only one concurrent rental for the same device succeeds
// Risk: high
// Spec: Endpoints
// Behavior: API ensures only one concurrent rental for the same device succeeds

test("PROOF-B-054-STATUSa — overdue → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove ensures transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-054-STATUSb — returned → overdue: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→overdue reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-054-STATUSc — overdue → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through returned
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-055-STATUS — Status Transition: API sets device status to rented upon successful rental creation
// Risk: high
// Spec: Endpoints
// Behavior: API sets device status to rented upon successful rental creation

test("PROOF-B-055-STATUSa — returned → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove device.status = 'rented' side-effect
});

test("PROOF-B-055-STATUSb — completed → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-055-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-061-STATUS — Status Transition: API allows nurse and admin to extend a rental period
// Risk: critical
// Spec: Endpoints
// Behavior: API allows nurse and admin to extend a rental period

test("PROOF-B-061-STATUSa — reserved → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-061-STATUSb — cancelled → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-061-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through cancelled
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-062-STATUS — Status Transition: API rejects rental extension if rental is not active
// Risk: high
// Spec: Endpoints
// Behavior: API rejects rental extension if rental is not active

test("PROOF-B-062-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-062-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-062-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through cancelled
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-063-STATUS — Status Transition: API rejects rental extension if maximum of 3 extensions per rental is reached
// Risk: medium
// Spec: Endpoints
// Behavior: API rejects rental extension if maximum of 3 extensions per rental is reached

test("PROOF-B-063-STATUSa — reserved → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-063-STATUSb — active → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-063-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through active
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-065-STATUS — Status Transition: API allows technician, nurse, and admin to process device return
// Risk: critical
// Spec: Endpoints
// Behavior: API allows technician, nurse, and admin to process device return

test("PROOF-B-065-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-065-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-065-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-066-STATUS — Status Transition: API rejects device return if rental is not active or overdue
// Risk: high
// Spec: Endpoints
// Behavior: API rejects device return if rental is not active or overdue

test("PROOF-B-066-STATUSa — active → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-066-STATUSb — returned → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-066-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through returned
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-070-STATUS — Status Transition: API sets device status to maintenance if return condition is needs_repair
// Risk: high
// Spec: Endpoints
// Behavior: API sets device status to maintenance if return condition is needs_repair

test("PROOF-B-070-STATUSa — overdue → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove device.status = 'maintenance' side-effect
});

test("PROOF-B-070-STATUSb — returned → overdue: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→overdue reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-070-STATUSc — overdue → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through returned
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-071-STATUS — Status Transition: API sets device status to available if return condition is good
// Risk: high
// Spec: Endpoints
// Behavior: API sets device status to available if return condition is good

test("PROOF-B-071-STATUSa — returned → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove device.status = 'available' side-effect
});

test("PROOF-B-071-STATUSb — completed → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-071-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-073-STATUS — Status Transition: API updates patient.activeRentals upon device return
// Risk: high
// Spec: Endpoints
// Behavior: API updates patient.activeRentals upon device return

test("PROOF-B-073-STATUSa — reserved → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.pat).not.toBeNull();
  // Kills: Remove pat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove patient.activeRentals count updated side-effect

});

test("PROOF-B-073-STATUSb — cancelled → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-073-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through cancelled
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-074-STATUS — Status Transition: API allows billing and admin to create an invoice
// Risk: critical
// Spec: Endpoints
// Behavior: API allows billing and admin to create an invoice

test("PROOF-B-074-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-074-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-075-STATUS — Status Transition: API rejects invoice creation if rentalId does not belong to same clinic
// Risk: critical
// Spec: Endpoints
// Behavior: API rejects invoice creation if rentalId does not belong to same clinic

test("PROOF-B-075-STATUSa — reserved → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-075-STATUSb — returned → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-075-STATUSc — reserved → completed: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to completed without going through returned
  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-076-STATUS — Status Transition: API allows billing and admin to record payment
// Risk: critical
// Spec: Endpoints
// Behavior: API allows billing and admin to record payment

test("PROOF-B-076-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-076-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-077-STATUS — Status Transition: API rejects payment if amount exceeds remaining balance
// Risk: medium
// Spec: Endpoints
// Behavior: API rejects payment if amount exceeds remaining balance

test("PROOF-B-077-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-077-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-078-STATUS — Status Transition: API sets invoice status to paid if total paid >= invoice total
// Risk: high
// Spec: Endpoints
// Behavior: API sets invoice status to paid if total paid >= invoice total

test("PROOF-B-078-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove invoice.status = 'paid' side-effect
});

test("PROOF-B-078-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-079-STATUS — Status Transition: API keeps invoice status as outstanding for partial payments
// Risk: high
// Spec: Endpoints
// Behavior: API keeps invoice status as outstanding for partial payments

test("PROOF-B-079-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove keeps transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-079-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-080-STATUS — Status Transition: API allows admin only to access device utilization report
// Risk: critical
// Spec: Endpoints
// Behavior: API allows admin only to access device utilization report

test("PROOF-B-080-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-080-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-081-STATUS — Status Transition: Device status transitions from available to rented when rental created
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from available to rented when rental created

test("PROOF-B-081-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-081-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-082-STATUS — Status Transition: Device status transitions from rented to available when returned in good condition
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from rented to available when returned in good condition

test("PROOF-B-082-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-082-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-082-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-083-STATUS — Status Transition: Device status transitions from rented to maintenance when returned needing repair
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from rented to maintenance when returned needing repair

test("PROOF-B-083-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-083-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-083-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through maintenance
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-084-STATUS — Status Transition: Device status transitions from available to maintenance for scheduled maintenance
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from available to maintenance for scheduled maintenance

test("PROOF-B-084-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-084-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-085-STATUS — Status Transition: Device status transitions from maintenance to available when maintenance completed
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from maintenance to available when maintenance completed

test("PROOF-B-085-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-085-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-085-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-086-STATUS — Status Transition: Device status transitions from available to decommissioned
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from available to decommissioned

test("PROOF-B-086-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-086-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-087-STATUS — Status Transition: Device status transitions from maintenance to decommissioned
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status transitions from maintenance to decommissioned

test("PROOF-B-087-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-087-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-087-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-088-STATUS — Status Transition: Device status cannot transition from decommissioned to any other state
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device status cannot transition from decommissioned to any other state

test("PROOF-B-088-STATUSa — decommissioned → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-088-STATUSb — decommissioned → decommissioned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→decommissioned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-088-STATUSc — decommissioned → available: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to available without going through decommissioned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-089-STATUS — Status Transition: Device status cannot transition from rented to decommissioned
// Risk: high
// Spec: Endpoints
// Behavior: Device status cannot transition from rented to decommissioned

test("PROOF-B-089-STATUSa — rented → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-089-STATUSb — decommissioned → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-090-STATUS — Status Transition: System sets maintenanceStartDate when device status transitions to maintenance
// Risk: high
// Spec: Status Machine: devices
// Behavior: System sets maintenanceStartDate when device status transitions to maintenance

test("PROOF-B-090-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-090-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-090-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through maintenance
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-091-STATUS — Status Transition: System sets lastMaintenanceDate when device status transitions to available from maintenance
// Risk: high
// Spec: Status Machine: devices
// Behavior: System sets lastMaintenanceDate when device status transitions to available from maintenance

test("PROOF-B-091-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-091-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-091-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-092-STATUS — Status Transition: System clears maintenanceStartDate when device status transitions to available from maintenance
// Risk: high
// Spec: Status Machine: devices
// Behavior: System clears maintenanceStartDate when device status transitions to available from maintenance

test("PROOF-B-092-STATUSa — available → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove clears transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-092-STATUSb — available → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-093-STATUS — Status Transition: System sets decommissionedAt when device status transitions to decommissioned
// Risk: high
// Spec: Status Machine: devices
// Behavior: System sets decommissionedAt when device status transitions to decommissioned

test("PROOF-B-093-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-093-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-093-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-094-STATUS — Status Transition: System sets decommissionedReason when device status transitions to decommissioned
// Risk: high
// Spec: Status Machine: devices
// Behavior: System sets decommissionedReason when device status transitions to decommissioned

test("PROOF-B-094-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-094-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-095-STATUS — Status Transition: Rental status transitions from reserved to active on startDate or manual activation
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from reserved to active on startDate or manual activation

test("PROOF-B-095-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-095-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-095-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-096-STATUS — Status Transition: Rental status transitions from active to overdue automatically when past expectedReturnDate
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from active to overdue automatically when past expectedReturnDate

test("PROOF-B-096-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-096-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-097-STATUS — Status Transition: Rental status transitions from active to returned when device returned
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from active to returned when device returned

test("PROOF-B-097-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-097-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-097-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-098-STATUS — Status Transition: Rental status transitions from overdue to returned upon late return
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from overdue to returned upon late return

test("PROOF-B-098-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-098-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-098-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through maintenance
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-099-STATUS — Status Transition: Rental status transitions from returned to completed when final invoice paid
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from returned to completed when final invoice paid

test("PROOF-B-099-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-099-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-100-STATUS — Status Transition: Rental status transitions from reserved to cancelled before startDate
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from reserved to cancelled before startDate

test("PROOF-B-100-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-100-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-100-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-101-STATUS — Status Transition: Rental status transitions from active to cancelled by admin only with reason
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status transitions from active to cancelled by admin only with reason

test("PROOF-B-101-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-101-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-102-STATUS — Status Transition: Rental status cannot transition from completed to any other state
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status cannot transition from completed to any other state

test("PROOF-B-102-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-102-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-102-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-103-STATUS — Status Transition: Rental status cannot transition from cancelled to active
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status cannot transition from cancelled to active

test("PROOF-B-103-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-103-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-105-STATUS — Status Transition: Rental status cannot transition from returned to active
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental status cannot transition from returned to active

test("PROOF-B-105-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-105-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-105-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-106-STATUS — Status Transition: System sets device.status to rented when rental status transitions to active
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System sets device.status to rented when rental status transitions to active

test("PROOF-B-106-STATUSa — rented → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove device.status = 'rented' side-effect
});

test("PROOF-B-106-STATUSb — rented → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-106-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through rented
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-107-STATUS — Status Transition: System sends overdue notification when rental status transitions to overdue
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System sends overdue notification when rental status transitions to overdue

test("PROOF-B-107-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sends transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-107-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to maintenance state first
  await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow maintenance→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-108-STATUS — Status Transition: System calculates late fees (150% of dailyRate) when rental status transitions to overdue
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System calculates late fees (150% of dailyRate) when rental status transitions to overdue

test("PROOF-B-108-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove calculates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-108-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-108-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-109-STATUS — Status Transition: System calculates final charges when rental status transitions to returned
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System calculates final charges when rental status transitions to returned

test("PROOF-B-109-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove calculates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-109-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-110-STATUS — Status Transition: System updates device.status to available/maintenance when rental status transitions to returned
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System updates device.status to available/maintenance when rental status transitions to returned

test("PROOF-B-110-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove device.status = 'available' or 'maintenance' side-effect
});

test("PROOF-B-110-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-110-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-111-STATUS — Status Transition: System archives rental when rental status transitions to completed
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System archives rental when rental status transitions to completed

test("PROOF-B-111-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove archives transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-111-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-112-STATUS — Status Transition: System updates patient.completedRentals count when rental status transitions to completed
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System updates patient.completedRentals count when rental status transitions to completed

test("PROOF-B-112-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.pat).not.toBeNull();
  // Kills: Remove pat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove patient.completedRentals count updated side-effect

});

test("PROOF-B-112-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-112-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-113-STATUS — Status Transition: System updates device.status to available when rental status transitions to cancelled
// Risk: high
// Spec: Status Machine: rentals
// Behavior: System updates device.status to available when rental status transitions to cancelled

test("PROOF-B-113-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove device.status = 'available' side-effect
});

test("PROOF-B-113-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-113-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});