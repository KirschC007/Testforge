/**
 * End-to-End Sanity Check: generate every new ProofType against a realistic spec
 * and write the output to /tmp/testforge-samples/ for manual review.
 *
 * This is what should have been done BEFORE claiming features work.
 *
 * Usage: npx tsx scripts/generate-sample-output.ts
 */
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  generateE2ESmartFormTest,
  generateE2EUserJourneyTest,
  generateE2EPerfBudgetTest,
  generateE2EVisualTest,
  generateE2ENetworkTest,
  generateE2EAccessibilityFullTest,
  generateStatefulSequenceTest,
  generatePropertyTest,
} from "../server/analyzer/proof-generator";
import { generateHelpers } from "../server/analyzer/helpers-generator";
import { buildProbes } from "../server/analyzer/active-scanner";
import type { ProofTarget, AnalysisResult, EndpointField } from "../server/analyzer/types";

// ─── Realistic spec: SaaS booking app with full CRUD ─────────────────────────
const REALISTIC_ANALYSIS: AnalysisResult = {
  ir: {
    behaviors: [
      {
        id: "B001",
        title: "User books a reservation",
        subject: "User",
        action: "books",
        object: "reservation",
        preconditions: ["User is logged in"],
        postconditions: ["Reservation created with status pending"],
        errorCases: ["400 if partySize > 20", "409 if slot taken"],
        tags: ["e2e", "booking"],
        riskHints: ["business_logic"],
      },
    ],
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
    resources: [
      { name: "reservations", table: "reservations", tenantKey: "restaurantId", operations: ["create", "read", "update", "delete"], hasPII: true },
    ],
    apiEndpoints: [
      {
        name: "reservations.create",
        method: "POST /api/trpc/reservations.create",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          { name: "guestName", type: "string", required: true, min: 1, max: 100 },
          { name: "email", type: "string", required: true },
          { name: "partySize", type: "number", required: true, min: 1, max: 20 },
          { name: "date", type: "date", required: true },
          { name: "status", type: "enum", required: true, enumValues: ["pending", "confirmed", "cancelled"] },
        ] as EndpointField[],
        outputFields: ["id", "restaurantId", "guestName", "partySize", "status", "createdAt"],
      },
      {
        name: "reservations.getById",
        method: "GET /api/trpc/reservations.getById",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          { name: "id", type: "number", required: true },
        ] as EndpointField[],
        outputFields: ["id", "restaurantId", "guestName", "status"],
      },
      {
        name: "reservations.update",
        method: "POST /api/trpc/reservations.update",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          { name: "id", type: "number", required: true },
          { name: "guestName", type: "string", required: false },
          { name: "partySize", type: "number", required: false, min: 1, max: 20 },
        ] as EndpointField[],
      },
      {
        name: "reservations.list",
        method: "GET /api/trpc/reservations.list",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
        ] as EndpointField[],
      },
      {
        name: "reservations.delete",
        method: "POST /api/trpc/reservations.delete",
        auth: "requireAuth",
        relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          { name: "id", type: "number", required: true },
        ] as EndpointField[],
      },
    ],
    authModel: {
      loginEndpoint: "/api/trpc/auth.login",
      roles: [
        { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin@test.com", defaultPass: "TestPass2026x" },
      ],
    },
    enums: { status: ["pending", "confirmed", "cancelled"] },
    statusMachine: null,
    userFlows: [
      {
        id: "UF001",
        name: "Guest booking flow",
        actor: "admin",
        steps: [
          "Login as admin",
          "Navigate to /reservations/new",
          "Fill guestName field",
          "Fill email field",
          "Select status",
          "Click create button",
          "Verify reservation appears in list",
        ],
        successCriteria: ["Reservation created", "ID returned"],
        errorScenarios: [],
        relatedEndpoints: ["reservations.create"],
      },
    ],
    dataModels: [],
  },
  qualityScore: 9,
  specType: "saas-booking",
};

