import { describe, expect, it } from "vitest";
import { generateReport } from "./report";
import type { AnalysisResult, RiskModel, ValidatedProofSuite } from "./types";

describe("generateReport", () => {
  it("includes static findings and execution profile details", () => {
    const analysis: AnalysisResult = {
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
      qualityScore: 7,
      specType: "code:tRPC",
      supportedScope: {
        verdict: "supported",
        tier: "gold",
        evidenceLevel: "detected",
        confidenceScore: 95,
        goldReadinessScore: 100,
        mode: "code",
        primaryStack: "tRPC + Zod + Drizzle + TypeScript",
        summary: "gold",
        strengths: [],
        blockers: [],
        recommendations: [],
        matchedGoldSignals: [],
        missingGoldSignals: [],
        evidenceSignals: [],
      },
      executionProfile: {
        mode: "verified",
        compileReadinessScore: 96,
        runtimeReadinessScore: 92,
        sandboxReadinessScore: 90,
        summary: "verified",
        strengths: [],
        blockers: ["none"],
        recommendations: ["keep going"],
      },
    };

    const riskModel: RiskModel = {
      behaviors: [],
      proofTargets: [],
      proofPlanning: { mode: "gold", keptTargetCount: 1, skippedTargetCount: 0, summary: "full" },
      skippedProofTargets: [],
      idorVectors: 0,
      csrfEndpoints: 0,
    };

    const suite: ValidatedProofSuite = {
      proofs: [],
      discardedProofs: [],
      verdict: { passed: 1, failed: 0, score: 9.5, summary: "1/1" },
      coverage: { totalBehaviors: 1, coveredBehaviors: 1, coveragePercent: 100, uncoveredIds: [] },
    };

    const report = generateReport(
      analysis,
      riskModel,
      suite,
      "report-test",
      undefined,
      [{ rule: "STATIC-001-HARDCODED-SECRET", severity: "HIGH", file: "server/auth.ts", line: 5, message: "hardcoded", snippet: "jwt.sign" }]
    );

    expect(report).toContain("## Static Analysis Findings (Layer 0)");
    expect(report).toContain("STATIC-001-HARDCODED-SECRET");
    expect(report).toContain("## Execution Profile");
    expect(report).toContain("Compile Readiness");
    expect(report).toContain("Quality Score: 7.0/10.0");
  });

  it("renders code-parser quality scores on a /100 scale", () => {
    const baseAnalysis: AnalysisResult = {
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
      qualityScore: 70,
      specType: "code:Next.js",
    };
    const riskModel: RiskModel = {
      behaviors: [],
      proofTargets: [],
      skippedProofTargets: [],
      idorVectors: 0,
      csrfEndpoints: 0,
    };
    const suite: ValidatedProofSuite = {
      proofs: [],
      discardedProofs: [],
      verdict: { passed: 0, failed: 0, score: 0, summary: "0/0" },
      coverage: { totalBehaviors: 0, coveredBehaviors: 0, coveragePercent: 0, uncoveredIds: [] },
    };

    const report = generateReport(baseAnalysis, riskModel, suite, "scale-test");

    expect(report).toContain("Quality Score: 70/100");
    expect(report).not.toContain("70.0/10.0");
  });
});
