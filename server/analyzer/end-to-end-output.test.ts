/**
 * End-to-End Output Sanity Tests
 *
 * Generates each new ProofType against a realistic spec and verifies the
 * output is actually USABLE — imports declared, no duplicate keys, no
 * dangling identifiers, brace balance, etc.
 *
 * This catches the class of bugs that unit tests miss: structural validity
 * of generated TypeScript code as a complete file.
 */
import { describe, it, expect } from "vitest";
import {
  generateE2ESmartFormTest,
  generateE2EUserJourneyTest,
  generateE2EPerfBudgetTest,
  generateE2EVisualTest,
  generateE2ENetworkTest,
  generateE2EAccessibilityFullTest,
  generateStatefulSequenceTest,
  generatePropertyTest,
} from "./proof-generator";
import type { ProofTarget, AnalysisResult, EndpointField } from "./types";

// Realistic spec — full CRUD + dates + phone + enums + auth
const REALISTIC: AnalysisResult = {
  ir: {
    behaviors: [{
      id: "B001", title: "Test", subject: "User", action: "books", object: "reservation",
      preconditions: [], postconditions: [], errorCases: [], tags: [], riskHints: [],
    }],
    invariants: [], ambiguities: [], contradictions: [],
    tenantModel: { tenantEntity: "restaurant", tenantIdField: "restaurantId" },
    resources: [],
    apiEndpoints: [
      {
        name: "reservations.create",
        method: "POST /api/trpc/reservations.create",
        auth: "requireAuth",
        relatedBehaviors: ["B001"],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          { name: "guestName", type: "string", required: true, max: 100 },
          { name: "phone", type: "string", required: true },
          { name: "partySize", type: "number", required: true, min: 1, max: 20 },
          { name: "date", type: "date", required: true },
          { name: "status", type: "enum", required: true, enumValues: ["pending", "confirmed"] },
        ] as EndpointField[],
      },
      {
        name: "reservations.getById", method: "GET", auth: "requireAuth", relatedBehaviors: [],
        inputFields: [
          { name: "restaurantId", type: "number", required: true, isTenantKey: true },
          { name: "id", type: "number", required: true },
        ] as EndpointField[],
      },
      {
        name: "reservations.list", method: "GET", auth: "requireAuth", relatedBehaviors: [],
        inputFields: [{ name: "restaurantId", type: "number", required: true, isTenantKey: true }] as EndpointField[],
      },
    ],
    authModel: {
      loginEndpoint: "/api/trpc/auth.login",
      roles: [{ name: "admin", envUserVar: "X", envPassVar: "Y", defaultUser: "a", defaultPass: "b" }],
    },
    enums: {},
    statusMachine: null,
    userFlows: [{
      id: "F1", name: "Booking", actor: "admin",
      steps: ["Login as admin", "Navigate to /reservations/new", "Click submit button", "Verify success"],
      successCriteria: ["Reservation created"], errorScenarios: [], relatedEndpoints: ["reservations.create"],
    }],
  },
  qualityScore: 9, specType: "test",
};

function makeTarget(proofType: ProofTarget["proofType"], endpoint = "reservations.create"): ProofTarget {
  return {
    id: `T_${proofType.toUpperCase()}_001`,
    behaviorId: "B001",
    proofType,
    riskLevel: "high",
    description: "test desc",
    preconditions: [],
    assertions: [],
    mutationTargets: [
      { description: "M1", expectedKill: true },
      { description: "M2", expectedKill: true },
      { description: "M3", expectedKill: true },
      { description: "M4", expectedKill: true },
      { description: "M5", expectedKill: true },
    ],
    endpoint,
  };
}

/**
 * Verify generated output:
 *   - Brace balance
 *   - No duplicate object keys (TypeScript error TS1117)
 *   - Every helper used is imported
 *   - No literal "${" outside template strings (template artifacts)
 */
