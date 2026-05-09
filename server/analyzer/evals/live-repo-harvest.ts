import {
  EXTERNAL_REPO_BENCHMARK_CASES,
  type ExternalRepoBenchmarkResult,
} from "./external-repo-benchmarks";
import { BENCHMARK_CASES } from "./benchmark-cases";

export interface LiveRepoHarvestRecord {
  name: string;
  repoUrl: string;
  status: "confirmed_hit" | "candidate_miss" | "watch";
  tier: ExternalRepoBenchmarkResult["tier"];
  evidenceLevel: ExternalRepoBenchmarkResult["evidenceLevel"];
  goldReadinessScore: number;
  priorityScore: number;
  priorityReason: string;
  suggestedFixtureName: string;
  promotionStatus: "promoted" | "uncovered";
  promotedByBenchmarks: string[];
  observedProofTypes: string[];
  requiredProofTypes: string[];
  forbiddenProofTypes: string[];
  missingRequiredProofTypes: string[];
  unexpectedForbiddenProofTypes: string[];
  failures: string[];
  recommendation: string;
}

export interface LiveRepoHarvestSummary {
  total: number;
  confirmedHits: number;
  candidateMisses: number;
  watchList: number;
}

export interface LiveRepoFixtureBacklogItem {
  rank: number;
  name: string;
  repoUrl: string;
  status: LiveRepoHarvestRecord["status"];
  priorityScore: number;
  priorityReason: string;
  suggestedFixtureName: string;
  promotionStatus: LiveRepoHarvestRecord["promotionStatus"];
  promotedByBenchmarks: string[];
  nextAction: string;
  tier: ExternalRepoBenchmarkResult["tier"];
  evidenceLevel: ExternalRepoBenchmarkResult["evidenceLevel"];
  goldReadinessScore: number;
  observedProofTypes: string[];
}

export interface LiveRepoFixtureBacklog {
  totalCandidates: number;
  topCandidates: LiveRepoFixtureBacklogItem[];
}

export interface LiveRepoHarvest {
  summary: LiveRepoHarvestSummary;
  records: LiveRepoHarvestRecord[];
}

function buildSuggestedFixtureName(name: string): string {
  return `live-${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}-fixture`;
}

function getTierWeight(tier: ExternalRepoBenchmarkResult["tier"]): number {
  switch (tier) {
    case "gold":
      return 24;
    case "supported":
      return 14;
    default:
      return 6;
  }
}

function getEvidenceWeight(evidenceLevel: ExternalRepoBenchmarkResult["evidenceLevel"]): number {
  switch (evidenceLevel) {
    case "detected":
      return 16;
    case "inferred":
      return 10;
    default:
      return 4;
  }
}

function getStatusWeight(status: LiveRepoHarvestRecord["status"]): number {
  switch (status) {
    case "candidate_miss":
      return 100;
    case "confirmed_hit":
      return 74;
    default:
      return 42;
  }
}

function buildPriorityReason(params: {
  status: LiveRepoHarvestRecord["status"];
  goldReadinessScore: number;
  observedProofTypes: string[];
  missingRequiredProofTypes: string[];
  unexpectedForbiddenProofTypes: string[];
  failures: string[];
}): string {
  if (params.status === "candidate_miss") {
    const gapCount = params.missingRequiredProofTypes.length + params.unexpectedForbiddenProofTypes.length + params.failures.length;
    return `real live miss with ${gapCount} contract gap${gapCount === 1 ? "" : "s"} to minimize into regression coverage`;
  }

  if (params.status === "confirmed_hit") {
    return `confirmed live strength with ${params.observedProofTypes.length} observed proof signal${params.observedProofTypes.length === 1 ? "" : "s"} worth freezing into fixtures`;
  }

  if (params.observedProofTypes.length > 0) {
    return `watch candidate already emits ${params.observedProofTypes.length} live proof signal${params.observedProofTypes.length === 1 ? "" : "s"} and is close to fixture-worthy`;
  }

  if (params.goldReadinessScore >= 60) {
    return "watch candidate has high gold-readiness and should be turned into a stronger outside-world regression anchor";
  }

  return "watch candidate broadens stack coverage even without strong live proof signals yet";
}

function buildNextAction(status: LiveRepoHarvestRecord["status"], promotionStatus: LiveRepoHarvestRecord["promotionStatus"]): string {
  if (promotionStatus === "promoted") {
    return "This live pattern is already covered by a benchmark; keep watching for drift and expand only if the signal changes.";
  }

  switch (status) {
    case "candidate_miss":
      return "Minimize the live miss into a failing regression fixture first, then harden the analyzer until it passes.";
    case "confirmed_hit":
      return "Promote the observed live proof pattern into a preserved bug-zoo or benchmark fixture.";
    default:
      return "Keep this repo in the live suite and consider a focused minimized fixture if the same watch pattern repeats.";
  }
}

