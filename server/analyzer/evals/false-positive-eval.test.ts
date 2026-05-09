import { describe, expect, it } from "vitest";
import { FALSE_POSITIVE_FIXTURES, runFalsePositiveEval, summarizeFalsePositiveEval } from "./false-positive-eval";

describe("false positive eval", () => {
  it("keeps the safe fixture suite green", () => {
    const results = runFalsePositiveEval();
    const summary = summarizeFalsePositiveEval(results);

    expect(FALSE_POSITIVE_FIXTURES.length).toBeGreaterThanOrEqual(10);
    expect(summary.failed).toBe(0);
    expect(summary.falsePositiveHits).toBe(0);
    expect(summary.passRate).toBe(100);
  });
});
