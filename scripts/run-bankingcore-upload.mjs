/**
 * TestForge Pipeline Test — BankingCore Upload Spec
 * Reads the uploaded spec-1-bankingcore.zip, extracts the markdown,
 * runs the full 5-layer pipeline, and saves the output ZIP.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Read spec from uploaded ZIP
const inputZip = new AdmZip("/home/ubuntu/upload/spec-1-bankingcore.zip");
const entries = inputZip.getEntries();
const specEntry = entries.find(e => e.entryName.endsWith(".md"));
if (!specEntry) throw new Error("No .md file found in ZIP");
const specText = specEntry.getData().toString("utf8");
console.log(`Spec loaded: ${specEntry.entryName} (${specText.length} chars, ${specText.split("\n").length} lines)`);

// Dynamic import of the pipeline
const { runAnalysisJob } = await import(`${projectRoot}/server/analyzer/job-runner.ts`);

console.log("\n=== Running TestForge Pipeline ===");
const jobStart = Date.now();

let lastProgress = "";
const result = await runAnalysisJob(
  specText,
  "BankingCore v2.1",
  (layer, msg) => {
    if (msg !== lastProgress) {
      console.log(`  [Layer ${layer}] ${msg}`);
      lastProgress = msg;
    }
  }
);

const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
console.log(`\nPipeline completed in ${elapsed}s`);

const { analysisResult, riskModel, validatedSuite, report, testFiles, helpers, extendedSuite } = result;

// ─── Results ──────────────────────────────────────────────────────────────────
console.log("\n=== Results ===");
console.log(`Behaviors:       ${analysisResult.ir.behaviors.length}`);
console.log(`Endpoints:       ${analysisResult.ir.apiEndpoints.length}`);
console.log(`Quality Score:   ${analysisResult.qualityScore}/100`);
console.log(`Spec Type:       ${analysisResult.specType}`);
console.log(`Proof Targets:   ${riskModel.proofTargets.length}`);
console.log(`Validated Tests: ${validatedSuite.proofs.length}`);
console.log(`Discarded:       ${validatedSuite.discardedProofs.length}`);
console.log(`Test Files:      ${testFiles.length}`);
console.log(`Extended Files:  ${extendedSuite.files.length}`);
const proofTypes = [...new Set(riskModel.proofTargets.map(p => p.proofType))].join(", ");
console.log(`Proof Types:     ${proofTypes}`);

// ─── Endpoint names check (Bug 1 verification) ────────────────────────────────
console.log("\n=== Endpoint Names (Bug 1 Check) ===");
for (const ep of analysisResult.ir.apiEndpoints) {
  const isRest = /^(GET|POST|PUT|PATCH|DELETE)\s+/.test(ep.name);
  console.log(`  ${isRest ? "❌ REST" : "✓ dot"} ${ep.name}`);
}

// ─── Boundary fields check (Bug 7 check) ─────────────────────────────────────
console.log("\n=== Boundary Tests (Bug 7 Check) ===");
const boundaryProofs = riskModel.proofTargets.filter(p => p.proofType === "boundary");
const boundaryFiles = testFiles.filter(f => f.filename.includes("boundary"));
for (const bf of boundaryFiles) {
  const hasValueFallback = bf.content.includes(": boundaryValue,") && bf.content.includes("value: ");
  const fieldMatch = bf.content.match(/const (\w+)BoundaryValue|(\w+): boundaryValue/);
  console.log(`  ${bf.filename} — ${hasValueFallback ? "⚠ 'value' fallback" : "✓ real field"}`);
}
if (boundaryProofs.length === 0) console.log("  (no boundary proofs generated)");

// ─── Auth Matrix check (Bug 3 check) ─────────────────────────────────────────
console.log("\n=== Auth Matrix Tests (Bug 3 Check) ===");
const authFiles = testFiles.filter(f => f.filename.includes("auth"));
for (const af of authFiles.slice(0, 3)) {
  const hasStringLiteral = af.content.match(/bankId:\s*"TEST_BANK_ID"/);
  const hasVariable = af.content.match(/bankId:\s*TEST_BANK_ID[^"]/);
  console.log(`  ${af.filename}`);
  console.log(`    String literal: ${hasStringLiteral ? "❌ YES (Bug 3 not fixed)" : "✓ none"}`);
  console.log(`    Variable ref:   ${hasVariable ? "✓ YES" : "⚠ not found"}`);
}

// ─── Requirement Checks ───────────────────────────────────────────────────────
console.log("\n=== Requirement Checks ===");
const checks = [
  ["≥20 Behaviors", analysisResult.ir.behaviors.length >= 20],
  ["≥8 Endpoints", analysisResult.ir.apiEndpoints.length >= 8],
  ["IDOR tests", riskModel.proofTargets.some(p => p.proofType === "idor")],
  ["Boundary tests", riskModel.proofTargets.some(p => p.proofType === "boundary")],
  ["Status-Transition tests", riskModel.proofTargets.some(p => p.proofType === "status_transition")],
  ["CSRF tests", riskModel.proofTargets.some(p => p.proofType === "csrf")],
  ["Auth-Matrix tests", riskModel.proofTargets.some(p => p.proofType === "auth_matrix")],
  ["Idempotency tests", riskModel.proofTargets.some(p => p.proofType === "idempotency")],
  ["No 'value' field fallback", !testFiles.some(f => f.content.match(/\bvalue: boundaryValue\b/))],
  ["No REST path endpoints", !analysisResult.ir.apiEndpoints.some(e => /^(GET|POST|PUT|PATCH|DELETE)\s+/.test(e.name))],
  ["No duplicate boundary files", (() => {
    const seen = new Set();
    for (const f of testFiles) {
      if (f.filename.includes("boundary")) {
        if (seen.has(f.filename)) return false;
        seen.add(f.filename);
      }
    }
    return true;
  })()],
  ["No TODO_REPLACE placeholders", !testFiles.some(f => f.content.includes("TODO_REPLACE_WITH"))],
  ["Sanitized filenames", (() => {
    // Check that individual filename segments don't contain spaces or illegal chars
    // (path separators / are allowed as directory separators)
    const bad = testFiles.filter(f => {
      const segments = f.filename.split("/");
      return segments.some(seg => /[ \\:*?"<>|]/.test(seg));
    });
    if (bad.length > 0) console.log("  BAD filenames:", bad.map(f => f.filename));
    return bad.length === 0;
  })()],
];

let allPassed = true;
for (const [label, passed] of checks) {
  console.log(`  ${passed ? "✓" : "❌"} ${label}`);
  if (!passed) allPassed = false;
}

// ─── Mutation Score ───────────────────────────────────────────────────────────
console.log("\n=== Mutation Score ===");
const totalMutations = validatedSuite.proofs.reduce((s, p) => s + (p.mutationTargets?.length || 0), 0);
const killedMutations = validatedSuite.proofs.reduce((s, p) => s + (p.mutationTargets?.filter(m => m.expectedKill).length || 0), 0);
console.log(`  Total mutation targets: ${totalMutations}`);
console.log(`  Expected kills:         ${killedMutations}`);
console.log(`  Mutation score:         ${totalMutations > 0 ? Math.round(killedMutations / totalMutations * 100) : 0}%`);

// ─── Build ZIP ────────────────────────────────────────────────────────────────
console.log("\n=== Building ZIP ===");
const outputZip = new AdmZip();

// Add test files
for (const tf of testFiles) {
  outputZip.addFile(tf.filename, Buffer.from(tf.content, "utf8"));
}

// Add helpers (name already includes 'helpers/' prefix from helpers-generator.ts e.g. 'helpers/api.ts')
for (const [name, content] of Object.entries(helpers)) {
  outputZip.addFile(name, Buffer.from(content, "utf8"));
}

// Add extended suite
for (const ef of extendedSuite.files) {
  outputZip.addFile(ef.filename, Buffer.from(ef.content, "utf8"));
}

// Add configs
for (const [name, content] of Object.entries(extendedSuite.configs)) {
  outputZip.addFile(name, Buffer.from(content, "utf8"));
}

// Add package.json and README
outputZip.addFile("package.json", Buffer.from(extendedSuite.packageJson, "utf8"));
outputZip.addFile("README.md", Buffer.from(extendedSuite.readme, "utf8"));

// Add report
outputZip.addFile("testforge-report.md", Buffer.from(report, "utf8"));

const outputPath = `${projectRoot}/output-bankingcore-upload.zip`;
outputZip.writeZip(outputPath);
const zipSize = Math.round(outputZip.toBuffer().length / 1024);
console.log(`ZIP saved: ${outputPath} (${zipSize}KB)`);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n=== Summary Table ===");
console.log(`| Metric                | Value |`);
console.log(`|----------------------|-------|`);
console.log(`| Behaviors extracted  | ${analysisResult.ir.behaviors.length} |`);
console.log(`| Endpoints detected   | ${analysisResult.ir.apiEndpoints.length} |`);
console.log(`| Proof targets        | ${riskModel.proofTargets.length} |`);
console.log(`| Tests generated      | ${validatedSuite.proofs.length} |`);
console.log(`| Discarded proofs     | ${validatedSuite.discardedProofs.length} |`);
console.log(`| Test files           | ${testFiles.length} |`);
console.log(`| Extended files       | ${extendedSuite.files.length} |`);
console.log(`| Mutation targets     | ${totalMutations} |`);
console.log(`| Proof types          | ${[...new Set(riskModel.proofTargets.map(p => p.proofType))].length} |`);
console.log(`| ZIP size             | ${zipSize}KB |`);
console.log(`| All checks passed    | ${allPassed ? "YES ✓" : "NO ❌"} |`);
console.log(`| Pipeline time        | ${elapsed}s |`);
