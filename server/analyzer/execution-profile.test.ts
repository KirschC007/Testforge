import { describe, expect, it } from "vitest";
import { buildExecutionProfile } from "./execution-profile";
import type { AnalysisResult, RiskModel, SupportedScopeAssessment, ValidatedProofSuite } from "./types";

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
    qualityScore: 8,
    specType: "code",
    supportedScope: scope,
  };
}

describe("buildExecutionProfile", () => {
  it("classifies strong gold runs as verified", () => {
    const analysis = makeAnalysis(makeScope({}));
    const riskModel: RiskModel = {
      behaviors: [],
      proofTargets: [],
      proofPlanning: { mode: "gold", keptTargetCount: 8, skippedTargetCount: 0, summary: "full" },
      skippedProofTargets: [],
      idorVectors: 0,
      csrfEndpoints: 0,
    };
    const suite: ValidatedProofSuite = {
      proofs: [],
      discardedProofs: [],
      verdict: { passed: 8, failed: 0, score: 9.2, summary: "8/8" },
      coverage: { totalBehaviors: 10, coveredBehaviors: 9, coveragePercent: 90, uncoveredIds: [] },
    };

    const profile = buildExecutionProfile(analysis, riskModel, suite);
    expect(profile.mode).toBe("verified");
    expect(profile.compileReadinessScore).toBeGreaterThanOrEqual(85);
  });

  it("keeps weak heuristic runs in the minimal band", () => {
    const analysis = makeAnalysis(makeScope({
      verdict: "unsupported",
      tier: "experimental",
      evidenceLevel: "heuristic",
      confidenceScore: 25,
      goldReadinessScore: 20,
      primaryStack: "Free-text spec",
    }));
    const riskModel: RiskModel = {
      behaviors: [],
      proofTargets: [],
      proofPlanning: { mode: "minimal", keptTargetCount: 2, skippedTargetCount: 5, summary: "minimal" },
      skippedProofTargets: [{ id: "x", proofType: "flow", reason: "heuristic" }],
      idorVectors: 0,
      csrfEndpoints: 0,
    };
    const suite: ValidatedProofSuite = {
      proofs: [],
      discardedProofs: [],
      verdict: { passed: 1, failed: 2, score: 3.5, summary: "1/3" },
      coverage: { totalBehaviors: 10, coveredBehaviors: 2, coveragePercent: 20, uncoveredIds: [] },
    };

    const profile = buildExecutionProfile(analysis, riskModel, suite);
    expect(profile.mode).toBe("minimal");
    expect(profile.blockers.some(blocker => blocker.includes("skipped"))).toBe(true);
  });
});
