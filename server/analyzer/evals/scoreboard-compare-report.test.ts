import { describe, expect, it } from "vitest";
import baseline from "./quality-baseline.json";
import { buildEvalScoreboard } from "./scoreboard";
import { compareScoreboards } from "./scoreboard-compare";
import { renderScoreboardComparisonMarkdown } from "./scoreboard-compare-report";
import { QUALITY_THRESHOLDS } from "./quality-thresholds";

describe("scoreboard compare report", () => {
  it("renders a markdown delta report", async () => {
    const comparison = compareScoreboards(await buildEvalScoreboard(), baseline, QUALITY_THRESHOLDS);
    const markdown = renderScoreboardComparisonMarkdown(comparison, "2026-04-23T12:00:00.000Z", baseline.label);

    expect(markdown).toContain("# TestForge Quality Delta Report");
    expect(markdown).toContain("## Core Metrics");
    expect(markdown).toContain("## Top Proof Risks");
    expect(markdown).toContain("False positive pass rate");
    expect(markdown).toContain("External repo pass rate");
    expect(markdown).toContain("Bug-kill readiness pass rate");
    expect(markdown).toContain("Bug-kill mutation score");
    expect(markdown).toContain("## Category Deltas");
    expect(markdown).toContain("## Bug Zoo Proof Type Deltas");
    expect(markdown).toContain("## External Repo Proof Type Deltas");
    expect(markdown).toContain("## Regressions");
  });
});
