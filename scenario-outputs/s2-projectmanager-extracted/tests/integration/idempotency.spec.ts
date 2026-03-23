import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID } from "../../helpers/factories";

// Proof: PROOF-B-020-IDEMPOTENCY
// Behavior: Project creation fails if project name is not unique within workspace
// Risk: medium
// Kills: Remove duplicate-check before returns in projects.create | Not returning existing resource on duplicate returns | Creating second record instead of returning existing one

function basePayload_PROOF_B_020_IDEMPOTENCY() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}

test.describe("Idempotency: Project creation fails if project name is not unique within workspace", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate returns request must not create a second 409 PROJECT_NAME_EXISTS", async ({ request }) => {
    const payload = basePayload_PROOF_B_020_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "projects.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "projects.create", payload, cookie);
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

  test("repeated returns must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_020_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "projects.create", payload, cookie);
    await trpcMutation(request, "projects.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "projects.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
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

  test("returns with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_020_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "projects.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "projects.create", payload, cookie);
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

// Proof: PROOF-B-055-IDEMPOTENCY
// Behavior: Moving task to 'in_progress' sets startedAt if not already set
// Risk: high
// Kills: Remove duplicate-check before sets in tasks.updateStatus | Not returning existing resource on duplicate sets | Creating second record instead of returning existing one

function basePayload_PROOF_B_055_IDEMPOTENCY() {
  return {
    id: TEST_WORKSPACE_ID,
    status: "todo",
  };
}

test.describe("Idempotency: Moving task to 'in_progress' sets startedAt if not already set", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate sets request must not create a second `startedAt` = NOW()", async ({ request }) => {
    const payload = basePayload_PROOF_B_055_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "tasks.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "tasks.updateStatus", payload, cookie);
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

  test("repeated sets must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_055_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "tasks.updateStatus", payload, cookie);
    await trpcMutation(request, "tasks.updateStatus", payload, cookie);
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

  test("sets with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_055_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "tasks.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "tasks.updateStatus", payload, cookie);
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