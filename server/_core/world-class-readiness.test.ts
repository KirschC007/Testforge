import { describe, expect, it } from "vitest";
import {
  WORLD_CLASS_CONTROLS,
  evaluateWorldClassReadiness,
  renderWorldClassReadinessMarkdown,
} from "./world-class-readiness";

describe("world-class readiness", () => {
  it("tracks all 30 world-class gaps explicitly", () => {
    expect(WORLD_CLASS_CONTROLS).toHaveLength(30);
    expect(new Set(WORLD_CLASS_CONTROLS.map((control) => control.id)).size).toBe(30);
  });

  it("does not pretend externally validated market facts are code-complete", () => {
    const external = WORLD_CLASS_CONTROLS.filter((control) => control.status === "externally_blocked");

    expect(external.map((control) => control.id)).toEqual(["competitor_benchmarks", "external_validation"]);
    expect(external.every((control) => /requires|Needs/i.test(control.remainingRisk))).toBe(true);
  });

  it("requires evidence for every control", () => {
    const evaluation = evaluateWorldClassReadiness();

    expect(evaluation.total).toBe(30);
    expect(evaluation.pass).toBe(true);
    expect(evaluation.controls.filter((control) => !control.evidencePresent)).toEqual([]);
    expect(evaluation.directlyProved).toBeGreaterThanOrEqual(10);
    expect(evaluation.operationalized).toBeGreaterThanOrEqual(15);
  });

  it("renders a customer-honest markdown proof pack", () => {
    const markdown = renderWorldClassReadinessMarkdown(evaluateWorldClassReadiness());

    expect(markdown).toContain("# TestForge World-Class Readiness");
    expect(markdown).toContain("Externally blocked but explicitly tracked");
    expect(markdown).toContain("Echte Kundenrepo-Benchmark-Suite");
    expect(markdown).toContain("Externe Validierung");
  });
});
