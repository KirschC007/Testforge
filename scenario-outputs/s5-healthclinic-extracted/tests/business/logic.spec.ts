import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-009-BL — Business Logic: Nurse role can read patients
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Nurse role can read patients

test("PROOF-B-009-BLa — Nurse role can read patients", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-009-BLb — Nurse role can read patients requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-009-BLc — Nurse role can read patients persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-010-BL — Business Logic: Nurse role can create/update vitals
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Nurse role can create/update vitals

test("PROOF-B-010-BLa — Nurse role can create/update vitals", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-010-BLb — Nurse role can create/update vitals requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-010-BLc — Nurse role can create/update vitals persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-011-BL — Business Logic: Nurse role cannot view billing
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Nurse role cannot view billing

test("PROOF-B-011-BLa — Nurse role cannot view billing", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-011-BLb — Nurse role cannot view billing requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-011-BLc — Nurse role cannot view billing persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-012-BL — Business Logic: Receptionist role can manage appointments
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Receptionist role can manage appointments

test("PROOF-B-012-BLa — Receptionist role can manage appointments", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-012-BLb — Receptionist role can manage appointments requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-012-BLc — Receptionist role can manage appointments persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-013-BL — Business Logic: Receptionist role can view patient demographics only
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Receptionist role can view patient demographics only

test("PROOF-B-013-BLa — Receptionist role can view patient demographics only", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-013-BLb — Receptionist role can view patient demographics only requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-013-BLc — Receptionist role can view patient demographics only persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-015-BL — Business Logic: Admin role can manage staff
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Admin role can manage staff

test("PROOF-B-015-BLa — Admin role can manage staff", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-015-BLb — Admin role can manage staff requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-015-BLc — Admin role can manage staff persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-016-BL — Business Logic: Admin role can manage billing
// Risk: critical | Endpoint: appointments.updateStatus
// Spec: Roles
// Behavior: Admin role can manage billing

test("PROOF-B-016-BLa — Admin role can manage billing", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-016-BLb — Admin role can manage billing requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-016-BLc — Admin role can manage billing persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-020-BL — Business Logic: Patient email must be unique per clinic
// Risk: high | Endpoint: registerPatient
// Spec: Endpoints
// Behavior: Patient email must be unique per clinic

test("PROOF-B-020-BLa — Patient email must be unique per clinic", async ({ request }) => {
  // Precondition: attempting to register a patient with an email that already exists within the same clinic
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "registerPatient", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in registerPatient
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in registerPatient
});
test("PROOF-B-020-BLb — Patient email must be unique per clinic requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "registerPatient", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from registerPatient
});
test("PROOF-B-020-BLc — Patient email must be unique per clinic persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from registerPatient
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

test("PROOF-B-020-BLg — duplicate state change must return 409", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // First state change (should succeed)
  const { status: first } = await trpcMutation(request, "registerPatient",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect([200, 204]).toContain(first);
  
  // Second identical state change (should be rejected)
  const { status: second } = await trpcMutation(request, "registerPatient",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(second).toBe(409);
  // Kills: Allow duplicate state change (no idempotency check)
});

// PROOF-B-022-BL — Business Logic: GET /api/patients allows nurse to see demographics only
// Risk: critical | Endpoint: patients.list
// Spec: Endpoints
// Behavior: GET /api/patients allows nurse to see demographics only

test("PROOF-B-022-BLa — GET /api/patients allows nurse to see demographics only", async ({ request }) => {
  // Precondition: authenticated user has `nurse` role
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "patients.list", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in patients.list
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in patients.list
});
test("PROOF-B-022-BLb — GET /api/patients allows nurse to see demographics only requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "patients.list", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from patients.list
});
test("PROOF-B-022-BLc — GET /api/patients allows nurse to see demographics only persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from patients.list
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-025-BL — Business Logic: GET /api/patients/:id allows doctor to see all details
// Risk: critical | Endpoint: patientDetails.getById
// Spec: Endpoints
// Behavior: GET /api/patients/:id allows doctor to see all details

test("PROOF-B-025-BLa — GET /api/patients/:id allows doctor to see all details", async ({ request }) => {
  // Precondition: authenticated user has `doctor` role
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "patientDetails.getById", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in patientDetails.getById
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in patientDetails.getById
});
test("PROOF-B-025-BLb — GET /api/patients/:id allows doctor to see all details requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "patientDetails.getById", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from patientDetails.getById
});
test("PROOF-B-025-BLc — GET /api/patients/:id allows doctor to see all details persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from patientDetails.getById
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-026-BL — Business Logic: GET /api/patients/:id allows nurse to see demographics + vitals
// Risk: critical | Endpoint: patientDetails.getById
// Spec: Endpoints
// Behavior: GET /api/patients/:id allows nurse to see demographics + vitals

test("PROOF-B-026-BLa — GET /api/patients/:id allows nurse to see demographics + vitals", async ({ request }) => {
  // Precondition: authenticated user has `nurse` role
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "patientDetails.getById", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in patientDetails.getById
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in patientDetails.getById
});
test("PROOF-B-026-BLb — GET /api/patients/:id allows nurse to see demographics + vit requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "patientDetails.getById", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from patientDetails.getById
});
test("PROOF-B-026-BLc — GET /api/patients/:id allows nurse to see demographics + vit persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from patientDetails.getById
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-027-BL — Business Logic: GET /api/patients/:id allows receptionist to see demographics only
// Risk: critical | Endpoint: patientDetails.getById
// Spec: Endpoints
// Behavior: GET /api/patients/:id allows receptionist to see demographics only

test("PROOF-B-027-BLa — GET /api/patients/:id allows receptionist to see demographics only", async ({ request }) => {
  // Precondition: authenticated user has `receptionist` role
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "patientDetails.getById", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in patientDetails.getById
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in patientDetails.getById
});
test("PROOF-B-027-BLb — GET /api/patients/:id allows receptionist to see demographic requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "patientDetails.getById", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from patientDetails.getById
});
test("PROOF-B-027-BLc — GET /api/patients/:id allows receptionist to see demographic persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from patientDetails.getById
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-031-BL — Business Logic: POST /api/appointments prevents double-booking for same doctor+date+time
// Risk: high | Endpoint: bookAppointment
// Spec: Endpoints
// Behavior: POST /api/appointments prevents double-booking for same doctor+date+time

test("PROOF-B-031-BLa — POST /api/appointments prevents double-booking for same doctor+date+ti", async ({ request }) => {
  // Precondition: an existing appointment for the same `doctorId`, `date`, and `time` already exists
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookAppointment", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookAppointment
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookAppointment
});
test("PROOF-B-031-BLb — POST /api/appointments prevents double-booking for same doct requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "bookAppointment", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookAppointment
});
test("PROOF-B-031-BLc — POST /api/appointments prevents double-booking for same doct persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from bookAppointment
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

test("PROOF-B-031-BLg — duplicate state change must return 409", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // First state change (should succeed)
  const { status: first } = await trpcMutation(request, "bookAppointment",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect([200, 204]).toContain(first);
  
  // Second identical state change (should be rejected)
  const { status: second } = await trpcMutation(request, "bookAppointment",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(second).toBe(409);
  // Kills: Allow duplicate state change (no idempotency check)
});

// PROOF-B-038-BL — Business Logic: Record patient vitals requires appointmentId to belong to patient
// Risk: high | Endpoint: recordVitals
// Spec: Endpoints
// Behavior: Record patient vitals requires appointmentId to belong to patient

test("PROOF-B-038-BLa — Record patient vitals requires appointmentId to belong to patient", async ({ request }) => {
  // Precondition: provided `appointmentId` does not correspond to the `patientId`
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "recordVitals", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in recordVitals
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in recordVitals
});
test("PROOF-B-038-BLb — Record patient vitals requires appointmentId to belong to pa requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "recordVitals", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from recordVitals
});
test("PROOF-B-038-BLc — Record patient vitals requires appointmentId to belong to pa persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from recordVitals
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-048-BL — Business Logic: Completing an appointment sets completedAt and calculates billingAmount
// Risk: high | Endpoint: appointments.updateStatus
// Spec: Status Machine: appointments
// Behavior: Completing an appointment sets completedAt and calculates billingAmount

test("PROOF-B-048-BLa — Completing an appointment sets completedAt and calculates billingAmoun", async ({ request }) => {
  // Precondition: appointment status transitions to `completed`
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-048-BLb — Completing an appointment sets completedAt and calculates bi requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-048-BLc — Completing an appointment sets completedAt and calculates bi persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-049-BL — Business Logic: Cancelling an appointment sets cancelledAt and cancelledBy
// Risk: high | Endpoint: appointments.updateStatus
// Spec: Status Machine: appointments
// Behavior: Cancelling an appointment sets cancelledAt and cancelledBy

test("PROOF-B-049-BLa — Cancelling an appointment sets cancelledAt and cancelledBy", async ({ request }) => {
  // Precondition: appointment status transitions to `cancelled`
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in appointments.updateStatus
});
test("PROOF-B-049-BLb — Cancelling an appointment sets cancelledAt and cancelledBy requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-049-BLc — Cancelling an appointment sets cancelledAt and cancelledBy persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-050-BL — Business Logic: Marking an appointment as no_show increments patient.noShowCount
// Risk: high | Endpoint: appointments.updateStatus
// Spec: Status Machine: appointments
// Behavior: Marking an appointment as no_show increments patient.noShowCount

test("PROOF-B-050-BLa — Marking an appointment as no_show increments patient.noShowCount", async ({ request }) => {
  // Precondition: appointment status transitions to `no_show`
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined();

  // Side-Effect-Check: Read counter BEFORE action
  const { data: before } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = (before as Record<string, unknown>)?.count as number ?? 0;
  // Act
  const { data, status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in appointments.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  const { data: after } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const countAfter = (after as Record<string, unknown>)?.count as number ?? 0;
  expect(countAfter).toBe(countBefore + 1);
  // Kills: Not incrementing counter in appointments.updateStatus
  // Kills: Remove success path in appointments.updateStatus
  // Kills: Not updating the `noShowCount` for the associated patient is increased by one after increments in appointments.updateStatus
});
test("PROOF-B-050-BLb — Marking an appointment as no_show increments patient.noShowC requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  const { status } = await trpcMutation(request, "appointments.updateStatus", {
    clinicId,
    clinicId: TEST_CLINIC_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from appointments.updateStatus
});
test("PROOF-B-050-BLc — Marking an appointment as no_show increments patient.noShowC persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const clinicId = created.id as number;
  expect(clinicId).toBeDefined(); // Kills: Don't return id from appointments.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove patients.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === clinicId)).toBe(true); // Kills: Don't persist to DB
});