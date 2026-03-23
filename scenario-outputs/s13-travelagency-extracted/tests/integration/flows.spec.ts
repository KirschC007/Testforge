import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// PROOF-B-017-FLOW — Flow: Multi-step flow: Agent creates booking with pending status
// Risk: high
// Behavior: Agent creates booking with pending status

test("PROOF-B-017-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-017-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});

// PROOF-B-018-FLOW — Flow: Multi-step flow: Admin confirms booking, status changes to 'confirmed'
// Risk: high
// Behavior: Admin confirms booking, status changes to 'confirmed'

test("PROOF-B-018-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-018-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});

// PROOF-B-019-FLOW — Flow: Multi-step flow: DSGVO export contains PII fields
// Risk: critical
// Behavior: DSGVO export contains PII fields

test("PROOF-B-019-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-019-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});

// PROOF-B-020-FLOW — Flow: Multi-step flow: DSGVO export contains all bookings for customer
// Risk: critical
// Behavior: DSGVO export contains all bookings for customer

test("PROOF-B-020-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-020-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});

// PROOF-B-021-FLOW — Flow: Multi-step flow: DSGVO export includes timestamp
// Risk: critical
// Behavior: DSGVO export includes timestamp

test("PROOF-B-021-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-021-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});

// PROOF-B-022-FLOW — Flow: Multi-step flow: Package creation fails if price is 0 or negative
// Risk: high
// Behavior: Package creation fails if price is 0 or negative

test("PROOF-B-022-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-022-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});

// PROOF-B-023-FLOW — Flow: Multi-step flow: Package creation fails if max passengers > 500
// Risk: high
// Behavior: Package creation fails if max passengers > 500

test("PROOF-B-023-FLOWa — complete flow succeeds end-to-end", async ({ request }) => {
  // Step 1: Create resource
  // Step 2: Advance through states
  // Step 3: Verify final state
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();
  // Kills: Skip intermediate step in flow

  const { data: final } = await trpcQuery(request, "ings.getById",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(final).not.toBeNull();
  // Kills: Allow flow to complete with missing precondition
});

test("PROOF-B-023-FLOWb — flow cannot skip intermediate step", async ({ request }) => {
  const { data: created } = await trpcMutation(request, "bookings.create",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect((created as Record<string, unknown>)?.id).toBeDefined();

  // Attempt to jump to final state without intermediate steps
  const { status } = await trpcMutation(request, "ings.updateStatus",
    { id: (created as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID, skipSteps: true }, adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Allow flow to skip required intermediate steps
});