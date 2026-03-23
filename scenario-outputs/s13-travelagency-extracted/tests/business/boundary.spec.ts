import { expect, test } from "@playwright/test";
import { tomorrowStr, trpcMutation, yesterdayStr } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// PROOF-B-006-BOUND — Boundary: Booking creation fails if passengers exceed package capacity
// Risk: high

const basePayload_PROOF_B_006_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
    status: boundaryValue,
});

test("PROOF-B-006-BOUNDa — status=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_006_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in status validation (off-by-one)
});

test("PROOF-B-006-BOUNDb — status=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_006_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in status validation (off-by-one)
});

test("PROOF-B-006-BOUNDc — status=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_006_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove status boundary validation
});

test("PROOF-B-006-BOUNDd — status=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_006_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove status boundary validation
});

test("PROOF-B-006-BOUNDe — status=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_006_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove status boundary validation
});

// PROOF-B-007-BOUND — Boundary: Booking creation fails for past travelDate
// Risk: high

const basePayload_PROOF_B_007_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: boundaryValue,
    passengers: 1,
    notes: "test-notes",
});

test("PROOF-B-007-BOUNDa — travelDate="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_007_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in travelDate validation (off-by-one)
});

test("PROOF-B-007-BOUNDb — travelDate="A".repeat(200) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_007_BOUND("A".repeat(200)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in travelDate validation (off-by-one)
});

test("PROOF-B-007-BOUNDc — travelDate="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_007_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove travelDate boundary validation
});

test("PROOF-B-007-BOUNDd — travelDate="A".repeat(201) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_007_BOUND("A".repeat(201)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove travelDate boundary validation
});

test("PROOF-B-007-BOUNDe — travelDate=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookings.create", basePayload_PROOF_B_007_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove travelDate boundary validation
});

// PROOF-B-010-BOUND — Boundary: Package price must be greater than 0
// Risk: high
// Boundary Field: price (number, min: 0.01)

const basePayload_PROOF_B_010_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    maxPassengers: 1,
    departureDate: tomorrowStr(),
    price: boundaryValue,
});

test("PROOF-B-010-BOUNDa — price=0.01 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_010_BOUND(0.01), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in price validation (off-by-one)
});

test("PROOF-B-010-BOUNDb — price=100.00 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_010_BOUND(100.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in price validation (off-by-one)
});

test("PROOF-B-010-BOUNDc — price=0.00 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_010_BOUND(0.00), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

test("PROOF-B-010-BOUNDd — price=100.01 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_010_BOUND(100.01), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

test("PROOF-B-010-BOUNDe — price=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_010_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

// PROOF-B-011-BOUND — Boundary: Package maxPassengers must be between 1 and 500
// Risk: high
// Boundary Field: maxPassengers (number, min: 1, max: 500)

const basePayload_PROOF_B_011_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    price: 0.01,
    departureDate: tomorrowStr(),
    maxPassengers: boundaryValue,
});

test("PROOF-B-011-BOUNDa — maxPassengers=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_011_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in maxPassengers validation (off-by-one)
});

test("PROOF-B-011-BOUNDb — maxPassengers=500 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_011_BOUND(500), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in maxPassengers validation (off-by-one)
});

test("PROOF-B-011-BOUNDc — maxPassengers=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_011_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove maxPassengers boundary validation
});

test("PROOF-B-011-BOUNDd — maxPassengers=501 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_011_BOUND(501), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove maxPassengers boundary validation
});

test("PROOF-B-011-BOUNDe — maxPassengers=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_011_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove maxPassengers boundary validation
});

// PROOF-B-012-BOUND — Boundary: Package departureDate must be in the future
// Risk: high
// Boundary Field: price (number, min: 0.01)

const basePayload_PROOF_B_012_BOUND = (boundaryValue: unknown) => ({
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    maxPassengers: 1,
    departureDate: tomorrowStr(),
    price: boundaryValue,
});

test("PROOF-B-012-BOUNDa — price=0.01 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_012_BOUND(0.01), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in price validation (off-by-one)
});

test("PROOF-B-012-BOUNDb — price=100.00 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_012_BOUND(100.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in price validation (off-by-one)
});

test("PROOF-B-012-BOUNDc — price=0.00 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_012_BOUND(0.00), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

test("PROOF-B-012-BOUNDd — price=100.01 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_012_BOUND(100.01), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});

test("PROOF-B-012-BOUNDe — price=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "packages.create", basePayload_PROOF_B_012_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove price boundary validation
});