function getPromotedByBenchmarks(name: string): string[] {
  return BENCHMARK_CASES
    .filter((entry) => entry.promotedFromLiveRepo === name)
    .map((entry) => entry.name);
}

function getBacklogSortScore(record: LiveRepoHarvestRecord): number {
  const uncoveredBonus = record.promotionStatus === "uncovered" ? 28 : 0;
  return record.priorityScore + uncoveredBonus;
}

export function buildLiveRepoHarvest(results: ExternalRepoBenchmarkResult[]): LiveRepoHarvest {
  const records: LiveRepoHarvestRecord[] = results.map((result) => {
    const contract = EXTERNAL_REPO_BENCHMARK_CASES.find((entry) => entry.name === result.name);
    const requiredProofTypes = contract?.liveOverrides?.requiredProofTypes
      ?? contract?.requiredProofTypes
      ?? [];
    const forbiddenProofTypes = contract?.liveOverrides?.forbiddenProofTypes
      ?? contract?.forbiddenProofTypes
      ?? [];
    const missingRequiredProofTypes = requiredProofTypes.filter((proofType) => !result.proofTypes.includes(proofType));
    const unexpectedForbiddenProofTypes = forbiddenProofTypes.filter((proofType) => result.proofTypes.includes(proofType));

    let status: LiveRepoHarvestRecord["status"] = "watch";
    let recommendation = "Keep this repo in the live suite and watch for future proof-signal changes.";

    if (result.failures.length > 0 || missingRequiredProofTypes.length > 0 || unexpectedForbiddenProofTypes.length > 0) {
      status = "candidate_miss";
      recommendation = "Turn the miss into a minimized regression fixture or tighten the repo contract if the expectation was too optimistic.";
    } else if (result.proofTypes.length > 0) {
      status = "confirmed_hit";
      recommendation = "Promote the strongest observed live proof patterns into bug-zoo or benchmark fixtures to preserve this strength.";
    }

    const priorityScore = getStatusWeight(status)
      + Math.round(result.goldReadinessScore * 0.35)
      + (result.proofTypes.length * 9)
      + getTierWeight(result.tier)
      + getEvidenceWeight(result.evidenceLevel);
    const priorityReason = buildPriorityReason({
      status,
      goldReadinessScore: result.goldReadinessScore,
      observedProofTypes: result.proofTypes,
      missingRequiredProofTypes,
      unexpectedForbiddenProofTypes,
      failures: result.failures,
    });
    const promotedByBenchmarks = getPromotedByBenchmarks(result.name);

    return {
      name: result.name,
      repoUrl: result.repoUrl,
      status,
      tier: result.tier,
      evidenceLevel: result.evidenceLevel,
      goldReadinessScore: result.goldReadinessScore,
      priorityScore,
      priorityReason,
      suggestedFixtureName: buildSuggestedFixtureName(result.name),
      promotionStatus: (promotedByBenchmarks.length > 0 ? "promoted" : "uncovered") as "promoted" | "uncovered",
      promotedByBenchmarks,
      observedProofTypes: result.proofTypes,
      requiredProofTypes,
      forbiddenProofTypes,
      missingRequiredProofTypes,
      unexpectedForbiddenProofTypes,
      failures: result.failures,
      recommendation,
    };
  });

  return {
    summary: {
      total: records.length,
      confirmedHits: records.filter((record) => record.status === "confirmed_hit").length,
      candidateMisses: records.filter((record) => record.status === "candidate_miss").length,
      watchList: records.filter((record) => record.status === "watch").length,
    },
    records,
  };
}

export function buildLiveRepoFixtureBacklog(harvest: LiveRepoHarvest, limit = 5): LiveRepoFixtureBacklog {
  const topCandidates = [...harvest.records]
    .sort((left, right) => {
      const leftSortScore = getBacklogSortScore(left);
      const rightSortScore = getBacklogSortScore(right);
      if (rightSortScore !== leftSortScore) {
        return rightSortScore - leftSortScore;
      }
      if (right.goldReadinessScore !== left.goldReadinessScore) {
        return right.goldReadinessScore - left.goldReadinessScore;
      }
      return right.observedProofTypes.length - left.observedProofTypes.length;
    })
    .slice(0, limit)
    .map((record, index) => ({
      rank: index + 1,
      name: record.name,
      repoUrl: record.repoUrl,
      status: record.status,
      priorityScore: record.priorityScore,
      priorityReason: record.priorityReason,
      suggestedFixtureName: record.suggestedFixtureName,
      promotionStatus: record.promotionStatus,
      promotedByBenchmarks: record.promotedByBenchmarks,
      nextAction: buildNextAction(record.status, record.promotionStatus),
      tier: record.tier,
      evidenceLevel: record.evidenceLevel,
      goldReadinessScore: record.goldReadinessScore,
      observedProofTypes: record.observedProofTypes,
    }));

  return {
    totalCandidates: harvest.records.length,
    topCandidates,
  };
}

