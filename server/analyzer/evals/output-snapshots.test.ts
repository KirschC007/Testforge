import { describe, expect, it } from "vitest";
import { runOutputSnapshotSuite, summarizeOutputSnapshotResults } from "./output-snapshots";

describe("output snapshot suite", () => {
  it("validates generated scenario snapshots contain the expected test layers", () => {
    const results = runOutputSnapshotSuite();
    const summary = summarizeOutputSnapshotResults(results);

    expect(summary.total).toBeGreaterThanOrEqual(2);
    expect(summary.failed).toBe(0);
    expect(summary.passRate).toBe(100);
  });
});
