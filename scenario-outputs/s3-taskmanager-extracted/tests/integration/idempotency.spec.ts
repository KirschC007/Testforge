import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID } from "../../helpers/factories";

// Proof: PROOF-B-001-IDEMPOTENCY
// Behavior: Create tasks
// Risk: critical
// Kills: Remove duplicate-check before Create in tasks.create | Not returning existing resource on duplicate Create | Creating second record instead of returning existing one

function basePayload_PROOF_B_001_IDEMPOTENCY() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "active",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}

test.describe("Idempotency: Create tasks", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate Create request must not create a second tasks", async ({ request }) => {
    const payload = basePayload_PROOF_B_001_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "tasks.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "tasks.create", payload, cookie);
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
    await trpcMutation(request, "tasks.create", payload, cookie);
    await trpcMutation(request, "tasks.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "tasks.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
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
    const response1 = await trpcMutation(request, "tasks.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "tasks.create", payload, cookie);
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

// Proof: PROOF-B-009-IDEMPOTENCY
// Behavior: Create tasks
// Risk: critical
// Kills: Remove duplicate-check before Create in tasks.create | Not returning existing resource on duplicate Create | Creating second record instead of returning existing one

function basePayload_PROOF_B_009_IDEMPOTENCY() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "active",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}

test.describe("Idempotency: Create tasks", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate Create request must not create a second tasks", async ({ request }) => {
    const payload = basePayload_PROOF_B_009_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "tasks.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "tasks.create", payload, cookie);
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
    const payload = basePayload_PROOF_B_009_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "tasks.create", payload, cookie);
    await trpcMutation(request, "tasks.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "tasks.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
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
    const payload = { ...basePayload_PROOF_B_009_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "tasks.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "tasks.create", payload, cookie);
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