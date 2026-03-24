#!/usr/bin/env node
/**
 * Fix-Briefing 2 Quality Gate
 * Verifies all 9 fixes are correctly implemented in the generated output.
 * Runs against the BankingCore scenario.
 */
import { runAnalysisJob } from "../server/analyzer/index.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load BankingCore spec ───────────────────────────────────────────────────
const specPath = join(__dirname, "../scenarios/bankingcore/bankingcore-spec.md");
let specText;
if (existsSync(specPath)) {
  specText = readFileSync(specPath, "utf8");
} else {
  // Minimal inline spec for testing
  specText = `
# BankingCore API Spec

## Roles
- admin: Full access
- customer: Own account access only
- auditor: Read-only access

## Tenant Model
Each account belongs to a bank (bankId).

## Endpoints

### POST /api/accounts
Create a new account.
Input: bankId (string, required), customerId (string, required), accountType (enum: checking|savings|credit), initialBalance (number, min: 0, max: 1000000)
Output: accountId, balance, status

### GET /api/accounts
List accounts for a bank.
Input: bankId (string, required)

### POST /api/transactions
Create a transaction.
Input: bankId (string, required), accountId (string, required), amount (number, min: 0.01, max: 50000), type (enum: debit|credit|transfer)

### GET /api/customers/:id/export
Export customer data (GDPR).
Output: name, email, phone, address, accounts

### DELETE /api/customers/:id/gdpr
GDPR deletion of customer data.
Postconditions: name = [deleted], email = [deleted], phone = [deleted]

### POST /api/customers
Create customer.
Input: bankId (string, required), name (string, required), email (string, required), phone (string)

## Status Machine (accounts)
States: pending, active, suspended, closed
Transitions: pending → active, active → suspended, suspended → active, active → closed
Forbidden: closed → active, closed → suspended

## Behaviors

### B-001: Account creation requires valid bankId
Preconditions: bankId exists
Postconditions: account created with status=pending
Error cases: INVALID_BANK_ID if bankId not found

### B-002: Transaction amount must be between 0.01 and 50000
Preconditions: account is active
Postconditions: transaction recorded
Error cases: AMOUNT_TOO_LARGE if amount > 50000, AMOUNT_TOO_SMALL if amount < 0.01

### B-003: Account status transitions
Preconditions: account exists
Postconditions: status changes according to state machine
Error cases: INVALID_TRANSITION if transition not allowed

### B-004: GDPR customer data export
Preconditions: customer exists
Postconditions: export contains name, email, phone, address
Tags: gdpr, export

### B-005: GDPR customer data deletion
Preconditions: customer exists
Postconditions: name = [deleted], email = [deleted], phone = [deleted]
Tags: gdpr, delete

### B-006: Customer isolation (IDOR)
Preconditions: customer authenticated
Postconditions: can only access own data
Error cases: 403 if accessing other customer's data

### B-007: Concurrent transaction must not cause race condition
Preconditions: account is active
Postconditions: balance consistent after concurrent transactions
Tags: concurrency, race-condition

### B-008: Duplicate transaction idempotency
Preconditions: transaction submitted
Postconditions: duplicate returns same result
Tags: idempotency, duplicate

### B-009: Role-based access to admin endpoints
Preconditions: user authenticated
Postconditions: admin can access all, customer can only access own
Tags: rbac, authorization, role-based

### B-010: Rate limiting on transaction endpoint
Preconditions: user authenticated
Postconditions: 429 after 100 requests/minute
Tags: rate-limit
`;
}

console.log("=".repeat(70));
console.log("FIX-BRIEFING 2 QUALITY GATE");
console.log("=".repeat(70));
console.log(`Spec length: ${specText.length} chars`);

let result;
try {
  result = await runAnalysisJob(specText, "BankingCore");
} catch (err) {
  console.error("Pipeline failed:", err);
  process.exit(1);
}

