import { describe, expect, it } from "vitest";
import { buildEvalScoreboard } from "./scoreboard";

describe("eval scoreboard", () => {
  it("builds a green scoreboard across bug zoo and benchmark cases", async () => {
    const scoreboard = await buildEvalScoreboard();

    expect(scoreboard.bugZoo.failed).toBe(0);
    expect(scoreboard.falsePositives.failed).toBe(0);
    expect(scoreboard.benchmarks.failed).toBe(0);
    expect(scoreboard.goldenBenchmarks.failed).toBe(0);
    expect(scoreboard.generatedSuiteQuality.failed).toBe(0);
    expect(scoreboard.salesProofDemo.failed).toBe(0);
    expect(scoreboard.externalRepos.failed).toBe(0);
    expect(scoreboard.outputSnapshots.failed).toBe(0);
    expect(scoreboard.outputExecution.failed).toBe(0);
    expect(scoreboard.bugKillReadiness.failed).toBe(0);
    expect(scoreboard.overall.failedSuites).toBe(0);
    expect(scoreboard.overall.totalSuites).toBe(10);
    expect(scoreboard.bugZoo.total).toBeGreaterThanOrEqual(14);
    expect(scoreboard.bugZooCategories.length).toBeGreaterThanOrEqual(5);
    expect(scoreboard.bugZooProofTypes.length).toBeGreaterThanOrEqual(8);
    expect(scoreboard.bugZooCategories.every((category) => category.failed === 0)).toBe(true);
    expect(scoreboard.bugZooProofTypes.every((proofType) => proofType.fixturesMissed === 0)).toBe(true);
    expect(scoreboard.bugZooProofTypes.every((proofType) => proofType.forbiddenHits === 0)).toBe(true);
    expect(scoreboard.falsePositiveResults.length).toBeGreaterThanOrEqual(10);
    expect(scoreboard.benchmarkResults.length).toBeGreaterThanOrEqual(4);
    expect(scoreboard.goldenBenchmarkResults.length).toBeGreaterThanOrEqual(20);
    expect(scoreboard.generatedSuiteQualityResults.length).toBeGreaterThanOrEqual(2);
    expect(scoreboard.salesProofDemoResult.phasesProved).toBe(8);
    expect(scoreboard.salesProofDemoResult.readiness).not.toBe("draft_only");
    expect(scoreboard.externalRepoResults.length).toBeGreaterThanOrEqual(4);
    expect(scoreboard.externalRepoProofTypes.length).toBeGreaterThanOrEqual(4);
    expect(scoreboard.externalRepoProofTypes.every((proofType) => proofType.reposMissed === 0)).toBe(true);
    expect(scoreboard.externalRepoProofTypes.every((proofType) => proofType.forbiddenHits === 0)).toBe(true);
    expect(scoreboard.externalPromotionCoverage.coverageRate).toBe(100);
    expect(scoreboard.externalPromotionCoverage.uncoveredContracts).toBe(0);
    expect(scoreboard.outputSnapshotResults.length).toBeGreaterThanOrEqual(2);
    expect(scoreboard.outputExecutionResults.length).toBeGreaterThanOrEqual(2);
    expect(scoreboard.outputExecution.totalSpecs).toBeGreaterThan(0);
    expect(scoreboard.outputExecution.totalSecuritySpecs).toBeGreaterThan(0);
    expect(scoreboard.bugKillReadinessResults.length).toBeGreaterThanOrEqual(7);
    expect(scoreboard.bugKillReadiness.missingProofTypes).toBe(0);
    expect(scoreboard.bugKillReadiness.averageMutationScore).toBe(100);
  });
});
