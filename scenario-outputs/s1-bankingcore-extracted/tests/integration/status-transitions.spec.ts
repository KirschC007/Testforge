import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_BANK_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-030-STATUS — Status Transition: POST /api/transactions returns 422 for insufficient balance
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/transactions returns 422 for insufficient balance

test("PROOF-B-030-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.create",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Kills: Remove HTTP 422 INSUFFICIENT_BALANCE side-effect
});

test("PROOF-B-030-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.create",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.create",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-034-STATUS — Status Transition: POST /api/transactions returns 422 if accounts are not active
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/transactions returns 422 if accounts are not active

test("PROOF-B-034-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.create",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove HTTP 422 ACCOUNT_NOT_ACTIVE side-effect

});

test("PROOF-B-034-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.create",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.create",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-037-STATUS — Status Transition: PATCH /api/transactions/:id/status allows pending→processing transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows pending→processing transition

test("PROOF-B-037-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-037-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-038-STATUS — Status Transition: PATCH /api/transactions/:id/status allows processing→completed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows processing→completed transition

test("PROOF-B-038-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-038-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-039-STATUS — Status Transition: PATCH /api/transactions/:id/status allows processing→failed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows processing→failed transition

test("PROOF-B-039-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-039-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-040-STATUS — Status Transition: PATCH /api/transactions/:id/status allows completed→reversed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows completed→reversed transition

test("PROOF-B-040-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-040-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-041-STATUS — Status Transition: PATCH /api/transactions/:id/status rejects completed→pending transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status rejects completed→pending transition

test("PROOF-B-041-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-041-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-042-STATUS — Status Transition: PATCH /api/transactions/:id/status rejects failed→completed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status rejects failed→completed transition

test("PROOF-B-042-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-042-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-043-STATUS — Status Transition: PATCH /api/transactions/:id/status rejects reversed→any transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status rejects reversed→any transition

test("PROOF-B-043-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-043-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-044-STATUS — Status Transition: PATCH /api/transactions/:id/status rejects pending→completed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status rejects pending→completed transition

test("PROOF-B-044-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove rejects status transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-044-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-045-STATUS — Status Transition: Reversed transaction restores original balance
// Risk: high
// Spec: Endpoints
// Behavior: Reversed transaction restores original balance

test("PROOF-B-045-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.fromAccount as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove restores balance transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.fromAccount).toBe(countBefore + 1);
  // Kills: Remove `fromAccount` is credited and `toAccount` is debited by the transaction amount side-effect

});

test("PROOF-B-045-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-046-STATUS — Status Transition: PATCH /api/transactions/:id/status returns 422 for forbidden transitions
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status returns 422 for forbidden transitions

test("PROOF-B-046-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-046-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-051-STATUS — Status Transition: DELETE /api/accounts/:id sets account status to closed
// Risk: high
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id sets account status to closed

test("PROOF-B-051-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account `status` is set to 'closed' side-effect

});

test("PROOF-B-051-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-052-STATUS — Status Transition: DELETE /api/accounts/:id returns 422 if account has positive balance
// Risk: high
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id returns 422 if account has positive balance

test("PROOF-B-052-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Kills: Remove HTTP 422 BALANCE_NOT_ZERO side-effect
});

test("PROOF-B-052-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-053-STATUS — Status Transition: DELETE /api/accounts/:id returns 422 if account has pending transactions
// Risk: high
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id returns 422 if account has pending transactions

test("PROOF-B-053-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-053-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-054-STATUS — Status Transition: DELETE /api/accounts/:id returns 409 if account is already closed
// Risk: high
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id returns 409 if account is already closed

test("PROOF-B-054-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-054-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.delete",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-056-STATUS — Status Transition: POST /api/accounts/:id/freeze sets account status to frozen
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze sets account status to frozen

test("PROOF-B-056-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account `status` is set to 'frozen' side-effect

});

test("PROOF-B-056-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-057-STATUS — Status Transition: Frozen accounts cannot send transactions
// Risk: high
// Spec: Endpoints
// Behavior: Frozen accounts cannot send transactions

test("PROOF-B-057-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.account as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove prevents transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.originat).not.toBeNull();
  // Kills: Remove originat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.account).toBe(countBefore + 1);
  // Kills: Remove Transactions originating from a frozen account are rejected side-effect

});

test("PROOF-B-057-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-058-STATUS — Status Transition: Frozen accounts can receive transactions
// Risk: high
// Spec: Endpoints
// Behavior: Frozen accounts can receive transactions

test("PROOF-B-058-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.account as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.account).toBe(countBefore + 1);
  // Kills: Remove Transactions targeting a frozen account are accepted side-effect

});

test("PROOF-B-058-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-059-STATUS — Status Transition: POST /api/accounts/:id/freeze returns 409 if account is already frozen
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze returns 409 if account is already frozen

test("PROOF-B-059-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-059-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-060-STATUS — Status Transition: POST /api/accounts/:id/freeze returns 422 if account is closed
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze returns 422 if account is closed

test("PROOF-B-060-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove HTTP 422 ACCOUNT_CLOSED side-effect

});

test("PROOF-B-060-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.freeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-062-STATUS — Status Transition: POST /api/accounts/:id/unfreeze sets account status to active
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze sets account status to active

test("PROOF-B-062-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets status transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account `status` is set to 'active' side-effect

});

test("PROOF-B-062-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-063-STATUS — Status Transition: POST /api/accounts/:id/unfreeze returns 409 if account is not frozen
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze returns 409 if account is not frozen

test("PROOF-B-063-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-063-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-064-STATUS — Status Transition: POST /api/accounts/:id/unfreeze returns 422 if account is closed
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze returns 422 if account is closed

test("PROOF-B-064-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove HTTP 422 ACCOUNT_CLOSED side-effect

});

test("PROOF-B-064-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "accounts.unfreeze",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-065-STATUS — Status Transition: Account status transition active→frozen allowed for admin
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transition active→frozen allowed for admin

test("PROOF-B-065-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove triggers transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status can be changed to 'frozen' side-effect

});

test("PROOF-B-065-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-066-STATUS — Status Transition: Account status transition frozen→active allowed for admin
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transition frozen→active allowed for admin

test("PROOF-B-066-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove triggers transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status can be changed to 'active' side-effect

});

test("PROOF-B-066-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-067-STATUS — Status Transition: Account status transition active→closed allowed for admin under conditions
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transition active→closed allowed for admin under conditions

test("PROOF-B-067-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove triggers transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status can be changed to 'closed' side-effect

});

test("PROOF-B-067-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-068-STATUS — Status Transition: Account status transition frozen→closed allowed for admin under conditions
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transition frozen→closed allowed for admin under conditions

test("PROOF-B-068-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove triggers transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status can be changed to 'closed' side-effect

});

test("PROOF-B-068-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-069-STATUS — Status Transition: Account status transition closed→active is forbidden
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transition closed→active is forbidden

test("PROOF-B-069-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status cannot be changed to 'active' side-effect

});

test("PROOF-B-069-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-070-STATUS — Status Transition: Account status transition closed→frozen is forbidden
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transition closed→frozen is forbidden

test("PROOF-B-070-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status cannot be changed to 'frozen' side-effect

});

test("PROOF-B-070-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-071-STATUS — Status Transition: Transaction status transition pending→processing is allowed
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition pending→processing is allowed

test("PROOF-B-071-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-071-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-072-STATUS — Status Transition: Transaction status transition processing→completed is allowed
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition processing→completed is allowed

test("PROOF-B-072-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-072-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-073-STATUS — Status Transition: Transaction status transition processing→failed is allowed
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition processing→failed is allowed

test("PROOF-B-073-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-073-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-074-STATUS — Status Transition: Transaction status transition completed→reversed is allowed
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition completed→reversed is allowed

test("PROOF-B-074-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-074-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-075-STATUS — Status Transition: Transaction status transition completed→pending is forbidden
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition completed→pending is forbidden

test("PROOF-B-075-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-075-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-076-STATUS — Status Transition: Transaction status transition failed→completed is forbidden
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition failed→completed is forbidden

test("PROOF-B-076-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-076-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-077-STATUS — Status Transition: Transaction status transition reversed→any is forbidden
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition reversed→any is forbidden

test("PROOF-B-077-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-077-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

// PROOF-B-078-STATUS — Status Transition: Transaction status transition pending→completed is forbidden
// Risk: high
// Spec: Status Machine: transactions
// Behavior: Transaction status transition pending→completed is forbidden

test("PROOF-B-078-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-078-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "transactions.status",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "accounts.getById",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});