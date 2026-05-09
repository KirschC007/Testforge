import { describe, expect, it } from "vitest";
import { runBugZooEval, summarizeBugZoo, summarizeBugZooByProofType } from "./bug-zoo-eval";

describe("bug zoo eval", () => {
  it("scores all current bug fixtures successfully", () => {
    const results = runBugZooEval();
    const summary = summarizeBugZoo(results);

    expect(summary.total).toBeGreaterThanOrEqual(14);
    expect(summary.failed).toBe(0);
    expect(summary.passRate).toBe(100);
    expect(summary.averageStaticCoverage).toBe(100);
    expect(summary.recallProxy).toBe(100);
    expect(summary.precisionProxy).toBe(100);
    expect(summary.hallucinations).toBe(0);
    expect(summary.totalFailures).toBe(0);
    expect(results.every((result) => result.staticCoveragePercent === 100)).toBe(true);
  });

  it("builds per-proof scorecards without gaps on current fixtures", () => {
    const results = runBugZooEval();
    const proofTypes = summarizeBugZooByProofType(results);
    const idor = proofTypes.find((entry) => entry.proofType === "idor");
    const webhook = proofTypes.find((entry) => entry.proofType === "webhook");

    expect(proofTypes.length).toBeGreaterThanOrEqual(8);
    expect(proofTypes.every((entry) => entry.fixturesMissed === 0)).toBe(true);
    expect(proofTypes.every((entry) => entry.forbiddenHits === 0)).toBe(true);
    expect(proofTypes.every((entry) => entry.recallProxy === 100)).toBe(true);
    expect(proofTypes.every((entry) => entry.precisionProxy === 100)).toBe(true);
    expect(idor?.fixturesExpecting).toBeGreaterThanOrEqual(1);
    expect(webhook?.fixturesMatched).toBeGreaterThanOrEqual(1);
  });
});
