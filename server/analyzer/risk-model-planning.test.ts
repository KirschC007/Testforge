import { describe, expect, it } from "vitest";
import { buildRiskModel } from "./risk-model";
import type { AnalysisResult, SupportedScopeAssessment } from "./types";

function makeScope(overrides: Partial<SupportedScopeAssessment>): SupportedScopeAssessment {
  return {
    verdict: "unsupported",
    tier: "experimental",
    evidenceLevel: "heuristic",
    confidenceScore: 25,
    goldReadinessScore: 20,
    mode: "code",
    primaryStack: "JavaScript + weak signals",
    summary: "test scope",
    strengths: [],
    blockers: [],
    recommendations: [],
    matchedGoldSignals: [],
    missingGoldSignals: [],
    evidenceSignals: [],
    ...overrides,
  };
}

describe("buildRiskModel proof planning", () => {
  it("filters aggressive proof targets before generation for experimental stacks", () => {
    const analysis: AnalysisResult = {
      qualityScore: 5,
      specType: "code:Express",
      supportedScope: makeScope({}),
      ir: {
        behaviors: [
          {
            id: "B1",
            title: "Concurrent booking must respect capacity limit",
            subject: "user",
            action: "create",
            object: "booking",
            preconditions: ["resource exists"],
            postconditions: ["booking count += 1"],
            errorCases: ["capacity must not exceed max"],
            tags: ["concurrency", "validation"],
            riskHints: ["race condition", "overbooking", "boundary"],
          },
        ],
        invariants: [],
        ambiguities: [],
        contradictions: [],
        tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
        resources: [],
        apiEndpoints: [
          {
            name: "bookings.create",
            method: "POST /api/trpc/bookings.create",
            auth: "authenticated",
            relatedBehaviors: ["B1"],
            inputFields: [
              { name: "tenantId", type: "number", required: true, isTenantKey: true },
              { name: "seats", type: "number", required: true, min: 1, max: 4 },
            ],
          },
        ],
        authModel: null,
        enums: {},
        statusMachine: null,
      },
    };

    const riskModel = buildRiskModel(analysis);
    const proofTypes = riskModel.proofTargets.map((target) => target.proofType);

    expect(riskModel.proofPlanning?.mode).toBe("minimal");
    expect(proofTypes).toContain("boundary");
    expect(proofTypes).not.toContain("concurrency");
    expect(riskModel.skippedProofTargets?.some((target) => target.proofType === "concurrency")).toBe(true);
  });

  it("does not plan tenant-isolation proofs for explicitly single-tenant code", () => {
    const analysis: AnalysisResult = {
      qualityScore: 7,
      specType: "code:Next.js",
      supportedScope: makeScope({ verdict: "partial", tier: "conservative", confidenceScore: 65, goldReadinessScore: 60 }),
      ir: {
        behaviors: [
          {
            id: "B1",
            title: "Authenticated user can update model settings",
            subject: "user",
            action: "updates",
            object: "model settings",
            preconditions: ["user authenticated"],
            postconditions: ["settings saved"],
            errorCases: [],
            tags: ["settings"],
            riskHints: ["idor", "cross-tenant"],
          },
        ],
        invariants: [],
        ambiguities: [],
        contradictions: [],
        tenantModel: null,
        resources: [],
        apiEndpoints: [
          {
            name: "POST /api/settings/models",
            method: "POST /api/settings/models",
            auth: "authenticated",
            relatedBehaviors: ["B1"],
            inputFields: [{ name: "model", type: "string", required: true }],
          },
        ],
        authModel: null,
        enums: {},
        statusMachine: null,
      },
    };

    const riskModel = buildRiskModel(analysis);
    const proofTypes = riskModel.proofTargets.map((target) => target.proofType);
    const endpoints = riskModel.proofTargets.map((target) => target.endpoint).filter(Boolean);

    expect(proofTypes).not.toContain("idor");
    expect(proofTypes).not.toContain("cross_tenant_chain");
    expect(endpoints).toContain("POST /api/settings/models");
    expect(endpoints).not.toContain("settings.models");
  });
});