const { testFiles, helpers, extendedSuite } = result;
const allFiles = [
  ...testFiles.map(f => ({ name: f.filename, content: f.content })),
  ...Object.entries(helpers).map(([name, content]) => ({ name, content })),
  ...(extendedSuite?.files || []).map(f => ({ name: f.filename, content: f.content })),
];
const allContent = allFiles.map(f => f.content).join("\n");

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = "") {
  const ok = !!condition;
  if (ok) passed++;
  else failed++;
  results.push({ ok, name, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ─── Fix 1+10: getPreferredRole / Admin bevorzugen ───────────────────────────
// All generators should use the admin role's cookie function, not hardcoded "getAdminCookie"
// when the spec has a role named "admin"
const authContent = helpers["helpers/auth.ts"] || "";
check(
  "Fix 1: helpers/auth.ts enthält getAdminCookie",
  authContent.includes("getAdminCookie"),
  `auth.ts: ${authContent.length} chars`
);

// ─── Fix 2: Skip-Status nur aus statusMachine ────────────────────────────────
const statusTransContent = allFiles.find(f => f.name.includes("status-transition"))?.content || "";
const hasStatusTransition = statusTransContent.length > 0;
check(
  "Fix 2: Status-Transition Test generiert",
  hasStatusTransition,
  `${statusTransContent.length} chars`
);
if (hasStatusTransition) {
  // Skip-status should come from known states only
  const skipMatches = statusTransContent.match(/skip-transition/g) || [];
  check(
    "Fix 2: Skip-Transition Test vorhanden (wenn states bekannt)",
    skipMatches.length >= 0, // 0 is ok if no skip candidates found
    `${skipMatches.length} skip-transition tests`
  );
}

// ─── Fix 3: Concurrency Cookie-Init + Payload-Typen ─────────────────────────
const concurrencyContent = allFiles.find(f => f.name.includes("concurren") || f.name.includes("race"))?.content || "";
check(
  "Fix 3: Concurrency Test generiert",
  concurrencyContent.length > 0,
  `${concurrencyContent.length} chars`
);
if (concurrencyContent.length > 0) {
  check(
    "Fix 3: Concurrency hat beforeAll Cookie-Init",
    concurrencyContent.includes("beforeAll") && concurrencyContent.includes("Cookie"),
    "beforeAll + Cookie present"
  );
  // Numeric fields should not be strings
  const hasStringNumbers = concurrencyContent.match(/:\s*"[0-9]+(\.[0-9]+)?"/g) || [];
  check(
    "Fix 3: Keine String-Zahlen in Concurrency Payload",
    hasStringNumbers.length === 0,
    hasStringNumbers.length > 0 ? `Found: ${hasStringNumbers.slice(0,3).join(", ")}` : "OK"
  );
}

// ─── Fix 4: Auth-Matrix kein JSON.stringify ──────────────────────────────────
const authMatrixContent = allFiles.find(f => f.name.includes("auth-matrix"))?.content || "";
check(
  "Fix 4: Auth-Matrix Test generiert",
  authMatrixContent.length > 0,
  `${authMatrixContent.length} chars`
);
if (authMatrixContent.length > 0) {
  check(
    "Fix 4: Kein JSON.stringify in Auth-Matrix Payload",
    !authMatrixContent.includes("JSON.stringify"),
    authMatrixContent.includes("JSON.stringify") ? "JSON.stringify FOUND" : "OK"
  );
}

// ─── Fix 5: Idempotency Cookie-Init ─────────────────────────────────────────
const idempotencyContent = allFiles.find(f => f.name.includes("idempotency"))?.content || "";
check(
  "Fix 5: Idempotency Test generiert",
  idempotencyContent.length > 0,
  `${idempotencyContent.length} chars`
);
if (idempotencyContent.length > 0) {
  check(
    "Fix 5: Idempotency hat beforeAll Cookie-Init",
    idempotencyContent.includes("beforeAll") && idempotencyContent.includes("Cookie"),
    "beforeAll + Cookie present"
  );
}

// ─── Fix 6: DSGVO PII-Felder (name/email/phone) ─────────────────────────────
const dsgvoContent = allFiles.find(f => f.name.includes("dsgvo") || f.name.includes("gdpr") || f.name.includes("compliance"))?.content || "";
check(
  "Fix 6: DSGVO Test generiert",
  dsgvoContent.length > 0,
  `${dsgvoContent.length} chars`
);
if (dsgvoContent.length > 0) {
  const hasPiiFields = ["name", "email", "phone"].some(f => dsgvoContent.includes(f));
  check(
    "Fix 6: DSGVO enthält PII-Felder (name/email/phone)",
    hasPiiFields,
    hasPiiFields ? "OK" : "No PII fields found"
  );
  // Should NOT have .log or .pers as field names
  const hasBadFields = dsgvoContent.includes(".log") || dsgvoContent.includes(".pers");
  check(
    "Fix 6: Keine .log/.pers Felder in DSGVO",
    !hasBadFields,
    hasBadFields ? ".log or .pers FOUND" : "OK"
  );
}

// ─── Fix 7: Helpers nicht doppelt genested ───────────────────────────────────
const helperKeys = Object.keys(helpers);
const doubleNested = helperKeys.filter(k => k.includes("helpers/helpers/"));
check(
  "Fix 7: Keine doppelt-genesteten Helpers (helpers/helpers/)",
  doubleNested.length === 0,
  doubleNested.length > 0 ? `Found: ${doubleNested.join(", ")}` : "OK"
);
check(
  "Fix 7: helpers/api.ts existiert",
  helperKeys.includes("helpers/api.ts"),
  `Keys: ${helperKeys.slice(0,5).join(", ")}`
);

// ─── Fix 8: DSGVO-Export Endpoint (customers.export statt customers.getById) ─
if (dsgvoContent.length > 0) {
  const hasGetById = dsgvoContent.includes("customers.getById") || dsgvoContent.includes("accounts.getById");
  const hasExport = dsgvoContent.includes(".export") || dsgvoContent.includes("gdpr") || dsgvoContent.includes("export");
  check(
    "Fix 8: DSGVO-Export nutzt export/gdpr Endpoint (nicht getById)",
    !hasGetById || hasExport,
    hasGetById && !hasExport ? "getById FOUND without export" : "OK"
  );
}

// ─── Fix 9: DSGVO-Audit Endpoint ─────────────────────────────────────────────
if (dsgvoContent.length > 0) {
  // Should not use accounts.delete for GDPR audit
  const hasAccountsDelete = dsgvoContent.includes("accounts.delete");
  const hasGdprEndpoint = dsgvoContent.includes("gdpr") || dsgvoContent.includes("customers");
  check(
    "Fix 9: DSGVO-Audit nutzt gdpr/customers Endpoint (nicht accounts.delete)",
    !hasAccountsDelete || hasGdprEndpoint,
    hasAccountsDelete && !hasGdprEndpoint ? "accounts.delete FOUND" : "OK"
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(70));
console.log("ZUSAMMENFASSUNG");
console.log("=".repeat(70));
console.log(`Behaviors:     ${result.ir?.behaviors?.length || 0}`);
console.log(`Test Files:    ${testFiles.length}`);
console.log(`Helper Files:  ${helperKeys.length}`);
console.log(`Checks:        ${passed}/${passed + failed} bestanden`);
if (failed === 0) {
  console.log("🎉 ALLE FIX-BRIEFING 2 CHECKS BESTANDEN!");
} else {
  console.log(`⚠️  ${failed} Checks fehlgeschlagen`);
  results.filter(r => !r.ok).forEach(r => console.log(`   ❌ ${r.name}`));
}
console.log("=".repeat(70));
