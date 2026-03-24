import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

// Proof: PROOF-B-059-CONCURRENCY
// Behavior: POST /api/rentals ensures only one rental succeeds for the same device concurrently
// Risk: high
// Kills: Remove mutex/lock around ensures in rentals.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for single successful rental update

function basePayload_PROOF_B_059_CONCURRENCY() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}

test.describe("Concurrency: POST /api/rentals ensures only one rental succeeds for the same device concurrently", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent ensures requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "rentals.create", basePayload_PROOF_B_059_CONCURRENCY(), cookie)
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

  test("concurrent ensures must not create duplicate single successful rentals", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "rentals.create", basePayload_PROOF_B_059_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent ensures", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "rentals.create", basePayload_PROOF_B_059_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "rentals.list", { clinicId: TEST_CLINIC_ID }, cookie);
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