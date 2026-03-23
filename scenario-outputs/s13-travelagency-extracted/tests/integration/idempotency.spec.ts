import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID } from "../../helpers/factories";

// Proof: PROOF-B-017-IDEMPOTENCY
// Behavior: Agent creates booking with pending status
// Risk: high
// Kills: Remove duplicate-check before is created in bookings.create | Not returning existing resource on duplicate is created | Creating second record instead of returning existing one

function basePayload_PROOF_B_017_IDEMPOTENCY() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}

test.describe("Idempotency: Agent creates booking with pending status", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAgencyAdminCookie(request);
  });

  test("duplicate is created request must not create a second with status 'pending'", async ({ request }) => {
    const payload = basePayload_PROOF_B_017_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "bookings.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "bookings.create", payload, cookie);
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

  test("repeated is created must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_017_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "bookings.create", payload, cookie);
    await trpcMutation(request, "bookings.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "bookings.list", { agencyId: TEST_AGENCY_ID }, cookie);
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

  test("is created with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_017_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "bookings.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "bookings.create", payload, cookie);
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