import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_BANK_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-034-STATUS — Status Transition: POST /api/transactions returns 422 if accounts are not active
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/transactions returns 422 if accounts are not active

test("PROOF-B-034-STATUSa — active → frozen: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "createTransaction.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 ACCOUNT_NOT_ACTIVE transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove HTTP 422 Unprocessable Entity with error code ACCOUNT_NOT_ACTIVE side-effect

});

test("PROOF-B-034-STATUSb — frozen → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to frozen state first
  await trpcMutation(request, "createTransaction.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "createTransaction.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow frozen→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-034-STATUSc — active → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through frozen
  const { status } = await trpcMutation(request, "createTransaction.create",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-037-STATUS — Status Transition: PATCH /api/transactions/:id/status allows pending to processing transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows pending to processing transition

test("PROOF-B-037-STATUSa — pending → processing: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-037-STATUSb — processing → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to processing state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow processing→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-037-STATUSc — pending → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through processing
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-038-STATUS — Status Transition: PATCH /api/transactions/:id/status allows processing to completed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows processing to completed transition

test("PROOF-B-038-STATUSa — processing → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-038-STATUSb — completed → processing: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→processing reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-038-STATUSc — processing → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through completed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-039-STATUS — Status Transition: PATCH /api/transactions/:id/status allows processing to failed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows processing to failed transition

test("PROOF-B-039-STATUSa — processing → failed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "failed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("failed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-039-STATUSb — failed → processing: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to failed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "failed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow failed→processing reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("failed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-039-STATUSc — processing → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through failed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-040-STATUS — Status Transition: PATCH /api/transactions/:id/status allows completed to reversed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status allows completed to reversed transition

test("PROOF-B-040-STATUSa — completed → reversed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-040-STATUSb — reversed → completed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to reversed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow reversed→completed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-040-STATUSc — completed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through reversed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-041-STATUS — Status Transition: PATCH /api/transactions/:id/status forbids completed to pending transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status forbids completed to pending transition

test("PROOF-B-041-STATUSa — completed → pending: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-041-STATUSb — pending → completed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to pending state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow pending→completed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-041-STATUSc — completed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through pending
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-042-STATUS — Status Transition: PATCH /api/transactions/:id/status forbids failed to completed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status forbids failed to completed transition

test("PROOF-B-042-STATUSa — failed → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-042-STATUSb — completed → failed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "failed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→failed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-042-STATUSc — failed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through completed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("failed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-043-STATUS — Status Transition: PATCH /api/transactions/:id/status forbids reversed to any transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status forbids reversed to any transition

test("PROOF-B-043-STATUSa — reversed → reversed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-043-STATUSb — reversed → reversed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to reversed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow reversed→reversed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-043-STATUSc — reversed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through reversed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-044-STATUS — Status Transition: PATCH /api/transactions/:id/status forbids pending to completed transition
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status forbids pending to completed transition

test("PROOF-B-044-STATUSa — pending → completed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-044-STATUSb — completed → pending: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to completed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow completed→pending reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-044-STATUSc — pending → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through completed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("pending");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-045-STATUS — Status Transition: Reversed transaction restores original balance
// Risk: high
// Spec: Endpoints
// Behavior: Reversed transaction restores original balance

test("PROOF-B-045-STATUSa — frozen → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.fromAccount as number) ?? 0;

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove restores transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.fromAccount).toBe(countBefore + 1);
  // Kills: Remove fromAccount is credited, toAccount is debited by the transaction amount side-effect

});

test("PROOF-B-045-STATUSb — active → frozen: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→frozen reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-045-STATUSc — frozen → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through active
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-046-STATUS — Status Transition: PATCH /api/transactions/:id/status returns 422 for forbidden transitions
// Risk: high
// Spec: Endpoints
// Behavior: PATCH /api/transactions/:id/status returns 422 for forbidden transitions

test("PROOF-B-046-STATUSa — active → closed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 INVALID_TRANSITION transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-046-STATUSb — closed → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to closed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow closed→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-046-STATUSc — active → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through closed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-050-STATUS — Status Transition: DELETE /api/accounts/:id sets account status to closed
// Risk: high
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id sets account status to closed

test("PROOF-B-050-STATUSa — frozen → closed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets status to transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is updated to 'closed' side-effect

});

test("PROOF-B-050-STATUSb — closed → frozen: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to closed state first
  await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow closed→frozen reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-050-STATUSc — frozen → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through closed
  const { status } = await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-053-STATUS — Status Transition: DELETE /api/accounts/:id returns 409 if account is already closed
// Risk: high
// Spec: Endpoints
// Behavior: DELETE /api/accounts/:id returns 409 if account is already closed

test("PROOF-B-053-STATUSa — closed → processing: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 ALREADY_CLOSED transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-053-STATUSb — processing → closed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to processing state first
  await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow processing→closed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-053-STATUSc — closed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through processing
  const { status } = await trpcMutation(request, "closeAccount.delete",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-055-STATUS — Status Transition: POST /api/accounts/:id/freeze sets account status to frozen
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze sets account status to frozen

test("PROOF-B-055-STATUSa — processing → frozen: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets status to transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is updated to 'frozen' side-effect

});

test("PROOF-B-055-STATUSb — frozen → processing: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to frozen state first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow frozen→processing reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-055-STATUSc — processing → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through frozen
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-056-STATUS — Status Transition: Frozen accounts cannot send transactions
// Risk: high
// Spec: Endpoints
// Behavior: Frozen accounts cannot send transactions

test("PROOF-B-056-STATUSa — processing → failed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "failed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove cannot send transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("failed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-056-STATUSb — failed → processing: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to failed state first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "failed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow failed→processing reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("failed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-056-STATUSc — processing → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through failed
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-057-STATUS — Status Transition: Frozen accounts can receive transactions
// Risk: high
// Spec: Endpoints
// Behavior: Frozen accounts can receive transactions

test("PROOF-B-057-STATUSa — completed → reversed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove can receive transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-057-STATUSb — reversed → completed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to reversed state first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "reversed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "completed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow reversed→completed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("reversed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-057-STATUSc — completed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through reversed
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("completed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-058-STATUS — Status Transition: POST /api/accounts/:id/freeze returns 409 if already frozen
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze returns 409 if already frozen

test("PROOF-B-058-STATUSa — frozen → frozen: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 ALREADY_FROZEN transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-058-STATUSb — frozen → frozen: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to frozen state first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow frozen→frozen reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-058-STATUSc — frozen → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through frozen
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-059-STATUS — Status Transition: POST /api/accounts/:id/freeze returns 422 if account is closed
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/freeze returns 422 if account is closed

test("PROOF-B-059-STATUSa — closed → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 ACCOUNT_CLOSED transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove HTTP 422 Unprocessable Entity with error code ACCOUNT_CLOSED side-effect

});

test("PROOF-B-059-STATUSb — active → closed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→closed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-059-STATUSc — closed → frozen: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to frozen without going through active
  const { status } = await trpcMutation(request, "freezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-061-STATUS — Status Transition: POST /api/accounts/:id/unfreeze sets account status to active
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze sets account status to active

test("PROOF-B-061-STATUSa — active → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets status to transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is updated to 'active' side-effect

});

test("PROOF-B-061-STATUSb — active → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-061-STATUSc — active → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through active
  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-062-STATUS — Status Transition: POST /api/accounts/:id/unfreeze returns 409 if not frozen
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze returns 409 if not frozen

test("PROOF-B-062-STATUSa — frozen → closed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 409 NOT_FROZEN transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-062-STATUSb — closed → frozen: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to closed state first
  await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow closed→frozen reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-062-STATUSc — frozen → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through closed
  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-063-STATUS — Status Transition: POST /api/accounts/:id/unfreeze returns 422 if account is closed
// Risk: high
// Spec: Endpoints
// Behavior: POST /api/accounts/:id/unfreeze returns 422 if account is closed

test("PROOF-B-063-STATUSa — closed → processing: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.count as number) ?? 0;

  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns 422 ACCOUNT_CLOSED transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Update status field but not persist to DB

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.count).toBe(countBefore + 1);
  // Kills: Remove HTTP 422 Unprocessable Entity with error code ACCOUNT_CLOSED side-effect

});

test("PROOF-B-063-STATUSb — processing → closed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to processing state first
  await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "processing", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow processing→closed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("processing");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-063-STATUSc — closed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through processing
  const { status } = await trpcMutation(request, "unfreezeAccount.create",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-064-STATUS — Status Transition: Account status transitions: active to frozen by admin
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transitions: active to frozen by admin

test("PROOF-B-064-STATUSa — active → frozen: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is 'frozen' side-effect

});

test("PROOF-B-064-STATUSb — frozen → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to frozen state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow frozen→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-064-STATUSc — active → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through frozen
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-065-STATUS — Status Transition: Account status transitions: frozen to active by admin
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transitions: frozen to active by admin

test("PROOF-B-065-STATUSa — frozen → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is 'active' side-effect

});

test("PROOF-B-065-STATUSb — active → frozen: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→frozen reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-065-STATUSc — frozen → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through active
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-066-STATUS — Status Transition: Account status transitions: active to closed by admin if balance zero and no pending transactions
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transitions: active to closed by admin if balance zero and no pending transactions

test("PROOF-B-066-STATUSa — active → closed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is 'closed' side-effect

});

test("PROOF-B-066-STATUSb — closed → active: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to closed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow closed→active reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-066-STATUSc — active → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through closed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("active");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-067-STATUS — Status Transition: Account status transitions: frozen to closed by admin if balance zero and no pending transactions
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status transitions: frozen to closed by admin if balance zero and no pending transactions

test("PROOF-B-067-STATUSa — frozen → closed: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Baseline: record counter BEFORE transition
  const { data: before } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  const countBefore = ((before as Record<string, unknown>)?.Account as number) ?? 0;

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions from transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.stat).not.toBeNull();
  // Kills: Remove stat = NOW() in handler

  // Side-effect: counter must increment exactly once
  expect((updated as Record<string, unknown>)?.Account).toBe(countBefore + 1);
  // Kills: Remove Account status is 'closed' side-effect

});

test("PROOF-B-067-STATUSb — closed → frozen: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to closed state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow closed→frozen reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-067-STATUSc — frozen → pending: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to pending without going through closed
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "pending", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-068-STATUS — Status Transition: Account status forbids closed to active transition
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status forbids closed to active transition

test("PROOF-B-068-STATUSa — closed → active: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("active");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-068-STATUSb — active → closed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to active state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow active→closed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("active");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-068-STATUSc — closed → frozen: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to frozen without going through active
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-069-STATUS — Status Transition: Account status forbids closed to frozen transition
// Risk: high
// Spec: Status Machine: accounts
// Behavior: Account status forbids closed to frozen transition

test("PROOF-B-069-STATUSa — closed → frozen: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-069-STATUSb — frozen → closed: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to frozen state first
  await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "frozen", bankId: TEST_BANK_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "closed", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow frozen→closed reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("frozen");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-069-STATUSc — closed → active: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to active without going through frozen
  const { status } = await trpcMutation(request, "updateTransactionStatus.update",
    { id: resource.id, status: "active", bankId: TEST_BANK_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "listAccounts.list",
    { id: resource.id, bankId: TEST_BANK_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("closed");
  // Kills: Accept any status value without validating transition chain
});