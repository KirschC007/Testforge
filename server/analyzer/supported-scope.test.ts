import { describe, expect, it } from "vitest";
import { assessSupportedScopeForCodebase, assessSupportedScopeForSpec } from "./supported-scope";
import { parseCodeToIR, type CodeFile } from "./code-parser";

const basePackage = (dependencies: Record<string, string>): CodeFile => ({
  path: "package.json",
  content: JSON.stringify({ dependencies }),
});

describe("assessSupportedScopeForCodebase", () => {
  it("marks the focused tRPC + Zod + Drizzle stack as gold", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        "@trpc/server": "^11.0.0",
        zod: "^4.0.0",
        "drizzle-orm": "^0.45.0",
      }),
      { path: "server/router.ts", content: "export const x = 1;" },
      { path: "server/schema.ts", content: "export const y = 2;" },
    ]);

    expect(assessment.verdict).toBe("supported");
    expect(assessment.tier).toBe("gold");
    expect(assessment.evidenceLevel).toBe("inferred");
    expect(assessment.primaryStack).toContain("tRPC");
    expect(assessment.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(assessment.blockers).toHaveLength(0);
  });

  it("keeps JavaScript-only codebases runnable but below gold standard", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        express: "^4.0.0",
      }),
      { path: "server/index.js", content: "module.exports = {};" },
    ]);

    expect(assessment.verdict).toBe("partial");
    expect(assessment.tier).toBe("supported");
    expect(assessment.evidenceLevel).toBe("inferred");
    expect(assessment.confidenceScore).toBeLessThan(90);
    expect(assessment.blockers.some(blocker => blocker.includes("JavaScript"))).toBe(true);
  });

  it("keeps missing zod schemas below gold standard instead of blocking the run", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        "@trpc/server": "^11.0.0",
      }),
      { path: "server/index.ts", content: "export const router = {};" },
    ]);

    expect(assessment.verdict).toBe("partial");
    expect(assessment.blockers.some(blocker => blocker.includes("Zod"))).toBe(true);
  });

  it("downgrades mixed backend frameworks below gold standard", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        "@trpc/server": "^11.0.0",
        express: "^4.0.0",
        zod: "^4.0.0",
        "drizzle-orm": "^0.45.0",
      }),
      { path: "server/index.ts", content: "export const router = {};" },
    ]);

    expect(assessment.verdict).toBe("partial");
    expect(assessment.blockers.some(blocker => blocker.includes("Mehrere Backend-Frameworks"))).toBe(true);
  });

  it("keeps prisma in the supported band but outside gold standard", () => {
    const assessment = assessSupportedScopeForCodebase([
      basePackage({
        "@trpc/server": "^11.0.0",
        zod: "^4.0.0",
        prisma: "^5.0.0",
      }),
      { path: "server/index.ts", content: "export const router = {};" },
    ]);

    expect(assessment.verdict).toBe("partial");
    expect(assessment.tier).toBe("supported");
    expect(assessment.recommendations.some(item => item.includes("Drizzle"))).toBe(true);
  });
});

describe("assessSupportedScopeForSpec", () => {
  it("supports openapi mode", () => {
    const assessment = assessSupportedScopeForSpec('{"openapi":"3.0.0"}', "openapi");
    expect(assessment.verdict).toBe("supported");
    expect(assessment.tier).toBe("gold");
    expect(assessment.primaryStack).toBe("OpenAPI");
    expect(assessment.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it("keeps free-text specs runnable but below gold standard", () => {
    const assessment = assessSupportedScopeForSpec("# Spec", "spec");
    expect(assessment.verdict).toBe("partial");
    expect(assessment.tier).toBe("supported");
    expect(assessment.evidenceLevel).toBe("heuristic");
    expect(assessment.confidenceScore).toBeLessThan(90);
  });
});

describe("parseCodeToIR supportedScope integration", () => {
  it("adds a confidence-reducing ambiguity when the codebase misses the gold standard", () => {
    const result = parseCodeToIR([
      basePackage({
        "@trpc/server": "^11.0.0",
      }),
      { path: "server/index.ts", content: "export const x = 1;" },
    ]);

    expect(result.supportedScope?.verdict).toBe("partial");
    expect(result.ir.ambiguities.some(ambiguity => ambiguity.impact === "reduces_confidence")).toBe(true);
  });
});
