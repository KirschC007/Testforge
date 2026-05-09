import { z } from "zod";

export const customerBenchmarkCaseSchema = z.object({
  id: z.string().min(3),
  source: z.enum(["customer_zip", "customer_repo", "public_repo", "internal_fixture"]),
  stack: z.string().min(1),
  consent: z.enum(["granted", "not_required", "missing"]),
  expectedEndpoints: z.number().int().min(0),
  expectedAuthFlows: z.number().int().min(0),
  expectedBusinessRules: z.number().int().min(0),
  seededBugs: z.number().int().min(0),
  notes: z.string().default(""),
});

export const generatedSuiteReviewSchema = z.object({
  caseId: z.string().min(3),
  reviewer: z.string().min(1),
  generatedAt: z.string().datetime(),
  compileStatus: z.enum(["passed", "needs_env", "failed", "not_run"]),
  acceptedTests: z.number().int().min(0),
  rejectedTests: z.number().int().min(0),
  hallucinatedTests: z.number().int().min(0),
  usefulTests: z.number().int().min(0),
  seededBugsCaught: z.number().int().min(0),
  seededBugsTotal: z.number().int().min(0),
  manualFixMinutes: z.number().min(0),
  verdict: z.enum(["merge_ready", "useful_with_edits", "inspiration_only", "reject"]),
});

export type CustomerBenchmarkCase = z.infer<typeof customerBenchmarkCaseSchema>;
export type GeneratedSuiteReview = z.infer<typeof generatedSuiteReviewSchema>;

export interface AcceptanceSummary {
  reviewedSuites: number;
  mergeReadySuites: number;
  usefulSuites: number;
  acceptedTests: number;
  rejectedTests: number;
  hallucinatedTests: number;
  usefulTests: number;
  compilePassRate: number;
  usefulSuiteRate: number;
  testAcceptanceRate: number;
  hallucinationRate: number;
  seededBugCatchRate: number;
  averageManualFixMinutes: number;
  marketReady: boolean;
  blockers: string[];
}

