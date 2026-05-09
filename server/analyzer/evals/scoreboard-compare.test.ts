import { describe, expect, it } from "vitest";
import baseline from "./quality-baseline.json";
import { buildEvalScoreboard } from "./scoreboard";
import { compareScoreboards } from "./scoreboard-compare";
import { QUALITY_THRESHOLDS } from "./quality-thresholds";

describe("scoreboard compare", () => {
  it("passes when the current scoreboard matches or exceeds the baseline", async () => {
    const current = await buildEvalScoreboard();
    const comparison = compareScoreboards(current, baseline, QUALITY_THRESHOLDS);

    expect(comparison.passed).toBe(true);
    expect(comparison.regressions).toHaveLength(0);
    expect(comparison.bugZooProofTypeDeltas.length).toBeGreaterThanOrEqual(8);
    expect(comparison.externalRepoProofTypeDeltas.length).toBeGreaterThanOrEqual(4);
    expect(comparison.bugKillReadinessPassRate.current).toBe(100);
    expect(comparison.bugKillMutationScore.current).toBe(100);
  });
});
