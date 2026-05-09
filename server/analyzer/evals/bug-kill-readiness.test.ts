import { describe, expect, it } from "vitest";
import { runBugKillReadinessEval, summarizeBugKillReadiness } from "./bug-kill-readiness";

describe("bug-kill readiness eval", () => {
  it("generates validated mutation-killing proofs for bug-zoo proof fixtures", async () => {
    const results = await runBugKillReadinessEval();
    const summary = summarizeBugKillReadiness(results);

    expect(summary.total).toBeGreaterThanOrEqual(6);
    expect(summary.failed).toBe(0);
    expect(summary.passRate).toBe(100);
    expect(summary.missingProofTypes).toBe(0);
    expect(summary.totalKillCommentProofs).toBe(summary.totalValidatedProofs);
    expect(summary.averageMutationScore).toBeGreaterThanOrEqual(80);
  }, 30000);
});
