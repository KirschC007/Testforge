import { runBugZooEval, summarizeBugZoo, summarizeBugZooByCategory, summarizeBugZooByProofType } from "./bug-zoo-eval";
import { runFalsePositiveEval, summarizeFalsePositiveEval } from "./false-positive-eval";
import { BENCHMARK_CASES } from "./benchmark-cases";
import { runEvalCase, summarizeEvalResults } from "../eval-harness";
import { runOutputSnapshotSuite, summarizeOutputSnapshotResults } from "./output-snapshots";
import { runOutputExecutionSuite, summarizeOutputExecutionResults } from "./output-execution";
import { runBugKillReadinessEval, summarizeBugKillReadiness, type BugKillReadinessResult } from "./bug-kill-readiness";
import { runGoldenBenchmarkSuite, summarizeGoldenBenchmarkResults, type GoldenBenchmarkResult } from "./golden-benchmark-cases";
import { runGeneratedSuiteQualitySuite, summarizeGeneratedSuiteQuality, type GeneratedSuiteQualityResult } from "./generated-suite-quality";
import { runSalesProofDemo, type SalesProofDemoResult } from "./sales-proof-demo";
import {
  runExternalRepoBenchmarkSuite,
  summarizeExternalRepoBenchmarks,
  summarizeExternalRepoBenchmarksByProofType,
  type ExternalRepoBenchmarkResult,
} from "./external-repo-benchmarks";

export interface ExternalPromotionCoverage {
  totalContracts: number;
  promotedContracts: number;
  uncoveredContracts: number;
  coverageRate: number;
  promotedNames: string[];
  uncoveredNames: string[];
}

export interface EvalScoreboard {
  bugZoo: ReturnType<typeof summarizeBugZoo>;
  bugZooCategories: ReturnType<typeof summarizeBugZooByCategory>;
  bugZooProofTypes: ReturnType<typeof summarizeBugZooByProofType>;
  falsePositives: ReturnType<typeof summarizeFalsePositiveEval>;
  benchmarks: ReturnType<typeof summarizeEvalResults>;
  goldenBenchmarks: ReturnType<typeof summarizeGoldenBenchmarkResults>;
  generatedSuiteQuality: ReturnType<typeof summarizeGeneratedSuiteQuality>;
  salesProofDemo: { total: number; passed: number; failed: number; passRate: number };
  externalRepos: ReturnType<typeof summarizeExternalRepoBenchmarks>;
  externalRepoProofTypes: ReturnType<typeof summarizeExternalRepoBenchmarksByProofType>;
  externalPromotionCoverage: ExternalPromotionCoverage;
  outputSnapshots: ReturnType<typeof summarizeOutputSnapshotResults>;
  outputExecution: ReturnType<typeof summarizeOutputExecutionResults>;
  bugKillReadiness: ReturnType<typeof summarizeBugKillReadiness>;
  overall: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    suitePassRate: number;
  };
  benchmarkResults: ReturnType<typeof runEvalCase>[];
  goldenBenchmarkResults: GoldenBenchmarkResult[];
  generatedSuiteQualityResults: GeneratedSuiteQualityResult[];
  salesProofDemoResult: SalesProofDemoResult;
  falsePositiveResults: ReturnType<typeof runFalsePositiveEval>;
  externalRepoResults: ExternalRepoBenchmarkResult[];
  outputSnapshotResults: ReturnType<typeof runOutputSnapshotSuite>;
  outputExecutionResults: ReturnType<typeof runOutputExecutionSuite>;
  bugKillReadinessResults: BugKillReadinessResult[];
}

