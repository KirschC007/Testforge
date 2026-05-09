import { describe, expect, it } from "vitest";
import {
  assertWithinUsageLimit,
  buildArtifactManifest,
  buildAuditEvent,
  buildMarketEvidenceDeck,
  buildProductReadinessScorecard,
  buildQueueSnapshot,
  buildSandboxPolicy,
  buildWebhookPayload,
  getDailyAnalysisLimit,
} from "./product-readiness";

describe("product readiness", () => {
  it("enforces free-first usage before paid tiers", () => {
    expect(getDailyAnalysisLimit("free")).toBe(1);
    expect(getDailyAnalysisLimit("pro")).toBe(50);
    expect(getDailyAnalysisLimit("team")).toBe(200);
    expect(getDailyAnalysisLimit("enterprise")).toBe(Infinity);
    expect(getDailyAnalysisLimit("free", "admin")).toBe(Infinity);
    expect(() => assertWithinUsageLimit({ plan: "free", todayCount: 1 })).toThrow(/Daily limit reached/);
  });

  it("builds queue and sandbox contracts for safe scaling", () => {
    expect(buildQueueSnapshot({ runningJobs: 2, plan: "team" })).toMatchObject({
      mode: "in_process_worker",
      priority: 70,
    });
    expect(buildSandboxPolicy()).toMatchObject({
      network: "public-http-only-with-ssrf-guard",
      maxTimeoutMs: 30000,
    });
  });

  it("creates artifact, audit, and webhook metadata", () => {
    expect(buildArtifactManifest({ analysisId: 7, reportKey: "r.md", zipKey: "o.zip" }).artifacts).toHaveLength(2);
    expect(buildAuditEvent({ actorUserId: 1, action: "analysis.created", analysisId: 7 })).toMatchObject({ actorUserId: 1, action: "analysis.created" });
    expect(buildWebhookPayload({ event: "analysis.completed", analysisId: 7, userId: 1 }).idempotencyKey).toBe("analysis.completed:7:1");
  });

  it("publishes the ten world-class readiness areas", () => {
    const scorecard = buildProductReadinessScorecard();
    expect(scorecard.score).toBeGreaterThanOrEqual(80);
    expect(scorecard.items.map((item) => item.area)).toEqual([
      "live_benchmarks",
      "observability",
      "billing_usage",
      "queue_workers",
      "artifact_retention",
      "security_audit",
      "golden_dataset",
      "sandbox_execution",
      "enterprise_admin",
      "sales_readiness",
    ]);
  });

  it("builds a market evidence deck with concrete proof cases", () => {
    const deck = buildMarketEvidenceDeck();

    expect(deck.scoreboard.bugZooFixtures).toBe("14/14");
    expect(deck.proofTypes).toContain("idor");
    expect(deck.cases.length).toBeGreaterThanOrEqual(5);
    expect(deck.cases.some((item) => item.risk === "critical")).toBe(true);
  });
});
