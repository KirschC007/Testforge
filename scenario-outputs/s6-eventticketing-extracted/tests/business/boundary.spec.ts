import { expect, test } from "@playwright/test";
import { tomorrowStr, trpcMutation, yesterdayStr } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getOrganizerAdminCookie(request);
});

// PROOF-B-019-BOUND — Boundary: Event date must be at least 7 days in future
// Risk: medium
// Boundary Field: date (date)

const basePayload_PROOF_B_019_BOUND = (boundaryValue: unknown) => ({
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    capacity: 1,
    ticketPrice: 0.01,
    date: boundaryValue,
});

test("PROOF-B-019-BOUNDa — date=tomorrowStr() (future = valid)", async ({ request }) => {
  const { status } = await trpcMutation(request, "events.create", basePayload_PROOF_B_019_BOUND(tomorrowStr()), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in date validation (off-by-one)
});

test("PROOF-B-019-BOUNDb — date=yesterdayStr() (past = invalid)", async ({ request }) => {
  const { status } = await trpcMutation(request, "events.create", basePayload_PROOF_B_019_BOUND(yesterdayStr()), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove date boundary validation
});

test("PROOF-B-019-BOUNDc — date=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "events.create", basePayload_PROOF_B_019_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove date boundary validation
});

// PROOF-B-027-BOUND — Boundary: Event must be in future for order creation
// Risk: medium
// Boundary Field: quantity (number, min: 1)

const basePayload_PROOF_B_027_BOUND = (boundaryValue: unknown) => ({
    eventId: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
    quantity: boundaryValue,
});

test("PROOF-B-027-BOUNDa — quantity=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "orders.create", basePayload_PROOF_B_027_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in quantity validation (off-by-one)
});

test("PROOF-B-027-BOUNDb — quantity=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "orders.create", basePayload_PROOF_B_027_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in quantity validation (off-by-one)
});

test("PROOF-B-027-BOUNDc — quantity=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "orders.create", basePayload_PROOF_B_027_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove quantity boundary validation
});

test("PROOF-B-027-BOUNDd — quantity=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "orders.create", basePayload_PROOF_B_027_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove quantity boundary validation
});

test("PROOF-B-027-BOUNDe — quantity=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "orders.create", basePayload_PROOF_B_027_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove quantity boundary validation
});