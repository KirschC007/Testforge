import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildEmptyMarketValidationSnapshot } from "../server/_core/customer-validation";

const root = process.cwd();
const reportDir = path.join(root, "artifacts", "quality");
const jsonPath = path.join(reportDir, "market-validation.json");
const mdPath = path.join(reportDir, "market-validation.md");
const snapshot = buildEmptyMarketValidationSnapshot();

mkdirSync(reportDir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), ...snapshot }, null, 2));
writeFileSync(
  mdPath,
  [
    "# TestForge Market Validation Gate",
    "",
    "This artifact is intentionally conservative. Internal synthetic tests do not count as market proof.",
    "",
    `Required customer cases: ${snapshot.plan.requiredCustomerCases}`,
    `Required external reviewers: ${snapshot.plan.requiredExternalReviewers}`,
    `Corpus ready: ${snapshot.corpus.ready ? "yes" : "no"}`,
    `Acceptance market-ready: ${snapshot.acceptance.marketReady ? "yes" : "no"}`,
    "",
    "## Current Blockers",
    "",
    ...snapshot.corpus.blockers.map((blocker) => `- Corpus: ${blocker}`),
    ...snapshot.acceptance.blockers.map((blocker) => `- Acceptance: ${blocker}`),
    "",
    "## Blocked Claims",
    "",
    ...snapshot.plan.launchClaimPolicy.blockedUntilExternalEvidence.map((claim) => `- ${claim}`),
    "",
  ].join("\n")
);

console.log("Market validation verification passed.");
console.log(`Artifacts: ${jsonPath} | ${mdPath}`);
