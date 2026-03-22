import type { Ambiguity, AnalysisResult, RiskModel, ValidatedProofSuite } from "./types";

// ─── Report Generator ─────────────────────────────────────────────────────────

export function generateReport(
  analysis: AnalysisResult,
  riskModel: RiskModel,
  suite: ValidatedProofSuite,
  projectName: string,
  llmCheckerStats?: { approved: number; flagged: number; rejected: number; avgConfidence: number }
): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines: string[] = [];

  lines.push(`# TestForge Report v3.0 — ${projectName}`);
  lines.push(`\nGenerated: ${now} | Spec Type: ${analysis.specType} | Quality Score: ${analysis.qualityScore.toFixed(1)}/10.0\n`);

  lines.push("## Verdict\n");
  lines.push(`**${suite.verdict.summary}**\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Verdict Score | ${suite.verdict.score.toFixed(1)}/10.0 |`);
  lines.push(`| Behaviors Extracted | ${analysis.ir.behaviors.length} |`);
  lines.push(`| API Endpoints Discovered | ${analysis.ir.apiEndpoints.length} |`);
  lines.push(`| Coverage | ${suite.coverage.coveragePercent}% (${suite.coverage.coveredBehaviors}/${suite.coverage.totalBehaviors}) |`);
  lines.push(`| Validated Proofs | ${suite.verdict.passed} |`);
  lines.push(`| Discarded Proofs | ${suite.verdict.failed} |`);
  lines.push(`| IDOR Attack Vectors | ${riskModel.idorVectors} |`);
  lines.push(`| CSRF Endpoints | ${riskModel.csrfEndpoints} |\n`);

  if (llmCheckerStats) {
    lines.push("## LLM Checker Results\n");
    lines.push(`| Verdict | Count |`);
    lines.push(`|---|---|`);
    lines.push(`| ✅ Approved | ${llmCheckerStats.approved} |`);
    lines.push(`| ⚠️ Flagged | ${llmCheckerStats.flagged} |`);
    lines.push(`| ❌ Rejected (hallucinated) | ${llmCheckerStats.rejected} |`);
    lines.push(`| Avg Confidence | ${(llmCheckerStats.avgConfidence * 100).toFixed(0)}% |\n`);
  }

  const dist = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const b of riskModel.behaviors) dist[b.riskLevel]++;
  lines.push("## Risk Distribution\n");
  lines.push(`| Level | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| 🔴 Critical | ${dist.critical} |`);
  lines.push(`| 🟠 High | ${dist.high} |`);
  lines.push(`| 🟡 Medium | ${dist.medium} |`);
  lines.push(`| 🟢 Low | ${dist.low} |\n`);

  if (analysis.ir.ambiguities.length > 0) {
    lines.push("## Ambiguity Gate\n");
    for (const a of analysis.ir.ambiguities) {
      lines.push(`### ${a.behaviorId} — ${a.impact === "blocks_test" ? "⛔ BLOCKS TEST" : "⚠ Reduces Confidence"}`);
      lines.push(`**Problem:** ${a.problem}`);
      lines.push(`**Question:** ${a.question}\n`);
    }
  }

  lines.push("## Validated Proofs\n");
  for (const p of suite.proofs) {
    lines.push(`### ${p.id} — ${p.proofType.toUpperCase()}`);
    lines.push(`- **File:** \`${p.filename}\``);
    lines.push(`- **Risk:** ${p.riskLevel}`);
    lines.push(`- **Mutation Score:** ${(p.mutationScore * 100).toFixed(0)}%`);
    lines.push(`- **Validation:** ${p.validationNotes.join(", ")}\n`);
  }

  if (suite.discardedProofs.length > 0) {
    lines.push("## Discarded Proofs (False-Green Detection)\n");
    for (const dp of suite.discardedProofs) {
      lines.push(`### ${dp.rawProof.id} — DISCARDED`);
      lines.push(`- **Reason:** \`${dp.reason}\``);
      lines.push(`- **Details:** ${dp.details}\n`);
    }
  }

  if (suite.coverage.uncoveredIds.length > 0) {
    lines.push("## Uncovered Behaviors\n");
    for (const id of suite.coverage.uncoveredIds) {
      const b = analysis.ir.behaviors.find(bh => bh.id === id);
      lines.push(`- **${id}**: ${b?.title || "Unknown"}`);
    }
  }

  lines.push("\n## Getting Started\n");
  lines.push("```bash");
  lines.push("npm install");
  lines.push("npx playwright install --with-deps chromium");
  lines.push("BASE_URL=https://your-staging-url.com npx playwright test --list");
  lines.push("BASE_URL=https://your-staging-url.com npx playwright test");
  lines.push("```");
  lines.push("\nRed test = Bug found. Green test = Spec correctly implemented. Both are success.\n");

  return lines.join("\n");
}