export interface MarketValidationPlan {
  requiredCustomerCases: number;
  requiredExternalReviewers: number;
  minimumUsefulSuiteRate: number;
  minimumTestAcceptanceRate: number;
  maximumHallucinationRate: number;
  maximumAverageManualFixMinutes: number;
  minimumSeededBugCatchRate: number;
  requiredStacks: string[];
  launchClaimPolicy: {
    allowedNow: string[];
    blockedUntilExternalEvidence: string[];
  };
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function buildMarketValidationPlan(): MarketValidationPlan {
  return {
    requiredCustomerCases: 30,
    requiredExternalReviewers: 5,
    minimumUsefulSuiteRate: 75,
    minimumTestAcceptanceRate: 75,
    maximumHallucinationRate: 5,
    maximumAverageManualFixMinutes: 15,
    minimumSeededBugCatchRate: 60,
    requiredStacks: [
      "nextjs-authjs",
      "nextjs-trpc",
      "express-rest",
      "nestjs",
      "hono",
      "fastapi",
      "django-rest",
      "rails",
      "laravel",
      "go-api",
      "spring-boot",
      "monorepo",
    ],
    launchClaimPolicy: {
      allowedNow: [
        "internal quality gate passed",
        "beta-ready for supported TypeScript/FastAPI-style inputs",
        "evidence-first generated test suite",
      ],
      blockedUntilExternalEvidence: [
        "perfect",
        "world's best",
        "guaranteed merge-ready for all vibe code",
        "enterprise-proven",
      ],
    },
  };
}

export function summarizeAcceptanceReviews(reviews: GeneratedSuiteReview[]): AcceptanceSummary {
  const parsed = reviews.map((review) => generatedSuiteReviewSchema.parse(review));
  const acceptedTests = parsed.reduce((sum, review) => sum + review.acceptedTests, 0);
  const rejectedTests = parsed.reduce((sum, review) => sum + review.rejectedTests, 0);
  const hallucinatedTests = parsed.reduce((sum, review) => sum + review.hallucinatedTests, 0);
  const usefulTests = parsed.reduce((sum, review) => sum + review.usefulTests, 0);
  const seededBugsCaught = parsed.reduce((sum, review) => sum + review.seededBugsCaught, 0);
  const seededBugsTotal = parsed.reduce((sum, review) => sum + review.seededBugsTotal, 0);
  const usefulSuites = parsed.filter((review) => review.verdict === "merge_ready" || review.verdict === "useful_with_edits").length;
  const mergeReadySuites = parsed.filter((review) => review.verdict === "merge_ready").length;
  const compilePassed = parsed.filter((review) => review.compileStatus === "passed" || review.compileStatus === "needs_env").length;
  const totalTests = acceptedTests + rejectedTests;
  const averageManualFixMinutes = parsed.length > 0
    ? Math.round(parsed.reduce((sum, review) => sum + review.manualFixMinutes, 0) / parsed.length)
    : 0;
  const plan = buildMarketValidationPlan();

  const summary: AcceptanceSummary = {
    reviewedSuites: parsed.length,
    mergeReadySuites,
    usefulSuites,
    acceptedTests,
    rejectedTests,
    hallucinatedTests,
    usefulTests,
    compilePassRate: pct(compilePassed, parsed.length),
    usefulSuiteRate: pct(usefulSuites, parsed.length),
    testAcceptanceRate: pct(acceptedTests, totalTests),
    hallucinationRate: pct(hallucinatedTests, totalTests),
    seededBugCatchRate: pct(seededBugsCaught, seededBugsTotal),
    averageManualFixMinutes,
    marketReady: false,
    blockers: [],
  };

  if (summary.reviewedSuites < plan.requiredCustomerCases) {
    summary.blockers.push(`Need ${plan.requiredCustomerCases} reviewed customer suites; have ${summary.reviewedSuites}.`);
  }
  if (summary.usefulSuiteRate < plan.minimumUsefulSuiteRate) {
    summary.blockers.push(`Useful suite rate ${summary.usefulSuiteRate}% is below ${plan.minimumUsefulSuiteRate}%.`);
  }
  if (summary.testAcceptanceRate < plan.minimumTestAcceptanceRate) {
    summary.blockers.push(`Test acceptance rate ${summary.testAcceptanceRate}% is below ${plan.minimumTestAcceptanceRate}%.`);
  }
  if (summary.hallucinationRate > plan.maximumHallucinationRate) {
    summary.blockers.push(`Hallucination rate ${summary.hallucinationRate}% is above ${plan.maximumHallucinationRate}%.`);
  }
  if (summary.averageManualFixMinutes > plan.maximumAverageManualFixMinutes) {
    summary.blockers.push(`Average manual fix time ${summary.averageManualFixMinutes}m is above ${plan.maximumAverageManualFixMinutes}m.`);
  }
  if (seededBugsTotal > 0 && summary.seededBugCatchRate < plan.minimumSeededBugCatchRate) {
    summary.blockers.push(`Seeded bug catch rate ${summary.seededBugCatchRate}% is below ${plan.minimumSeededBugCatchRate}%.`);
  }

  summary.marketReady = summary.blockers.length === 0;
  return summary;
}

export function validateBenchmarkCorpus(cases: CustomerBenchmarkCase[]) {
  const parsed = cases.map((entry) => customerBenchmarkCaseSchema.parse(entry));
  const plan = buildMarketValidationPlan();
  const consented = parsed.filter((entry) => entry.consent === "granted" || entry.consent === "not_required");
  const stacks = new Set(consented.map((entry) => entry.stack));
  const missingStacks = plan.requiredStacks.filter((stack) => !stacks.has(stack));
  const blockers: string[] = [];

  if (consented.length < plan.requiredCustomerCases) {
    blockers.push(`Need ${plan.requiredCustomerCases} consented benchmark cases; have ${consented.length}.`);
  }
  if (missingStacks.length > 0) {
    blockers.push(`Missing required stack coverage: ${missingStacks.join(", ")}.`);
  }

  return {
    totalCases: parsed.length,
    consentedCases: consented.length,
    coveredStacks: Array.from(stacks).sort(),
    missingStacks,
    ready: blockers.length === 0,
    blockers,
  };
}

export function assertLaunchClaimAllowed(claim: string, summary: AcceptanceSummary): void {
  const blockedClaims = buildMarketValidationPlan().launchClaimPolicy.blockedUntilExternalEvidence;
  const normalized = claim.toLowerCase();
  const isBlockedClaim = blockedClaims.some((blocked) => normalized.includes(blocked.toLowerCase()));
  if (isBlockedClaim && !summary.marketReady) {
    throw new Error(`Launch claim blocked until external market validation passes: ${claim}`);
  }
}

export function buildEmptyMarketValidationSnapshot() {
  return {
    plan: buildMarketValidationPlan(),
    corpus: validateBenchmarkCorpus([]),
    acceptance: summarizeAcceptanceReviews([]),
  };
}