function buildExternalPromotionCoverage(results: ExternalRepoBenchmarkResult[]): ExternalPromotionCoverage {
  const promotedNames = new Set(
    BENCHMARK_CASES
      .map((entry) => entry.promotedFromLiveRepo)
      .filter((value): value is string => Boolean(value))
  );
  const contractNames = results.map((result) => result.name);
  const promotedContracts = contractNames.filter((name) => promotedNames.has(name));
  const uncoveredNames = contractNames.filter((name) => !promotedNames.has(name));

  return {
    totalContracts: contractNames.length,
    promotedContracts: promotedContracts.length,
    uncoveredContracts: uncoveredNames.length,
    coverageRate: contractNames.length > 0 ? Math.round((promotedContracts.length / contractNames.length) * 100) : 0,
    promotedNames: promotedContracts,
    uncoveredNames,
  };
}

export async function buildEvalScoreboard(): Promise<EvalScoreboard> {
  const bugZooResults = runBugZooEval();
  const bugZoo = summarizeBugZoo(bugZooResults);
  const bugZooCategories = summarizeBugZooByCategory(bugZooResults);
  const bugZooProofTypes = summarizeBugZooByProofType(bugZooResults);
  const falsePositiveResults = runFalsePositiveEval();
  const falsePositives = summarizeFalsePositiveEval(falsePositiveResults);
  const benchmarkResults = BENCHMARK_CASES.map((input) => runEvalCase(input));
  const benchmarks = summarizeEvalResults(benchmarkResults);
  const goldenBenchmarkResults = runGoldenBenchmarkSuite();
  const goldenBenchmarks = summarizeGoldenBenchmarkResults(goldenBenchmarkResults);
  const generatedSuiteQualityResults = runGeneratedSuiteQualitySuite();
  const generatedSuiteQuality = summarizeGeneratedSuiteQuality(generatedSuiteQualityResults);
  const salesProofDemoResult = runSalesProofDemo();
  const salesProofDemo = {
    total: 1,
    passed: salesProofDemoResult.passed ? 1 : 0,
    failed: salesProofDemoResult.passed ? 0 : 1,
    passRate: salesProofDemoResult.passed ? 100 : 0,
  };
  const externalRepoResults = runExternalRepoBenchmarkSuite();
  const externalRepos = summarizeExternalRepoBenchmarks(externalRepoResults);
  const externalRepoProofTypes = summarizeExternalRepoBenchmarksByProofType(externalRepoResults);
  const externalPromotionCoverage = buildExternalPromotionCoverage(externalRepoResults);
  const outputSnapshotResults = runOutputSnapshotSuite();
  const outputSnapshots = summarizeOutputSnapshotResults(outputSnapshotResults);
  const outputExecutionResults = runOutputExecutionSuite();
  const outputExecution = summarizeOutputExecutionResults(outputExecutionResults);
  const bugKillReadinessResults = await runBugKillReadinessEval();
  const bugKillReadiness = summarizeBugKillReadiness(bugKillReadinessResults);
  const totalSuites = 10;
  const passedSuites = [
    bugZoo.failed === 0,
    falsePositives.failed === 0,
    benchmarks.failed === 0,
    goldenBenchmarks.failed === 0,
    generatedSuiteQuality.failed === 0,
    salesProofDemo.failed === 0,
    externalRepos.failed === 0,
    outputSnapshots.failed === 0,
    outputExecution.failed === 0,
    bugKillReadiness.failed === 0,
  ].filter(Boolean).length;

  return {
    bugZoo,
    bugZooCategories,
    bugZooProofTypes,
    falsePositives,
    benchmarks,
    goldenBenchmarks,
    generatedSuiteQuality,
    salesProofDemo,
    externalRepos,
    externalRepoProofTypes,
    externalPromotionCoverage,
    outputSnapshots,
    outputExecution,
    bugKillReadiness,
    overall: {
      totalSuites,
      passedSuites,
      failedSuites: totalSuites - passedSuites,
      suitePassRate: Math.round((passedSuites / totalSuites) * 100),
    },
    benchmarkResults,
    goldenBenchmarkResults,
    generatedSuiteQualityResults,
    salesProofDemoResult,
    falsePositiveResults,
    externalRepoResults,
    outputSnapshotResults,
    outputExecutionResults,
    bugKillReadinessResults,
  };
}
