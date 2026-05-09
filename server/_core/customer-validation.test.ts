import { describe, expect, it } from "vitest";
import {
  assertLaunchClaimAllowed,
  buildEmptyMarketValidationSnapshot,
  buildMarketValidationPlan,
  summarizeAcceptanceReviews,
  validateBenchmarkCorpus,
  type CustomerBenchmarkCase,
  type GeneratedSuiteReview,
} from "./customer-validation";

function review(overrides: Partial<GeneratedSuiteReview> = {}): GeneratedSuiteReview {
  return {
    caseId: "case-next-auth",
    reviewer: "external-reviewer",
    generatedAt: "2026-05-06T12:00:00.000Z",
    compileStatus: "passed",
    acceptedTests: 12,
    rejectedTests: 2,
    hallucinatedTests: 0,
    usefulTests: 12,
    seededBugsCaught: 3,
    seededBugsTotal: 4,
    manualFixMinutes: 8,
    verdict: "merge_ready",
    ...overrides,
  };
}

describe("customer validation", () => {
  it("defines a measurable market validation plan", () => {
    const plan = buildMarketValidationPlan();

    expect(plan.requiredCustomerCases).toBe(30);
    expect(plan.requiredExternalReviewers).toBe(5);
    expect(plan.requiredStacks).toContain("nextjs-authjs");
    expect(plan.launchClaimPolicy.blockedUntilExternalEvidence).toContain("perfect");
  });

  it("summarizes external review acceptance and blocks premature perfection claims", () => {
    const summary = summarizeAcceptanceReviews([
      review(),
      review({ caseId: "case-express", verdict: "useful_with_edits", compileStatus: "needs_env" }),
    ]);

    expect(summary.reviewedSuites).toBe(2);
    expect(summary.usefulSuiteRate).toBe(100);
    expect(summary.testAcceptanceRate).toBeGreaterThan(80);
    expect(summary.marketReady).toBe(false);
    expect(summary.blockers.some((blocker) => blocker.includes("Need 30 reviewed customer suites"))).toBe(true);
    expect(() => assertLaunchClaimAllowed("perfect for all vibe code", summary)).toThrow(/blocked/);
  });

  it("allows strong claims only after external acceptance thresholds are met", () => {
    const reviews = Array.from({ length: 30 }, (_, index) => review({ caseId: `case-${index}` }));
    const summary = summarizeAcceptanceReviews(reviews);

    expect(summary.marketReady).toBe(true);
    expect(() => assertLaunchClaimAllowed("perfect for supported benchmarked stacks", summary)).not.toThrow();
  });

  it("validates consented benchmark corpus stack breadth", () => {
    const cases: CustomerBenchmarkCase[] = buildMarketValidationPlan().requiredStacks.map((stack, index) => ({
      id: `case-${index}-${stack}`,
      source: "customer_zip",
      stack,
      consent: "granted",
      expectedEndpoints: 5,
      expectedAuthFlows: 1,
      expectedBusinessRules: 3,
      seededBugs: 2,
      notes: "",
    }));

    const tooSmall = validateBenchmarkCorpus(cases);
    expect(tooSmall.ready).toBe(false);
    expect(tooSmall.missingStacks).toEqual([]);

    const enough = validateBenchmarkCorpus([
      ...cases,
      ...Array.from({ length: 18 }, (_, index) => ({ ...cases[index % cases.length], id: `extra-${index}` })),
    ]);
    expect(enough.ready).toBe(true);
  });

  it("publishes an empty snapshot that is honest about missing market evidence", () => {
    const snapshot = buildEmptyMarketValidationSnapshot();

    expect(snapshot.acceptance.marketReady).toBe(false);
    expect(snapshot.corpus.ready).toBe(false);
    expect(snapshot.acceptance.blockers.length).toBeGreaterThan(0);
  });
});
