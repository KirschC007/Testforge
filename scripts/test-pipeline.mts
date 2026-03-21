/**
 * Goldstandard Test Script
 * Runs the full TestForge pipeline on the TaskFlow spec and saves output for analysis.
 * Usage: npx tsx scripts/test-pipeline.mts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { runAnalysisJob } from "../server/analyzer.js";

const specText = readFileSync("/home/ubuntu/taskmanager-spec.md", "utf-8");

console.log("=== TestForge Goldstandard Test ===");
console.log("Spec length:", specText.length, "chars");
console.log("Running pipeline...\n");

const startTime = Date.now();

const result = await runAnalysisJob(specText, "TaskFlow", async (layer, message, data) => {
  console.log(`[Layer ${layer}] ${message}`);
  if (data?.analysisResult) {
    const ir = data.analysisResult.ir;
    console.log(`  → Behaviors: ${ir.behaviors.length}`);
    console.log(`  → Endpoints: ${ir.apiEndpoints.length}`);
    console.log(`  → Enums: ${JSON.stringify(ir.enums || {})}`);
    console.log(`  → StatusMachine: ${JSON.stringify(ir.statusMachine || {})}`);
  }
  if (data?.riskModel) {
    const rm = data.riskModel;
    console.log(`  → ProofTargets: ${rm.proofTargets?.length || 0}`);
    rm.proofTargets?.forEach((pt: any) => {
      console.log(`    - ${pt.id} [${pt.proofType}] ${pt.endpoint || 'NO_ENDPOINT'} risk=${pt.riskLevel}`);
      if (pt.constraints?.length) {
        console.log(`      constraints: ${JSON.stringify(pt.constraints)}`);
      }
    });
  }
});

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n=== Pipeline completed in ${elapsed}s ===`);
console.log(`Behaviors: ${result.analysisResult.ir.behaviors.length}`);
console.log(`Endpoints found: ${result.analysisResult.ir.apiEndpoints.length}`);
console.log(`Enums: ${JSON.stringify(result.analysisResult.ir.enums || {})}`);
console.log(`StatusMachine: ${JSON.stringify(result.analysisResult.ir.statusMachine || {})}`);
console.log(`ProofTargets: ${result.riskModel.proofTargets.length}`);
console.log(`ValidatedProofs: ${result.validatedSuite.verdict.passed}`);
console.log(`DiscardedProofs: ${result.validatedSuite.verdict.failed}`);
console.log(`Score: ${result.validatedSuite.verdict.score.toFixed(1)}/10`);
console.log(`TestFiles: ${result.testFiles.length}`);

// Save all generated test files for analysis
const outDir = "/home/ubuntu/taskflow-goldstandard";
mkdirSync(outDir, { recursive: true });

for (const tf of result.testFiles) {
  const filePath = `${outDir}/${tf.filename.replace(/\//g, "_")}`;
  writeFileSync(filePath, tf.content);
  console.log(`\nSaved: ${tf.filename} (${tf.content.length} chars)`);
}

writeFileSync(`${outDir}/report.md`, result.report);
writeFileSync(`${outDir}/ir.json`, JSON.stringify(result.analysisResult.ir, null, 2));
writeFileSync(`${outDir}/riskmodel.json`, JSON.stringify(result.riskModel, null, 2));
writeFileSync(`${outDir}/validated.json`, JSON.stringify(result.validatedSuite, null, 2));

console.log(`\nAll output saved to ${outDir}`);
console.log("\n=== Goldstandard Check ===");
console.log("Checking for TODO_REPLACE placeholders in generated tests...");

let todoCount = 0;
let restaurantCount = 0;
let partySizeCount = 0;

for (const tf of result.testFiles) {
  const todos = (tf.content.match(/TODO_REPLACE/g) || []).length;
  const restaurants = (tf.content.match(/restaurant/gi) || []).length;
  const partySizes = (tf.content.match(/partySize/g) || []).length;
  if (todos > 0) console.log(`  ⚠️  ${tf.filename}: ${todos} TODO_REPLACE`);
  if (restaurants > 0) console.log(`  ❌ ${tf.filename}: ${restaurants} 'restaurant' occurrences (hey-listen fallback!)`);
  if (partySizes > 0) console.log(`  ❌ ${tf.filename}: ${partySizes} 'partySize' occurrences (hey-listen fallback!)`);
  todoCount += todos;
  restaurantCount += restaurants;
  partySizeCount += partySizes;
}

console.log(`\nTODO_REPLACE: ${todoCount}`);
console.log(`hey-listen fallbacks (restaurant): ${restaurantCount}`);
console.log(`hey-listen fallbacks (partySize): ${partySizeCount}`);

if (restaurantCount === 0 && partySizeCount === 0) {
  console.log("✅ No hey-listen fallbacks found!");
} else {
  console.log("❌ hey-listen fallbacks still present — NOT goldstandard");
}

// Check for correct endpoint usage
console.log("\nChecking endpoint usage in generated tests...");
const expectedEndpoints = ["tasks.create", "tasks.getById", "tasks.updateStatus", "tasks.delete", "tasks.list", "tasks.bulkDelete"];
for (const ep of expectedEndpoints) {
  const found = result.testFiles.some(tf => tf.content.includes(ep));
  console.log(`  ${found ? "✅" : "❌"} ${ep}: ${found ? "found" : "NOT FOUND"}`);
}

// Check for correct enum values
console.log("\nChecking enum values in generated tests...");
const expectedEnums = ["todo", "in_progress", "review", "done", "low", "medium", "high", "critical"];
for (const val of expectedEnums) {
  const found = result.testFiles.some(tf => tf.content.includes(`"${val}"`));
  console.log(`  ${found ? "✅" : "⚠️"} "${val}": ${found ? "found" : "not found"}`);
}
