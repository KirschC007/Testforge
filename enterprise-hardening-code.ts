/**
 * BankCore API — Server Implementation
 * WARNING: This file contains INTENTIONAL BUGS for security testing.
 * DO NOT use in production.
 *
 * Hidden bugs:
 * BUG-01: SQL Injection in accounts.list (string concatenation in filter)
 * BUG-02: IDOR in accounts.get (no bankId check — any authenticated user can read any account)
 * BUG-03: Race condition in transactions.create (balance check and debit not atomic)
 * BUG-04: Missing CSRF validation on transfers.initiate
 * BUG-05: teller can approve own AML-flagged transfers (role check missing)
 * BUG-06: Negative amount allowed in transactions.create (no min validation)
 * BUG-07: Lockout counter stored in-memory (resets on server restart)
 * BUG-08: Audit log skipped on failed transactions (only logs success)
 * BUG-09: DSGVO export leaks all banks' data (missing bankId filter)
 * BUG-10: Idempotency key not checked — double-booking possible
 * BUG-11: JWT secret hardcoded in source
 * BUG-12: pageSize not capped — allows fetching unlimited rows (DoS)
 */

import { z } from "zod";

// BUG-11: Hardcoded JWT secret
const JWT_SECRET = "supersecret123";

// BUG-07: In-memory lockout counter (resets on restart)
const loginAttempts: Record<string, { count: number; lockedUntil?: number }> = {};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function authLogin(db: any, input: { email: string; password: string; bankId: string }) {
  const { email, password, bankId } = input;

  // BUG-07: In-memory only, not persisted to DB
  const attempts = loginAttempts[email] || { count: 0 };
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    throw { code: "LOCKOUT", message: "Account locked" };
  }

  const user = await db.query(`SELECT * FROM users WHERE email = '${email}' AND bank_id = '${bankId}'`);
  // BUG-01 (also here): raw string interpolation in SQL

  if (!user || user.password_hash !== hashPassword(password)) {
    attempts.count++;
    if (attempts.count >= 5) {
      attempts.lockedUntil = Date.now() + 30 * 60 * 1000;
    }
    loginAttempts[email] = attempts;
    throw { code: "UNAUTHORIZED", message: "Invalid credentials" };
  }

  loginAttempts[email] = { count: 0 };
  return { token: signJwt({ userId: user.id, bankId, role: user.role }, JWT_SECRET) };
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function accountsGet(db: any, ctx: { user: { bankId: string; role: string; customerId?: string } }, input: { accountId: string }) {
  // BUG-02: No bankId check — IDOR vulnerability
  // Any authenticated user from ANY bank can read ANY account by ID
  const account = await db.query(
    `SELECT * FROM accounts WHERE id = ?`,
    [input.accountId]
  );
  if (!account) throw { code: "NOT_FOUND" };
  return account;
}

export async function accountsList(db: any, ctx: { user: { bankId: string; role: string } }, input: {
  bankId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  accountType?: string;
}) {
  const { bankId, page = 1, pageSize = 20, status, accountType } = input;

  // BUG-12: pageSize not capped — attacker can request pageSize=999999
  const offset = (page - 1) * pageSize;

  // BUG-01: SQL Injection via string concatenation in filter
  let query = `SELECT * FROM accounts WHERE bank_id = ? LIMIT ${pageSize} OFFSET ${offset}`;
  const params: any[] = [bankId];

  if (status) {
    // VULNERABLE: status is injected directly without parameterization
    query = `SELECT * FROM accounts WHERE bank_id = ? AND status = '${status}' LIMIT ${pageSize} OFFSET ${offset}`;
  }
  if (accountType) {
    query += ` AND account_type = '${accountType}'`; // BUG-01 continued
  }

  return db.query(query, params);
}

