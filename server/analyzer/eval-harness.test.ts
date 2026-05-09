import { describe, expect, it } from "vitest";
import { runEvalCase, summarizeEvalResults } from "./eval-harness";

const packageJson = (dependencies: Record<string, string>) => ({
  path: "package.json",
  content: JSON.stringify({ dependencies }),
});

describe("eval harness", () => {
  it("passes a gold-stack benchmark fixture", () => {
    const result = runEvalCase({
      name: "gold-stack",
      mode: "code",
      codeFiles: [
        packageJson({
          "@trpc/server": "^11.0.0",
          zod: "^4.0.0",
          "drizzle-orm": "^0.45.0",
        }),
        { path: "server/router.ts", content: "export const appRouter = {};" },
      ],
      expectedTier: "gold",
      expectedEvidenceLevel: "inferred",
      minGoldReadiness: 80,
    });

    expect(result.passed).toBe(true);
    expect(result.proofPlanningMode).toBe("gold");
  });

  it("keeps heuristic spec fixtures out of the gold band", () => {
    const result = runEvalCase({
      name: "free-text-spec",
      mode: "spec",
      specText: "# API spec\nUsers can create orders.",
      expectedTier: "supported",
      expectedEvidenceLevel: "heuristic",
      minGoldReadiness: 30,
      forbiddenProofTypes: ["concurrency", "flow"],
    });

    expect(result.passed).toBe(true);
    expect(result.proofPlanningMode).not.toBe("gold");
  });

  it("summarizes eval pass rates", () => {
    const summary = summarizeEvalResults([
      { name: "a", passed: true, tier: "gold", evidenceLevel: "detected", goldReadinessScore: 100, proofPlanningMode: "gold", proofTypes: [], failures: [] },
      { name: "b", passed: false, tier: "supported", evidenceLevel: "heuristic", goldReadinessScore: 40, proofPlanningMode: "minimal", proofTypes: [], failures: ["x"] },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBe(50);
  });
});