const TARGETS: Array<{ proofType: ProofTarget["proofType"]; endpoint: string }> = [
  { proofType: "e2e_smart_form", endpoint: "reservations.create" },
  { proofType: "e2e_user_journey", endpoint: "reservations.create" },
  { proofType: "e2e_perf_budget", endpoint: "reservations.list" },
  { proofType: "e2e_visual", endpoint: "reservations.list" },
  { proofType: "e2e_network", endpoint: "reservations.list" },
  { proofType: "e2e_a11y_full", endpoint: "reservations.list" },
  { proofType: "stateful_sequence", endpoint: "reservations.create" },
  { proofType: "property_based", endpoint: "reservations.create" },
];

// Build target via the REAL pipeline (buildProofTarget) so mutation targets match
// what production uses, not generic placeholders.
import { buildProofTarget } from "../server/analyzer/risk-model";
import type { ScoredBehavior } from "../server/analyzer/types";

function makeTarget(proofType: ProofTarget["proofType"], endpoint: string): ProofTarget {
  const sb: ScoredBehavior = {
    behavior: REALISTIC_ANALYSIS.ir.behaviors[0],
    riskLevel: "high",
    proofTypes: [proofType],
    priority: 0,
    rationale: "test",
  };
  const real = buildProofTarget(sb, proofType, REALISTIC_ANALYSIS);
  if (real) {
    real.endpoint = endpoint;
    return real;
  }
  // Fallback for proof types without buildProofTarget branch (security templates)
  return {
    id: `T_${proofType.toUpperCase()}_001`,
    behaviorId: "B001",
    proofType,
    riskLevel: "high",
    description: `Sample ${proofType}`,
    preconditions: [],
    assertions: [],
    mutationTargets: [{ description: "Generic mutation", expectedKill: true }],
    endpoint,
  };
}

const GENERATORS = {
  e2e_smart_form: generateE2ESmartFormTest,
  e2e_user_journey: generateE2EUserJourneyTest,
  e2e_perf_budget: generateE2EPerfBudgetTest,
  e2e_visual: generateE2EVisualTest,
  e2e_network: generateE2ENetworkTest,
  e2e_a11y_full: generateE2EAccessibilityFullTest,
  stateful_sequence: generateStatefulSequenceTest,
  property_based: generatePropertyTest,
} as const;

async function main() {
  const outDir = "/tmp/testforge-samples";
  await mkdir(outDir, { recursive: true });

  console.log("\n═══ TestForge Sample Output Generation ═══\n");

  // Generate each ProofType
  for (const { proofType, endpoint } of TARGETS) {
    const generator = GENERATORS[proofType as keyof typeof GENERATORS];
    if (!generator) continue;
    try {
      const target = makeTarget(proofType, endpoint);
      const code = generator(target, REALISTIC_ANALYSIS);
      const file = join(outDir, `${proofType}.spec.ts`);
      await writeFile(file, code);
      console.log(`✓ ${proofType.padEnd(25)} → ${file} (${code.length} chars)`);
    } catch (err: any) {
      console.log(`✗ ${proofType.padEnd(25)} → ERROR: ${err.message}`);
    }
  }

  // Generate the helpers package
  console.log();
  const helpers = generateHelpers(REALISTIC_ANALYSIS);
  for (const [name, content] of Object.entries(helpers)) {
    if (typeof content !== "string") continue;
    if (!name.endsWith(".mjs")) continue; // only mjs scripts (Phase 3 + A2/A3)
    const file = join(outDir, name);
    await writeFile(file, content);
    console.log(`✓ ${name.padEnd(35)} → ${file} (${content.length} chars)`);
  }

  // Active scanner probes
  console.log();
  const probes = buildProbes(REALISTIC_ANALYSIS);
  await writeFile(join(outDir, "active-scanner-probes.json"), JSON.stringify(probes, null, 2));
  console.log(`✓ Active scanner probes (${probes.length}) → ${outDir}/active-scanner-probes.json`);

  console.log(`\nReview each file at ${outDir} to verify the output is sensible.\n`);
}

main().catch(console.error);