export async function accountsCreate(db: any, ctx: { user: { bankId: string; role: string } }, input: {
  bankId: string;
  customerId: string;
  accountType: string;
  currency: string;
  initialDeposit?: number;
}) {
  if (!["bank_admin", "teller"].includes(ctx.user.role)) {
    throw { code: "FORBIDDEN" };
  }
  // Missing: bankId from body vs JWT check (partial IDOR)
  const account = await db.query(
    `INSERT INTO accounts (bank_id, customer_id, account_type, currency, balance, status) VALUES (?, ?, ?, ?, ?, 'active')`,
    [input.bankId, input.customerId, input.accountType, input.currency, input.initialDeposit ?? 0]
  );
  return account;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function transactionsCreate(db: any, ctx: { user: { bankId: string; role: string } }, input: {
  bankId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  reference?: string;
  idempotencyKey?: string;
}) {
  const { fromAccountId, toAccountId, amount, bankId } = input;

  // BUG-06: No minimum amount validation — negative amounts allowed
  // This allows reversing transactions: amount = -500 credits fromAccount
  if (amount === 0) throw { code: "VALIDATION_ERROR", message: "Amount cannot be zero" };

  // BUG-10: Idempotency key not checked
  // Double-booking possible on network retry

  // BUG-03: Race condition — balance check and debit are NOT atomic
  // Two concurrent requests can both pass the balance check and both debit
  const fromAccount = await db.query(`SELECT * FROM accounts WHERE id = ? AND bank_id = ?`, [fromAccountId, bankId]);
  if (!fromAccount) throw { code: "NOT_FOUND" };
  if (fromAccount.status === "frozen") throw { code: "ACCOUNT_FROZEN" };
  if (fromAccount.status === "closed") throw { code: "ACCOUNT_FROZEN" };

  // BUG-03: No SELECT FOR UPDATE / transaction lock here
  if (fromAccount.balance < amount) {
    throw { code: "INSUFFICIENT_FUNDS" };
  }

  // Gap between check and update — race condition window
  const toAccount = await db.query(`SELECT * FROM accounts WHERE id = ?`, [toAccountId]);
  if (!toAccount) throw { code: "NOT_FOUND" };

  // BUG-03: Two separate updates instead of atomic transaction
  await db.query(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [amount, fromAccountId]);
  await db.query(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [amount, toAccountId]);

  const tx = await db.query(
    `INSERT INTO transactions (bank_id, from_account_id, to_account_id, amount, currency, status) VALUES (?, ?, ?, ?, ?, 'completed')`,
    [bankId, fromAccountId, toAccountId, amount, input.currency]
  );

  // BUG-08: Audit log only on success path, not on error
  await db.query(
    `INSERT INTO audit_logs (bank_id, user_id, action, resource_type, resource_id) VALUES (?, ?, 'transaction.create', 'transaction', ?)`,
    [bankId, ctx.user, tx.id]
  );

  return tx;
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export async function transfersInitiate(db: any, ctx: { user: { bankId: string; role: string; userId: string } }, input: {
  bankId: string;
  fromAccountId: string;
  toBankId: string;
  toIban: string;
  amount: number;
  currency: string;
  purpose: string;
}) {
  // BUG-04: No CSRF token validation
  if (!["teller", "bank_admin"].includes(ctx.user.role)) {
    throw { code: "FORBIDDEN" };
  }

  // Teller limit check
  if (ctx.user.role === "teller" && input.amount > 50000) {
    throw { code: "FORBIDDEN", message: "Teller limit exceeded" };
  }

  const amlFlag = input.amount > 10000;
  const status = amlFlag ? "pending" : "processing";

  const transfer = await db.query(
    `INSERT INTO transfers (bank_id, from_account_id, to_bank_id, to_iban, amount, currency, purpose, status, aml_flag, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.bankId, input.fromAccountId, input.toBankId, input.toIban, input.amount, input.currency, input.purpose, status, amlFlag, ctx.user.userId]
  );

  return transfer;
}

export async function transfersApprove(db: any, ctx: { user: { bankId: string; role: string; userId: string } }, input: { transferId: string }) {
  // BUG-05: teller can approve — role check is wrong
  // Should be: only auditor and bank_admin
  // Actual check allows teller through:
  if (!["teller", "auditor", "bank_admin"].includes(ctx.user.role)) {
    throw { code: "FORBIDDEN" };
  }

  const transfer = await db.query(`SELECT * FROM transfers WHERE id = ? AND bank_id = ?`, [input.transferId, ctx.user.bankId]);
  if (!transfer) throw { code: "NOT_FOUND" };
  if (transfer.status !== "pending") throw { code: "VALIDATION_ERROR", message: "Transfer not pending" };

  await db.query(`UPDATE transfers SET status = 'processing', approved_by = ? WHERE id = ?`, [ctx.user.userId, input.transferId]);
  return { success: true };
}

export async function transfersReject(db: any, ctx: { user: { bankId: string; role: string; userId: string } }, input: { transferId: string; reason: string }) {
  if (!["auditor", "bank_admin"].includes(ctx.user.role)) {
    throw { code: "FORBIDDEN" };
  }
  if (!input.reason || input.reason.length < 10) {
    throw { code: "VALIDATION_ERROR", message: "Reason too short" };
  }
  await db.query(`UPDATE transfers SET status = 'rejected', rejection_reason = ? WHERE id = ?`, [input.reason, input.transferId]);
  return { success: true };
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export async function complianceGdprExport(db: any, ctx: { user: { bankId: string; role: string } }, input: { customerId: string }) {
  if (!["bank_admin", "super_admin"].includes(ctx.user.role)) {
    throw { code: "FORBIDDEN" };
  }

  // BUG-09: Missing bankId filter — bank_admin can export customers from other banks
  const customer = await db.query(`SELECT * FROM customers WHERE id = ?`, [input.customerId]);
  const accounts = await db.query(`SELECT * FROM accounts WHERE customer_id = ?`, [input.customerId]);
  const transactions = await db.query(
    `SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE customer_id = ?)`,
    [input.customerId]
  );

  return { customer, accounts, transactions };
}

export async function complianceGdprDelete(db: any, ctx: { user: { bankId: string; role: string } }, input: { customerId: string }) {
  if (!["bank_admin", "super_admin"].includes(ctx.user.role)) {
    throw { code: "FORBIDDEN" };
  }

  // Anonymize PII — correct implementation
  await db.query(
    `UPDATE customers SET name = 'ANONYMIZED', email = 'anon@deleted.invalid', phone = NULL, address = NULL, date_of_birth = NULL, tax_id = NULL WHERE id = ? AND bank_id = ?`,
    [input.customerId, ctx.user.bankId]
  );

  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  // Simplified for test — in real code use bcrypt
  return Buffer.from(password).toString("base64");
}

function signJwt(payload: object, secret: string): string {
  // Simplified for test
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