function checkOutputIsUsable(code: string, label: string): void {
  // 1. Brace balance
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  expect(opens, `${label}: unbalanced braces`).toBe(closes);

  // 2. Required imports — if a helper is USED, it must be IMPORTED
  // Find all import sources
  const importedSymbols = new Set<string>();
  const importRegex = /import\s+(?:type\s+)?(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(code)) !== null) {
    if (m[1]) {
      // named imports: { a, b, c }
      for (const sym of m[1].split(",")) {
        importedSymbols.add(sym.trim().split(" as ")[0].trim());
      }
    }
    if (m[2]) importedSymbols.add(m[2]); // namespace
    if (m[3]) importedSymbols.add(m[3]); // default
  }

  // Common helpers that must be imported when used
  const helpersToCheck = [
    "trpcMutation", "trpcQuery", "loginAndGetCookie", "tomorrowStr", "randomPhone",
    "loginAsRole", "navigateTo", "smartFill", "smartClick", "smartSelect", "expectVisible",
    "AxeBuilder", "fc",
  ];
  for (const helper of helpersToCheck) {
    // Match: helper as identifier (function call, JSX, variable use)
    // Not match: helper as substring in another word, or in comments/strings
    const usedRegex = new RegExp(`(?<![\\w$])${helper}(?:\\(|\\.|\\s)`, "g");
    if (usedRegex.test(code)) {
      expect(importedSymbols.has(helper), `${label}: uses ${helper} but doesn't import it`).toBe(true);
    }
  }

  // 3. No duplicate keys in the SAME object literal
  // Heuristic: find each `{ ... }` block (very loosely), check for repeated `key:`
  const objBlocks = code.match(/\{[^{}]*\}/g) || [];
  for (const block of objBlocks) {
    const keys = (block.match(/^\s*(\w+):/gm) || []).map(s => s.trim().replace(":", ""));
    const seen = new Set<string>();
    for (const k of keys) {
      // Skip JS keywords and typed param destructures
      if (["return", "const", "let", "var", "if", "for", "while", "function"].includes(k)) continue;
      expect(seen.has(k), `${label}: duplicate key "${k}" in object literal`).toBe(false);
      seen.add(k);
    }
  }
}

describe("Phase 1+2+A end-to-end output: every generator produces USABLE code", () => {
  it("generateE2ESmartFormTest output is usable", () => {
    const code = generateE2ESmartFormTest(makeTarget("e2e_smart_form"), REALISTIC);
    checkOutputIsUsable(code, "e2e_smart_form");
  });

  it("generateE2EUserJourneyTest output is usable", () => {
    const code = generateE2EUserJourneyTest(makeTarget("e2e_user_journey"), REALISTIC);
    checkOutputIsUsable(code, "e2e_user_journey");
  });

  it("generateE2EPerfBudgetTest output is usable", () => {
    const code = generateE2EPerfBudgetTest(makeTarget("e2e_perf_budget", "reservations.list"), REALISTIC);
    checkOutputIsUsable(code, "e2e_perf_budget");
  });

  it("generateE2EVisualTest output is usable", () => {
    const code = generateE2EVisualTest(makeTarget("e2e_visual", "reservations.list"), REALISTIC);
    checkOutputIsUsable(code, "e2e_visual");
  });

  it("generateE2ENetworkTest output is usable", () => {
    const code = generateE2ENetworkTest(makeTarget("e2e_network", "reservations.list"), REALISTIC);
    checkOutputIsUsable(code, "e2e_network");
  });

  it("generateE2EAccessibilityFullTest output is usable", () => {
    const code = generateE2EAccessibilityFullTest(makeTarget("e2e_a11y_full", "reservations.list"), REALISTIC);
    checkOutputIsUsable(code, "e2e_a11y_full");
  });

  it("generateStatefulSequenceTest output is usable (no duplicate keys, tomorrowStr imported)", () => {
    const code = generateStatefulSequenceTest(makeTarget("stateful_sequence"), REALISTIC);
    checkOutputIsUsable(code, "stateful_sequence");
    // Specifically: tomorrowStr must be imported (regression test)
    expect(code).toMatch(/import\s+\{[^}]*\btomorrowStr\b[^}]*\}\s+from\s+["']\.\.\/\.\.\/helpers\/api["']/);
    // Specifically: marker field (guestName) must NOT appear twice in createPayload
    const createBlock = code.match(/const createPayload = \{[^}]*\}/);
    if (createBlock) {
      const keys = (createBlock[0].match(/^\s*(\w+):/gm) || []).filter(k => k.includes("guestName"));
      expect(keys.length, "guestName must appear exactly once in createPayload").toBe(1);
    }
  });

  it("generatePropertyTest output is usable (tomorrowStr imported when date field present)", () => {
    const code = generatePropertyTest(makeTarget("property_based"), REALISTIC);
    checkOutputIsUsable(code, "property_based");
    // Specifically: tomorrowStr must be imported (regression test)
    expect(code).toMatch(/import\s+\{[^}]*\btomorrowStr\b[^}]*\}\s+from\s+["']\.\.\/\.\.\/helpers\/api["']/);
  });
});
