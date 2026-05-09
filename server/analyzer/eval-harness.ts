import { parseCodeToIR, type CodeFile } from "./code-parser";
import { assessSupportedScopeForSpec } from "./supported-scope";
import { buildRiskModel } from "./risk-model";
import { getProofGenerationProfile } from "./proof-planning";
import type { EvidenceLevel, ProofType, SupportedScopeAssessment } from "./types";

export interface EvalCase {
  name: string;
  mode: "code" | "spec";
  codeFiles?: CodeFile[];
  specText?: string;
  promotedFromLiveRepo?: string;
  expectedTier: "gold" | "supported" | "experimental";
  expectedEvidenceLevel: EvidenceLevel;
  minGoldReadiness: number;
  requiredProofTypes?: ProofType[];
  forbiddenProofTypes?: ProofType[];
}

export interface EvalCaseResult {
  name: string;
  passed: boolean;
  tier: SupportedScopeAssessment["tier"];
  evidenceLevel: EvidenceLevel;
  goldReadinessScore: number;
  proofPlanningMode: "gold" | "conservative" | "minimal";
  proofTypes: string[];
  failures: string[];
}

export function runEvalCase(input: EvalCase): EvalCaseResult {
  const analysis = input.mode === "code"
    ? parseCodeToIR(input.codeFiles || [])
    : {
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
        qualityScore: 0,
        specType: input.mode,
        supportedScope: assessSupportedScopeForSpec(input.specText || "", input.specText?.includes("openapi") ? "openapi" : "spec"),
      };

  const supportedScope = analysis.supportedScope!;
  const riskModel = buildRiskModel(analysis);
  const proofPlanning = getProofGenerationProfile(analysis);
  const proofTypes = Array.from(new Set(riskModel.proofTargets.map(target => target.proofType))) as ProofType[];
  const failures: string[] = [];

  if (supportedScope.tier !== input.expectedTier) {
    failures.push(`Expected tier ${input.expectedTier} but got ${supportedScope.tier}`);
  }
  if (supportedScope.evidenceLevel !== input.expectedEvidenceLevel) {
    failures.push(`Expected evidence ${input.expectedEvidenceLevel} but got ${supportedScope.evidenceLevel}`);
  }
  if (supportedScope.goldReadinessScore < input.minGoldReadiness) {
    failures.push(`Expected gold readiness >= ${input.minGoldReadiness} but got ${supportedScope.goldReadinessScore}`);
  }
  for (const proofType of input.requiredProofTypes || []) {
    if (!proofTypes.includes(proofType)) failures.push(`Missing required proof type ${proofType}`);
  }
  for (const proofType of input.forbiddenProofTypes || []) {
    if (proofTypes.includes(proofType)) failures.push(`Forbidden proof type ${proofType} was generated`);
  }

  return {
    name: input.name,
    passed: failures.length === 0,
    tier: supportedScope.tier,
    evidenceLevel: supportedScope.evidenceLevel,
    goldReadinessScore: supportedScope.goldReadinessScore,
    proofPlanningMode: proofPlanning.mode,
    proofTypes,
    failures,
  };
}

export function summarizeEvalResults(results: EvalCaseResult[]) {
  const passed = results.filter(result => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
  };
}
