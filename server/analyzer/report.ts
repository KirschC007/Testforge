import type { Ambiguity, AnalysisResult, RiskModel, ValidatedProofSuite, ValidatedProof, SpecHealth } from "./types";
import type { StaticFinding } from "./static-analyzer";

// ─── Report Generator ─────────────────────────────────────────────────────────

export function generateReport(
  analysis: AnalysisResult,
  riskModel: RiskModel,
  suite: ValidatedProofSuite,
  projectName: string,
  llmCheckerStats?: { approved: number; flagged: number; rejected: number; avgConfidence: number },
  staticFindings?: StaticFinding[]
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

  // Proof-Type Coverage Summary
  const proofTypeCounts = new Map<string, number>();
  for (const p of suite.proofs) proofTypeCounts.set(p.proofType, (proofTypeCounts.get(p.proofType) || 0) + 1);
  lines.push("## Proof Type Coverage\n");
  lines.push(`| Type | Count | Avg Mutation Score |`);
  lines.push(`|---|---|---|`);
  const typeEntries = Array.from(proofTypeCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of typeEntries) {
    const typeProofs = suite.proofs.filter(p => p.proofType === type);
    const avgMut = typeProofs.reduce((s, p) => s + p.mutationScore, 0) / typeProofs.length;
    const mutBar = avgMut >= 0.9 ? "🟢" : avgMut >= 0.6 ? "🟡" : "🔴";
    lines.push(`| \`${type}\` | ${count} | ${mutBar} ${(avgMut * 100).toFixed(0)}% |`);
  }
  lines.push("");

  // Flakiness Risk Section
  const flakyProofs = suite.proofs.filter(p => {
    const code = p.code || "";
    return (p.proofType === "webhook" || p.proofType === "cron_job") ||
      /expect\([^)]*Date\.now\(\)/.test(code);
  });
  if (flakyProofs.length > 0) {
    lines.push("## Flakiness Risk\n");
    lines.push(`> ${flakyProofs.length} proof(s) have elevated flakiness risk and use retries or poll() guards.\n`);
    lines.push(`| Proof | Type | Risk Reason |`);
    lines.push(`|---|---|---|`);
    for (const p of flakyProofs) {
      const reason = (p.proofType === "webhook" || p.proofType === "cron_job")
        ? "Async delivery — uses pollUntil()" : "Timing-sensitive assertion";
      lines.push(`| \`${p.id}\` | \`${p.proofType}\` | ${reason} |`);
    }
    lines.push("");
  }

  lines.push("## Validated Proofs\n");
  for (const p of suite.proofs) {
    const flakyFlag = flakyProofs.includes(p) ? " ⚡ flaky-guarded" : "";
    lines.push(`### ${p.id} — ${p.proofType.toUpperCase()}`);
    lines.push(`- **File:** \`${p.filename}\``);
    lines.push(`- **Risk:** ${p.riskLevel}`);
    lines.push(`- **Mutation Score:** ${(p.mutationScore * 100).toFixed(0)}%${flakyFlag}`);
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

  // Static Analysis Findings (Layer 0)
  if (staticFindings && staticFindings.length > 0) {
    lines.push("\n## Static Analysis Findings (Layer 0)\n");
    lines.push(`> ${staticFindings.length} deterministic findings — no LLM, no hallucinations.\n`);
    const bySeverity: Record<string, StaticFinding[]> = { HIGH: [], MEDIUM: [], LOW: [] };
    for (const f of staticFindings) (bySeverity[f.severity] ??= []).push(f);
    for (const sev of ["HIGH", "MEDIUM", "LOW"] as const) {
      if (!bySeverity[sev]?.length) continue;
      const icon = sev === "HIGH" ? "🔴" : sev === "MEDIUM" ? "🟡" : "🟢";
      lines.push(`### ${icon} ${sev} (${bySeverity[sev].length})\n`);
      lines.push(`| Rule | File | Line | Message |`);
      lines.push(`|---|---|---|---|`);
      for (const f of bySeverity[sev]) {
        const shortFile = f.file.split("/").slice(-2).join("/");
        lines.push(`| \`${f.rule}\` | \`${shortFile}\` | ${f.line} | ${f.message} |`);
      }
      lines.push("");
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


export function generateHTMLReport(
  analysis: AnalysisResult,
  riskModel: RiskModel,
  suite: ValidatedProofSuite,
  projectName: string,
  llmCheckerStats?: { approved: number; flagged: number; rejected: number; avgConfidence: number },
  specHealth?: SpecHealth,
  staticFindings?: StaticFinding[]
): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const dist = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const b of riskModel.behaviors) dist[b.riskLevel as keyof typeof dist]++;

  const proofsByType = new Map<string, ValidatedProof[]>();
  for (const p of suite.proofs) {
    if (!proofsByType.has(p.proofType)) proofsByType.set(p.proofType, []);
    proofsByType.get(p.proofType)!.push(p);
  }

  const proofTypeLabels: Record<string, string> = {
    idor: "IDOR / Tenant Isolation", csrf: "CSRF Protection", auth_matrix: "Auth Matrix",
    status_transition: "Status Transitions", boundary: "Input Validation", dsgvo: "DSGVO / GDPR",
    business_logic: "Business Logic", concurrency: "Concurrency", idempotency: "Idempotency",
    rate_limit: "Rate Limiting", webhook: "Webhook Security", feature_gate: "Feature Gates",
    cron_job: "Cron Jobs", risk_scoring: "Risk Scoring", flow: "User Flows",
    e2e_flow: "E2E Flows", spec_drift: "Spec Drift",
    // World-class additions
    db_transaction: "DB Transactions / Atomicity",
    audit_log: "Audit Log Validation",
    graphql: "GraphQL Security",
    accessibility: "Accessibility (WCAG 2.1 AA)",
    sql_injection: "SQL Injection", hardcoded_secret: "Hardcoded Secrets",
    negative_amount: "Negative Amount / Financial", aml_bypass: "AML Bypass",
    cross_tenant_chain: "Cross-Tenant Chain", concurrent_write: "Concurrent Write",
    mass_assignment: "Mass Assignment",
  };

  const proofTypeIcons: Record<string, string> = {
    idor: "🔓", csrf: "🛡️", auth_matrix: "👥", status_transition: "🔄",
    boundary: "📏", dsgvo: "🇪🇺", business_logic: "⚙️", concurrency: "⚡",
    idempotency: "🔁", rate_limit: "🚦", webhook: "🪝", feature_gate: "🚪",
    cron_job: "⏰", risk_scoring: "📊", flow: "🔀", e2e_flow: "🖥️", spec_drift: "📐",
    db_transaction: "🗄️", audit_log: "📋", graphql: "◈", accessibility: "♿",
    sql_injection: "💉", hardcoded_secret: "🔑", negative_amount: "💸",
    aml_bypass: "🏦", cross_tenant_chain: "⛓️", concurrent_write: "✍️",
    mass_assignment: "📦",
  };

  const scoreColor = suite.verdict.score >= 7 ? "#22c55e" : suite.verdict.score >= 4 ? "#f59e0b" : "#ef4444";
  const healthScore = specHealth?.score ?? 0;
  const healthGrade = specHealth?.grade ?? "?";
  const healthColor = healthScore >= 80 ? "#22c55e" : healthScore >= 60 ? "#f59e0b" : "#ef4444";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TestForge Report — ${projectName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  header { text-align: center; padding: 40px 0 32px; border-bottom: 1px solid #1e293b; margin-bottom: 32px; }
  header h1 { font-size: 28px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
  header .subtitle { color: #94a3b8; font-size: 14px; }
  .hero { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .score-card { background: #1e293b; border-radius: 12px; padding: 28px; text-align: center; border: 1px solid #334155; }
  .score-card .number { font-size: 48px; font-weight: 800; }
  .score-card .label { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .score-card .detail { font-size: 12px; color: #64748b; margin-top: 8px; }
  .risk-bar { display: flex; gap: 4px; margin-top: 12px; height: 8px; border-radius: 4px; overflow: hidden; }
  .risk-bar .seg { height: 100%; }
  .risk-bar .seg.critical { background: #ef4444; }
  .risk-bar .seg.high { background: #f97316; }
  .risk-bar .seg.medium { background: #eab308; }
  .risk-bar .seg.low { background: #22c55e; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat { background: #1e293b; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #334155; }
  .stat .val { font-size: 24px; font-weight: 700; color: #f8fafc; }
  .stat .lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  section { margin-bottom: 32px; }
  section h2 { font-size: 18px; font-weight: 600; color: #f8fafc; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #1e293b; }
  .alert { background: #1e293b; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 12px; }
  .alert .title { font-weight: 600; color: #fbbf24; font-size: 14px; }
  .alert .body { color: #94a3b8; font-size: 13px; margin-top: 4px; }
  .proof-group { background: #1e293b; border-radius: 8px; margin-bottom: 8px; border: 1px solid #334155; overflow: hidden; }
  .proof-group summary { padding: 14px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 500; }
  .proof-group summary:hover { background: #334155; }
  .proof-group .badge { background: #334155; color: #94a3b8; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .proof-group .content { padding: 0 16px 16px; }
  .proof-item { padding: 8px 0; border-bottom: 1px solid #0f172a; font-size: 13px; display: flex; justify-content: space-between; }
  .proof-item:last-child { border: none; }
  .proof-item .id { color: #94a3b8; font-family: monospace; font-size: 12px; }
  .proof-item .risk { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .proof-item .risk.critical { background: #7f1d1d; color: #fca5a5; }
  .proof-item .risk.high { background: #7c2d12; color: #fdba74; }
  .proof-item .risk.medium { background: #713f12; color: #fde047; }
  .proof-item .risk.low { background: #14532d; color: #86efac; }
  .cmd { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; color: #22d3ee; position: relative; white-space: pre-wrap; margin-top: 8px; }
  .cmd .copy { position: absolute; top: 8px; right: 8px; background: #334155; border: none; color: #94a3b8; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; }
  .cmd .copy:hover { background: #475569; color: #f8fafc; }
  .health-dim { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #0f172a; font-size: 13px; }
  .health-dim:last-child { border: none; }
  .health-dim .pass { color: #22c55e; }
  .health-dim .fail { color: #ef4444; }
  .footer { text-align: center; padding: 32px 0; color: #475569; font-size: 12px; border-top: 1px solid #1e293b; margin-top: 40px; }
</style>
</head>
<body>
<div class="container">

<header>
  <h1>🔒 TestForge Security Report</h1>
  <div class="subtitle">${projectName} — Generated ${now}</div>
</header>

<div class="hero">
  <div class="score-card">
    <div class="number" style="color: ${scoreColor}">${suite.verdict.score.toFixed(1)}</div>
    <div class="label">Security Score / 10</div>
    <div class="detail">${suite.verdict.passed} proofs validated</div>
  </div>
  <div class="score-card">
    <div class="number" style="color: ${healthColor}">${healthScore}</div>
    <div class="label">Spec Health (${healthGrade})</div>
    <div class="detail">${specHealth?.summary || "Spec quality assessment"}</div>
  </div>
  <div class="score-card">
    <div class="number" style="color: #94a3b8">${analysis.ir.apiEndpoints.length}</div>
    <div class="label">Endpoints Analyzed</div>
    <div class="detail">${analysis.ir.behaviors.length} behaviors extracted</div>
    <div class="risk-bar">
      ${dist.critical ? `<div class="seg critical" style="flex:${dist.critical}"></div>` : ""}
      ${dist.high ? `<div class="seg high" style="flex:${dist.high}"></div>` : ""}
      ${dist.medium ? `<div class="seg medium" style="flex:${dist.medium}"></div>` : ""}
      ${dist.low ? `<div class="seg low" style="flex:${dist.low}"></div>` : ""}
    </div>
  </div>
</div>

<div class="stats">
  <div class="stat"><div class="val">${riskModel.idorVectors}</div><div class="lbl">IDOR Vectors</div></div>
  <div class="stat"><div class="val">${riskModel.csrfEndpoints}</div><div class="lbl">CSRF Endpoints</div></div>
  <div class="stat"><div class="val">${suite.coverage.coveragePercent}%</div><div class="lbl">Coverage</div></div>
  <div class="stat"><div class="val">${suite.discardedProofs.length}</div><div class="lbl">False-Green Caught</div></div>
</div>

${llmCheckerStats ? `<div class="stats">
  <div class="stat"><div class="val">${llmCheckerStats.approved}</div><div class="lbl">LLM Approved</div></div>
  <div class="stat"><div class="val">${llmCheckerStats.flagged}</div><div class="lbl">Flagged</div></div>
  <div class="stat"><div class="val">${llmCheckerStats.rejected}</div><div class="lbl">Hallucinated</div></div>
  <div class="stat"><div class="val">${(llmCheckerStats.avgConfidence * 100).toFixed(0)}%</div><div class="lbl">Avg Confidence</div></div>
</div>` : ""}

${analysis.ir.ambiguities.length > 0 ? `<section>
  <h2>⚠️ Spec Ambiguities Found</h2>
  ${analysis.ir.ambiguities.slice(0, 10).map((a: Ambiguity) => `<div class="alert">
    <div class="title">${a.behaviorId || "Spec"} — ${a.impact === "blocks_test" ? "⛔ Blocks Test" : "⚠ Reduces Confidence"}</div>
    <div class="body"><strong>Problem:</strong> ${escapeHtml(a.problem)}</div>
    <div class="body"><strong>Question:</strong> ${escapeHtml(a.question)}</div>
  </div>`).join("\n")}
</section>` : ""}

${specHealth ? `<section>
  <h2>📋 Spec Health</h2>
  <div class="proof-group" style="border: none;">
    ${specHealth.dimensions.map(d => `<div class="health-dim">
      <span>${d.passed ? "✅" : "❌"} ${d.label}</span>
      <span class="${d.passed ? "pass" : "fail"}">${d.score}/${d.maxScore}${!d.passed ? ` — ${escapeHtml(d.tip)}` : ""}</span>
    </div>`).join("\n")}
  </div>
</section>` : ""}

<section>
  <h2>🧪 Security Proofs by Category</h2>
  ${Array.from(proofsByType.entries()).sort((a, b) => b[1].length - a[1].length).map(([type, proofs]) => `<details class="proof-group">
    <summary>
      <span>${proofTypeIcons[type] || "🔍"} ${proofTypeLabels[type] || type}</span>
      <span class="badge">${proofs.length}</span>
    </summary>
    <div class="content">
      ${proofs.slice(0, 20).map(p => `<div class="proof-item">
        <span class="id">${p.id}</span>
        <span class="risk ${p.riskLevel}">${p.riskLevel}</span>
      </div>`).join("\n")}
      ${proofs.length > 20 ? `<div class="proof-item"><span class="id">... and ${proofs.length - 20} more</span><span></span></div>` : ""}
    </div>
  </details>`).join("\n")}
</section>

<section>
  <h2>🚀 Get Started</h2>
  <div class="cmd" id="cmd">npm install
npx playwright install --with-deps chromium
cp .env.example .env  # configure BASE_URL and credentials
npx playwright test --list  # see all tests
npx playwright test  # run all tests<button class="copy" onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent.replace('Copy',''))">Copy</button></div>
  <p style="margin-top: 12px; color: #94a3b8; font-size: 13px;">
    🔴 Red test = Bug found. 🟢 Green test = Spec correctly implemented. Both are success.
  </p>
</section>

${staticFindings && staticFindings.length > 0 ? `<section>
  <h2>🔬 Static Analysis (Layer 0) — ${staticFindings.length} Findings</h2>
  <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">Deterministic code scan — no LLM, no hallucinations. Runs before any AI analysis.</p>
  ${["HIGH","MEDIUM","LOW"].map(sev => {
    const items = staticFindings.filter(f => f.severity === sev);
    if (!items.length) return "";
    const color = sev === "HIGH" ? "#ef4444" : sev === "MEDIUM" ? "#eab308" : "#22c55e";
    const icon = sev === "HIGH" ? "🔴" : sev === "MEDIUM" ? "🟡" : "🟢";
    return `<details class="proof-group" open>
      <summary style="border-left:3px solid ${color}">
        <span>${icon} ${sev} Severity</span>
        <span class="badge">${items.length}</span>
      </summary>
      <div class="content">
        ${items.map(f => `<div class="proof-item">
          <span class="id" title="${escapeHtml(f.snippet)}">${escapeHtml(f.rule)} — ${escapeHtml(f.message)}</span>
          <span class="risk ${sev.toLowerCase()}">${escapeHtml(f.file.split("/").slice(-1)[0])}:${f.line}</span>
        </div>`).join("\n")}
      </div>
    </details>`;
  }).join("\n")}
</section>` : ""}

<footer class="footer">
  Generated by TestForge v11.0 — Spec-to-Security-Tests in under 5 minutes
</footer>

</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
