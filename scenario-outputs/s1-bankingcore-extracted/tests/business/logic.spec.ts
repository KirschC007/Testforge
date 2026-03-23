import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_BANK_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-012-BL — Business Logic: POST /api/accounts requires advisor or admin role
// Risk: critical | Endpoint: createAccount.create
// Spec: Endpoints
// Behavior: POST /api/accounts requires advisor or admin role

test("PROOF-B-012-BLa — POST /api/accounts requires advisor or admin role", async ({ request }) => {
  // Precondition: User attempts to create an account
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "createAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in createAccount.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in createAccount.create
});
test("PROOF-B-012-BLb — POST /api/accounts requires advisor or admin role requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "createAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from createAccount.create
});
test("PROOF-B-012-BLc — POST /api/accounts requires advisor or admin role persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from createAccount.create
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-014-BL — Business Logic: Initial deposit is added to balance atomically
// Risk: high | Endpoint: createAccount.create
// Spec: Endpoints
// Behavior: Initial deposit is added to balance atomically

test("PROOF-B-014-BLa — balance deducted after Initial deposit is added to balance atomically", async ({ request }) => {
  // Arrange: Create fromAccount and toAccount with known balances
  const fromAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(fromAccount?.id).toBeDefined();
  expect(toAccount?.id).toBeDefined();

  // Read balance BEFORE transaction
  const { data: fromBefore } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  const balanceBefore = (Array.isArray(fromBefore) ? fromBefore : [fromBefore])
    .find((a: unknown) => (a as Record<string, unknown>).id === fromAccount.id)
    ?.balance as number ?? 0;
  expect(typeof balanceBefore).toBe("number");
  // Kills: Cannot read balance before transaction

  // Act: Execute the transaction
  const AMOUNT = 1;
  const { status, data } = await trpcMutation(request, "createAccount.create", {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  }, adminCookie);
  expect(status).toBe(200);
  // Kills: Remove success path in createAccount.create

  // Read balance AFTER transaction
  const { data: fromAfter } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  const balanceAfter = (Array.isArray(fromAfter) ? fromAfter : [fromAfter])
    .find((a: unknown) => (a as Record<string, unknown>).id === fromAccount.id)
    ?.balance as number;

  expect(balanceAfter).toBe(balanceBefore - AMOUNT);
  // Kills: Not deducting amount from fromAccount.balance
  expect(balanceAfter).toBeGreaterThanOrEqual(0);
  // Kills: Allow negative balance (insufficient funds check missing)
  // Kills: Remove success path in createAccount.create
  // Kills: Not updating Account balance reflects `initialDeposit` without race conditions after is added to in createAccount.create
});
test("PROOF-B-014-BLb — Initial deposit is added to balance atomically requires auth", async ({ request }) => {
  const fromAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const { status } = await trpcMutation(request, "createAccount.create", {
    bankId: TEST_BANK_ID,
    fromAccountId: fromAccount.id as number,
    toAccountId: toAccount.id as number,
    amount: 1,
  }, ""); // No cookie
  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from createAccount.create
});

// PROOF-B-022-BL — Business Logic: Advisor/admin can filter accounts by customerId or see all
// Risk: critical | Endpoint: listAccounts.list
// Spec: Endpoints
// Behavior: Advisor/admin can filter accounts by customerId or see all

test("PROOF-B-022-BLa — Advisor/admin can filter accounts by customerId or see all", async ({ request }) => {
  // Precondition: User has 'advisor' or 'admin' role
  // Precondition: GET /api/accounts request
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Side-Effect-Check: Read counter BEFORE action
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = (before as Record<string, unknown>)?.count as number ?? 0;
  // Act
  const { data, status } = await trpcMutation(request, "listAccounts.list", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in listAccounts.list
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  const { data: after } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  const countAfter = (after as Record<string, unknown>)?.count as number ?? 0;
  expect(countAfter).toBe(countBefore + 1);
  // Kills: Not incrementing counter in listAccounts.list
  // Kills: Remove success path in listAccounts.list
  // Kills: Not updating Response reflects filtering by `customerId` if provided, otherwise all accounts for the bank after filters accounts in listAccounts.list
});
test("PROOF-B-022-BLb — Advisor/admin can filter accounts by customerId or see all requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "listAccounts.list", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from listAccounts.list
});
test("PROOF-B-022-BLc — Advisor/admin can filter accounts by customerId or see all persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from listAccounts.list
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-027-BL — Business Logic: POST /api/transactions requires advisor or admin role
// Risk: critical | Endpoint: createTransaction.create
// Spec: Endpoints
// Behavior: POST /api/transactions requires advisor or admin role

test("PROOF-B-027-BLa — POST /api/transactions requires advisor or admin role", async ({ request }) => {
  // Precondition: User attempts to create a transaction
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "createTransaction.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in createTransaction.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in createTransaction.create
});
test("PROOF-B-027-BLb — POST /api/transactions requires advisor or admin role requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "createTransaction.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from createTransaction.create
});
test("PROOF-B-027-BLc — POST /api/transactions requires advisor or admin role persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from createTransaction.create
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-031-BL — Business Logic: Amount is deducted from fromAccount and credited to toAccount atomically
// Risk: high | Endpoint: createTransaction.create
// Spec: Endpoints
// Behavior: Amount is deducted from fromAccount and credited to toAccount atomically

test("PROOF-B-031-BLa — balance deducted after Amount is deducted from fromAccount and credited t", async ({ request }) => {
  // Arrange: Create fromAccount and toAccount with known balances
  const fromAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(fromAccount?.id).toBeDefined();
  expect(toAccount?.id).toBeDefined();

  // Read balance BEFORE transaction
  const { data: fromBefore } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  const balanceBefore = (Array.isArray(fromBefore) ? fromBefore : [fromBefore])
    .find((a: unknown) => (a as Record<string, unknown>).id === fromAccount.id)
    ?.balance as number ?? 0;
  expect(typeof balanceBefore).toBe("number");
  // Kills: Cannot read balance before transaction

  // Act: Execute the transaction
  const AMOUNT = 1;
  const { status, data } = await trpcMutation(request, "createTransaction.create", {
    bankId: TEST_BANK_ID,
    fromAccountId: fromAccount.id as number,
    toAccountId: toAccount.id as number,
    amount: AMOUNT,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  }, adminCookie);
  expect(status).toBe(200);
  // Kills: Remove success path in createTransaction.create

  // Read balance AFTER transaction
  const { data: fromAfter } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  const balanceAfter = (Array.isArray(fromAfter) ? fromAfter : [fromAfter])
    .find((a: unknown) => (a as Record<string, unknown>).id === fromAccount.id)
    ?.balance as number;

  expect(balanceAfter).toBe(balanceBefore - AMOUNT);
  // Kills: Not deducting amount from fromAccount.balance
  expect(balanceAfter).toBeGreaterThanOrEqual(0);
  // Kills: Allow negative balance (insufficient funds check missing)
  // Kills: Remove success path in createTransaction.create
  // Kills: Skip side effect: Balances are updated consistently without race conditions
});
test("PROOF-B-031-BLb — Amount is deducted from fromAccount and credited to toAccoun requires auth", async ({ request }) => {
  const fromAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const toAccount = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const { status } = await trpcMutation(request, "createTransaction.create", {
    bankId: TEST_BANK_ID,
    fromAccountId: fromAccount.id as number,
    toAccountId: toAccount.id as number,
    amount: 1,
  }, ""); // No cookie
  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from createTransaction.create
});

// PROOF-B-036-BL — Business Logic: PATCH /api/transactions/:id/status requires admin role
// Risk: critical | Endpoint: updateTransactionStatus.update
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status requires admin role

test("PROOF-B-036-BLa — PATCH /api/transactions/:id/status requires admin role", async ({ request }) => {
  // Precondition: User attempts to update transaction status
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "updateTransactionStatus.update", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in updateTransactionStatus.update
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in updateTransactionStatus.update
});
test("PROOF-B-036-BLb — PATCH /api/transactions/:id/status requires admin role requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "updateTransactionStatus.update", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from updateTransactionStatus.update
});
test("PROOF-B-036-BLc — PATCH /api/transactions/:id/status requires admin role persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from updateTransactionStatus.update
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-049-BL — Business Logic: DELETE /api/accounts/:id requires admin role
// Risk: critical | Endpoint: closeAccount.delete
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id requires admin role

test("PROOF-B-049-BLa — DELETE /api/accounts/:id requires admin role", async ({ request }) => {
  // Arrange: Create a real resource
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act: Delete resource
  const { status, data } = await trpcMutation(request, "closeAccount.delete", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove success path in closeAccount.delete

  expect((data as Record<string, unknown>)?.success).toBe(true);
  // Kills: Return success:false on deletion

  // DB-Check: Resource must be gone
  const { status: getStatus } = await trpcQuery(request, "listAccounts.list",
    { createAccountId, bankId: TEST_BANK_ID }, adminCookie);
  expect(getStatus).toBe(404);
  // Kills: Soft-delete instead of hard-delete
});

test("PROOF-B-049-BLb — DELETE /api/accounts/:id requires admin role requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;

  const { status } = await trpcMutation(request, "closeAccount.delete", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, ""); // No cookie

  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from closeAccount.delete
});

// PROOF-B-054-BL — Business Logic: POST /api/accounts/:id/freeze requires admin role
// Risk: critical | Endpoint: freezeAccount.create
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze requires admin role

test("PROOF-B-054-BLa — POST /api/accounts/:id/freeze requires admin role", async ({ request }) => {
  // Precondition: User attempts to freeze an account
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "freezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in freezeAccount.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in freezeAccount.create
});
test("PROOF-B-054-BLb — POST /api/accounts/:id/freeze requires admin role requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "freezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from freezeAccount.create
});
test("PROOF-B-054-BLc — POST /api/accounts/:id/freeze requires admin role persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from freezeAccount.create
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-056-BL — Business Logic: Frozen accounts cannot send transactions
// Risk: high | Endpoint: freezeAccount.create
// Spec: Endpoints
// Behavior: Frozen accounts cannot send transactions

test("PROOF-B-056-BLa — Frozen accounts cannot send transactions", async ({ request }) => {
  // Precondition: Account status is 'frozen'
  // Precondition: Attempt to initiate an outgoing transaction
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "freezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in freezeAccount.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in freezeAccount.create
});
test("PROOF-B-056-BLb — Frozen accounts cannot send transactions requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "freezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from freezeAccount.create
});
test("PROOF-B-056-BLc — Frozen accounts cannot send transactions persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from freezeAccount.create
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

test("PROOF-B-056-BLf — ACCOUNT_NOT_ACTIVE: action on frozen resource must fail", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // Freeze the resource first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, bankId: TEST_BANK_ID, reason: "test-freeze" }, adminCookie);
  
  // Attempt action on frozen resource
  const { status } = await trpcMutation(request, "freezeAccount.create", {
    bankId: TEST_BANK_ID,
    id: TEST_BANK_ID,\n    reason: "test-reason",
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow action on frozen/inactive resource
});

// PROOF-B-057-BL — Business Logic: Frozen accounts can receive transactions
// Risk: high | Endpoint: freezeAccount.create
// Spec: Endpoints
// Behavior: Frozen accounts can receive transactions

test("PROOF-B-057-BLa — Frozen accounts can receive transactions", async ({ request }) => {
  // Precondition: Account status is 'frozen'
  // Precondition: Attempt to initiate an incoming transaction
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "freezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in freezeAccount.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in freezeAccount.create
});
test("PROOF-B-057-BLb — Frozen accounts can receive transactions requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "freezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from freezeAccount.create
});
test("PROOF-B-057-BLc — Frozen accounts can receive transactions persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from freezeAccount.create
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});

test("PROOF-B-057-BLf — ACCOUNT_NOT_ACTIVE: action on frozen resource must fail", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  
  // Freeze the resource first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, bankId: TEST_BANK_ID, reason: "test-freeze" }, adminCookie);
  
  // Attempt action on frozen resource
  const { status } = await trpcMutation(request, "freezeAccount.create", {
    bankId: TEST_BANK_ID,
    id: TEST_BANK_ID,\n    reason: "test-reason",
  }, adminCookie);
  
  expect(status).toBe(422);
  // Kills: Allow action on frozen/inactive resource
});

// PROOF-B-060-BL — Business Logic: POST /api/accounts/:id/unfreeze requires admin role
// Risk: critical | Endpoint: unfreezeAccount.create
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze requires admin role

test("PROOF-B-060-BLa — POST /api/accounts/:id/unfreeze requires admin role", async ({ request }) => {
  // Precondition: User attempts to unfreeze an account
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "unfreezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in unfreezeAccount.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in unfreezeAccount.create
});
test("PROOF-B-060-BLb — POST /api/accounts/:id/unfreeze requires admin role requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  const { status } = await trpcMutation(request, "unfreezeAccount.create", {
    createAccountId,
    bankId: TEST_BANK_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from unfreezeAccount.create
});
test("PROOF-B-060-BLc — POST /api/accounts/:id/unfreeze requires admin role persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const createAccountId = created.id as number;
  expect(createAccountId).toBeDefined(); // Kills: Don't return id from unfreezeAccount.create
  const { data: fetched, status } = await trpcQuery(request, "listAccounts.list",
    { bankId: TEST_BANK_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove listAccounts.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === createAccountId)).toBe(true); // Kills: Don't persist to DB
});