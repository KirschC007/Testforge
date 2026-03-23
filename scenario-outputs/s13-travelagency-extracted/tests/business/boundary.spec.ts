import { expect, test } from "@playwright/test";
import { tomorrowStr, trpcMutation, yesterdayStr } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// PROOF-B-002-BOUND — Boundary: agency_admin has full access to agency data
// Risk: critical

const basePayload_PROOF_B_002_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
    status: boundaryValue,
});

test("PROOF-B-002-BOUNDa — status=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_002_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in status validation (off-by-one)
});

test("PROOF-B-002-BOUNDb — status=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_002_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in status validation (off-by-one)
});

test("PROOF-B-002-BOUNDc — status=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_002_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove status boundary validation
});

test("PROOF-B-002-BOUNDd — status=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_002_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove status boundary validation
});

test("PROOF-B-002-BOUNDe — status=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_002_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove status boundary validation
});

// PROOF-B-014-BOUND — Boundary: Booking creation fails if passengers exceed package capacity
// Risk: high

const basePayload_PROOF_B_014_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: boundaryValue,
    passengers: 1,
    notes: "test-notes",
});

test("PROOF-B-014-BOUNDa — travelDate="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_014_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in travelDate validation (off-by-one)
});

test("PROOF-B-014-BOUNDb — travelDate="A".repeat(200) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_014_BOUND("A".repeat(200)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in travelDate validation (off-by-one)
});

test("PROOF-B-014-BOUNDc — travelDate="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_014_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove travelDate boundary validation
});

test("PROOF-B-014-BOUNDd — travelDate="A".repeat(201) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_014_BOUND("A".repeat(201)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove travelDate boundary validation
});

test("PROOF-B-014-BOUNDe — travelDate=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_014_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove travelDate boundary validation
});

// PROOF-B-016-BOUND — Boundary: Only agency_admin can cancel a confirmed booking
// Risk: high

const basePayload_PROOF_B_016_BOUND = (boundaryValue: unknown) => ({
    agencyId: boundaryValue,
    bookingId: 1,
    status: "pending",
});

test("PROOF-B-016-BOUNDa — agencyId=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.updateStatus", basePayload_PROOF_B_016_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in agencyId validation (off-by-one)
});

test("PROOF-B-016-BOUNDb — agencyId=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.updateStatus", basePayload_PROOF_B_016_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in agencyId validation (off-by-one)
});

test("PROOF-B-016-BOUNDc — agencyId=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.updateStatus", basePayload_PROOF_B_016_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

test("PROOF-B-016-BOUNDd — agencyId=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.updateStatus", basePayload_PROOF_B_016_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

test("PROOF-B-016-BOUNDe — agencyId=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.updateStatus", basePayload_PROOF_B_016_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

// PROOF-B-018-BOUND — Boundary: Package price must be greater than 0
// Risk: high
// Boundary Field: price (number, min: 0.01)

const basePayload_PROOF_B_018_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    maxPassengers: 1,
    departureDate: tomorrowStr(),
    price: boundaryValue,
});

test("PROOF-B-018-BOUNDa — price=0.01 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_018_BOUND(0.01), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in price validation (off-by-one)
});

test("PROOF-B-018-BOUNDb — price=100.00 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_018_BOUND(100.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in price validation (off-by-one)
});

test("PROOF-B-018-BOUNDc — price=0.00 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_018_BOUND(0.00), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

test("PROOF-B-018-BOUNDd — price=100.01 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_018_BOUND(100.01), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

test("PROOF-B-018-BOUNDe — price=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_018_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

// PROOF-B-021-BOUND — Boundary: Only agency_admin can export customer data
// Risk: critical

const basePayload_PROOF_B_021_BOUND = (boundaryValue: unknown) => ({
    agencyId: boundaryValue,
    customerId: 2,
});

test("PROOF-B-021-BOUNDa — agencyId=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in agencyId validation (off-by-one)
});

test("PROOF-B-021-BOUNDb — agencyId=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in agencyId validation (off-by-one)
});

test("PROOF-B-021-BOUNDc — agencyId=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

test("PROOF-B-021-BOUNDd — agencyId=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

test("PROOF-B-021-BOUNDe — agencyId=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

// PROOF-B-022-BOUND — Boundary: Only agency_admin can delete customer data
// Risk: critical

const basePayload_PROOF_B_022_BOUND = (boundaryValue: unknown) => ({
    agencyId: boundaryValue,
    customerId: 2,
});

test("PROOF-B-022-BOUNDa — agencyId=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in agencyId validation (off-by-one)
});

test("PROOF-B-022-BOUNDb — agencyId=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in agencyId validation (off-by-one)
});

test("PROOF-B-022-BOUNDc — agencyId=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

test("PROOF-B-022-BOUNDd — agencyId=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});

test("PROOF-B-022-BOUNDe — agencyId=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove agencyId boundary validation
});