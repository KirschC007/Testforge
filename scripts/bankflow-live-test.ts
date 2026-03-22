/**
 * BankFlow Live-Test — bypasses LLM parseSpec, uses manually constructed IR
 * Pipeline: buildRiskModel → generateProofs → validateProofs → generateHelpers → generateReport
 */
import {
  buildRiskModel,
  generateProofs,
  validateProofs,
  generateHelpers,
  generateReport,
  assessSpecHealth,
  type AnalysisResult,
  type AnalysisIR,
  type Behavior,
  type APIEndpoint,
} from "../server/analyzer.js";
import * as fs from "fs";
import * as path from "path";

// Helper to create a Behavior with all required fields
function mkBehavior(
  id: string,
  title: string,
  subject: string,
  action: string,
  object: string,
  tags: string[],
  riskHints: string[],
  chapter: string,
  preconditions: string[] = [],
  postconditions: string[] = [],
  errorCases: string[] = [],
): Behavior {
  return { id, title, subject, action, object, preconditions, postconditions, errorCases, tags, riskHints, chapter };
}

const bankFlowIR: AnalysisIR = {
  behaviors: [
    mkBehavior("B001", "accounts.create rejects cross-bank bankId (IDOR)", "bank_admin", "create", "account", ["idor", "auth"], ["403 if bankId does not match caller's bank"], "Accounts"),
    mkBehavior("B002", "accounts.create rejects cross-bank customerId (IDOR)", "bank_admin", "create", "account", ["idor"], ["403 if customerId belongs to a different bank"], "Accounts"),
    mkBehavior("B003", "accounts.create boundary: initialDeposit 0..1000000", "bank_admin", "create", "account", ["boundary"], ["400 if initialDeposit is negative", "400 if initialDeposit exceeds 1000000"], "Accounts"),
    mkBehavior("B004", "accounts.create role check: only bank_admin", "bank_admin", "create", "account", ["auth", "business-logic"], ["teller and auditor get 403"], "Accounts"),
    mkBehavior("B005", "transactions.create IDOR: cross-bank accountIds rejected", "bank_admin", "create", "transaction", ["idor"], ["403 if any accountId belongs to a different bank"], "Transactions"),
    mkBehavior("B006", "transactions.create boundary: amount 0.01..500000", "bank_admin", "create", "transaction", ["boundary"], ["400 if amount <= 0", "400 if amount exceeds 500000"], "Transactions"),
    mkBehavior("B007", "transactions.create deducts from fromAccount balance", "bank_admin", "create", "transaction", ["business-logic"], ["balance can never go below 0"], "Transactions", [], ["Deducts amount from fromAccount.balance", "Credits amount to toAccount.balance"]),
    mkBehavior("B008", "transactions.create rate limit: 20/min per bank", "bank_admin", "create", "transaction", ["rate-limit"], ["429 with retryAfter"], "Transactions"),
    mkBehavior("B009", "transactions.updateStatus: pending → processing → completed", "bank_admin", "update", "transaction.status", ["status-transition"], ["400 invalid_transition"], "Transactions"),
    mkBehavior("B010", "transactions.updateStatus: reversed restores balances", "bank_admin", "update", "transaction.status", ["business-logic"], ["only bank_admin can reverse"], "Transactions", [], ["restore amount to fromAccount.balance", "deduct amount from toAccount.balance"]),
    mkBehavior("B011", "transactions.updateStatus IDOR: cross-bank rejected", "bank_admin", "update", "transaction.status", ["idor"], ["403 if transaction belongs to different bank"], "Transactions"),
    mkBehavior("B012", "accounts.list IDOR: cross-bank bankId rejected", "bank_admin", "list", "account", ["idor"], ["403 if bankId does not match caller's bank"], "Accounts"),
    mkBehavior("B013", "accounts.list boundary: pageSize max 100", "bank_admin", "list", "account", ["boundary"], ["400 if pageSize > 100"], "Accounts"),
    mkBehavior("B014", "accounts.close IDOR: cross-bank rejected", "bank_admin", "delete", "account", ["idor"], ["403 if account belongs to different bank"], "Accounts"),
    mkBehavior("B015", "accounts.close: cannot close with non-zero balance", "bank_admin", "delete", "account", ["business-logic"], ["409 if account has non-zero balance"], "Accounts"),
    mkBehavior("B016", "customers.anonymize: PII anonymization (DSGVO)", "bank_admin", "anonymize", "customer", ["dsgvo", "privacy"], ["name → [anonymized], email → [anonymized]"], "DSGVO"),
    mkBehavior("B017", "bank.exportData: bank_admin only (DSGVO)", "bank_admin", "export", "bank.data", ["dsgvo", "auth"], ["bank_admin only"], "DSGVO"),
    mkBehavior("B018", "auth.login rate limit: 5 failed/min per IP", "anonymous", "login", "auth", ["rate-limit"], ["429 after 5 failed attempts"], "Auth"),
    mkBehavior("B019", "CSRF: all POST/DELETE require X-CSRF-Token", "any", "mutate", "api", ["csrf"], ["403 csrf_token_missing"], "CSRF"),
    mkBehavior("B020", "accounts.create response shape matches spec", "bank_admin", "create", "account", ["api-response"], [], "Accounts"),
    mkBehavior("B021", "transactions.create response shape matches spec", "bank_admin", "create", "transaction", ["api-response"], [], "Transactions"),
  ],
  invariants: [
    { id: "INV001", description: "Account balance non-negative", alwaysTrue: "account.balance >= 0", violationConsequence: "Financial data corruption" },
    { id: "INV002", description: "Transaction amount positive", alwaysTrue: "transaction.amount > 0", violationConsequence: "Invalid transaction" },
    { id: "INV003", description: "Reversed transaction restores balances", alwaysTrue: "sum(all transactions for account) === current balance", violationConsequence: "Balance inconsistency" },
  ],
  ambiguities: [],
  contradictions: [],
  tenantModel: {
    tenantEntity: "bank",
    tenantIdField: "bankId",
  },
  resources: [
    { name: "account", table: "accounts", tenantKey: "bankId", operations: ["create", "read", "list", "delete"], hasPII: false },
    { name: "transaction", table: "transactions", tenantKey: "bankId", operations: ["create", "read", "list", "update"], hasPII: false },
    { name: "customer", table: "customers", tenantKey: "bankId", operations: ["read", "update"], hasPII: true },
  ],
  apiEndpoints: [
    {
      name: "accounts.create",
      method: "POST",
      auth: "bank_admin",
      relatedBehaviors: ["B001", "B002", "B003", "B004"],
      inputFields: [
        { name: "bankId", type: "number", required: true, isTenantKey: true },
        { name: "customerId", type: "number", required: true },
        { name: "accountType", type: "enum", required: true, enumValues: ["checking", "savings", "business"] },
        { name: "currency", type: "enum", required: true, enumValues: ["EUR", "USD", "GBP"] },
        { name: "initialDeposit", type: "number", required: true, min: 0, max: 1000000, isBoundaryField: true },
      ],
      outputFields: ["id", "bankId", "customerId", "accountType", "currency", "balance", "status", "createdAt"],
    },
    {
      name: "transactions.create",
      method: "POST",
      auth: "bank_admin,teller",
      relatedBehaviors: ["B005", "B006", "B007", "B008"],
      inputFields: [
        { name: "bankId", type: "number", required: true, isTenantKey: true },
        { name: "fromAccountId", type: "number", required: true },
        { name: "toAccountId", type: "number", required: true },
        { name: "amount", type: "number", required: true, min: 0.01, max: 500000, isBoundaryField: true },
        { name: "currency", type: "enum", required: true, enumValues: ["EUR", "USD", "GBP"] },
        { name: "description", type: "string", required: false },
      ],
      outputFields: ["id", "bankId", "fromAccountId", "toAccountId", "amount", "currency", "status", "createdAt"],
    },
    {
      name: "transactions.updateStatus",
      method: "POST",
      auth: "bank_admin,teller",
      relatedBehaviors: ["B009", "B010", "B011"],
      inputFields: [
        { name: "transactionId", type: "number", required: true },
        { name: "bankId", type: "number", required: true, isTenantKey: true },
        { name: "status", type: "enum", required: true, enumValues: ["pending", "processing", "completed", "failed", "reversed"] },
      ],
      outputFields: ["id", "status", "updatedAt"],
    },
    {
      name: "accounts.list",
      method: "GET",
      auth: "bank_admin,teller,auditor",
      relatedBehaviors: ["B012", "B013"],
      inputFields: [
        { name: "bankId", type: "number", required: true, isTenantKey: true },
        { name: "customerId", type: "number", required: false },
        { name: "accountType", type: "enum", required: false, enumValues: ["checking", "savings", "business"] },
        { name: "page", type: "number", required: false },
        { name: "pageSize", type: "number", required: false, min: 1, max: 100, isBoundaryField: true },
      ],
      outputFields: ["accounts", "total", "page", "pageSize"],
    },
    {
      name: "accounts.close",
      method: "DELETE",
      auth: "bank_admin",
      relatedBehaviors: ["B014", "B015"],
      inputFields: [
        { name: "accountId", type: "number", required: true },
        { name: "bankId", type: "number", required: true, isTenantKey: true },
      ],
      outputFields: ["success", "closedAt"],
    },
    {
      name: "customers.anonymize",
      method: "POST",
      auth: "bank_admin",
      relatedBehaviors: ["B016"],
      inputFields: [
        { name: "customerId", type: "number", required: true },
        { name: "bankId", type: "number", required: true, isTenantKey: true },
      ],
      outputFields: ["success", "anonymizedAt"],
    },
    {
      name: "bank.exportData",
      method: "GET",
      auth: "bank_admin",
      relatedBehaviors: ["B017"],
      inputFields: [
        { name: "bankId", type: "number", required: true, isTenantKey: true },
      ],
      outputFields: ["data", "exportedAt"],
    },
    {
      name: "auth.login",
      method: "POST",
      auth: "public",
      relatedBehaviors: ["B018"],
      inputFields: [
        { name: "username", type: "string", required: true },
        { name: "password", type: "string", required: true },
      ],
      outputFields: ["sessionToken", "role"],
    },
  ],
  authModel: {
    loginEndpoint: "/api/trpc/auth.login",
    csrfEndpoint: "/api/auth/csrf-token",
    roles: [
      { name: "bank_admin", envUserVar: "E2E_BANK_ADMIN_USER", envPassVar: "E2E_BANK_ADMIN_PASS", defaultUser: "test-bank-admin", defaultPass: "TestPass2026x!" },
      { name: "teller", envUserVar: "E2E_TELLER_USER", envPassVar: "E2E_TELLER_PASS", defaultUser: "test-teller", defaultPass: "TestPass2026x!" },
      { name: "auditor", envUserVar: "E2E_AUDITOR_USER", envPassVar: "E2E_AUDITOR_PASS", defaultUser: "test-auditor", defaultPass: "TestPass2026x!" },
    ],
  },
  enums: {
    accountType: ["checking", "savings", "business"],
    currency: ["EUR", "USD", "GBP"],
    status: ["pending", "processing", "completed", "failed", "reversed"],
  },
  statusMachine: {
    states: ["pending", "processing", "completed", "failed", "reversed"],
    transitions: [
      ["pending", "processing"],
      ["processing", "completed"],
      ["pending", "failed"],
      ["processing", "failed"],
      ["completed", "reversed"],
    ],
    forbidden: [
      ["completed", "pending"],
      ["reversed", "pending"],
      ["failed", "completed"],
    ],
    initialState: "pending",
    terminalStates: ["completed", "reversed", "failed"],
  },
};

