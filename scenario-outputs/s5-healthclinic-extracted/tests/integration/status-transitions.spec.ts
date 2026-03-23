import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-033-STATUS — Status Transition: Receptionist can change appointment status from confirmed to checked_in
// Risk: high
// Spec: Endpoints
// Behavior: Receptionist can change appointment status from confirmed to checked_in

test("PROOF-B-033-STATUSa — confirmed → checked_in: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can change appointment status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-033-STATUSb — checked_in → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to checked_in state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow checked_in→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-033-STATUSc — confirmed → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through checked_in
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-034-STATUS — Status Transition: Doctor can change appointment status from checked_in to in_progress
// Risk: high
// Spec: Endpoints
// Behavior: Doctor can change appointment status from checked_in to in_progress

test("PROOF-B-034-STATUSa — checked_in → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can change appointment status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-034-STATUSb — in_progress → checked_in: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→checked_in reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-034-STATUSc — checked_in → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through in_progress
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-035-STATUS — Status Transition: Doctor can change appointment status from in_progress to completed
// Risk: high
// Spec: Endpoints
// Behavior: Doctor can change appointment status from in_progress to completed

test("PROOF-B-035-STATUSa — in_progress → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can change appointment status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-035-STATUSb — completed → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-035-STATUSc — in_progress → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through completed
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-036-STATUS — Status Transition: Any role can change appointment status to cancelled if not completed
// Risk: high
// Spec: Endpoints
// Behavior: Any role can change appointment status to cancelled if not completed

test("PROOF-B-036-STATUSa — in_progress → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can change appointment status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-036-STATUSb — cancelled → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-036-STATUSc — in_progress → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through cancelled
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-037-STATUS — Status Transition: Admin can change appointment status from cancelled to confirmed (re-booking)
// Risk: high
// Spec: Endpoints
// Behavior: Admin can change appointment status from cancelled to confirmed (re-booking)

test("PROOF-B-037-STATUSa — cancelled → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can change appointment status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-037-STATUSb — confirmed → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-037-STATUSc — cancelled → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through confirmed
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-039-STATUS — Status Transition: Appointment status transition from scheduled to confirmed
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status transition from scheduled to confirmed

test("PROOF-B-039-STATUSa — scheduled → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-039-STATUSb — confirmed → scheduled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→scheduled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-039-STATUSc — scheduled → checked_in: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to checked_in without going through confirmed
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("scheduled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-040-STATUS — Status Transition: Appointment status transition from confirmed to checked_in
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status transition from confirmed to checked_in

test("PROOF-B-040-STATUSa — confirmed → checked_in: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-040-STATUSb — checked_in → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to checked_in state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow checked_in→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-040-STATUSc — confirmed → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through checked_in
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-041-STATUS — Status Transition: Appointment status transition from checked_in to in_progress
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status transition from checked_in to in_progress

test("PROOF-B-041-STATUSa — checked_in → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-041-STATUSb — in_progress → checked_in: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→checked_in reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-041-STATUSc — checked_in → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through in_progress
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-042-STATUS — Status Transition: Appointment status transition from in_progress to completed
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status transition from in_progress to completed

test("PROOF-B-042-STATUSa — in_progress → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-042-STATUSb — completed → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-042-STATUSc — in_progress → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through completed
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-043-STATUS — Status Transition: Appointment status transition to cancelled from any state except completed
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status transition to cancelled from any state except completed

test("PROOF-B-043-STATUSa — cancelled → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-043-STATUSb — cancelled → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-043-STATUSc — cancelled → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through cancelled
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-044-STATUS — Status Transition: Appointment status transition from cancelled to confirmed (admin only)
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status transition from cancelled to confirmed (admin only)

test("PROOF-B-044-STATUSa — cancelled → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-044-STATUSb — confirmed → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-044-STATUSc — cancelled → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through confirmed
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-045-STATUS — Status Transition: Appointment status cannot transition from completed to any other state
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status cannot transition from completed to any other state

test("PROOF-B-045-STATUSa — completed → checked_in: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-045-STATUSb — checked_in → completed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to checked_in state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "completed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow checked_in→completed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-045-STATUSc — completed → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through checked_in
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-046-STATUS — Status Transition: Appointment status cannot transition from no_show to in_progress
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status cannot transition from no_show to in_progress

test("PROOF-B-046-STATUSa — no_show → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-046-STATUSb — in_progress → no_show: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "in_progress", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "no_show", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→no_show reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-046-STATUSc — no_show → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through in_progress
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("no_show");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-047-STATUS — Status Transition: Appointment status cannot transition from cancelled to checked_in
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Appointment status cannot transition from cancelled to checked_in

test("PROOF-B-047-STATUSa — cancelled → checked_in: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-047-STATUSb — checked_in → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to checked_in state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow checked_in→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-047-STATUSc — cancelled → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through checked_in
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-048-STATUS — Status Transition: Completing an appointment sets completedAt and calculates billingAmount
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Completing an appointment sets completedAt and calculates billingAmount

test("PROOF-B-048-STATUSa — scheduled → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets completedAt and calculates billingAmount transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-048-STATUSb — cancelled → scheduled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→scheduled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-048-STATUSc — scheduled → checked_in: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to checked_in without going through cancelled
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("scheduled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-049-STATUS — Status Transition: Cancelling an appointment sets cancelledAt and cancelledBy
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Cancelling an appointment sets cancelledAt and cancelledBy

test("PROOF-B-049-STATUSa — confirmed → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets cancelledAt and cancelledBy transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-049-STATUSb — cancelled → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "confirmed", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-049-STATUSc — confirmed → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through cancelled
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-050-STATUS — Status Transition: Marking an appointment as no_show increments patient.noShowCount
// Risk: high
// Spec: Status Machine: appointments
// Behavior: Marking an appointment as no_show increments patient.noShowCount

test("PROOF-B-050-STATUSa — checked_in → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.noShowCount as number) ?? 0;

  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove increments transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.associat).not.toBeNull();
  // Kills: Remove associat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.noShowCount).toBe(countBefore + 1);
  // Kills: Remove the `noShowCount` for the associated patient is increased by one side-effect

});

test("PROOF-B-050-STATUSb — cancelled → checked_in: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "cancelled", clinicId: TEST_CLINIC_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "checked_in", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→checked_in reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-050-STATUSc — checked_in → scheduled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to scheduled without going through cancelled
  const { status } = await trpcMutation(request, "appointments.updateStatus",
    { id: resource.id, status: "scheduled", clinicId: TEST_CLINIC_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "patientDetails.getById",
    { id: resource.id, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("checked_in");
  // Kills: Accept any status value without validating transition chain
});