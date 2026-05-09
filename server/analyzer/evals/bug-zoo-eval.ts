import { parseCodeToIR } from "../code-parser";
import { runStaticAnalysis } from "../static-analyzer";
import { buildRiskModel } from "../risk-model";
import { BUG_ZOO_FIXTURES } from "./bug-zoo-fixtures";

export interface BugZooEvalResult {
  name: string;
  category: string;
  passed: boolean;
  staticRules: string[];
  proofTypes: string[];
  failures: string[];
  staticCoveragePercent: number;
  proofCoveragePercent: number;
  expectedSignalCount: number;
  matchedSignalCount: number;
  hallucinationCount: number;
}

export function runBugZooEval(): BugZooEvalResult[] {
  return BUG_ZOO_FIXTURES.map((fixture) => {
    const staticFindings = runStaticAnalysis(fixture.files);
    const analysis = parseCodeToIR(fixture.files) as ReturnType<typeof parseCodeToIR> & { staticFindings?: typeof staticFindings };
    analysis.staticFindings = staticFindings;
    const riskModel = buildRiskModel(analysis);
    const staticRules = Array.from(new Set(staticFindings.map((finding) => finding.rule)));
    const proofTypes = Array.from(new Set(riskModel.proofTargets.map((target) => target.proofType)));
    const failures: string[] = [];
    const matchedStaticRules = fixture.expectedStaticRules.filter((rule) => staticRules.includes(rule));
    const matchedProofTypes = fixture.expectedProofTypes.filter((proofType) => proofTypes.includes(proofType));
    const forbiddenStaticHits = (fixture.forbiddenStaticRules || []).filter((rule) => staticRules.includes(rule));
    const forbiddenProofHits = (fixture.forbiddenProofTypes || []).filter((proofType) => proofTypes.includes(proofType));

    for (const rule of fixture.expectedStaticRules) {
      if (!staticRules.includes(rule)) failures.push(`Missing static rule ${rule}`);
    }
    for (const proofType of fixture.expectedProofTypes) {
      if (!proofTypes.includes(proofType)) failures.push(`Missing proof type ${proofType}`);
    }
    for (const rule of fixture.forbiddenStaticRules || []) {
      if (staticRules.includes(rule)) failures.push(`Forbidden static rule ${rule} was triggered`);
    }
    for (const proofType of fixture.forbiddenProofTypes || []) {
      if (proofTypes.includes(proofType)) failures.push(`Forbidden proof type ${proofType} was generated`);
    }

    const staticCoveragePercent = fixture.expectedStaticRules.length > 0
      ? Math.round((matchedStaticRules.length / fixture.expectedStaticRules.length) * 100)
      : 100;
    const proofCoveragePercent = fixture.expectedProofTypes.length > 0
      ? Math.round((matchedProofTypes.length / fixture.expectedProofTypes.length) * 100)
      : 100;
    const expectedSignalCount = fixture.expectedStaticRules.length + fixture.expectedProofTypes.length;
    const matchedSignalCount = matchedStaticRules.length + matchedProofTypes.length;
    const hallucinationCount = forbiddenStaticHits.length + forbiddenProofHits.length;

    return {
      name: fixture.name,
      category: fixture.category,
      passed: failures.length === 0,
      staticRules,
      proofTypes,
      failures,
      staticCoveragePercent,
      proofCoveragePercent,
      expectedSignalCount,
      matchedSignalCount,
      hallucinationCount,
    };
  });
}

export interface BugZooCategorySummary {
  category: string;
  total: number;
  passed: number;
  failed: number;
  expectedSignals: number;
  matchedSignals: number;
  hallucinations: number;
  recallProxy: number;
  precisionProxy: number;
}

export interface BugZooProofTypeSummary {
  proofType: string;
  fixturesExpecting: number;
  fixturesMatched: number;
  fixturesMissed: number;
  forbiddenHits: number;
  recallProxy: number;
  precisionProxy: number;
}

