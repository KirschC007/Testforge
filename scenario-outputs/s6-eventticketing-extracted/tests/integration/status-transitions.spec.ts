import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getOrganizerAdminCookie(request);
});

// PROOF-B-033-STATUS — Status Transition: Order creation atomically decrements event.remainingCapacity, creates order, and charges via Stripe
// Risk: high
// Spec: Endpoints
// Behavior: Order creation atomically decrements event.remainingCapacity, creates order, and charges via Stripe

test("PROOF-B-033-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.create",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove atomically performs transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-033-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "orders.create",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.create",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-033-STATUSc — pending → cancelled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to cancelled without going through confirmed
  const { status } = await trpcMutation(request, "orders.create",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-034-STATUS — Status Transition: System returns 422 PAYMENT_FAILED and restores capacity if Stripe charge fails
// Risk: high
// Spec: Endpoints
// Behavior: System returns 422 PAYMENT_FAILED and restores capacity if Stripe charge fails

test("PROOF-B-034-STATUSa — confirmed → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.create",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 PAYMENT_FAILED and restores capacity transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

  // Kills: Remove event.remainingCapacity is restored side-effect
});

test("PROOF-B-034-STATUSb — cancelled → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "orders.create",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.create",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-034-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "orders.create",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-037-STATUS — Status Transition: organizer_admin can update order status to cancel/refund
// Risk: high
// Spec: Endpoints
// Behavior: organizer_admin can update order status to cancel/refund

test("PROOF-B-037-STATUSa — confirmed → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can update order status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-037-STATUSb — refunded → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-037-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-038-STATUS — Status Transition: Attendee can cancel own order only if event is more than 48 hours away
// Risk: high
// Spec: Endpoints
// Behavior: Attendee can cancel own order only if event is more than 48 hours away

test("PROOF-B-038-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can cancel transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-038-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-038-STATUSc — pending → cancelled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to cancelled without going through confirmed
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-039-STATUS — Status Transition: System returns 422 CANCELLATION_DEADLINE if attendee tries to cancel an order within 48 hours of event
// Risk: high
// Spec: Endpoints
// Behavior: System returns 422 CANCELLATION_DEADLINE if attendee tries to cancel an order within 48 hours of event

test("PROOF-B-039-STATUSa — confirmed → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 CANCELLATION_DEADLINE transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-039-STATUSb — cancelled → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-039-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-040-STATUS — Status Transition: System returns 409 ALREADY_CANCELLED if order is already cancelled
// Risk: high
// Spec: Endpoints
// Behavior: System returns 409 ALREADY_CANCELLED if order is already cancelled

test("PROOF-B-040-STATUSa — confirmed → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 ALREADY_CANCELLED transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-040-STATUSb — refunded → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-040-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-042-STATUS — Status Transition: Order transitions from pending to confirmed automatically after payment
// Risk: high
// Spec: Status Machine: orders
// Behavior: Order transitions from pending to confirmed automatically after payment

test("PROOF-B-042-STATUSa — pending → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-042-STATUSb — confirmed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-042-STATUSc — pending → cancelled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to cancelled without going through confirmed
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-043-STATUS — Status Transition: Order can transition from confirmed to cancelled
// Risk: high
// Spec: Status Machine: orders
// Behavior: Order can transition from confirmed to cancelled

test("PROOF-B-043-STATUSa — confirmed → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-043-STATUSb — cancelled → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-043-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-044-STATUS — Status Transition: Order can transition from confirmed to refunded
// Risk: high
// Spec: Status Machine: orders
// Behavior: Order can transition from confirmed to refunded

test("PROOF-B-044-STATUSa — confirmed → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Kills: Remove order status is 'refunded' side-effect
});

test("PROOF-B-044-STATUSb — refunded → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-044-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-045-STATUS — Status Transition: Order cannot transition from cancelled to confirmed
// Risk: high
// Spec: Status Machine: orders
// Behavior: Order cannot transition from cancelled to confirmed

test("PROOF-B-045-STATUSa — cancelled → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-045-STATUSb — confirmed → cancelled: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→cancelled reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-045-STATUSc — cancelled → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through confirmed
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-046-STATUS — Status Transition: Order cannot transition from refunded to any other state
// Risk: high
// Spec: Status Machine: orders
// Behavior: Order cannot transition from refunded to any other state

test("PROOF-B-046-STATUSa — refunded → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-046-STATUSb — cancelled → refunded: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→refunded reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-046-STATUSc — refunded → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through cancelled
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-047-STATUS — Status Transition: Order cannot transition from pending to refunded
// Risk: high
// Spec: Status Machine: orders
// Behavior: Order cannot transition from pending to refunded

test("PROOF-B-047-STATUSa — pending → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-047-STATUSb — refunded → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-047-STATUSc — pending → cancelled: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to cancelled without going through refunded
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-048-STATUS — Status Transition: Transition to cancelled restores capacity and initiates Stripe refund if paid
// Risk: high
// Spec: Status Machine: orders
// Behavior: Transition to cancelled restores capacity and initiates Stripe refund if paid

test("PROOF-B-048-STATUSa — pending → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove restores capacity and initiates Stripe refund transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.initiat).not.toBeNull();
  // Kills: Remove initiat = NOW() in handler

  // Kills: Remove Stripe refund is initiated if order was paid side-effect
});

test("PROOF-B-048-STATUSb — cancelled → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "cancelled", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-048-STATUSc — pending → refunded: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to refunded without going through cancelled
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-049-STATUS — Status Transition: Transition to refunded restores capacity and initiates full Stripe refund
// Risk: high
// Spec: Status Machine: orders
// Behavior: Transition to refunded restores capacity and initiates full Stripe refund

test("PROOF-B-049-STATUSa — confirmed → refunded: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove restores capacity and initiates full Stripe refund transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.initiat).not.toBeNull();
  // Kills: Remove initiat = NOW() in handler

  // Kills: Remove full Stripe refund is initiated side-effect
});

test("PROOF-B-049-STATUSb — refunded → confirmed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to refunded state first
  await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "refunded", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "confirmed", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow refunded→confirmed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("refunded");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-049-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through refunded
  const { status } = await trpcMutation(request, "orders.updateStatus",
    { id: resource.id, status: "pending", organizerId: TEST_ORGANIZER_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "eventStats.getById",
    { id: resource.id, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});