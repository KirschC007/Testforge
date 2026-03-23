import { expect, test } from "@playwright/test";
import { trpcMutation } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_TENANT_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-001-BOUND — Boundary: Create workouts
// Risk: critical

const basePayload_PROOF_B_001_BOUND = (boundaryValue: unknown) => ({
    gymId: 1,
    name: boundaryValue,
    type: "active",
    scheduledAt: "test-scheduledAt",
    notes: "test-notes",
});

test("PROOF-B-001-BOUNDa — name="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in name validation (off-by-one)
});

test("PROOF-B-001-BOUNDb — name="A".repeat(200) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_BOUND("A".repeat(200)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in name validation (off-by-one)
});

test("PROOF-B-001-BOUNDc — name="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove name boundary validation
});

test("PROOF-B-001-BOUNDd — name="A".repeat(201) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_BOUND("A".repeat(201)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove name boundary validation
});

test("PROOF-B-001-BOUNDe — name=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove name boundary validation
});

// PROOF-B-002-BOUND — Boundary: Get workouts
// Risk: medium

const basePayload_PROOF_B_002_BOUND = (boundaryValue: unknown) => ({
    gymId: 1,
    userId: 1,
    type: "active",
    status: "active",
    page: boundaryValue,
    pageSize: 1,
});

test("PROOF-B-002-BOUNDa — page=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.list", basePayload_PROOF_B_002_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in page validation (off-by-one)
});

test("PROOF-B-002-BOUNDb — page=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.list", basePayload_PROOF_B_002_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in page validation (off-by-one)
});

test("PROOF-B-002-BOUNDc — page=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.list", basePayload_PROOF_B_002_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove page boundary validation
});

test("PROOF-B-002-BOUNDd — page=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.list", basePayload_PROOF_B_002_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove page boundary validation
});

test("PROOF-B-002-BOUNDe — page=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.list", basePayload_PROOF_B_002_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove page boundary validation
});

// PROOF-B-003-BOUND — Boundary: Mutate workouts
// Risk: critical

const basePayload_PROOF_B_003_BOUND = (boundaryValue: unknown) => ({
    id: boundaryValue,
    gymId: 1,
});

test("PROOF-B-003-BOUNDa — id=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.start", basePayload_PROOF_B_003_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in id validation (off-by-one)
});

test("PROOF-B-003-BOUNDb — id=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.start", basePayload_PROOF_B_003_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in id validation (off-by-one)
});

test("PROOF-B-003-BOUNDc — id=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.start", basePayload_PROOF_B_003_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove id boundary validation
});

test("PROOF-B-003-BOUNDd — id=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.start", basePayload_PROOF_B_003_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove id boundary validation
});

test("PROOF-B-003-BOUNDe — id=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.start", basePayload_PROOF_B_003_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove id boundary validation
});

// PROOF-B-004-BOUND — Boundary: Mutate workouts
// Risk: critical

const basePayload_PROOF_B_004_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    gymId: 1,
    duration: boundaryValue,
    caloriesBurned: 1,
});

test("PROOF-B-004-BOUNDa — duration=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.complete", basePayload_PROOF_B_004_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in duration validation (off-by-one)
});

test("PROOF-B-004-BOUNDb — duration=600 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.complete", basePayload_PROOF_B_004_BOUND(600), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in duration validation (off-by-one)
});

test("PROOF-B-004-BOUNDc — duration=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.complete", basePayload_PROOF_B_004_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove duration boundary validation
});

test("PROOF-B-004-BOUNDd — duration=601 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.complete", basePayload_PROOF_B_004_BOUND(601), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove duration boundary validation
});

test("PROOF-B-004-BOUNDe — duration=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.complete", basePayload_PROOF_B_004_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove duration boundary validation
});

// PROOF-B-005-BOUND — Boundary: Mutate workouts
// Risk: critical

const basePayload_PROOF_B_005_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    gymId: 1,
    reason: boundaryValue,
});

test("PROOF-B-005-BOUNDa — reason="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.skip", basePayload_PROOF_B_005_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-005-BOUNDb — reason="A".repeat(500) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.skip", basePayload_PROOF_B_005_BOUND("A".repeat(500)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-005-BOUNDc — reason="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.skip", basePayload_PROOF_B_005_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-005-BOUNDd — reason="A".repeat(501) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.skip", basePayload_PROOF_B_005_BOUND("A".repeat(501)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-005-BOUNDe — reason=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.skip", basePayload_PROOF_B_005_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

// PROOF-B-006-BOUND — Boundary: Create workouts
// Risk: critical

const basePayload_PROOF_B_006_BOUND = (boundaryValue: unknown) => ({
    workoutId: 1,
    gymId: 1,
    name: boundaryValue,
    sets: 1,
    reps: 1,
    weight: 1,
    restSeconds: 1,
});

test("PROOF-B-006-BOUNDa — name="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in name validation (off-by-one)
});

test("PROOF-B-006-BOUNDb — name="A".repeat(100) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_BOUND("A".repeat(100)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in name validation (off-by-one)
});

test("PROOF-B-006-BOUNDc — name="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove name boundary validation
});

test("PROOF-B-006-BOUNDd — name="A".repeat(101) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_BOUND("A".repeat(101)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove name boundary validation
});

test("PROOF-B-006-BOUNDe — name=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove name boundary validation
});

// PROOF-B-007-BOUND — Boundary: Delete workouts
// Risk: critical

const basePayload_PROOF_B_007_BOUND = (boundaryValue: unknown) => ({
    id: boundaryValue,
    gymId: 1,
});

test("PROOF-B-007-BOUNDa — id=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in id validation (off-by-one)
});

test("PROOF-B-007-BOUNDb — id=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in id validation (off-by-one)
});

test("PROOF-B-007-BOUNDc — id=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove id boundary validation
});

test("PROOF-B-007-BOUNDd — id=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove id boundary validation
});

test("PROOF-B-007-BOUNDe — id=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove id boundary validation
});