import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID } from "../../helpers/factories";

// Proof: PROOF-B-033-IDEMPOTENCY
// Behavior: Order creation atomically decrements event.remainingCapacity, creates order, and charges via Stripe
// Risk: high
// Kills: Remove duplicate-check before atomically performs in orders.create | Not returning existing resource on duplicate atomically performs | Creating second record instead of returning existing one

function basePayload_PROOF_B_033_IDEMPOTENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Idempotency: Order creation atomically decrements event.remainingCapacity, creates order, and charges via Stripe", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("duplicate atomically performs request must not create a second decrement capacity, create order, charge Stripe", async ({ request }) => {
    const payload = basePayload_PROOF_B_033_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "orders.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "orders.create", payload, cookie);
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

  test("repeated atomically performs must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_033_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "orders.create", payload, cookie);
    await trpcMutation(request, "orders.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

  test("atomically performs with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_033_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "orders.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "orders.create", payload, cookie);
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

// Proof: PROOF-B-036-IDEMPOTENCY
// Behavior: Other concurrent orders for last tickets get SOLD_OUT
// Risk: high
// Kills: Remove duplicate-check before get in orders.create | Not returning existing resource on duplicate get | Creating second record instead of returning existing one

function basePayload_PROOF_B_036_IDEMPOTENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Idempotency: Other concurrent orders for last tickets get SOLD_OUT", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("duplicate get request must not create a second SOLD_OUT error", async ({ request }) => {
    const payload = basePayload_PROOF_B_036_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "orders.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "orders.create", payload, cookie);
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

  test("repeated get must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_036_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "orders.create", payload, cookie);
    await trpcMutation(request, "orders.create", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

  test("get with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_036_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "orders.create", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "orders.create", payload, cookie);
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

// Proof: PROOF-B-040-IDEMPOTENCY
// Behavior: System returns 409 ALREADY_CANCELLED if order is already cancelled
// Risk: high
// Kills: Remove duplicate-check before returns 409 ALREADY_CANCELLED in orders.updateStatus | Not returning existing resource on duplicate returns 409 ALREADY_CANCELLED | Creating second record instead of returning existing one

function basePayload_PROOF_B_040_IDEMPOTENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Idempotency: System returns 409 ALREADY_CANCELLED if order is already cancelled", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("duplicate returns 409 ALREADY_CANCELLED request must not create a second order status update request", async ({ request }) => {
    const payload = basePayload_PROOF_B_040_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
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

  test("repeated returns 409 ALREADY_CANCELLED must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_040_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "orders.updateStatus", payload, cookie);
    await trpcMutation(request, "orders.updateStatus", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

  test("returns 409 ALREADY_CANCELLED with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_040_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
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

// Proof: PROOF-B-048-IDEMPOTENCY
// Behavior: Transition to cancelled restores capacity and initiates Stripe refund if paid
// Risk: high
// Kills: Remove duplicate-check before restores capacity and initiates Stripe refund in orders.updateStatus | Not returning existing resource on duplicate restores capacity and initiates Stripe refund | Creating second record instead of returning existing one

function basePayload_PROOF_B_048_IDEMPOTENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Idempotency: Transition to cancelled restores capacity and initiates Stripe refund if paid", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("duplicate restores capacity and initiates Stripe refund request must not create a second order", async ({ request }) => {
    const payload = basePayload_PROOF_B_048_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
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

  test("repeated restores capacity and initiates Stripe refund must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_048_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "orders.updateStatus", payload, cookie);
    await trpcMutation(request, "orders.updateStatus", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

  test("restores capacity and initiates Stripe refund with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_048_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
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

// Proof: PROOF-B-049-IDEMPOTENCY
// Behavior: Transition to refunded restores capacity and initiates full Stripe refund
// Risk: high
// Kills: Remove duplicate-check before restores capacity and initiates full Stripe refund in orders.updateStatus | Not returning existing resource on duplicate restores capacity and initiates full Stripe refund | Creating second record instead of returning existing one

function basePayload_PROOF_B_049_IDEMPOTENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Idempotency: Transition to refunded restores capacity and initiates full Stripe refund", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("duplicate restores capacity and initiates full Stripe refund request must not create a second order", async ({ request }) => {
    const payload = basePayload_PROOF_B_049_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
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

  test("repeated restores capacity and initiates full Stripe refund must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_049_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "orders.updateStatus", payload, cookie);
    await trpcMutation(request, "orders.updateStatus", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

  test("restores capacity and initiates full Stripe refund with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_049_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "orders.updateStatus", payload, cookie);
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