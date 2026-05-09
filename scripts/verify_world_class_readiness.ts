import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  evaluateWorldClassReadiness,
  renderWorldClassReadinessMarkdown,
} from "../server/_core/world-class-readiness";

const root = process.cwd();
const reportDir = path.join(root, "artifacts", "quality");
const jsonPath = path.join(reportDir, "world-class-readiness.json");
const mdPath = path.join(reportDir, "world-class-readiness.md");
const evaluation = evaluateWorldClassReadiness(root);

mkdirSync(reportDir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify(evaluation, null, 2));
writeFileSync(mdPath, renderWorldClassReadinessMarkdown(evaluation));

console.log("World-class readiness verification");
console.log(`Controls: ${evaluation.total}`);
console.log(`Directly proved: ${evaluation.directlyProved}`);
console.log(`Operationalized: ${evaluation.operationalized}`);
console.log(`Externally blocked/tracked: ${evaluation.externallyBlocked}`);
console.log(`Artifacts: ${jsonPath} | ${mdPath}`);

const missing = evaluation.controls.filter((control) => !control.evidencePresent);
if (!evaluation.pass || missing.length > 0) {
  console.error("World-class readiness verification failed:");
  for (const control of missing) {
    console.error(`- ${control.id}: missing ${control.missingEvidence.join(", ")}`);
  }
  process.exit(1);
}

console.log("World-class readiness verification passed.");
