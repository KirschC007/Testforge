import { runAnalysisJob } from "./server/analyzer.ts";
import fs from "fs";
import path from "path";

const spec = fs.readFileSync("/home/ubuntu/testforge/hey-listen-spec.txt", "utf8");
console.log(`Spec size: ${spec.length} chars`);

const start = Date.now();
const result = await runAnalysisJob(spec, "markdown", "hey-listen");
const elapsed = Math.round((Date.now() - start) / 1000);

console.log(`\n=== RESULTS (${elapsed}s) ===`);
console.log("Behaviors:", result.analysisResult.ir.behaviors.length);
console.log("API Endpoints:", result.analysisResult.ir.apiEndpoints.length);
console.log("Proof targets:", result.riskModel.proofTargets.length);
console.log("Validated proofs:", result.validatedSuite.verdict.passed);
console.log("Discarded:", result.validatedSuite.discardedProofs.length);
console.log("Mutation score:", result.validatedSuite.verdict.score);
console.log("Test files:", result.testFiles.length);
console.log("LLM Checker:", JSON.stringify(result.llmCheckerStats));

console.log("\n=== TEST FILES ===");
for (const tf of result.testFiles) {
  const lines = tf.content.split('\n').length;
  const tests = (tf.content.match(/test\(/g) || []).length;
  console.log(`  ${tf.filename}: ${lines} lines, ${tests} tests`);
}

console.log("\n=== HELPERS ===");
console.log("Files:", Object.keys(result.helpers).join(", "));

// Save output for inspection
const outDir = "/tmp/hey-listen-tests";
fs.mkdirSync(outDir, { recursive: true });
for (const tf of result.testFiles) {
  const fullPath = path.join(outDir, tf.filename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, tf.content);
}
for (const [name, content] of Object.entries(result.helpers)) {
  const fullPath = path.join(outDir, name);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}
console.log(`\nAll files saved to ${outDir}`);
console.log("\n--- helpers/api.ts preview ---");
console.log(result.helpers["helpers/api.ts"].slice(0, 800));
