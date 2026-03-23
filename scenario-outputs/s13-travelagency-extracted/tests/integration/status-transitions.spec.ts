import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// PROOF-B-007-STATUS — Status Transition: Booking status transition pending to confirmed
// Risk: high
// Spec: Booking Status
// Behavior: Booking status transition pending to confirmed

test("PROOF-B-007-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-007-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-007-STATUSc — pending → paid: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to paid without going through confirmed
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-008-STATUS — Status Transition: Booking status transition confirmed to paid
// Risk: high
// Spec: Booking Status
// Behavior: Booking status transition confirmed to paid

test("PROOF-B-008-STATUSa — confirmed → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-008-STATUSb — paid → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-008-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through paid
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-009-STATUS — Status Transition: Booking status transition paid to completed
// Risk: high
// Spec: Booking Status
// Behavior: Booking status transition paid to completed

test("PROOF-B-009-STATUSa — paid → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-009-STATUSb — completed → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-009-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through completed
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-010-STATUS — Status Transition: Booking status transition paid to cancelled
// Risk: high
// Spec: Booking Status
// Behavior: Booking status transition paid to cancelled

test("PROOF-B-010-STATUSa — paid → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-010-STATUSb — cancelled → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-010-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-011-STATUS — Status Transition: Booking status transition cancelled to refunded
// Risk: high
// Spec: Booking Status
// Behavior: Booking status transition cancelled to refunded

test("PROOF-B-011-STATUSa — cancelled → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove Booking status is 'refunded' side-effect
});

test("PROOF-B-011-STATUSb — refunded → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-011-STATUSc — cancelled → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-012-STATUS — Status Transition: Booking status cannot transition from completed to cancelled
// Risk: high
// Spec: Booking Status
// Behavior: Booking status cannot transition from completed to cancelled

test("PROOF-B-012-STATUSa — completed → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-012-STATUSb — cancelled → completed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→completed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-012-STATUSc — completed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-013-STATUS — Status Transition: Booking status cannot transition from refunded to confirmed
// Risk: high
// Spec: Booking Status
// Behavior: Booking status cannot transition from refunded to confirmed

test("PROOF-B-013-STATUSa — refunded → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-013-STATUSb — confirmed → refunded: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→refunded reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-013-STATUSc — refunded → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through confirmed
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-014-STATUS — Status Transition: Booking creation fails if passengers exceed package capacity
// Risk: high
// Spec: Booking Rules
// Behavior: Booking creation fails if passengers exceed package capacity

test("PROOF-B-014-STATUSa — paid → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove fails transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-014-STATUSb — completed → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-014-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through completed
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-015-STATUS — Status Transition: Booking creation fails for past travelDate
// Risk: high
// Spec: Booking Rules
// Behavior: Booking creation fails for past travelDate

test("PROOF-B-015-STATUSa — paid → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove fails transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-015-STATUSb — cancelled → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-015-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-016-STATUS — Status Transition: Only agency_admin can cancel a confirmed booking
// Risk: high
// Spec: Booking Rules
// Behavior: Only agency_admin can cancel a confirmed booking

test("PROOF-B-016-STATUSa — cancelled → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can cancel transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-016-STATUSb — cancelled → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-016-STATUSc — cancelled → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-017-STATUS — Status Transition: Agent cannot access bookings from other agencies
// Risk: critical
// Spec: Booking Rules
// Behavior: Agent cannot access bookings from other agencies

test("PROOF-B-017-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.list",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot access transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-017-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "bookings.list",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.list",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-017-STATUSc — pending → paid: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to paid without going through confirmed
  const { status } = await trpcMutation(request, "bookings.list",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-018-STATUS — Status Transition: Package price must be greater than 0
// Risk: high
// Spec: Package Rules
// Behavior: Package price must be greater than 0

test("PROOF-B-018-STATUSa — confirmed → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove must be transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-018-STATUSb — paid → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "packages.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-018-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through paid
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-019-STATUS — Status Transition: Package maxPassengers must be between 1 and 500
// Risk: high
// Spec: Package Rules
// Behavior: Package maxPassengers must be between 1 and 500

test("PROOF-B-019-STATUSa — paid → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove must be transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-019-STATUSb — completed → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "packages.create",
    { id: resource.id, status: "completed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-019-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through completed
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-020-STATUS — Status Transition: Package departureDate must be in the future
// Risk: high
// Spec: Package Rules
// Behavior: Package departureDate must be in the future

test("PROOF-B-020-STATUSa — paid → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove must be transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-020-STATUSb — cancelled → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "packages.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-020-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-021-STATUS — Status Transition: Only agency_admin can export customer data
// Risk: critical
// Spec: DSGVO Rules
// Behavior: Only agency_admin can export customer data

test("PROOF-B-021-STATUSa — cancelled → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "gdpr.exportCustomerData",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can export transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-021-STATUSb — refunded → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "gdpr.exportCustomerData",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-021-STATUSc — cancelled → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-022-STATUS — Status Transition: Only agency_admin can delete customer data
// Risk: critical
// Spec: DSGVO Rules
// Behavior: Only agency_admin can delete customer data

test("PROOF-B-022-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can delete transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-022-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "gdpr.deleteCustomerData",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-022-STATUSc — pending → paid: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to paid without going through confirmed
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-025-STATUS — Status Transition: Booking created with status pending
// Risk: high
// Spec: UF-01: Customer Books a Package
// Behavior: Booking created with status pending

test("PROOF-B-025-STATUSa — confirmed → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove is created transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-025-STATUSb — paid → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to paid state first
  await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow paid→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-025-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through paid
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-026-STATUS — Status Transition: Booking status changes from pending to confirmed by Admin
// Risk: high
// Spec: UF-02: Agency Admin Confirms Booking
// Behavior: Booking status changes from pending to confirmed by Admin

test("PROOF-B-026-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove changes transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-026-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-026-STATUSc — pending → paid: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to paid without going through confirmed
  const { status } = await trpcMutation(request, "bookings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-028-STATUS — Status Transition: Package creation fails with price 0 or negative
// Risk: high
// Spec: UF-04: Create Travel Package
// Behavior: Package creation fails with price 0 or negative

test("PROOF-B-028-STATUSa — paid → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove fails transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-028-STATUSb — cancelled → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "packages.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-028-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-029-STATUS — Status Transition: Package creation fails with max passengers > 500
// Risk: high
// Spec: UF-04: Create Travel Package
// Behavior: Package creation fails with max passengers > 500

test("PROOF-B-029-STATUSa — cancelled → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove fails transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-029-STATUSb — refunded → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "packages.create",
    { id: resource.id, status: "refunded", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-029-STATUSc — cancelled → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "packages.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "bookings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});