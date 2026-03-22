/**
 * Debug: show the generated spec-drift test content to find the unbalanced brace
 */
import {
  buildRiskModel,
  assessSpecHealth,
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

console.log("Proof targets:", riskModel.proofTargets.length);
riskModel.proofTargets.forEach(t => console.log(" -", t.proofType, t.id));

// Import generateProofs to see the raw output
import("../server/analyzer.js").then(async (mod) => {
  const proofs = await (mod as any).generateProofs(riskModel, mockAnalysis);
  const driftProof = proofs.find((p: any) => p.filename.includes("drift"));
  if (driftProof) {
    console.log("\n=== DRIFT PROOF CONTENT ===");
    console.log(driftProof.content);
    
    // Count braces manually
    let open = 0, close = 0;
    for (const c of driftProof.content) {
      if (c === '{') open++;
      if (c === '}') close++;
    }
    console.log(`\nBraces: ${open} open, ${close} close, diff=${open - close}`);
  } else {
    console.log("No drift proof found");
    console.log("Proofs:", proofs.map((p: any) => p.filename));
  }
});
