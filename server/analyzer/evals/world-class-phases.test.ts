import { describe, expect, it } from "vitest";
import { runGoldenBenchmarkSuite, summarizeGoldenBenchmarkResults } from "./golden-benchmark-cases";
import { runGeneratedSuiteQualitySuite, summarizeGeneratedSuiteQuality } from "./generated-suite-quality";
import { runSalesProofDemo } from "./sales-proof-demo";

describe("world-class phase proof suite", () => {
  it("proves phases 1, 2, 3, 4, 5, 6, 7, and 8 with executable contracts", () => {
    const golden = summarizeGoldenBenchmarkResults(runGoldenBenchmarkSuite());
    const generated = summarizeGeneratedSuiteQuality(runGeneratedSuiteQualitySuite());
    const demo = runSalesProofDemo();

    expect(golden.total).toBeGreaterThanOrEqual(20);
    expect(golden.failed).toBe(0);
    expect(generated.failed).toBe(0);
    expect(demo.passed).toBe(true);
    expect(demo.phasesProved).toBe(8);
    expect(demo.proofTypes.length).toBeGreaterThan(0);
  });
});
