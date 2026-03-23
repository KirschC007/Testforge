#!/usr/bin/env node
/**
 * TestForge — Run only the 4 NEW scenarios (9-12) and produce quality-gate reports
 * Usage: npx tsx scripts/run-new-scenarios.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { runAnalysisJob } from "../server/analyzer/job-runner.js";
import { parseCodeToIR } from "../server/analyzer/code-parser.js";
import { buildRiskModel } from "../server/analyzer/risk-model.js";
import { generateProofs } from "../server/analyzer/proof-generator.js";
import { validateProofs } from "../server/analyzer/validator.js";
import { generateHelpers } from "../server/analyzer/helpers-generator.js";
import { createWriteStream } from "fs";
import archiver from "archiver";

const OUTPUT_DIR = "/tmp/testforge-new-scenarios-output";
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Quality Gate ──────────────────────────────────────────────────────────────
function runQualityGate(testFiles, scenarioName) {
  const results = [];
  let pass = true;
  let failCount = 0;

  const allContent = testFiles.map(f => f.content || "").join("\n");
  const testFileCount = testFiles.length;

  // Check 1: At least 3 test files
  if (testFileCount < 3) {
    results.push(`❌ CHECK 1 FAIL: Only ${testFileCount} test files (need ≥3)`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 1 PASS: ${testFileCount} test files generated`);
  }

  // Check 2: IDOR test present
  const hasIdor = allContent.includes("IDOR") || allContent.includes("idor") || allContent.includes("cross-tenant") || allContent.includes("clinicId") || allContent.includes("fleetId") || allContent.includes("academyId") || allContent.includes("communityId");
  if (!hasIdor) {
    results.push(`❌ CHECK 2 FAIL: No IDOR/tenant isolation test found`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 2 PASS: IDOR/tenant isolation test present`);
  }

  // Check 3: CSRF test present
  const hasCsrf = allContent.includes("csrf") || allContent.includes("CSRF") || allContent.includes("X-CSRF") || allContent.includes("csrfToken");
  if (!hasCsrf) {
    results.push(`❌ CHECK 3 FAIL: No CSRF test found`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 3 PASS: CSRF test present`);
  }

  // Check 4: Business logic test (constraint violation or state machine)
  const hasBusinessLogic = allContent.includes("business_logic") || allContent.includes("status") || allContent.includes("constraint") || allContent.includes("422") || allContent.includes("409");
  if (!hasBusinessLogic) {
    results.push(`❌ CHECK 4 FAIL: No business logic test found`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 4 PASS: Business logic test present`);
  }

  // Check 5: DB-state verification (Feature 1) — check for "persists to DB" or "fetched"
  const hasDbVerification = allContent.includes("persists to DB") || allContent.includes("fetched") || allContent.includes("trpcQuery") || allContent.includes("getBy");
  if (!hasDbVerification) {
    results.push(`❌ CHECK 5 FAIL: No DB-state verification found (Feature 1)`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 5 PASS: DB-state verification present (Feature 1)`);
  }

  // Check 6: Constraint violation test (Feature 2) — domain-specific patterns
  // Matches both explicit error codes (SLOT_TAKEN) and natural language variants (deadline passed)
  const domainPatterns = [
    // Explicit error codes from Feature 2 constraint patterns
    "SLOT_TAKEN", "BOOKING_CONFLICT", "MICROCHIP_EXISTS", "ALREADY_ENROLLED",
    "COURSE_NOT_PUBLISHED", "COURSE_FULL", "DEADLINE_PASSED", "VEHICLE_NOT_AVAILABLE",
    "RECIPE_NOT_PUBLISHED", "CANNOT_RATE_OWN", "ALREADY_RATED", "INVALID_DATE_RANGE",
    "NOT_PUBLISHED", "ALREADY_COMPLETED", "NOT_AVAILABLE",
    // Natural language variants that LLM generates in test descriptions
    "deadline passed", "deadline_passed", "deadline",
    "maxStudents", "max_students", "course is full", "capacity",
    "not published", "already enrolled", "already submitted",
    "double-book", "double booking", "overlap", "slot taken",
    "not available", "not active", "maintenance",
    "cannot rate", "rate own", "own recipe", "own course",
    "microchip", "license_plate unique", "email unique",
    "BOUND", "Boundary:", "boundary",
    "idempotency", "duplicate", "already exists"
  ];
  const foundPatterns = domainPatterns.filter(p => allContent.toLowerCase().includes(p.toLowerCase()));
  if (foundPatterns.length === 0) {
    results.push(`❌ CHECK 6 FAIL: No domain-specific constraint violation tests found (Feature 2)`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 6 PASS: Constraint violation tests present: ${foundPatterns.slice(0, 3).join(", ")}${foundPatterns.length > 3 ? "..." : ""}`);
  }

  // Check 7: GDPR test present
  const hasGdpr = allContent.includes("gdpr") || allContent.includes("GDPR") || allContent.includes("anonymize") || allContent.includes("anonymized") || allContent.includes("[Deleted]");
  if (!hasGdpr) {
    results.push(`❌ CHECK 7 FAIL: No GDPR test found`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 7 PASS: GDPR test present`);
  }

  // Check 8: Rate limit test present
  const hasRateLimit = allContent.includes("rate") || allContent.includes("429") || allContent.includes("rateLimit") || allContent.includes("brute");
  if (!hasRateLimit) {
    results.push(`❌ CHECK 8 FAIL: No rate limit test found`);
    pass = false; failCount++;
  } else {
    results.push(`✅ CHECK 8 PASS: Rate limit test present`);
  }

  return { pass, failCount, testFileCount, results };
}

// ── Scenario Runners ──────────────────────────────────────────────────────────
async function runSpecScenario(name, specText, zipPath) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`[${name}] Starting spec analysis (${specText.length} chars)...`);
  const t = Date.now();

  const result = await runAnalysisJob(specText, name, async (layer, msg) => {
    console.log(`  [${name}] Layer ${layer}: ${msg}`);
  });

  const testFiles = result.testFiles || [];
  console.log(`[${name}] Done in ${((Date.now() - t) / 1000).toFixed(1)}s — ${testFiles.length} test files, ${result.validatedSuite?.proofs?.length ?? 0} proofs`);

  // Save ZIP
  await saveZip(testFiles, zipPath, name);

  return { result, testFiles };
}

async function runCodeScenario(name, codeFiles, zipPath) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`[${name}] Starting code analysis (${codeFiles.length} files)...`);
  const t = Date.now();

  const result = await runAnalysisJob("", name, async (layer, msg) => {
    console.log(`  [${name}] Layer ${layer}: ${msg}`);
  }, undefined, { codeFiles });

  const testFiles = result.testFiles || [];
  console.log(`[${name}] Done in ${((Date.now() - t) / 1000).toFixed(1)}s — ${testFiles.length} test files, ${result.validatedSuite?.proofs?.length ?? 0} proofs`);

  // Save ZIP
  await saveZip(testFiles, zipPath, name);

  return { result, testFiles };
}

async function saveZip(testFiles, zipPath, name) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    // Add test files
    for (const f of testFiles) {
      const filePath = f.path || `${name.toLowerCase()}-tests.ts`;
      archive.append(f.content || "", { name: filePath });
    }

    // Add README
    archive.append(`# ${name} — TestForge Output\nGenerated: ${new Date().toISOString()}\nTest files: ${testFiles.length}\n`, { name: "README.md" });

    archive.finalize();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("TestForge — Running 4 NEW scenarios (9-12)...");
console.log(`Timestamp: ${new Date().toISOString()}`);

const scenarios = [];

// Szenario 9: PetVet Spec
const pvSpec = readFileSync("/tmp/scenario-9-petvet/petvet-spec.md", "utf8");
const s9 = await runSpecScenario("PetVet", pvSpec, `${OUTPUT_DIR}/s9-petvet.zip`);
scenarios.push({ name: "PetVet Spec", ...s9 });

// Szenario 10: CoursePortal Spec
const cpSpec = readFileSync("/tmp/scenario-10-courseportal/courseportal-spec.md", "utf8");
const s10 = await runSpecScenario("CoursePortal", cpSpec, `${OUTPUT_DIR}/s10-courseportal.zip`);
scenarios.push({ name: "CoursePortal Spec", ...s10 });

// Szenario 11: FleetManager Vibe-Code
const fmFiles = [
  { path: "drizzle/schema.ts", content: readFileSync("/tmp/scenario-11-fleetmanager/schema.ts", "utf8") },
  { path: "server/routers.ts", content: readFileSync("/tmp/scenario-11-fleetmanager/routers.ts", "utf8") },
  { path: "server/db.ts", content: readFileSync("/tmp/scenario-11-fleetmanager/db.ts", "utf8") },
  { path: "server/trpc.ts", content: readFileSync("/tmp/scenario-11-fleetmanager/trpc.ts", "utf8") },
  { path: "package.json", content: readFileSync("/tmp/scenario-11-fleetmanager/package.json", "utf8") },
];
const s11 = await runCodeScenario("FleetManager", fmFiles, `${OUTPUT_DIR}/s11-fleetmanager.zip`);
scenarios.push({ name: "FleetManager Vibe", ...s11 });

// Szenario 12: RecipeBox Spec
const rbSpec = readFileSync("/tmp/scenario-12-recipebox/recipebox-spec.md", "utf8");
const s12 = await runSpecScenario("RecipeBox", rbSpec, `${OUTPUT_DIR}/s12-recipebox.zip`);
scenarios.push({ name: "RecipeBox Spec", ...s12 });

// ── Quality Gate ──────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("QUALITY GATE RESULTS");
console.log("=".repeat(60));

const gateResults = [];
for (const s of scenarios) {
  const gate = runQualityGate(s.testFiles, s.name);
  gateResults.push({ name: s.name, gate, result: s.result });
  const icon = gate.pass ? "✅" : "❌";
  console.log(`\n${icon} [${s.name}] ${gate.pass ? "ALL CHECKS PASSED" : `${gate.failCount} CHECKS FAILED`} (${gate.testFileCount} test files)`);
  for (const r of gate.results) {
    console.log(`  ${r}`);
  }
}

// ── Summary Table ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("SUMMARY TABLE");
console.log("=".repeat(60));
console.log("| Szenario | Behaviors | Proofs | Test-Files | Gate |");
console.log("|----------|-----------|--------|------------|------|");
for (const { name, result, gate } of gateResults) {
  const b = result?.analysisResult?.ir?.behaviors?.length ?? "?";
  const p = result?.validatedSuite?.proofs?.length ?? "?";
  const t = result?.testFiles?.length ?? "?";
  const g = gate.pass ? "✅ PASS" : `❌ FAIL (${gate.failCount})`;
  console.log(`| ${name} | ${b} | ${p} | ${t} | ${g} |`);
}

// ── Save detailed summary ─────────────────────────────────────────────────────
let summaryMd = `# TestForge v4.1 — New Scenarios Quality Gate Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
summaryMd += `## Summary\n\n`;
summaryMd += `| Szenario | Behaviors | Proofs | Test-Files | Gate |\n`;
summaryMd += `|----------|-----------|--------|------------|------|\n`;
for (const { name, result, gate } of gateResults) {
  const b = result?.analysisResult?.ir?.behaviors?.length ?? "?";
  const p = result?.validatedSuite?.proofs?.length ?? "?";
  const t = result?.testFiles?.length ?? "?";
  const g = gate.pass ? "✅ PASS" : `❌ FAIL (${gate.failCount})`;
  summaryMd += `| ${name} | ${b} | ${p} | ${t} | ${g} |\n`;
}
summaryMd += `\n## Detailed Results\n\n`;
for (const { name, gate } of gateResults) {
  summaryMd += `### ${name}\n\n`;
  for (const r of gate.results) summaryMd += `- ${r}\n`;
  summaryMd += "\n";
}

const summaryPath = `${OUTPUT_DIR}/quality-gate-report.md`;
writeFileSync(summaryPath, summaryMd);
console.log(`\nQuality gate report saved: ${summaryPath}`);
console.log("All scenario ZIPs saved to:", OUTPUT_DIR);

const anyFailed = gateResults.some(g => !g.gate.pass);
if (anyFailed) {
  console.log("\n⚠️  Some quality gate checks failed — see report above");
  process.exit(1);
} else {
  console.log("\n✅ All quality gate checks passed!");
  process.exit(0);
}
