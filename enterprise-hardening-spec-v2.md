# BankCore API — Enterprise Hardening Spec v2

## System Overview

BankCore is a multi-tenant banking API serving retail banks. Each bank (`bankId`) is a tenant. Users have roles: `teller`, `branch_manager`, `compliance_officer`, `auditor`, `admin`, `customer`. All monetary operations are in EUR with 2 decimal precision.

## Authentication & Session

- `POST /auth/login` — accepts `{ username, password }`, returns JWT session cookie (HttpOnly, Secure, SameSite=Strict). Rate-limited to 5 attempts per 15 minutes per IP. After 5 failures, account is locked for 30 minutes. Lockout state MUST persist across server restarts (stored in DB, not in-memory).
- `POST /auth/logout` — invalidates session server-side. The session token MUST be blacklisted in DB immediately. Replaying a logged-out token MUST return 401.
- `GET /auth/me` — returns current user profile. MUST NOT include password hash, JWT secret, or internal DB IDs.
- JWT tokens MUST be signed with a secret loaded from environment variable `JWT_SECRET`. Hardcoding `"secret"`, `"changeme"`, or any string under 32 characters as the JWT secret is forbidden.
- JWT algorithm MUST be HS256 or stronger. Algorithm `"none"` MUST be rejected.
- Session tokens MUST expire after 8 hours. Expired tokens MUST return 401.

## Tenant Isolation (IDOR Prevention)

- All resources are scoped to `bankId`. A teller from `bankId=1` MUST NOT access accounts, transactions, or customers from `bankId=2`.
- `GET /accounts/:accountId` — returns account details. If `accountId` belongs to a different bank, MUST return 404 (not 403, to prevent enumeration).
- `GET /accounts?bankId=X` — lists accounts. MUST filter by authenticated user's bankId. Passing a different `bankId` in query params MUST be ignored (use token's bankId).
- `GET /transactions?bankId=X&accountId=Y` — lists transactions. Cross-tenant access MUST return empty list or 404.
- `GET /customers?bankId=X` — lists customers. Cross-tenant access MUST return 404.

## Fund Transfers

- `POST /transfers` — initiates a transfer. Fields: `{ fromAccountId, toAccountId, amount, currency, idempotencyKey, bankId }`.
  - `amount` must be > 0.00 and ≤ 1,000,000.00 EUR.
  - Negative amounts MUST return 422.
  - Zero amounts MUST return 422.
  - Amounts above 1,000,000.00 MUST return 422.
  - `currency` must be `"EUR"`. Other currencies MUST return 422.
  - `fromAccountId` and `toAccountId` MUST belong to the same `bankId`. Cross-bank transfers MUST return 403.
  - `fromAccountId` MUST NOT equal `toAccountId`. Self-transfers MUST return 422.
  - Insufficient funds MUST return 422 with error code `INSUFFICIENT_FUNDS`.
  - The debit and credit operations MUST be atomic (single DB transaction). Partial execution (debit without credit) MUST be impossible.
  - Concurrent transfers from the same account MUST be serialized. Two simultaneous transfers that would together overdraw the account: exactly one MUST succeed, one MUST fail with `INSUFFICIENT_FUNDS`.
  - `idempotencyKey` MUST be unique per bank. Submitting the same key twice MUST return the original response (409 or 200 with original result), never execute twice.
  - Only `teller` and `branch_manager` roles may initiate transfers. `customer`, `auditor`, `compliance_officer` MUST receive 403.

## AML (Anti-Money Laundering) Approval

- Transfers above 10,000 EUR require AML approval: status transitions to `pending_aml`.
- `POST /transfers/:id/approve-aml` — approves AML review. Only `compliance_officer` may approve. `teller`, `branch_manager`, `admin`, `auditor`, `customer` MUST receive 403.
- `POST /transfers/:id/reject-aml` — rejects AML review. Only `compliance_officer` may reject.
- A `compliance_officer` MUST NOT approve their own submitted transfers (self-approval forbidden).
- Status transitions: `pending` → `pending_aml` (auto, if amount > 10000) → `approved` or `rejected`. Direct `pending` → `approved` for amounts > 10000 is forbidden.
- `pending_aml` → `pending` (reversal) is forbidden.
- `approved` → any state is forbidden (terminal).
- `rejected` → any state is forbidden (terminal).

## Account Management

