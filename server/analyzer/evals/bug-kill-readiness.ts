import { parseCodeToIR } from "../code-parser";
import { buildRiskModel } from "../risk-model";
import { generateProofs } from "../proof-generator";
import { runIndependentChecker, validateProofs } from "../validator";
import { runStaticAnalysis } from "../static-analyzer";
import { BUG_ZOO_FIXTURES } from "./bug-zoo-fixtures";

export interface BugKillReadinessResult {
  name: string;
  category: string;
  passed: boolean;
  expectedProofTypes: string[];
  validatedProofTypes: string[];
  missingProofTypes: string[];
  killCommentProofs: number;
  validatedProofs: number;
  averageMutationScore: number;
  failures: string[];
}

export async function runBugKillReadinessEval(): Promise<BugKillReadinessResult[]> {
  const fixtures = BUG_ZOO_FIXTURES.filter((fixture) => fixture.expectedProofTypes.length > 0);
  const results: BugKillReadinessResult[] = [];

  for (const fixture of fixtures) {
    const staticFindings = runStaticAnalysis(fixture.files);
    const analysis = parseCodeToIR(fixture.files) as ReturnType<typeof parseCodeToIR> & { staticFindings?: typeof staticFindings };
    analysis.staticFindings = staticFindings;
    const riskModel = buildRiskModel(analysis);
    const rawProofs = await generateProofs(riskModel, analysis);
    const { checkedProofs } = await runIndependentChecker(rawProofs, analysis);
    const validatedSuite = validateProofs(checkedProofs, analysis.ir.behaviors.map((behavior) => behavior.id));
    const validatedProofTypes = Array.from(new Set(validatedSuite.proofs.map((proof) => proof.proofType)));
    const expectedProofTypes = fixture.expectedProofTypes;
    const missingProofTypes = expectedProofTypes.filter((proofType) => !validatedProofTypes.includes(proofType));
    const expectedValidatedProofs = validatedSuite.proofs.filter((proof) => expectedProofTypes.includes(proof.proofType));
    const killCommentProofs = expectedValidatedProofs.filter((proof) => proof.code.includes("// Kills:")).length;
    const averageMutationScore = expectedValidatedProofs.length > 0
      ? Math.round((expectedValidatedProofs.reduce((sum, proof) => sum + proof.mutationScore, 0) / expectedValidatedProofs.length) * 100)
      : 0;
    const failures: string[] = [];

    for (const missingProofType of missingProofTypes) {
      failures.push(`Missing validated proof type ${missingProofType}`);
    }
    if (expectedValidatedProofs.length > 0 && killCommentProofs !== expectedValidatedProofs.length) {
      failures.push(`Only ${killCommentProofs}/${expectedValidatedProofs.length} expected proofs include mutation-kill comments`);
    }
    if (expectedValidatedProofs.length > 0 && averageMutationScore < 80) {
      failures.push(`Average mutation score below 80: ${averageMutationScore}`);
    }

    results.push({
      name: fixture.name,
      category: fixture.category,
      passed: failures.length === 0,
      expectedProofTypes,
      validatedProofTypes,
      missingProofTypes,
      killCommentProofs,
      validatedProofs: expectedValidatedProofs.length,
      averageMutationScore,
      failures,
    });
  }

  return results;
}

export function summarizeBugKillReadiness(results: BugKillReadinessResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const totalExpectedProofTypes = results.reduce((sum, result) => sum + result.expectedProofTypes.length, 0);
  const missingProofTypes = results.reduce((sum, result) => sum + result.missingProofTypes.length, 0);
  const totalValidatedProofs = results.reduce((sum, result) => sum + result.validatedProofs, 0);
  const totalKillCommentProofs = results.reduce((sum, result) => sum + result.killCommentProofs, 0);
  const averageMutationScore = results.length > 0
    ? Math.round(results.reduce((sum, result) => sum + result.averageMutationScore, 0) / results.length)
    : 0;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    totalExpectedProofTypes,
    missingProofTypes,
    totalValidatedProofs,
    totalKillCommentProofs,
    averageMutationScore,
  };
}
