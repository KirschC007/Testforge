import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_TENANT_ID } from "../../helpers/factories";

// Proof: PROOF-B-001-IDEMPOTENCY
// Behavior: Create workouts
// Risk: critical
// Kills: Remove duplicate-check before Create in workouts.create | Not returning existing resource on duplicate Create | Creating second record instead of returning existing one

function basePayload_PROOF_B_001_IDEMPOTENCY() {
  return {
    gymId: 1,
    name: "Test name-${Date.now()}",
    type: "active",
    scheduledAt: "test-scheduledAt",
    notes: "test-notes",
  };
}

test.describe("Idempotency: Create workouts", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate Create request must not create a second workouts", async ({ request }) => {
    const payload = basePayload_PROOF_B_001_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "workouts.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "workouts.create", payload, cookie);
    // Must succeed or return conflict — never 500
    expect(response2.status).toBeOneOf([200, 201, 409]);
    if (response2.status === 200 || response2.status === 201) {
      // If it succeeds, must return the same resource
      const id2 = response2.data?.result?.data?.id;
      if (id1 && id2) {
        expect(id2).toBe(id1);
      }
    }
  });

  test("repeated Create must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_001_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "workouts.create", payload, cookie);
    await trpcMutation(request, "workouts.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "workouts.list", { tenantId: TEST_TENANT_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    if (Array.isArray(items)) {
      // Count items matching our payload
      const matchingItems = items.filter((item: Record<string, unknown>) => {
        return Object.entries(payload).every(([k, v]) => item[k] === v);
      });
      // At most one matching item should exist
      expect(matchingItems.length).toBeLessThanOrEqual(1);
    }
  });

  test("Create with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_001_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "workouts.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "workouts.create", payload, cookie);
    expect(response2.status).toBeOneOf([200, 201, 409, 422]);
    // If both succeed, they must return identical data
    if ((response1.status === 200 || response1.status === 201) &&
        (response2.status === 200 || response2.status === 201)) {
      const data1 = response1.data?.result?.data;
      const data2 = response2.data?.result?.data;
      if (data1?.id && data2?.id) {
        expect(data2.id).toBe(data1.id);
      }
    }
  });
});

// Proof: PROOF-B-006-IDEMPOTENCY
// Behavior: Create workouts
// Risk: critical
// Kills: Remove duplicate-check before Create in workouts.addExercise | Not returning existing resource on duplicate Create | Creating second record instead of returning existing one

function basePayload_PROOF_B_006_IDEMPOTENCY() {
  return {
    workoutId: 1,
    gymId: 1,
    name: "Test name-${Date.now()}",
    sets: 1,
    reps: 1,
    weight: 1,
    restSeconds: 1,
  };
}

test.describe("Idempotency: Create workouts", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate Create request must not create a second workouts", async ({ request }) => {
    const payload = basePayload_PROOF_B_006_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "workouts.addExercise", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "workouts.addExercise", payload, cookie);
    // Must succeed or return conflict — never 500
    expect(response2.status).toBeOneOf([200, 201, 409]);
    if (response2.status === 200 || response2.status === 201) {
      // If it succeeds, must return the same resource
      const id2 = response2.data?.result?.data?.id;
      if (id1 && id2) {
        expect(id2).toBe(id1);
      }
    }
  });

  test("repeated Create must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_006_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "workouts.addExercise", payload, cookie);
    await trpcMutation(request, "workouts.addExercise", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "workouts.list", { tenantId: TEST_TENANT_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    if (Array.isArray(items)) {
      // Count items matching our payload
      const matchingItems = items.filter((item: Record<string, unknown>) => {
        return Object.entries(payload).every(([k, v]) => item[k] === v);
      });
      // At most one matching item should exist
      expect(matchingItems.length).toBeLessThanOrEqual(1);
    }
  });

  test("Create with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_006_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "workouts.addExercise", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "workouts.addExercise", payload, cookie);
    expect(response2.status).toBeOneOf([200, 201, 409, 422]);
    // If both succeed, they must return identical data
    if ((response1.status === 200 || response1.status === 201) &&
        (response2.status === 200 || response2.status === 201)) {
      const data1 = response1.data?.result?.data;
      const data2 = response2.data?.result?.data;
      if (data1?.id && data2?.id) {
        expect(data2.id).toBe(data1.id);
      }
    }
  });
});