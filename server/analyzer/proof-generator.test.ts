import { describe, expect, it } from "vitest";
import { generateProofs } from "./proof-generator";
import { getProofGenerationProfile } from "./proof-planning";
import type { AnalysisResult, ProofTarget, RiskModel, SupportedScopeAssessment } from "./types";

function makeScope(overrides: Partial<SupportedScopeAssessment>): SupportedScopeAssessment {
  return {
    verdict: "supported",
    tier: "gold",
    evidenceLevel: "detected",
    confidenceScore: 95,
    goldReadinessScore: 100,
    mode: "code",
    primaryStack: "tRPC + Zod + Drizzle + TypeScript",
    summary: "test",
    strengths: [],
    blockers: [],
    recommendations: [],
    matchedGoldSignals: [],
    missingGoldSignals: [],
    evidenceSignals: [],
    ...overrides,
  };
}

function makeAnalysis(scope: SupportedScopeAssessment): AnalysisResult {
  return {
    qualityScore: 8,
    specType: "code",
    supportedScope: scope,
    ir: {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: null,
      resources: [],
      apiEndpoints: [],
      authModel: null,
      enums: {},
      statusMachine: null,
    },
  };
}

function makeTarget(id: string, proofType: ProofTarget["proofType"]): ProofTarget {
  return {
    id,
    behaviorId: "B1",
    proofType,
    riskLevel: "high",
    evidenceLevel: "heuristic",
    evidenceReason: "test fixture",
    description: `${proofType} target`,
    preconditions: [],
    assertions: [],
    mutationTargets: [{ description: "mutation", expectedKill: true }],
    endpoint: "orders.create",
    constraints: [],
  };
}

describe("getProofGenerationProfile", () => {
  it("keeps full proof catalog for gold analyses", () => {
    const profile = getProofGenerationProfile(makeAnalysis(makeScope({ tier: "gold" })));
    expect(profile.mode).toBe("gold");
    expect(profile.allowedProofTypes.has("concurrent_write")).toBe(true);
  });

  it("switches to conservative mode for non-gold supported analyses", () => {
    const profile = getProofGenerationProfile(makeAnalysis(makeScope({
      verdict: "partial",
      tier: "supported",
      confidenceScore: 72,
      goldReadinessScore: 67,
    })));
    expect(profile.mode).toBe("conservative");
    expect(profile.allowedProofTypes.has("idor")).toBe(true);
    expect(profile.allowedProofTypes.has("concurrent_write")).toBe(false);
  });

  it("switches to minimal mode for weak heuristic analyses", () => {
    const profile = getProofGenerationProfile(makeAnalysis(makeScope({
      verdict: "unsupported",
      tier: "experimental",
      confidenceScore: 25,
      goldReadinessScore: 17,
    })));
    expect(profile.mode).toBe("minimal");
    expect(profile.allowedProofTypes.has("boundary")).toBe(true);
    expect(profile.allowedProofTypes.has("flow")).toBe(false);
  });
});

describe("generateProofs quality gating", () => {
  it("filters aggressive proof types in minimal mode and annotates remaining proofs", async () => {
    const analysis = makeAnalysis(makeScope({
      verdict: "unsupported",
      tier: "experimental",
      confidenceScore: 25,
      goldReadinessScore: 17,
    }));

    const riskModel: RiskModel = {
      behaviors: [],
      idorVectors: 0,
      csrfEndpoints: 0,
      proofTargets: [
        makeTarget("B1_boundary", "boundary"),
        makeTarget("B1_flow", "flow"),
      ],
    };

    const proofs = await generateProofs(riskModel, analysis);

    expect(proofs).toHaveLength(1);
    expect(proofs[0].proofType).toBe("boundary");
    expect(proofs[0].generationMode).toBe("minimal");
    expect(proofs[0].evidenceReason).toBe("test fixture");
    expect(proofs[0].code).toContain("TestForge generation mode: minimal");
  });
});
