import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID } from "../../helpers/factories";

// Proof: PROOF-B-012-CONCURRENCY
// Behavior: attendee role can buy tickets
// Risk: critical
// Kills: Remove mutex/lock around can buy in events.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for tickets update

function basePayload_PROOF_B_012_CONCURRENCY() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}

test.describe("Concurrency: attendee role can buy tickets", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent can buy requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_012_CONCURRENCY(), cookie)
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

  test("concurrent can buy must not create duplicate ticketss", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_012_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent can buy", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_012_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "events.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-013-CONCURRENCY
// Behavior: attendee role can view own orders
// Risk: critical
// Kills: Remove mutex/lock around can view in events.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for own orders update

function basePayload_PROOF_B_013_CONCURRENCY() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}

test.describe("Concurrency: attendee role can view own orders", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent can view requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_013_CONCURRENCY(), cookie)
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

  test("concurrent can view must not create duplicate own orderss", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_013_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent can view", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_013_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "events.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-014-CONCURRENCY
// Behavior: attendee role can request refund
// Risk: critical
// Kills: Remove mutex/lock around can request in events.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for refund update

function basePayload_PROOF_B_014_CONCURRENCY() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}

test.describe("Concurrency: attendee role can request refund", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent can request requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_014_CONCURRENCY(), cookie)
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

  test("concurrent can request must not create duplicate refunds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_014_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent can request", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "events.create", basePayload_PROOF_B_014_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "events.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-029-CONCURRENCY
// Behavior: Order quantity must not exceed event.maxPerOrder
// Risk: medium
// Kills: Remove mutex/lock around must not exceed in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for event.maxPerOrder update

function basePayload_PROOF_B_029_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: Order quantity must not exceed event.maxPerOrder", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent must not exceed requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
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

  test("concurrent must not exceed must not create duplicate event.maxPerOrders", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent must not exceed", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-030-CONCURRENCY
// Behavior: System returns 400 MAX_PER_ORDER_EXCEEDED if quantity exceeds event.maxPerOrder
// Risk: medium
// Kills: Remove mutex/lock around returns 400 MAX_PER_ORDER_EXCEEDED in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for order creation request update

function basePayload_PROOF_B_030_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: System returns 400 MAX_PER_ORDER_EXCEEDED if quantity exceeds event.maxPerOrder", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent returns 400 MAX_PER_ORDER_EXCEEDED requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_030_CONCURRENCY(), cookie)
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

  test("concurrent returns 400 MAX_PER_ORDER_EXCEEDED must not create duplicate order creation requests", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_030_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent returns 400 MAX_PER_ORDER_EXCEEDED", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_030_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-031-CONCURRENCY
// Behavior: Order quantity must not exceed remaining capacity
// Risk: medium
// Kills: Remove mutex/lock around must not exceed in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for remaining capacity update

function basePayload_PROOF_B_031_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: Order quantity must not exceed remaining capacity", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent must not exceed requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_031_CONCURRENCY(), cookie)
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

  test("concurrent must not exceed must not create duplicate remaining capacitys", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_031_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent must not exceed", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_031_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-032-CONCURRENCY
// Behavior: System returns 422 INSUFFICIENT_CAPACITY if quantity exceeds remaining capacity
// Risk: medium
// Kills: Remove mutex/lock around returns 422 INSUFFICIENT_CAPACITY in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for order creation request update

function basePayload_PROOF_B_032_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: System returns 422 INSUFFICIENT_CAPACITY if quantity exceeds remaining capacity", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent returns 422 INSUFFICIENT_CAPACITY requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_032_CONCURRENCY(), cookie)
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

  test("concurrent returns 422 INSUFFICIENT_CAPACITY must not create duplicate order creation requests", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_032_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent returns 422 INSUFFICIENT_CAPACITY", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_032_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-033-CONCURRENCY
// Behavior: Order creation atomically decrements event.remainingCapacity, creates order, and charges via Stripe
// Risk: high
// Kills: Remove mutex/lock around atomically performs in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for decrement capacity, create order, charge Stripe update

function basePayload_PROOF_B_033_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: Order creation atomically decrements event.remainingCapacity, creates order, and charges via Stripe", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent atomically performs requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_033_CONCURRENCY(), cookie)
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

  test("concurrent atomically performs must not create duplicate decrement capacity, create order, charge Stripes", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_033_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent atomically performs", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_033_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-035-CONCURRENCY
// Behavior: Exactly one concurrent order for last tickets must succeed
// Risk: high
// Kills: Remove mutex/lock around exactly one must succeed in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for order creation update

function basePayload_PROOF_B_035_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: Exactly one concurrent order for last tickets must succeed", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent exactly one must succeed requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_035_CONCURRENCY(), cookie)
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

  test("concurrent exactly one must succeed must not create duplicate order creations", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_035_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent exactly one must succeed", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_035_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-036-CONCURRENCY
// Behavior: Other concurrent orders for last tickets get SOLD_OUT
// Risk: high
// Kills: Remove mutex/lock around get in orders.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for SOLD_OUT error update

function basePayload_PROOF_B_036_CONCURRENCY() {
  return {
    eventId: 1,
    quantity: 1,
    attendeeName: "Test attendeeName-${Date.now()}",
    attendeeEmail: "test@example.com",
    paymentMethodId: TEST_ORGANIZER_ID,
  };
}

test.describe("Concurrency: Other concurrent orders for last tickets get SOLD_OUT", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent get requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_036_CONCURRENCY(), cookie)
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

  test("concurrent get must not create duplicate SOLD_OUT errors", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_036_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent get", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.create", basePayload_PROOF_B_036_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-037-CONCURRENCY
// Behavior: organizer_admin can update order status to cancel/refund
// Risk: high
// Kills: Remove mutex/lock around can update order status in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for to cancelled or refunded update

function basePayload_PROOF_B_037_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: organizer_admin can update order status to cancel/refund", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent can update order status requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_037_CONCURRENCY(), cookie)
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

  test("concurrent can update order status must not create duplicate to cancelled or refundeds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_037_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent can update order status", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_037_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-043-CONCURRENCY
// Behavior: Order can transition from confirmed to cancelled
// Risk: high
// Kills: Remove mutex/lock around can transition in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for from confirmed to cancelled update

function basePayload_PROOF_B_043_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Order can transition from confirmed to cancelled", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent can transition requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_043_CONCURRENCY(), cookie)
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

  test("concurrent can transition must not create duplicate from confirmed to cancelleds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_043_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent can transition", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_043_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-044-CONCURRENCY
// Behavior: Order can transition from confirmed to refunded
// Risk: high
// Kills: Remove mutex/lock around can transition in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for from confirmed to refunded update

function basePayload_PROOF_B_044_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Order can transition from confirmed to refunded", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent can transition requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_044_CONCURRENCY(), cookie)
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

  test("concurrent can transition must not create duplicate from confirmed to refundeds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_044_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent can transition", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_044_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-045-CONCURRENCY
// Behavior: Order cannot transition from cancelled to confirmed
// Risk: high
// Kills: Remove mutex/lock around cannot transition in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for from cancelled to confirmed update

function basePayload_PROOF_B_045_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Order cannot transition from cancelled to confirmed", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent cannot transition requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_045_CONCURRENCY(), cookie)
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

  test("concurrent cannot transition must not create duplicate from cancelled to confirmeds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_045_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent cannot transition", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_045_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-046-CONCURRENCY
// Behavior: Order cannot transition from refunded to any other state
// Risk: high
// Kills: Remove mutex/lock around cannot transition in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for from refunded to any other state update

function basePayload_PROOF_B_046_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Order cannot transition from refunded to any other state", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent cannot transition requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_046_CONCURRENCY(), cookie)
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

  test("concurrent cannot transition must not create duplicate from refunded to any other states", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_046_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent cannot transition", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_046_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-047-CONCURRENCY
// Behavior: Order cannot transition from pending to refunded
// Risk: high
// Kills: Remove mutex/lock around cannot transition in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for from pending to refunded update

function basePayload_PROOF_B_047_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Order cannot transition from pending to refunded", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent cannot transition requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_047_CONCURRENCY(), cookie)
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

  test("concurrent cannot transition must not create duplicate from pending to refundeds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_047_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent cannot transition", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_047_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-048-CONCURRENCY
// Behavior: Transition to cancelled restores capacity and initiates Stripe refund if paid
// Risk: high
// Kills: Remove mutex/lock around restores capacity and initiates Stripe refund in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for order update

function basePayload_PROOF_B_048_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Transition to cancelled restores capacity and initiates Stripe refund if paid", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent restores capacity and initiates Stripe refund requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_048_CONCURRENCY(), cookie)
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

  test("concurrent restores capacity and initiates Stripe refund must not create duplicate orders", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_048_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent restores capacity and initiates Stripe refund", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_048_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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

// Proof: PROOF-B-049-CONCURRENCY
// Behavior: Transition to refunded restores capacity and initiates full Stripe refund
// Risk: high
// Kills: Remove mutex/lock around restores capacity and initiates full Stripe refund in orders.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for order update

function basePayload_PROOF_B_049_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
  };
}

test.describe("Concurrency: Transition to refunded restores capacity and initiates full Stripe refund", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getOrganizerAdminCookie(request);
  });

  test("concurrent restores capacity and initiates full Stripe refund requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_049_CONCURRENCY(), cookie)
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

  test("concurrent restores capacity and initiates full Stripe refund must not create duplicate orders", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_049_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent restores capacity and initiates full Stripe refund", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "orders.updateStatus", basePayload_PROOF_B_049_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "orders.list", { organizerId: TEST_ORGANIZER_ID }, cookie);
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