export function renderLiveRepoHarvestMarkdown(harvest: LiveRepoHarvest, generatedAt: string): string {
  const lines: string[] = [
    "# TestForge Live Repo Harvest",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## Summary",
    `- Total repos: ${harvest.summary.total}`,
    `- Confirmed hits: ${harvest.summary.confirmedHits}`,
    `- Candidate misses: ${harvest.summary.candidateMisses}`,
    `- Watch list: ${harvest.summary.watchList}`,
    "",
    "## Candidate Misses",
  ];

  const misses = harvest.records.filter((record) => record.status === "candidate_miss");
  if (misses.length === 0) {
    lines.push("- None");
  } else {
    for (const record of misses) {
      lines.push(`- ${record.name} | tier=${record.tier} | evidence=${record.evidenceLevel} | readiness=${record.goldReadinessScore}`);
      if (record.missingRequiredProofTypes.length > 0) {
        lines.push(`  Missing required proofs: ${record.missingRequiredProofTypes.join(", ")}`);
      }
      if (record.unexpectedForbiddenProofTypes.length > 0) {
        lines.push(`  Unexpected forbidden proofs: ${record.unexpectedForbiddenProofTypes.join(", ")}`);
      }
      if (record.failures.length > 0) {
        lines.push(`  Failures: ${record.failures.join(" | ")}`);
      }
      lines.push(`  Recommendation: ${record.recommendation}`);
      if (record.promotedByBenchmarks.length > 0) {
        lines.push(`  Promoted by: ${record.promotedByBenchmarks.join(", ")}`);
      }
    }
  }

  lines.push("", "## Confirmed Hits");
  const hits = harvest.records.filter((record) => record.status === "confirmed_hit");
  if (hits.length === 0) {
    lines.push("- None");
  } else {
    for (const record of hits) {
      lines.push(`- ${record.name} | proofs=${record.observedProofTypes.join(", ") || "-"} | readiness=${record.goldReadinessScore}`);
      lines.push(`  Recommendation: ${record.recommendation}`);
      if (record.promotedByBenchmarks.length > 0) {
        lines.push(`  Promoted by: ${record.promotedByBenchmarks.join(", ")}`);
      }
    }
  }

  lines.push("", "## Watch List");
  const watch = harvest.records.filter((record) => record.status === "watch");
  if (watch.length === 0) {
    lines.push("- None");
  } else {
    for (const record of watch) {
      lines.push(`- ${record.name} | tier=${record.tier} | evidence=${record.evidenceLevel} | readiness=${record.goldReadinessScore}`);
      lines.push(`  Recommendation: ${record.recommendation}`);
      if (record.promotedByBenchmarks.length > 0) {
        lines.push(`  Promoted by: ${record.promotedByBenchmarks.join(", ")}`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderLiveRepoFixtureBacklogMarkdown(backlog: LiveRepoFixtureBacklog, generatedAt: string): string {
  const lines: string[] = [
    "# TestForge Live Repo Fixture Backlog",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Total candidates: ${backlog.totalCandidates}`,
    "",
    "## Top Candidates",
  ];

  if (backlog.topCandidates.length === 0) {
    lines.push("- None");
  } else {
    for (const item of backlog.topCandidates) {
      lines.push(`- #${item.rank} ${item.name} | status=${item.status} | promotion=${item.promotionStatus} | score=${item.priorityScore} | readiness=${item.goldReadinessScore}`);
      lines.push(`  Suggested fixture: ${item.suggestedFixtureName}`);
      lines.push(`  Observed proofs: ${item.observedProofTypes.join(", ") || "-"}`);
      lines.push(`  Priority reason: ${item.priorityReason}`);
      if (item.promotedByBenchmarks.length > 0) {
        lines.push(`  Covered by benchmarks: ${item.promotedByBenchmarks.join(", ")}`);
      }
      lines.push(`  Next action: ${item.nextAction}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
