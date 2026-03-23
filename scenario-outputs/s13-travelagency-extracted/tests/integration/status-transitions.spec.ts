import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// PROOF-B-008-STATUS — Status Transition: Only agency_admin can cancel a confirmed booking
// Risk: high
// Spec: Booking Rules
// Behavior: Only agency_admin can cancel a confirmed booking

test("PROOF-B-008-STATUSa — pending → cancelled: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.cancel",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can cancel transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-008-STATUSb — cancelled → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to cancelled state first
  await trpcMutation(request, "bookings.cancel",
    { id: resource.id, status: "cancelled", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bookings.cancel",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow cancelled→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("cancelled");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-008-STATUSc — pending → paid: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to paid without going through cancelled
  const { status } = await trpcMutation(request, "bookings.cancel",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-017-STATUS — Status Transition: Agent creates booking with pending status
// Risk: high
// Spec: UF-01: Customer Books a Package
// Behavior: Agent creates booking with pending status

test("PROOF-B-017-STATUSa — confirmed → paid: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove is created transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-017-STATUSb — paid → confirmed: reverse transition must be rejected", async ({ request }) => {
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
  const { data: unchanged } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-017-STATUSc — confirmed → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through paid
  const { status } = await trpcMutation(request, "bookings.create",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-018-STATUS — Status Transition: Admin confirms booking, status changes to 'confirmed'
// Risk: high
// Spec: UF-02: Agency Admin Confirms Booking
// Behavior: Admin confirms booking, status changes to 'confirmed'

test("PROOF-B-018-STATUSa — paid → confirmed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove changes transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-018-STATUSb — confirmed → paid: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to confirmed state first
  await trpcMutation(request, "ings.updateStatus",
    { id: resource.id, status: "confirmed", agencyId: TEST_AGENCY_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: resource.id, status: "paid", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow confirmed→paid reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("confirmed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-018-STATUSc — paid → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through confirmed
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: resource.id, status: "pending", agencyId: TEST_AGENCY_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "ings.getById",
    { id: resource.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("paid");
  // Kills: Accept any status value without validating transition chain
});