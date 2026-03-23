/**
 * BankingCore Spec-Test (Aufgabe 3a)
 * Runs the full analysis pipeline on the BankingCore spec and saves the ZIP output.
 * Run via: cd /home/ubuntu/testforge && npx tsx scripts/run-banking-test.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PassThrough } from "stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const BANKING_CORE_SPEC = `# BankingCore API Specification v2.1

## Overview
BankingCore is a multi-tenant banking backend. Each bank (tenant) is isolated by \`bankId\`.
Customers belong to exactly one bank. Accounts belong to exactly one customer.
All monetary values are in EUR cents (integer). No floating point.

## Authentication
- All endpoints require \`Authorization: Bearer <jwt>\` header
- JWT contains: \`userId\`, \`bankId\`, \`role\` (enum: customer | advisor | admin)
- Expired or invalid JWT → 401
- Missing JWT → 401
- Rate limit: max 5 failed auth attempts per minute per IP → 429

## Roles & Permissions
- \`customer\`: can only access own accounts and own transactions
- \`advisor\`: can access all accounts within their \`bankId\`
- \`admin\`: can access everything within their \`bankId\`; cannot access other banks

## Endpoints

### POST /api/accounts
Create a new bank account.
Input: \`bankId\` (number), \`customerId\` (number), \`accountType\` (enum: checking|savings|loan), \`initialDeposit\` (number, min: 0, max: 1000000)
Output: \`id\`, \`bankId\`, \`customerId\`, \`accountType\`, \`balance\`, \`status\` (enum: active|frozen|closed), \`iban\`, \`createdAt\`
Authorization: advisor or admin only
Behavior:
- \`bankId\` in body must match JWT \`bankId\` — cross-tenant account creation must return 403
- \`initialDeposit\` is added to balance atomically
- IBAN is auto-generated and globally unique
- Customer with \`customerId\` must exist and belong to same \`bankId\`
- Returns 400 if \`accountType\` is not in enum
- Returns 400 if \`initialDeposit\` < 0 or > 1000000

### GET /api/accounts
List accounts.
Input: \`bankId\` (number, required), \`customerId\` (number, optional), \`status\` (enum: active|frozen|closed, optional)
Output: Array of account objects
Authorization: customer sees only own accounts, advisor/admin sees all within bank
Behavior:
- Customer role: automatically filtered to own \`customerId\` regardless of query params
- Advisor/admin: can filter by \`customerId\` or see all
- \`bankId\` must match JWT \`bankId\` — cross-tenant listing returns 403 with empty data

### GET /api/accounts/:id
Get single account.
Input: \`id\` (path param)
Output: full account object
Authorization: customer can only access own account, advisor/admin any within bank
Behavior:
- Returns 404 if account doesn't exist
- Returns 403 if account belongs to different bank
- Returns 403 if customer role and account.customerId !== jwt.userId

### POST /api/transactions
Create a transaction (transfer between accounts).
Input: \`bankId\` (number), \`fromAccountId\` (number), \`toAccountId\` (number), \`amount\` (number, min: 1, max: 50000000), \`description\` (string, max: 500), \`idempotencyKey\` (string, required)
Output: \`id\`, \`bankId\`, \`fromAccountId\`, \`toAccountId\`, \`amount\`, \`status\` (enum: pending|processing|completed|failed|reversed), \`description\`, \`createdAt\`
Authorization: advisor or admin only
Behavior:
- \`bankId\` must match JWT \`bankId\` — 403 on cross-tenant
- \`fromAccountId\` and \`toAccountId\` must belong to same \`bankId\` — 403 if not
- \`fromAccountId\` must have sufficient balance — 422 INSUFFICIENT_BALANCE
- Amount is deducted from fromAccount and credited to toAccount atomically
- \`idempotencyKey\` prevents duplicate transactions — same key returns original result
- \`fromAccountId\` !== \`toAccountId\` — 400 SAME_ACCOUNT
- Both accounts must have status \`active\` — 422 ACCOUNT_NOT_ACTIVE
- Rate limit: max 20 transactions per minute per bank — 429

### PATCH /api/transactions/:id/status
Update transaction status.
Input: \`status\` (enum: processing|completed|failed|reversed)
Authorization: admin only
Behavior:
- Allowed transitions: pending→processing, processing→completed, processing→failed, completed→reversed
- Forbidden transitions: completed→pending, failed→completed, reversed→*, pending→completed (must go through processing)
- \`reversed\` restores the original balance: credits fromAccount, debits toAccount
- Failed or reversed transactions: no balance change (already rolled back or never committed)
- Returns 422 INVALID_TRANSITION for forbidden transitions

### GET /api/transactions
List transactions.
Input: \`bankId\` (number), \`accountId\` (number, optional), \`status\` (enum, optional), \`fromDate\` (date, optional), \`toDate\` (date, optional)
Authorization: customer sees only own transactions, advisor/admin all within bank
Behavior:
- \`bankId\` must match JWT \`bankId\` — 403 on cross-tenant

### DELETE /api/accounts/:id
Close (soft-delete) a bank account.
Input: \`id\` (path param)
Authorization: admin only
Behavior:
- Sets \`status\` to \`closed\`
- Account with positive balance cannot be closed — 422 BALANCE_NOT_ZERO
- Account with pending transactions cannot be closed — 422 PENDING_TRANSACTIONS
- Already closed account → 409 ALREADY_CLOSED

### POST /api/accounts/:id/freeze
Freeze a bank account.
Input: \`id\` (path param), \`reason\` (string, max: 500)
Authorization: admin only
Behavior:
- Sets \`status\` to \`frozen\`
- Frozen accounts cannot send transactions (but can receive)
- Returns 409 if already frozen
- Returns 422 if account is closed

### POST /api/accounts/:id/unfreeze
Unfreeze a frozen account.
Input: \`id\` (path param)
Authorization: admin only
Behavior:
- Sets \`status\` to \`active\`
- Returns 409 if not frozen
- Returns 422 if account is closed

## Status Machine: accounts
States: active, frozen, closed
Transitions:
- active → frozen (admin: freeze)
- frozen → active (admin: unfreeze)
- active → closed (admin: close, only if balance = 0)
- frozen → closed (admin: close, only if balance = 0)
Forbidden:
- closed → active (cannot reopen)
- closed → frozen (cannot freeze closed)

## Status Machine: transactions
States: pending, processing, completed, failed, reversed
Transitions:
- pending → processing
- processing → completed
- processing → failed
- completed → reversed
Forbidden:
- completed → pending
- failed → completed
- reversed → * (terminal)
- pending → completed (must go through processing)

## DSGVO / GDPR
- Customer data (name, email, phone, address) must be anonymizable
- DELETE /api/customers/:id/gdpr — anonymizes all PII fields, sets name to "[deleted]"
- Transactions are retained but customer reference is anonymized
- Audit log entries are retained for 10 years

## CSRF Protection
- All state-changing requests require X-CSRF-Token header
- Token obtained via GET /api/auth/csrf-token
- Double-submit cookie pattern
- Missing or invalid token → 403
`;

// Import the full pipeline
const { runAnalysisJob } = await import("../server/analyzer/job-runner.ts");
const { generateHelpers } = await import("../server/analyzer/helpers-generator.ts");
const { generateExtendedTestSuite } = await import("../server/analyzer/extended-suite.ts");
const { mergeProofsToFile } = await import("../server/analyzer/validator.ts");
const archiver = await import("archiver");

console.log("=== BankingCore Spec-Test (Aufgabe 3a) ===\n");
console.log("Running full analysis pipeline...\n");

const result = await runAnalysisJob(
  BANKING_CORE_SPEC,
  "BankingCore",
  async (layer, msg) => { console.log(`  [L${layer}] ${msg}`); },
  undefined, // no industry pack
  undefined  // no code files → spec path
);

const { analysisResult, riskModel, validatedSuite, report, testFiles, helpers, extendedSuite } = result;
const ir = analysisResult.ir;

console.log("\n=== Results ===");
console.log(`Behaviors:       ${ir.behaviors.length}`);
console.log(`Endpoints:       ${ir.apiEndpoints.length}`);
console.log(`Quality Score:   ${analysisResult.qualityScore}/100`);
console.log(`Spec Type:       ${analysisResult.specType}`);
console.log(`Proof Targets:   ${riskModel.proofTargets.length}`);
console.log(`Validated Tests: ${validatedSuite.proofs.length}`);
console.log(`Test Files:      ${testFiles.length}`);
console.log(`Extended Files:  ${extendedSuite.files.length}`);

// Proof types triggered
const proofTypes = new Set(validatedSuite.proofs.map(p => p.proofType).filter(Boolean));
console.log(`Proof Types:     ${[...proofTypes].join(", ")}`);

// Requirement checks
console.log("\n=== Requirement Checks ===");
const checks = {
  "≥20 Behaviors": ir.behaviors.length >= 20,
  "≥8 Endpoints": ir.apiEndpoints.length >= 8,
  "IDOR tests": proofTypes.has("idor") || validatedSuite.proofs.some(p => p.proofType === "idor"),
  "Boundary tests": proofTypes.has("boundary") || validatedSuite.proofs.some(p => p.proofType === "boundary"),
  "Status-Transition tests": proofTypes.has("status_transition") || validatedSuite.proofs.some(p => p.proofType === "status_transition"),
  "CSRF tests": proofTypes.has("csrf") || validatedSuite.proofs.some(p => p.proofType === "csrf"),
  "Auth-Matrix tests": proofTypes.has("auth_matrix") || validatedSuite.proofs.some(p => p.proofType === "auth_matrix"),
};
let allPassed = true;
for (const [check, passed] of Object.entries(checks)) {
  console.log(`  ${passed ? "✓" : "✗"} ${check}`);
  if (!passed) allPassed = false;
}

// Bug candidates
console.log("\n=== Bug Candidates (likely red in real run) ===");
const idorProofs = validatedSuite.proofs.filter(p => p.proofType === "idor");
const boundaryProofs = validatedSuite.proofs.filter(p => p.proofType === "boundary");
const authProofs = validatedSuite.proofs.filter(p => p.proofType === "auth_matrix");
console.log(`  IDOR tests: ${idorProofs.length} (cross-tenant bankId isolation)`);
console.log(`  Boundary tests: ${boundaryProofs.length} (initialDeposit 0-1000000, amount 1-50000000)`);
console.log(`  Auth Matrix tests: ${authProofs.length} (customer/advisor/admin roles)`);

// Build ZIP
console.log("\n=== Building ZIP ===");
const chunks = [];
const archive = archiver.default("zip", { zlib: { level: 9 } });
const passThrough = new PassThrough();
archive.pipe(passThrough);
passThrough.on("data", (chunk) => chunks.push(chunk));

for (const tf of testFiles) {
  archive.append(tf.content, { name: tf.filename });
}
archive.append(report, { name: "testforge-report.md" });
for (const [filename, content] of Object.entries(helpers)) {
  archive.append(content, { name: filename });
}
for (const extFile of extendedSuite.files) {
  const alreadyAdded = testFiles.some(tf => tf.filename === extFile.filename);
  if (!alreadyAdded) {
    archive.append(extFile.content, { name: extFile.filename });
  }
}
for (const [configName, configContent] of Object.entries(extendedSuite.configs)) {
  const skipNames = ["playwright.config.ts", "package.json"];
  if (!skipNames.includes(configName)) {
    archive.append(configContent, { name: configName });
  }
}
archive.append(extendedSuite.readme, { name: "README.md" });

await Promise.all([
  archive.finalize(),
  new Promise((resolve, reject) => {
    passThrough.on("finish", resolve);
    passThrough.on("error", reject);
    archive.on("error", reject);
  }),
]);

const zipBuffer = Buffer.concat(chunks);
const outputPath = join(projectRoot, "output-spec-test.zip");
writeFileSync(outputPath, zipBuffer);
console.log(`ZIP saved: ${outputPath} (${Math.round(zipBuffer.length / 1024)}KB)`);

// Summary table
console.log("\n=== Summary Table ===");
console.log("| Metric                | Value |");
console.log("|----------------------|-------|");
console.log(`| Behaviors extracted  | ${ir.behaviors.length} |`);
console.log(`| Endpoints detected   | ${ir.apiEndpoints.length} |`);
console.log(`| Proof targets        | ${riskModel.proofTargets.length} |`);
console.log(`| Tests generated      | ${validatedSuite.proofs.length} |`);
console.log(`| Test files           | ${testFiles.length} |`);
console.log(`| Extended files       | ${extendedSuite.files.length} |`);
console.log(`| Proof types triggered| ${proofTypes.size} |`);
console.log(`| ZIP size             | ${Math.round(zipBuffer.length / 1024)}KB |`);
console.log(`| All checks passed    | ${allPassed ? "YES ✓" : "NO ✗"} |`);
