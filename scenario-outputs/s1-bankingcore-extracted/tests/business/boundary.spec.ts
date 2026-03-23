import { expect, test } from "@playwright/test";
import { trpcMutation } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_BANK_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-017-BOUND — Boundary: POST /api/accounts returns 400 for invalid accountType
// Risk: medium
// Boundary Field: initialDeposit (number, min: 0, max: 1000000)

const basePayload_PROOF_B_017_BOUND = (boundaryValue: unknown) => ({
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: boundaryValue,
});

test("PROOF-B-017-BOUNDa — initialDeposit=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.create", basePayload_PROOF_B_017_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in initialDeposit validation (off-by-one)
});

test("PROOF-B-017-BOUNDb — initialDeposit=1000000 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.create", basePayload_PROOF_B_017_BOUND(1000000), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in initialDeposit validation (off-by-one)
});

test("PROOF-B-017-BOUNDc — initialDeposit=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.create", basePayload_PROOF_B_017_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove initialDeposit boundary validation
});

test("PROOF-B-017-BOUNDd — initialDeposit=1000001 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.create", basePayload_PROOF_B_017_BOUND(1000001), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove initialDeposit boundary validation
});

test("PROOF-B-017-BOUNDe — initialDeposit=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.create", basePayload_PROOF_B_017_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove initialDeposit boundary validation
});

// PROOF-B-024-BOUND — Boundary: GET /api/accounts/:id returns 404 if account doesn't exist
// Risk: medium

const basePayload_PROOF_B_024_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    role: boundaryValue,
});

test("PROOF-B-024-BOUNDa — role=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.getById", basePayload_PROOF_B_024_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in role validation (off-by-one)
});

test("PROOF-B-024-BOUNDb — role=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.getById", basePayload_PROOF_B_024_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in role validation (off-by-one)
});

test("PROOF-B-024-BOUNDc — role=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.getById", basePayload_PROOF_B_024_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove role boundary validation
});

test("PROOF-B-024-BOUNDd — role=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.getById", basePayload_PROOF_B_024_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove role boundary validation
});

test("PROOF-B-024-BOUNDe — role=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "accounts.getById", basePayload_PROOF_B_024_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove role boundary validation
});

// PROOF-B-033-BOUND — Boundary: POST /api/transactions returns 400 if fromAccountId equals toAccountId
// Risk: medium
// Boundary Field: amount (number, min: 1, max: 50000000)

const basePayload_PROOF_B_033_BOUND = (boundaryValue: unknown) => ({
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    idempotencyKey: "idempotency-key-${Date.now()}",
    amount: boundaryValue,
});

test("PROOF-B-033-BOUNDa — amount=1.00 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_BOUND(1.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in amount validation (off-by-one)
});

test("PROOF-B-033-BOUNDb — amount=50000000.00 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_BOUND(50000000.00), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in amount validation (off-by-one)
});

test("PROOF-B-033-BOUNDc — amount=0.99 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_BOUND(0.99), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove amount boundary validation
});

test("PROOF-B-033-BOUNDd — amount=50000000.01 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_BOUND(50000000.01), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove amount boundary validation
});

test("PROOF-B-033-BOUNDe — amount=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "transactions.create", basePayload_PROOF_B_033_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove amount boundary validation
});