- `POST /accounts` — creates a new account. Fields: `{ bankId, customerId, accountType, initialBalance, currency }`.
  - `accountType` must be one of: `"checking"`, `"savings"`, `"business"`. Invalid values MUST return 422.
  - `initialBalance` must be ≥ 0.00. Negative initial balance MUST return 422.
  - `currency` must be `"EUR"`.
  - Only `branch_manager` and `admin` may create accounts. `teller`, `customer`, `auditor` MUST receive 403.
- `DELETE /accounts/:accountId` — closes account. MUST fail with 422 if account has non-zero balance.
- `GET /accounts/:accountId/balance` — returns current balance. Balance MUST reflect all committed transactions. Uncommitted (in-flight) transactions MUST NOT affect reported balance.

## Customer Data (GDPR)

- `GET /customers/:customerId` — returns customer profile. MUST NOT include password hash, SSN raw value, or full card numbers (PAN masking: show only last 4 digits).
- `POST /customers/:customerId/gdpr-export` — exports all personal data for a customer. Only `compliance_officer` and `admin` may trigger. Response MUST include all PII fields. MUST be scoped to requesting bank's customers only.
- `DELETE /customers/:customerId/gdpr-delete` — anonymizes customer data (GDPR Art. 17). Sets name to `"DELETED"`, email to `"deleted@deleted.invalid"`, removes SSN, phone. Account data is retained for regulatory purposes. Only `admin` may trigger. MUST return 200 with `{ anonymized: true }`.
- After GDPR deletion, `GET /customers/:customerId` MUST return the anonymized record (not 404).

## Search & Query Endpoints (SQL Injection)

- `GET /accounts/search?q=<term>&bankId=X` — full-text search on account holder name. The `q` parameter MUST be passed as a parameterized query to the DB. String concatenation into raw SQL is forbidden.
- `GET /transactions/search?q=<term>&bankId=X` — full-text search on transaction descriptions. Same SQL injection invariant applies.
- `GET /customers/search?q=<term>&bankId=X` — full-text search on customer names. Same SQL injection invariant applies.
- SQL injection payloads (`' OR '1'='1`, `'; DROP TABLE`, `UNION SELECT`, `sleep(5)`) MUST return 400 or 200 with empty results. MUST NOT return 500 or expose DB error messages.
- Search results MUST be scoped to the authenticated user's `bankId`. Injecting a different `bankId` via `q` parameter MUST be ignored.

## Audit Log

- Every state-changing operation (transfer, account create/close, AML approve/reject, GDPR delete) MUST create an audit log entry, regardless of whether the operation succeeds or fails.
- Failed operations (e.g., insufficient funds, 403 errors) MUST also be logged with `status: "failed"` and `reason`.
- `GET /audit-log?bankId=X` — returns audit log. Only `auditor`, `compliance_officer`, and `admin` may access. `teller`, `branch_manager`, `customer` MUST receive 403.
- Audit log entries MUST NOT be deletable or modifiable by any role (append-only).

## Rate Limiting & DoS Prevention

- `POST /auth/login`: max 5 requests per 15 minutes per IP. 6th request MUST return 429.
- `POST /transfers`: max 100 transfers per minute per `bankId`. Exceeding MUST return 429.
- `GET /accounts/search`: max 30 requests per minute per user. Exceeding MUST return 429.
- `pageSize` parameter on all list endpoints MUST be capped at 100. Requesting `pageSize=10000` MUST return at most 100 results.

## Secret & Configuration Security

- JWT_SECRET MUST be loaded from environment variable, never hardcoded.
- Database connection strings MUST NOT appear in API responses or error messages.
- API error responses MUST NOT include stack traces, file paths, or `node_modules` references.
- Internal service URLs MUST NOT be exposed in API responses.
- The `/health` endpoint MUST NOT return DB credentials, environment variable values, or internal IP addresses.

## Invariants (Always True)

1. A user can only access resources belonging to their `bankId`.
2. Monetary operations are atomic — partial execution is impossible.
3. All user input reaching the database is parameterized — no raw string concatenation.
4. Secrets are never hardcoded — always loaded from environment.
5. Audit log is append-only — no delete or update operations exist.
6. AML approval requires `compliance_officer` role — no other role can bypass.
7. Idempotency keys prevent duplicate execution — same key = same result.
8. Rate limits are enforced server-side and persist across restarts.
9. GDPR deletion anonymizes data but retains financial records for compliance.
10. JWT algorithm `"none"` is always rejected.
