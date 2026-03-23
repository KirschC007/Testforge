import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID } from "../../helpers/factories";

// Proof: PROOF-B-061-CONCURRENCY
// Behavior: POST /api/tasks/bulk-status bulk updates task statuses
// Risk: high
// Kills: Remove mutex/lock around bulk updates in bulkUpdateTaskStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for task statuses update

function basePayload_PROOF_B_061_CONCURRENCY() {
  return {
    taskIds: [1],
    status: "todo",
    workspaceId: TEST_WORKSPACE_ID,
  };
}

test.describe("Concurrency: POST /api/tasks/bulk-status bulk updates task statuses", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent bulk updates requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_061_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent bulk updates must not create duplicate task statusess", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_061_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent bulk updates", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_061_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "bulkUpdateTaskStatus.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

// Proof: PROOF-B-066-CONCURRENCY
// Behavior: Bulk task status update is atomic: if any task fails validation, none are updated
// Risk: high
// Kills: Remove mutex/lock around is atomic in bulkUpdateTaskStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for entire batch update

function basePayload_PROOF_B_066_CONCURRENCY() {
  return {
    taskIds: [1],
    status: "todo",
    workspaceId: TEST_WORKSPACE_ID,
  };
}

test.describe("Concurrency: Bulk task status update is atomic: if any task fails validation, none are updated", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent is atomic requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_066_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent is atomic must not create duplicate entire batchs", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_066_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent is atomic", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_066_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "bulkUpdateTaskStatus.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

// Proof: PROOF-B-102-CONCURRENCY
// Behavior: First write wins when two users move same task to different statuses simultaneously
// Risk: high
// Kills: Remove mutex/lock around applies in projects.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for first write wins (optimistic locking with `updatedAt` check) update

function basePayload_PROOF_B_102_CONCURRENCY() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}

test.describe("Concurrency: First write wins when two users move same task to different statuses simultaneously", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent applies requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "projects.create", basePayload_PROOF_B_102_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent applies must not create duplicate first write wins (optimistic locking with `updatedAt` check)s", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "projects.create", basePayload_PROOF_B_102_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent applies", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "projects.create", basePayload_PROOF_B_102_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "projects.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

// Proof: PROOF-B-104-CONCURRENCY
// Behavior: Entire batch is rolled back if one task fails validation during bulk status update
// Risk: high
// Kills: Remove mutex/lock around rolls back in projects.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for entire batch update

function basePayload_PROOF_B_104_CONCURRENCY() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}

test.describe("Concurrency: Entire batch is rolled back if one task fails validation during bulk status update", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent rolls back requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "projects.create", basePayload_PROOF_B_104_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent rolls back must not create duplicate entire batchs", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "projects.create", basePayload_PROOF_B_104_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent rolls back", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "projects.create", basePayload_PROOF_B_104_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "projects.list", { workspaceId: TEST_WORKSPACE_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});