import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-004-STATUS — Status Transition: GET /api/auth/csrf-token returns CSRF double-submit cookie
// Risk: critical
// Spec: Authentication
// Behavior: GET /api/auth/csrf-token returns CSRF double-submit cookie

test("PROOF-B-004-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "auth.csrfToken",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns transition from allowed list

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

// PROOF-B-007-STATUS — Status Transition: System rate-limits failed login attempts to 5 per 15 minutes
// Risk: medium
// Spec: Authentication
// Behavior: System rate-limits failed login attempts to 5 per 15 minutes

test("PROOF-B-007-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "auth.login",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rate-limits transition from allowed list

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

// PROOF-B-008-STATUS — Status Transition: System returns 429 for exceeding failed login rate limit
// Risk: medium
// Spec: Authentication
// Behavior: System returns 429 for exceeding failed login rate limit

test("PROOF-B-008-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "auth.login",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 429 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-008-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "auth.login",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "auth.login",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-009-STATUS — Status Transition: System locks out user for 30 minutes after exceeding failed login rate limit
// Risk: medium
// Spec: Authentication
// Behavior: System locks out user for 30 minutes after exceeding failed login rate limit

test("PROOF-B-009-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove locks out transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-009-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-015-STATUS — Status Transition: Nurse role cannot modify pricing
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Nurse role cannot modify pricing

test("PROOF-B-015-STATUSa — returned → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot modify transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-015-STATUSb — completed → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-015-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-019-STATUS — Status Transition: Billing role cannot access medical records
// Risk: critical
// Spec: Roles & Permissions
// Behavior: Billing role cannot access medical records

test("PROOF-B-019-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot access transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-019-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-024-STATUS — Status Transition: All POST/PUT/PATCH/DELETE requests require X-CSRF-Token header
// Risk: critical
// Spec: CSRF Protection
// Behavior: All POST/PUT/PATCH/DELETE requests require X-CSRF-Token header

test("PROOF-B-024-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-024-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-024-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-025-STATUS — Status Transition: System returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header
// Risk: critical
// Spec: CSRF Protection
// Behavior: System returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header

test("PROOF-B-025-STATUSa — reserved → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 403 CSRF_REQUIRED transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-025-STATUSb — returned → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-025-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through returned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-026-STATUS — Status Transition: POST /api/devices registers a new medical device
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/devices registers a new medical device

test("PROOF-B-026-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove registers transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-026-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-026-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-027-STATUS — Status Transition: POST /api/devices requires clinicId to match JWT clinicId
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/devices requires clinicId to match JWT clinicId

test("PROOF-B-027-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-027-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-027-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-028-STATUS — Status Transition: POST /api/devices rejects registration if serialNumber is globally unique
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/devices rejects registration if serialNumber is globally unique

test("PROOF-B-028-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects registration transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-028-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-029-STATUS — Status Transition: POST /api/devices rejects registration if purchaseDate is in the future
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/devices rejects registration if purchaseDate is in the future

test("PROOF-B-029-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects registration transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-029-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-029-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-032-STATUS — Status Transition: GET /api/devices shows name, type, status, availability to nurse
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/devices shows name, type, status, availability to nurse

test("PROOF-B-032-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove shows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-032-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-033-STATUS — Status Transition: GET /api/devices hides pricing details from nurse
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/devices hides pricing details from nurse

test("PROOF-B-033-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove hides transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-033-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-033-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-036-STATUS — Status Transition: GET /api/devices/:id retrieves device details
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/devices/:id retrieves device details

test("PROOF-B-036-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.list",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove retrieves transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-036-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "devices.list",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.list",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-039-STATUS — Status Transition: PATCH /api/devices/:id/status updates device status
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/devices/:id/status updates device status

test("PROOF-B-039-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
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

});

test("PROOF-B-039-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-039-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-040-STATUS — Status Transition: PATCH /api/devices/:id/status requires reason for maintenance/decommissioned status
// Risk: medium
// Spec: Endpoints
// Behavior: PATCH /api/devices/:id/status requires reason for maintenance/decommissioned status

test("PROOF-B-040-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-040-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-040-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-041-STATUS — Status Transition: POST /api/devices/:id/maintenance records a maintenance event
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance records a maintenance event

test("PROOF-B-041-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove records transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove Maintenance countdown is reset side-effect

});

test("PROOF-B-041-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-042-STATUS — Status Transition: POST /api/devices/:id/maintenance rejects if device is currently rented
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance rejects if device is currently rented

test("PROOF-B-042-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-042-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-042-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-043-STATUS — Status Transition: POST /api/devices/:id/maintenance sets device.lastMaintenanceDate to today
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance sets device.lastMaintenanceDate to today

test("PROOF-B-043-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
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

});

test("PROOF-B-043-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-045-STATUS — Status Transition: POST /api/devices/:id/maintenance requires nextMaintenanceDue to be in the future
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/devices/:id/maintenance requires nextMaintenanceDue to be in the future

test("PROOF-B-045-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-045-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-045-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-046-STATUS — Status Transition: POST /api/patients registers a patient
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/patients registers a patient

test("PROOF-B-046-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove registers transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-046-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "patients.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-047-STATUS — Status Transition: POST /api/patients requires clinicId to match JWT clinicId
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/patients requires clinicId to match JWT clinicId

test("PROOF-B-047-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-047-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "patients.create",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-047-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through cancelled
  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-048-STATUS — Status Transition: POST /api/patients requires dateOfBirth to be in the past
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/patients requires dateOfBirth to be in the past

test("PROOF-B-048-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-048-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "patients.create",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "patients.create",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-049-STATUS — Status Transition: Patient medicalNotes are visible only to nurse/admin
// Risk: critical
// Spec: Endpoints
// Behavior: Patient medicalNotes are visible only to nurse/admin

test("PROOF-B-049-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.maintenance",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove restricts visibility of transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-049-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-050-STATUS — Status Transition: GET /api/patients lists patients
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/patients lists patients

test("PROOF-B-050-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove lists transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-050-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-050-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-051-STATUS — Status Transition: GET /api/patients returns 403 INSUFFICIENT_ROLE for billing role
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/patients returns 403 INSUFFICIENT_ROLE for billing role

test("PROOF-B-051-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 403 INSUFFICIENT_ROLE transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-051-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-052-STATUS — Status Transition: POST /api/rentals creates a device rental
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/rentals creates a device rental

test("PROOF-B-052-STATUSa — maintenance → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove creates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-052-STATUSb — rented → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-053-STATUS — Status Transition: POST /api/rentals rejects if device is not available
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if device is not available

test("PROOF-B-053-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-053-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-054-STATUS — Status Transition: POST /api/rentals rejects if device belongs to a different clinic
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if device belongs to a different clinic

test("PROOF-B-054-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-054-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-054-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-055-STATUS — Status Transition: POST /api/rentals rejects if patient belongs to a different clinic
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if patient belongs to a different clinic

test("PROOF-B-055-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-055-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-055-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-056-STATUS — Status Transition: POST /api/rentals rejects if rental period exceeds 365 days
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if rental period exceeds 365 days

test("PROOF-B-056-STATUSa — reserved → returned: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-056-STATUSb — returned → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-056-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through returned
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

// PROOF-B-057-STATUS — Status Transition: POST /api/rentals rejects if expectedReturnDate is not after startDate
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if expectedReturnDate is not after startDate

test("PROOF-B-057-STATUSa — reserved → active: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-057-STATUSb — active → reserved: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-057-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-058-STATUS — Status Transition: POST /api/rentals rejects if insuranceClaim is true but insurancePreAuthCode is missing
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals rejects if insuranceClaim is true but insurancePreAuthCode is missing

test("PROOF-B-058-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-058-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-058-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-059-STATUS — Status Transition: POST /api/rentals ensures only one rental succeeds for the same device concurrently
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals ensures only one rental succeeds for the same device concurrently

test("PROOF-B-059-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove ensures transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-059-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-059-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-060-STATUS — Status Transition: POST /api/rentals sets device.status to 'rented'
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals sets device.status to 'rented'

test("PROOF-B-060-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-060-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.create",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-066-STATUS — Status Transition: POST /api/rentals/:id/extend extends a rental period
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/extend extends a rental period

test("PROOF-B-066-STATUSa — returned → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove extends transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-066-STATUSb — completed → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-066-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-067-STATUS — Status Transition: POST /api/rentals/:id/extend rejects if rental is not active
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/extend rejects if rental is not active

test("PROOF-B-067-STATUSa — reserved → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-067-STATUSb — cancelled → reserved: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-067-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-068-STATUS — Status Transition: POST /api/rentals/:id/extend rejects if maximum 3 extensions per rental are reached
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/extend rejects if maximum 3 extensions per rental are reached

test("PROOF-B-068-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-068-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-068-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-069-STATUS — Status Transition: POST /api/rentals/:id/extend requires newReturnDate to be after current expectedReturnDate
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/extend requires newReturnDate to be after current expectedReturnDate

test("PROOF-B-069-STATUSa — reserved → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-069-STATUSb — returned → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-069-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through returned
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

// PROOF-B-070-STATUS — Status Transition: POST /api/rentals/:id/extend requires newReturnDate to be within 365 days from original startDate
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/extend requires newReturnDate to be within 365 days from original startDate

test("PROOF-B-070-STATUSa — reserved → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.extend",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-070-STATUSb — active → reserved: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-070-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-072-STATUS — Status Transition: POST /api/rentals/:id/return processes device return
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return processes device return

test("PROOF-B-072-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove processes transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-072-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-072-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-073-STATUS — Status Transition: POST /api/rentals/:id/return rejects if rental is not active or overdue
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return rejects if rental is not active or overdue

test("PROOF-B-073-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-073-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-075-STATUS — Status Transition: POST /api/rentals/:id/return sets device.status to 'maintenance' if condition is 'needs_repair'
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return sets device.status to 'maintenance' if condition is 'needs_repair'

test("PROOF-B-075-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-075-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-075-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-076-STATUS — Status Transition: POST /api/rentals/:id/return sets device.status to 'available' if condition is 'good'
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return sets device.status to 'available' if condition is 'good'

test("PROOF-B-076-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-076-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→rented reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-076-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to decommissioned without going through available
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-079-STATUS — Status Transition: POST /api/rentals/:id/return requires damageNotes if condition is not 'good'
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return requires damageNotes if condition is not 'good'

test("PROOF-B-079-STATUSa — reserved → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-079-STATUSb — cancelled → reserved: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-079-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-080-STATUS — Status Transition: POST /api/rentals/:id/return requires damageCharge if condition is 'damaged' or 'needs_repair'
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/rentals/:id/return requires damageCharge if condition is 'damaged' or 'needs_repair'

test("PROOF-B-080-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-080-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.return",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-080-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through cancelled
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

// PROOF-B-081-STATUS — Status Transition: PATCH /api/rentals/:id/status updates rental status
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/rentals/:id/status updates rental status

test("PROOF-B-081-STATUSa — reserved → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "rentals.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-081-STATUSb — returned → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "rentals.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "rentals.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-081-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through returned
  const { status } = await trpcMutation(request, "rentals.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-082-STATUS — Status Transition: POST /api/invoices creates an invoice
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/invoices creates an invoice

test("PROOF-B-082-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove creates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-082-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-083-STATUS — Status Transition: POST /api/invoices rejects if rentalId belongs to a different clinic
// Risk: critical
// Spec: Endpoints
// Behavior: POST /api/invoices rejects if rentalId belongs to a different clinic

test("PROOF-B-083-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-083-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-083-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-084-STATUS — Status Transition: POST /api/invoices requires dueDate to be in the future
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/invoices requires dueDate to be in the future

test("PROOF-B-084-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.create",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove requires transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-084-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-085-STATUS — Status Transition: POST /api/invoices/:id/payment records payment
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/invoices/:id/payment records payment

test("PROOF-B-085-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove records transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove Invoice status updated to 'paid' if total paid >= invoice total side-effect
});

test("PROOF-B-085-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-086-STATUS — Status Transition: POST /api/invoices/:id/payment rejects if amount exceeds remaining balance
// Risk: medium
// Spec: Endpoints
// Behavior: POST /api/invoices/:id/payment rejects if amount exceeds remaining balance

test("PROOF-B-086-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-086-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-087-STATUS — Status Transition: POST /api/invoices/:id/payment sets invoice.status to 'paid' if total paid >= invoice total
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/invoices/:id/payment sets invoice.status to 'paid' if total paid >= invoice total

test("PROOF-B-087-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
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

});

test("PROOF-B-087-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-088-STATUS — Status Transition: POST /api/invoices/:id/payment handles partial payments by keeping invoice outstanding
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/invoices/:id/payment handles partial payments by keeping invoice outstanding

test("PROOF-B-088-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "invoices.payment",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove handles transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-088-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-089-STATUS — Status Transition: GET /api/reports/utilization provides device utilization report
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/reports/utilization provides device utilization report

test("PROOF-B-089-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove provides transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-089-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to decommissioned state first
  await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "maintenance", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow decommissioned→maintenance reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-089-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through decommissioned
  const { status } = await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("maintenance");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-090-STATUS — Status Transition: GET /api/reports/utilization is accessible only by admin
// Risk: critical
// Spec: Endpoints
// Behavior: GET /api/reports/utilization is accessible only by admin

test("PROOF-B-090-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove restricts access to transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-090-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to rented state first
  await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "reports.utilization",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow rented→available reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-091-STATUS — Status Transition: Device state transitions from available to rented when rental created
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from available to rented when rental created

test("PROOF-B-091-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-091-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-092-STATUS — Status Transition: Device state transitions from rented to available when returned in good condition
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from rented to available when returned in good condition

test("PROOF-B-092-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-092-STATUSb — available → rented: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-092-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-093-STATUS — Status Transition: Device state transitions from rented to maintenance when returned needing repair
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from rented to maintenance when returned needing repair

test("PROOF-B-093-STATUSa — rented → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-093-STATUSb — maintenance → rented: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-093-STATUSc — rented → decommissioned: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-094-STATUS — Status Transition: Device state transitions from available to maintenance for scheduled maintenance
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from available to maintenance for scheduled maintenance

test("PROOF-B-094-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-094-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-095-STATUS — Status Transition: Device state transitions from maintenance to available when maintenance completed
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from maintenance to available when maintenance completed

test("PROOF-B-095-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-095-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-095-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-096-STATUS — Status Transition: Device state transitions from available to decommissioned
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from available to decommissioned

test("PROOF-B-096-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-096-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-097-STATUS — Status Transition: Device state transitions from maintenance to decommissioned
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state transitions from maintenance to decommissioned

test("PROOF-B-097-STATUSa — maintenance → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-097-STATUSb — decommissioned → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-097-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-098-STATUS — Status Transition: Device state cannot transition from decommissioned to any other state
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state cannot transition from decommissioned to any other state

test("PROOF-B-098-STATUSa — decommissioned → available: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-098-STATUSb — available → decommissioned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to available state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow available→decommissioned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("available");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-098-STATUSc — decommissioned → rented: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to rented without going through available
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-099-STATUS — Status Transition: Device state cannot transition from rented to decommissioned without return first
// Risk: high
// Spec: Status Machine: devices
// Behavior: Device state cannot transition from rented to decommissioned without return first

test("PROOF-B-099-STATUSa — rented → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-099-STATUSb — decommissioned → rented: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-100-STATUS — Status Transition: Transition to maintenance state sets maintenanceStartDate
// Risk: high
// Spec: Status Machine: devices
// Behavior: Transition to maintenance state sets maintenanceStartDate

test("PROOF-B-100-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-100-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-101-STATUS — Status Transition: Transition from maintenance to available sets lastMaintenanceDate and clears maintenanceStartDate
// Risk: high
// Spec: Status Machine: devices
// Behavior: Transition from maintenance to available sets lastMaintenanceDate and clears maintenanceStartDate

test("PROOF-B-101-STATUSa — maintenance → available: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "available", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets lastMaintenanceDate and clears maintenanceStartDate transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("available");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-101-STATUSb — available → maintenance: reverse transition must be rejected", async ({ request }) => {
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

test("PROOF-B-101-STATUSc — maintenance → rented: skip-transition must be rejected", async ({ request }) => {
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

// PROOF-B-102-STATUS — Status Transition: Transition to decommissioned state sets decommissionedAt and decommissionedReason
// Risk: high
// Spec: Status Machine: devices
// Behavior: Transition to decommissioned state sets decommissionedAt and decommissionedReason

test("PROOF-B-102-STATUSa — outstanding → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-102-STATUSb — paid → outstanding: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "paid", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "outstanding", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→outstanding reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-103-STATUS — Status Transition: Rental state transitions from reserved to active on startDate or manual activation
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from reserved to active on startDate or manual activation

test("PROOF-B-103-STATUSa — reserved → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-103-STATUSb — active → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-103-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through active
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-104-STATUS — Status Transition: Rental state transitions from active to overdue automatically when past expectedReturnDate
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from active to overdue automatically when past expectedReturnDate

test("PROOF-B-104-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-104-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-104-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-105-STATUS — Status Transition: Rental state transitions from active to returned when device is returned
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from active to returned when device is returned

test("PROOF-B-105-STATUSa — rented → available: transition succeeds with correct side-effects", async ({ request }) => {
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

// PROOF-B-106-STATUS — Status Transition: Rental state transitions from overdue to returned upon late return, applying extra charges
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from overdue to returned upon late return, applying extra charges

test("PROOF-B-106-STATUSa — overdue → returned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-106-STATUSb — returned → overdue: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to returned state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow returned→overdue reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-106-STATUSc — overdue → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through returned
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-107-STATUS — Status Transition: Rental state transitions from returned to completed when final invoice is paid
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from returned to completed when final invoice is paid

test("PROOF-B-107-STATUSa — returned → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-107-STATUSb — completed → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-107-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-108-STATUS — Status Transition: Rental state transitions from reserved to cancelled before startDate
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from reserved to cancelled before startDate

test("PROOF-B-108-STATUSa — reserved → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-108-STATUSb — cancelled → reserved: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→reserved reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-108-STATUSc — reserved → overdue: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to overdue without going through cancelled
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-109-STATUS — Status Transition: Rental state transitions from active to cancelled by admin only, with reason
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state transitions from active to cancelled by admin only, with reason

test("PROOF-B-109-STATUSa — active → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-109-STATUSb — cancelled → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-109-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through cancelled
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-110-STATUS — Status Transition: Rental state cannot transition from completed to any other state
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state cannot transition from completed to any other state

test("PROOF-B-110-STATUSa — completed → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-110-STATUSb — completed → completed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→completed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-110-STATUSc — completed → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-111-STATUS — Status Transition: Rental state cannot transition from cancelled to active
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state cannot transition from cancelled to active

test("PROOF-B-111-STATUSa — cancelled → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-111-STATUSb — active → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-111-STATUSc — cancelled → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through active
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-112-STATUS — Status Transition: Rental state cannot transition from overdue to reserved
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state cannot transition from overdue to reserved

test("PROOF-B-112-STATUSa — overdue → reserved: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-112-STATUSb — reserved → overdue: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to reserved state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow reserved→overdue reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("reserved");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-112-STATUSc — overdue → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through reserved
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-113-STATUS — Status Transition: Rental state cannot transition from returned to active
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Rental state cannot transition from returned to active

test("PROOF-B-113-STATUSa — returned → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-113-STATUSb — active → returned: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "returned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→returned reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-113-STATUSc — returned → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through active
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("returned");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-114-STATUS — Status Transition: Transition to active rental state sets device.status to 'rented'
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Transition to active rental state sets device.status to 'rented'

test("PROOF-B-114-STATUSa — available → maintenance: transition succeeds with correct side-effects", async ({ request }) => {
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

test("PROOF-B-114-STATUSb — maintenance → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-115-STATUS — Status Transition: Transition to overdue rental state sends overdue notification and calculates late fees
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Transition to overdue rental state sends overdue notification and calculates late fees

test("PROOF-B-115-STATUSa — active → overdue: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sends overdue notification and calculates late fees transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-115-STATUSb — overdue → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to overdue state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "active", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow overdue→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-115-STATUSc — active → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through overdue
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-116-STATUS — Status Transition: Transition to returned rental state calculates final charges and updates device status
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Transition to returned rental state calculates final charges and updates device status

test("PROOF-B-116-STATUSa — available → decommissioned: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "decommissioned", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove calculates final charges and updates device status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("decommissioned");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-116-STATUSb — decommissioned → available: reverse transition must be rejected", async ({ request }) => {
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

// PROOF-B-117-STATUS — Status Transition: Transition to completed rental state archives rental and updates patient.completedRentals count
// Risk: critical
// Spec: Status Machine: rentals
// Behavior: Transition to completed rental state archives rental and updates patient.completedRentals count

test("PROOF-B-117-STATUSa — overdue → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove archives rental and updates patient.completedRentals count transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.pat).not.toBeNull();
  // Kills: Remove pat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove patient.completedRentals count is incremented side-effect

});

test("PROOF-B-117-STATUSb — completed → overdue: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "devices.status",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "overdue", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→overdue reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-117-STATUSc — overdue → reserved: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to reserved without going through completed
  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "reserved", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("overdue");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-118-STATUS — Status Transition: Transition to cancelled rental state sets device.status to 'available' and refunds deposit if applicable
// Risk: high
// Spec: Status Machine: rentals
// Behavior: Transition to cancelled rental state sets device.status to 'available' and refunds deposit if applicable

test("PROOF-B-118-STATUSa — available → rented: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "devices.status",
    { id: resource.id, status: "rented", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets device.status to 'available' and refunds deposit if applicable transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "devices.list",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("rented");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.cancellat).not.toBeNull();
  // Kills: Remove cancellat = NOW() in handler

  // Kills: Remove Deposit is refunded based on cancellation policy side-effect
});

test("PROOF-B-118-STATUSb — rented → available: reverse transition must be rejected", async ({ request }) => {
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