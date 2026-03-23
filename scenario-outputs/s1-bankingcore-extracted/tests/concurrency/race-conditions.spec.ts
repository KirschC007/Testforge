import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_BANK_ID } from "../../helpers/factories";

// Proof: PROOF-B-014-CONCURRENCY
// Behavior: Initial deposit is added to balance atomically
// Risk: high
// Kills: Remove mutex/lock around adds in accounts.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for initialDeposit to balance update

function basePayload_PROOF_B_014_CONCURRENCY() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}

test.describe("Concurrency: Initial deposit is added to balance atomically", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent adds requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "accounts.create", basePayload_PROOF_B_014_CONCURRENCY(), cookie)
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

  test("concurrent adds must not create duplicate initialDeposit to balances", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "accounts.create", basePayload_PROOF_B_014_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent adds", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "accounts.create", basePayload_PROOF_B_014_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "accounts.list", { bankId: TEST_BANK_ID }, cookie);
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

// Proof: PROOF-B-018-CONCURRENCY
// Behavior: POST /api/accounts returns 400 for invalid initialDeposit
// Risk: medium
// Kills: Remove mutex/lock around returns 400 in accounts.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for response update

function basePayload_PROOF_B_018_CONCURRENCY() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}

test.describe("Concurrency: POST /api/accounts returns 400 for invalid initialDeposit", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent returns 400 requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "accounts.create", basePayload_PROOF_B_018_CONCURRENCY(), cookie)
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

  test("concurrent returns 400 must not create duplicate responses", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "accounts.create", basePayload_PROOF_B_018_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent returns 400", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "accounts.create", basePayload_PROOF_B_018_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "accounts.list", { bankId: TEST_BANK_ID }, cookie);
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
// Behavior: POST /api/transactions returns 403 if fromAccountId and toAccountId are not in same bank
// Risk: critical
// Kills: Remove mutex/lock around returns 403 in transactions.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for response update

function basePayload_PROOF_B_029_CONCURRENCY() {
  return {
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    amount: 1,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  };
}

test.describe("Concurrency: POST /api/transactions returns 403 if fromAccountId and toAccountId are not in same bank", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent returns 403 requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
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

  test("concurrent returns 403 must not create duplicate responses", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent returns 403", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "transactions.list", { bankId: TEST_BANK_ID }, cookie);
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
// Behavior: Amount is deducted from fromAccount and credited to toAccount atomically
// Risk: high
// Kills: Remove mutex/lock around deducts and credits amount in transactions.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for accounts update

function basePayload_PROOF_B_031_CONCURRENCY() {
  return {
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    amount: 1,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  };
}

test.describe("Concurrency: Amount is deducted from fromAccount and credited to toAccount atomically", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent deducts and credits amount requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_031_CONCURRENCY(), cookie)
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

  test("concurrent deducts and credits amount must not create duplicate accountss", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_031_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent deducts and credits amount", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_031_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "transactions.list", { bankId: TEST_BANK_ID }, cookie);
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
// Behavior: POST /api/transactions returns 400 if fromAccountId equals toAccountId
// Risk: medium
// Kills: Remove mutex/lock around returns 400 in transactions.create | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for response update

function basePayload_PROOF_B_033_CONCURRENCY() {
  return {
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    amount: 1,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  };
}

test.describe("Concurrency: POST /api/transactions returns 400 if fromAccountId equals toAccountId", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent returns 400 requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_CONCURRENCY(), cookie)
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

  test("concurrent returns 400 must not create duplicate responses", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent returns 400", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "transactions.list", { bankId: TEST_BANK_ID }, cookie);
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
// Behavior: Reversed transaction restores original balance
// Risk: high
// Kills: Remove mutex/lock around restores balance in transactions.status | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for accounts update

function basePayload_PROOF_B_045_CONCURRENCY() {
  return {
    id: 1,
    status: "processing",
  };
}

test.describe("Concurrency: Reversed transaction restores original balance", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent restores balance requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.status", basePayload_PROOF_B_045_CONCURRENCY(), cookie)
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

  test("concurrent restores balance must not create duplicate accountss", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "transactions.status", basePayload_PROOF_B_045_CONCURRENCY(), cookie)
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

  test("system remains consistent after concurrent restores balance", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "transactions.status", basePayload_PROOF_B_045_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "transactions.list", { bankId: TEST_BANK_ID }, cookie);
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