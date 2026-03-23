import { expect, test } from "@playwright/test";
import { trpcMutation } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_BANK_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-004-BOUND — Boundary: Monetary values are stored in EUR cents as integers
// Risk: medium
// Boundary Field: initialDeposit (number, min: 0, max: 1000000)

const basePayload_PROOF_B_004_BOUND = (boundaryValue: unknown) => ({
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: boundaryValue,
});

test("PROOF-B-004-BOUNDa — initialDeposit=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createAccount.create", basePayload_PROOF_B_004_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in initialDeposit validation (off-by-one)
});

test("PROOF-B-004-BOUNDb — initialDeposit=1000000 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createAccount.create", basePayload_PROOF_B_004_BOUND(1000000), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in initialDeposit validation (off-by-one)
});

test("PROOF-B-004-BOUNDc — initialDeposit=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createAccount.create", basePayload_PROOF_B_004_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove initialDeposit boundary validation
});

test("PROOF-B-004-BOUNDd — initialDeposit=1000001 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createAccount.create", basePayload_PROOF_B_004_BOUND(1000001), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove initialDeposit boundary validation
});

test("PROOF-B-004-BOUNDe — initialDeposit=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "createAccount.create", basePayload_PROOF_B_004_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove initialDeposit boundary validation
});

// PROOF-B-030-BOUND — Boundary: POST /api/transactions returns 422 for insufficient balance
// Risk: high
// Boundary Field: amount (number, min: 1, max: 50000000)

const basePayload_PROOF_B_030_BOUND = (boundaryValue: unknown) => ({
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    idempotencyKey: "idempotency-key-${Date.now()}",
    amount: boundaryValue,
});

test("PROOF-B-030-BOUNDa — amount=1.00 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createTransaction.create", basePayload_PROOF_B_030_BOUND(1.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in amount validation (off-by-one)
});

test("PROOF-B-030-BOUNDb — amount=50000000.00 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createTransaction.create", basePayload_PROOF_B_030_BOUND(50000000.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in amount validation (off-by-one)
});

test("PROOF-B-030-BOUNDc — amount=0.99 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createTransaction.create", basePayload_PROOF_B_030_BOUND(0.99), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove amount boundary validation
});

test("PROOF-B-030-BOUNDd — amount=50000000.01 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "createTransaction.create", basePayload_PROOF_B_030_BOUND(50000000.01), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove amount boundary validation
});

test("PROOF-B-030-BOUNDe — amount=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "createTransaction.create", basePayload_PROOF_B_030_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove amount boundary validation
});

// PROOF-B-051-BOUND — Boundary: DELETE /api/accounts/:id returns 422 if account has positive balance
// Risk: high

const basePayload_PROOF_B_051_BOUND = (boundaryValue: unknown) => ({
    id: TEST_BANK_ID,
    role: boundaryValue,
});

test("PROOF-B-051-BOUNDa — role=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "closeAccount.delete", basePayload_PROOF_B_051_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in role validation (off-by-one)
});

test("PROOF-B-051-BOUNDb — role=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "closeAccount.delete", basePayload_PROOF_B_051_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in role validation (off-by-one)
});

test("PROOF-B-051-BOUNDc — role=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "closeAccount.delete", basePayload_PROOF_B_051_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove role boundary validation
});

test("PROOF-B-051-BOUNDd — role=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "closeAccount.delete", basePayload_PROOF_B_051_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove role boundary validation
});

test("PROOF-B-051-BOUNDe — role=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "closeAccount.delete", basePayload_PROOF_B_051_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove role boundary validation
});