async function runBankFlowTest() {
  console.log("=== BankFlow Live-Test ===\n");

  const mockAnalysis: AnalysisResult = {
    ir: bankFlowIR,
    qualityScore: 9.2,
    specType: "api-spec",
    specHealth: undefined,
  };

  // Step 0: Spec Health
  console.log("Step 0: Spec Health Assessment...");
  const specHealth = assessSpecHealth(bankFlowIR);
  mockAnalysis.specHealth = specHealth;
  console.log(`  Score: ${specHealth.score}/100 (Grade ${specHealth.grade})`);
  specHealth.dimensions.forEach(d => console.log(`  ${d.passed ? "✅" : "⚠️"} ${d.name}: ${d.detail}`));

  // Step 1: Risk Model
  console.log("\nStep 1: Building risk model...");
  const riskModel = buildRiskModel(mockAnalysis);
  console.log(`  ${riskModel.proofTargets.length} proof targets`);
  const byType: Record<string, number> = {};
  riskModel.proofTargets.forEach(t => { byType[t.proofType] = (byType[t.proofType] || 0) + 1; });
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

  // Step 2: Generate Proofs
  console.log("\nStep 2: Generating proofs...");
  const rawProofs = await generateProofs(riskModel, mockAnalysis);
  console.log(`  ${rawProofs.length} proof files`);
  rawProofs.forEach(p => console.log(`  ${p.filename} (${(p.code || "").split("\n").length} lines)`));

  // Step 3: Validate Proofs
  console.log("\nStep 3: Validating proofs...");
  const behaviorIds = bankFlowIR.behaviors.map(b => b.id);
  const suite = validateProofs(rawProofs, behaviorIds);
  console.log(`  Validated: ${suite.proofs.length}, Discarded: ${suite.discardedProofs.length}`);
  console.log(`  Mutation Score: ${suite.verdict.score.toFixed(1)}/10.0`);
  console.log(`  Verdict: ${suite.verdict.summary}`);

  // Step 4: Generate Helpers
  console.log("\nStep 4: Generating helpers...");
  const helpers = generateHelpers(mockAnalysis);
  const helperFiles = Object.keys(helpers);
  console.log(`  ${helperFiles.length} helper files`);
  helperFiles.forEach(f => console.log(`  ${f} (${(helpers as any)[f].split("\n").length} lines)`));

  // Step 5: Generate Report
  console.log("\nStep 5: Generating report...");
  const report = generateReport(mockAnalysis, riskModel, suite as any, "BankFlow");
  console.log(`  ${report.split("\n").length} lines`);

  // Write output
  const outDir = "/tmp/bankflow-output";
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const proof of rawProofs) {
    const filePath = path.join(outDir, proof.filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, proof.code || "");
  }

  for (const [filename, content] of Object.entries(helpers)) {
    const filePath = path.join(outDir, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content as string);
  }

  fs.writeFileSync(path.join(outDir, "testforge-report.md"), report);

  // List files
  const allFiles: string[] = [];
  function listFiles(dir: string, base = "") {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel = base ? `${base}/${entry}` : entry;
      if (fs.statSync(full).isDirectory()) listFiles(full, rel);
      else allFiles.push(rel);
    }
  }
  listFiles(outDir);

  console.log(`\n=== Generated Files (${allFiles.length}) ===`);
  allFiles.forEach(f => console.log(`  ${f}`));

  // 6 Checks
  console.log("\n=== 6 Spec-Checks ===");

  const testContent = allFiles.filter(f => f.startsWith("tests/")).map(f => fs.readFileSync(path.join(outDir, f), "utf-8")).join("\n");
  const todoMatches = testContent.match(/"TODO_[A-Z]/g) || [];
  console.log(`Check 1: TODO_FIELDNAME → ${todoMatches.length} Treffer ${todoMatches.length === 0 ? "✅" : "❌"}`);

  const schemasExists = fs.existsSync(path.join(outDir, "helpers/schemas.ts"));
  console.log(`Check 2: helpers/schemas.ts → ${schemasExists ? "✅" : "❌"}`);

  if (schemasExists) {
    const sc = fs.readFileSync(path.join(outDir, "helpers/schemas.ts"), "utf-8");
    const zm = sc.match(/z\.(number|string|boolean|enum)/g) || [];
    console.log(`Check 3: Zod fields → ${zm.length} Treffer ${zm.length >= 5 ? "✅" : "❌"}`);
  }

  const driftFile = allFiles.find(f => f.includes("drift"));
  console.log(`Check 4: spec-drift test → ${driftFile ? `✅ ${driftFile}` : "❌ fehlt"}`);

  if (driftFile) {
    const dc = fs.readFileSync(path.join(outDir, driftFile), "utf-8");
    const fc = dc.match(/toBeDefined\(\)|toContain|Kills.*remov/g) || [];
    console.log(`Check 5: spec-drift checks → ${fc.length} Treffer ${fc.length >= 2 ? "✅" : "❌"}`);
  }

  const indexContent = fs.existsSync(path.join(outDir, "helpers/index.ts")) ? fs.readFileSync(path.join(outDir, "helpers/index.ts"), "utf-8") : "";
  console.log(`Check 6: schemas in index.ts → ${indexContent.includes("schemas") ? "✅" : "❌"}`);

  return outDir;
}

runBankFlowTest().then(outDir => {
  console.log(`\n✅ Done. Output: ${outDir}`);
}).catch(err => {
  console.error("❌ Error:", err.message, err.stack?.split("\n")[1]);
  process.exit(1);
});
