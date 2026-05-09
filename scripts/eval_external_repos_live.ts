import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  runExternalRepoBenchmarkSuiteLive,
  summarizeExternalRepoBenchmarks,
} from "../server/analyzer/evals/external-repo-benchmarks";
import {
  buildLiveRepoHarvest,
  buildLiveRepoFixtureBacklog,
  renderLiveRepoHarvestMarkdown,
  renderLiveRepoFixtureBacklogMarkdown,
} from "../server/analyzer/evals/live-repo-harvest";

const asJson = process.argv.includes("--json");
const githubToken = process.env.GITHUB_TOKEN;

async function main() {
  const results = await runExternalRepoBenchmarkSuiteLive({
    sourceKind: "live_github",
    githubToken,
  });
  const summary = summarizeExternalRepoBenchmarks(results);
  const harvest = buildLiveRepoHarvest(results);
  const backlog = buildLiveRepoFixtureBacklog(harvest);
  const generatedAt = new Date().toISOString();
  const reportDir = path.resolve(process.cwd(), "artifacts", "quality");
  const harvestJsonPath = path.join(reportDir, "live-repo-harvest.json");
  const harvestMdPath = path.join(reportDir, "live-repo-harvest.md");
  const backlogJsonPath = path.join(reportDir, "live-repo-fixture-backlog.json");
  const backlogMdPath = path.join(reportDir, "live-repo-fixture-backlog.md");

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(harvestJsonPath, JSON.stringify({ generatedAt, summary, harvest, backlog, results }, null, 2));
  writeFileSync(harvestMdPath, renderLiveRepoHarvestMarkdown(harvest, generatedAt));
  writeFileSync(backlogJsonPath, JSON.stringify({ generatedAt, summary, backlog }, null, 2));
  writeFileSync(backlogMdPath, renderLiveRepoFixtureBacklogMarkdown(backlog, generatedAt));

  if (asJson) {
    console.log(JSON.stringify({ summary, harvest, backlog, results, harvestJsonPath, harvestMdPath, backlogJsonPath, backlogMdPath }, null, 2));
    if (summary.failed > 0) {
      process.exitCode = 1;
    }
    return;
  }

  console.log("TestForge External Repo Benchmarks (Live GitHub)");
  console.log("===============================================");
  console.log(`External repos: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
  console.log(`GitHub token: ${githubToken ? "present" : "not set"}`);
  console.log(`Harvest: ${harvestJsonPath} | ${harvestMdPath}`);
  console.log(`Fixture backlog: ${backlogJsonPath} | ${backlogMdPath}`);
  console.log("");
  console.log(`Harvest summary: hits=${harvest.summary.confirmedHits} | misses=${harvest.summary.candidateMisses} | watch=${harvest.summary.watchList}`);
  console.log("");
  console.log("Top fixture backlog:");
  for (const item of backlog.topCandidates.slice(0, 3)) {
    console.log(`  #${item.rank} ${item.name} | ${item.status} | score=${item.priorityScore} | fixture=${item.suggestedFixtureName}`);
  }
  console.log("");

  for (const result of results) {
    console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
    console.log(`  Repo: ${result.owner}/${result.repo}@${result.branch}`);
    console.log(`  Tier: ${result.tier} | Evidence: ${result.evidenceLevel} | Gold readiness: ${result.goldReadinessScore}`);
    console.log(`  Proof planning: ${result.proofPlanningMode}`);
    console.log(`  Notes: ${result.notes}`);
    console.log(`  Proof types: ${result.proofTypes.join(", ") || "-"}`);
    if (result.failures.length > 0) {
      console.log(`  Failures: ${result.failures.join(" | ")}`);
    }
  }

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[TestForge] Live external repo benchmarks failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
