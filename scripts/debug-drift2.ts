/**
 * Debug: directly call generateSpecDriftTest and print the output
 */
import {
  buildRiskModel,
  type AnalysisResult,
  type AnalysisIR,
  type Behavior,
} from "../server/analyzer.js";

function mkBehavior(id: string, title: string, subject: string, action: string, object: string, tags: string[], riskHints: string[], chapter: string): Behavior {
  return { id, title, subject, action, object, preconditions: [], postconditions: [], errorCases: [], tags, riskHints, chapter };
}

const ir: AnalysisIR = {
  behaviors: [
    mkBehavior("B020", "accounts.create response shape matches spec", "bank_admin", "create", "account", ["api-response"], [], "Accounts"),
  ],
  invariants: [],
  ambiguities: [],
  contradictions: [],
  tenantModel: { tenantEntity: "bank", tenantIdField: "bankId" },
  resources: [{ name: "account", table: "accounts", tenantKey: "bankId", operations: ["create", "read"], hasPII: false }],
  apiEndpoints: [{
    name: "accounts.create",
    method: "POST",
    auth: "bank_admin",
    relatedBehaviors: ["B020"],
    inputFields: [
      { name: "bankId", type: "number", required: true, isTenantKey: true },
      { name: "initialDeposit", type: "number", required: true, min: 0, max: 1000000, isBoundaryField: true },
    ],
    outputFields: ["id", "bankId", "balance", "status", "createdAt"],
  }],
  authModel: {
    loginEndpoint: "/api/trpc/auth.login",
    roles: [{ name: "bank_admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin", defaultPass: "pass" }],
  },
  enums: {},
  statusMachine: null,
};

const mockAnalysis: AnalysisResult = { ir, qualityScore: 9.0, specType: "api-spec" };
const riskModel = buildRiskModel(mockAnalysis);

const driftTarget = riskModel.proofTargets.find(t => t.proofType === "spec_drift");
console.log("Drift target:", JSON.stringify(driftTarget, null, 2));

// Use dynamic import to call the internal function
const mod = await import("../server/analyzer.js");
// @ts-ignore
const generateSpecDriftTest = mod.generateSpecDriftTest;
if (!generateSpecDriftTest) {
  console.log("generateSpecDriftTest not exported — need to export it");
  process.exit(1);
}

const code = generateSpecDriftTest(driftTarget, mockAnalysis);
console.log("\n=== GENERATED CODE ===");
console.log(code);

// Count braces outside strings
let open = 0, close = 0, inStr = false, strChar = '';
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const prev = i > 0 ? code[i-1] : '';
  if (inStr) {
    if (c === strChar && prev !== '\\') inStr = false;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') { inStr = true; strChar = c; continue; }
  if (c === '{') open++;
  if (c === '}') close++;
}
console.log(`\nBraces (outside strings): ${open} open, ${close} close, diff=${open - close}`);
