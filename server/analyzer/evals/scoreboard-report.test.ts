import { describe, expect, it } from "vitest";
import { buildEvalScoreboard } from "./scoreboard";
import { renderEvalScoreboardMarkdown } from "./scoreboard-report";

describe("scoreboard report", () => {
  it("renders a markdown quality report with key sections", async () => {
    const scoreboard = await buildEvalScoreboard();
    const markdown = renderEvalScoreboardMarkdown(scoreboard, "2026-04-23T12:00:00.000Z");

    expect(markdown).toContain("# TestForge Quality Report");
    expect(markdown).toContain("## Overall");
    expect(markdown).toContain("## Top Proof Signals");
    expect(markdown).toContain("## Bug Categories");
    expect(markdown).toContain("## Proof Types");
    expect(markdown).toContain("## False Positive Suite");
    expect(markdown).toContain("## Benchmarks");
    expect(markdown).toContain("## External Repo Benchmarks");
    expect(markdown).toContain("## External Repo Proof Types");
    expect(markdown).toContain("## External Promotion Coverage");
    expect(markdown).toContain("## Output Snapshots");
    expect(markdown).toContain("## Output Execution Readiness");
    expect(markdown).toContain("## Bug-Kill Readiness");
  });
});