export function summarizeBugZoo(results: BugZooEvalResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const averageStaticCoverage = results.length > 0
    ? Math.round(results.reduce((sum, result) => sum + result.staticCoveragePercent, 0) / results.length)
    : 0;
  const averageProofCoverage = results.length > 0
    ? Math.round(results.reduce((sum, result) => sum + result.proofCoveragePercent, 0) / results.length)
    : 0;
  const totalFailures = results.reduce((sum, result) => sum + result.failures.length, 0);
  const expectedSignals = results.reduce((sum, result) => sum + result.expectedSignalCount, 0);
  const matchedSignals = results.reduce((sum, result) => sum + result.matchedSignalCount, 0);
  const hallucinations = results.reduce((sum, result) => sum + result.hallucinationCount, 0);
  const recallProxy = expectedSignals > 0 ? Math.round((matchedSignals / expectedSignals) * 100) : 100;
  const precisionProxy = matchedSignals + hallucinations > 0
    ? Math.round((matchedSignals / (matchedSignals + hallucinations)) * 100)
    : 100;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    averageStaticCoverage,
    averageProofCoverage,
    totalFailures,
    expectedSignals,
    matchedSignals,
    hallucinations,
    recallProxy,
    precisionProxy,
  };
}

export function summarizeBugZooByCategory(results: BugZooEvalResult[]): BugZooCategorySummary[] {
  const grouped = new Map<string, BugZooEvalResult[]>();
  for (const result of results) {
    const bucket = grouped.get(result.category) || [];
    bucket.push(result);
    grouped.set(result.category, bucket);
  }

  return Array.from(grouped.entries())
    .map(([category, bucket]) => {
      const passed = bucket.filter((result) => result.passed).length;
      const expectedSignals = bucket.reduce((sum, result) => sum + result.expectedSignalCount, 0);
      const matchedSignals = bucket.reduce((sum, result) => sum + result.matchedSignalCount, 0);
      const hallucinations = bucket.reduce((sum, result) => sum + result.hallucinationCount, 0);
      return {
        category,
        total: bucket.length,
        passed,
        failed: bucket.length - passed,
        expectedSignals,
        matchedSignals,
        hallucinations,
        recallProxy: expectedSignals > 0 ? Math.round((matchedSignals / expectedSignals) * 100) : 100,
        precisionProxy: matchedSignals + hallucinations > 0
          ? Math.round((matchedSignals / (matchedSignals + hallucinations)) * 100)
          : 100,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function summarizeBugZooByProofType(results: BugZooEvalResult[]): BugZooProofTypeSummary[] {
  const proofTypes = new Set<string>();

  for (const fixture of BUG_ZOO_FIXTURES) {
    for (const proofType of fixture.expectedProofTypes) proofTypes.add(proofType);
    for (const proofType of fixture.forbiddenProofTypes || []) proofTypes.add(proofType);
  }

  return Array.from(proofTypes)
    .map((proofType) => {
      const fixturesExpecting = BUG_ZOO_FIXTURES.filter((fixture) => fixture.expectedProofTypes.includes(proofType as never)).length;
      const fixturesMatched = BUG_ZOO_FIXTURES.reduce((sum, fixture, index) => {
        if (!fixture.expectedProofTypes.includes(proofType as never)) return sum;
        return sum + (results[index]?.proofTypes.includes(proofType) ? 1 : 0);
      }, 0);
      const forbiddenHits = BUG_ZOO_FIXTURES.reduce((sum, fixture, index) => {
        if (!(fixture.forbiddenProofTypes || []).includes(proofType as never)) return sum;
        return sum + (results[index]?.proofTypes.includes(proofType) ? 1 : 0);
      }, 0);

      return {
        proofType,
        fixturesExpecting,
        fixturesMatched,
        fixturesMissed: fixturesExpecting - fixturesMatched,
        forbiddenHits,
        recallProxy: fixturesExpecting > 0 ? Math.round((fixturesMatched / fixturesExpecting) * 100) : 100,
        precisionProxy: fixturesMatched + forbiddenHits > 0
          ? Math.round((fixturesMatched / (fixturesMatched + forbiddenHits)) * 100)
          : 100,
      };
    })
    .sort((a, b) => a.proofType.localeCompare(b.proofType));
}
