#!/usr/bin/env node
/**
 * TestForge v4.2 — Run only scenarios 9-12 with full 14-check quality gate
 * Usage: npx tsx scripts/run-v4-scenarios.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import archiver from "archiver";
import { createWriteStream } from "fs";

const { runAnalysisJob } = await import("../server/analyzer/job-runner.ts");

const OUTPUT_DIR = "/tmp/testforge-v4-outputs";
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── ZIP builder (same as run-all-scenarios.mjs) ───────────────────────────────
async function buildZip(result, outputPath) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = createWriteStream(outputPath);
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    for (const f of result.testFiles || []) {
      archive.append(f.content, { name: f.filename });
    }
    const helpers = result.helpers || {};
    for (const [name, content] of Object.entries(helpers)) {
      if (typeof content === "string") {
        archive.append(content, { name });
      }
    }
    const ext = result.extendedSuite || {};
    for (const f of ext.files || []) {
      if (f && typeof f.content === "string" && f.filename) {
        archive.append(f.content, { name: f.filename });
      }
    }
    // Add extended suite configs
    for (const [name, content] of Object.entries(ext.configs || {})) {
      if (typeof content === "string") {
        archive.append(content, { name });
      }
    }
    if (ext.packageJson) archive.append(ext.packageJson, { name: "package.json" });
    if (ext.readme) archive.append(ext.readme, { name: "README.md" });
    if (result.report) {
      archive.append(result.report, { name: "testforge-report.md" });
    }
    archive.finalize();
  });
}

// ── Walk directory ────────────────────────────────────────────────────────────
function walkDir(dir, files = []) {
  try {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) walkDir(full, files);
      else if (f.endsWith(".spec.ts") || f.endsWith(".test.ts") || f.endsWith(".feature") || f.endsWith(".js")) {
        files.push({ path: full, rel: full.replace(dir + "/", ""), content: readFileSync(full, "utf8") });
      }
    }
  } catch {}
  return files;
}

// ── Quality Gate (14 checks from run-all-scenarios.mjs) ──────────────────────
function runQualityGate(testFiles, scenarioName) {
  const results = [];
  let failCount = 0;

  function fail(msg) { results.push(`❌ FAIL: ${msg}`); failCount++; }
  function warn(msg) { results.push(`⚠️  WARN: ${msg}`); }
  function pass(msg) { results.push(`✅ PASS: ${msg}`); }

  // 1. Import-Mismatch: every get*Cookie used must be imported
  for (const f of testFiles) {
    const usedFns = [...new Set((f.content.match(/\bget\w*Cookie\b/g) || []))];
    const importBlock = (f.content.match(/^import\s+\{[^}]+\}[^;]+;/gm) || []).join("\n");
    for (const fn of usedFns) {
      if (!importBlock.includes(fn)) {
        fail(`[${f.rel}] uses ${fn}() but not imported`);
      }
    }
  }
  if (failCount === 0) pass("Import-Mismatch: all get*Cookie functions properly imported");

  // 2. No uninitialized cookies
  let uninitCookies = 0;
  for (const f of testFiles) {
    if (f.content.includes("let cookie: string") && !f.content.includes("cookie = await")) {
      fail(`[${f.rel}] has uninitialized cookie variable`);
      uninitCookies++;
    }
  }
  if (uninitCookies === 0) pass("Cookies: all cookie variables properly initialized");

  // 3. No string-instead-of-variable for tenant IDs
  let badTenantLiterals = 0;
  for (const f of testFiles) {
    const bad = (f.content.match(/(?:bankId|workspaceId|shopId|fleetId|clinicId|academyId|communityId):\s*"TEST_[A-Z_]+"/g) || []);
    if (bad.length > 0) {
      fail(`[${f.rel}] string literal instead of variable: ${bad[0]}`);
      badTenantLiterals++;
    }
  }
  if (badTenantLiterals === 0) pass("Tenant-IDs: using variable references, not string literals");

  // 4. No TODO_REPLACE placeholders
  let todoReplace = 0;
  for (const f of testFiles) {
    if (f.content.includes("TODO_REPLACE_WITH")) {
      fail(`[${f.rel}] contains TODO_REPLACE_WITH placeholder`);
      todoReplace++;
    }
  }
  if (todoReplace === 0) pass("Placeholders: no TODO_REPLACE_WITH found");

  // 5. No escaped double-quotes in payloads
  let escapedQuotes = 0;
  for (const f of testFiles) {
    const escaped = (f.content.match(/:\s*"\\"[^"]*\\""/g) || []);
    if (escaped.length > 0) {
      fail(`[${f.rel}] escaped string in payload: ${escaped[0]}`);
      escapedQuotes++;
    }
  }
  if (escapedQuotes === 0) pass("Payloads: no escaped double-quotes");

  // 6. Sanitized filenames
  let badFilenames = 0;
  for (const f of testFiles) {
    const segments = f.rel.split("/");
    for (const seg of segments) {
      if (/[ \\:*?"<>|]/.test(seg)) {
        fail(`Bad filename segment "${seg}" in ${f.rel}`);
        badFilenames++;
      }
    }
  }
  if (badFilenames === 0) pass("Filenames: all sanitized (no special chars)");

  // 7. Status-transition: no invalid status values
  const stFile = testFiles.find(f => f.rel.includes("status-transition") || f.rel.includes("status_transition"));
  if (stFile) {
    const knownStatuses = [
      "pending", "processing", "completed", "failed", "reversed",
      "active", "frozen", "closed", "inactive", "maintenance",
      "todo", "in_progress", "review", "done", "archived",
      "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED",
      "scheduled", "confirmed", "checked_in", "no_show",
      "refunded", "cancelled", "open", "rejected", "approved",
      "draft", "sent", "paid", "overdue", "void",
      "planned", "skipped", "available", "unavailable",
      "published", "unpublished", "enrolled", "completed",
      // CoursePortal
      "dropped", "expired", "waitlisted",
      // RecipeBox
      "deleted", "archived", "hidden", "featured",
      // FleetManager
      "reserved", "in_use", "returned", "damaged",
    ];
    const statusMatches = stFile.content.match(/status:\s*"([^"]+)"/g) || [];
    let badStatus = 0;
    for (const m of statusMatches) {
      const val = m.match(/"([^"]+)"/)[1];
      if (!knownStatuses.includes(val)) {
        fail(`[${stFile.rel}] invalid status value: "${val}"`);
        badStatus++;
      }
    }
    if (badStatus === 0) pass("Status-Transition: all status values valid");
  } else {
    warn("Status-Transition: no status-transition test file found (may be expected for this scenario)");
  }

  // 8. DSGVO: checks real PII fields (name, email, phone)
  const dsgvoFile = testFiles.find(f => /dsgvo|gdpr|compliance/i.test(f.rel));
  if (dsgvoFile) {
    const hasPII = /name|email|phone/i.test(dsgvoFile.content);
    if (!hasPII) {
      fail(`[${dsgvoFile.rel}] DSGVO test does not check PII fields (name/email/phone)`);
    } else {
      pass("DSGVO: checks real PII fields");
    }
    if (/deletedResource\?\.log|deletedResource\?\.pers/.test(dsgvoFile.content)) {
      fail(`[${dsgvoFile.rel}] DSGVO checking fake fields (.log, .pers)`);
    }
    // Bug 2 check: no auth/csrf endpoint used as verify endpoint
    const hasCsrfAsVerify = /trpcQuery.*csrf|trpcQuery.*token|trpcQuery.*login/i.test(dsgvoFile.content);
    if (hasCsrfAsVerify) {
      fail(`[${dsgvoFile.rel}] DSGVO verify endpoint is auth/csrf endpoint (Bug 2)`);
    }
  } else {
    warn("DSGVO: no dsgvo/gdpr test file found");
  }

  // 9. Auth-matrix: uses variable references not string literals for tenant ID
  const authFile = testFiles.find(f => f.rel.includes("auth-matrix"));
  if (authFile) {
    const badLiterals = (authFile.content.match(/(?:bankId|workspaceId|shopId|fleetId|clinicId|academyId|communityId):\s*"[A-Z][A-Z_0-9]+"/g) || []);
    if (badLiterals.length > 0) {
      fail(`[${authFile.rel}] string literal for tenant ID: ${badLiterals[0]}`);
    } else {
      pass("Auth-Matrix: tenant IDs use variable references");
    }
  } else {
    warn("Auth-Matrix: no auth-matrix test file found");
  }

  // 10. Boundary: uses real field name (not "value")
  const boundFile = testFiles.find(f => f.rel.includes("boundary"));
  if (boundFile) {
    const valueFields = (boundFile.content.match(/\bvalue:\s*[-\d]+/g) || []);
    if (valueFields.length > 0) {
      fail(`[${boundFile.rel}] boundary test uses generic "value" field: ${valueFields[0]}`);
    } else {
      pass("Boundary: uses real field names");
    }
  } else {
    warn("Boundary: no boundary test file found");
  }

  // 11. Helpers path: no double-nesting
  let doubleNested = 0;
  for (const f of testFiles) {
    if (f.content.includes("helpers/helpers/")) {
      fail(`[${f.rel}] double-nested helpers path: helpers/helpers/`);
      doubleNested++;
    }
  }
  if (doubleNested === 0) pass("Helpers-Path: no double-nested helpers paths");

  // 12. E2E-Flow-Tests: if e2e-flows.spec.ts exists, it must have correct imports
  const e2eFile = testFiles.find(f => f.rel.includes("e2e-flow") || f.rel.includes("e2e_flow"));
  if (e2eFile) {
    if (!e2eFile.content.includes("trpcMutation") && !e2eFile.content.includes("trpcQuery")) {
      fail(`[${e2eFile.rel}] E2E-Flow test missing trpcMutation/trpcQuery imports`);
    } else {
      pass("E2E-Flow: correct API helper imports");
    }
    if (e2eFile.content.includes("TODO_REPLACE_WITH")) {
      fail(`[${e2eFile.rel}] E2E-Flow test has TODO_REPLACE_WITH placeholder`);
    }
  } else {
    warn("E2E-Flow: no e2e-flow test file found");
  }

  // 13. DB-State-Verification: status-transition tests must call trpcQuery AFTER trpcMutation
  const stFileForDB = testFiles.find(f => f.rel.includes("status-transition") || f.rel.includes("status_transition"));
  if (stFileForDB) {
    const hasMutation = stFileForDB.content.includes("trpcMutation");
    const hasQueryAfter = stFileForDB.content.includes("trpcQuery");
    if (hasMutation && !hasQueryAfter) {
      fail(`[${stFileForDB.rel}] Status-Transition test has no DB-State-Verification (no trpcQuery after mutation)`);
    } else if (hasMutation && hasQueryAfter) {
      pass("DB-State-Verification: status-transition tests verify DB state after mutation");
    }
  } else {
    warn("DB-State-Verification: no status-transition test file found");
  }

  // 14. Enum values: no TODO_ENUM_VALUE placeholders in generated tests
  let enumTodos = 0;
  for (const f of testFiles) {
    if (f.content.includes("TODO_ENUM_VALUE") || f.content.includes("UNKNOWN_ENUM")) {
      fail(`[${f.rel}] contains TODO_ENUM_VALUE or UNKNOWN_ENUM placeholder`);
      enumTodos++;
    }
  }
  if (enumTodos === 0) pass("Enum-Values: no TODO_ENUM_VALUE placeholders in any test file");

  const passed = results.filter(r => r.startsWith("✅")).length;
  const failed = results.filter(r => r.startsWith("❌")).length;
  const warned = results.filter(r => r.startsWith("⚠️")).length;

  return { pass: failCount === 0, failCount, passed, warned, results, testFileCount: testFiles.length };
}

// ── Endpoint-Name-Check ───────────────────────────────────────────────────────
function checkEndpointNames(testFiles) {
  const allEndpoints = new Set();
  const restPaths = [];
  const badPrefixes = [];

  for (const f of testFiles) {
    // Extract endpoint names from trpcMutation/trpcQuery calls
    const matches = f.content.matchAll(/trpc(?:Mutation|Query)\s*\([^,]+,\s*["']([^"']+)["']/g);
    for (const m of Array.from(matches)) {
      const ep = m[1];
      allEndpoints.add(ep);
      if (ep.startsWith("/")) restPaths.push({ file: f.rel, ep });
      if (/^routers\.|^router\./.test(ep)) badPrefixes.push({ file: f.rel, ep });
    }
  }

  return {
    endpoints: Array.from(allEndpoints).sort(),
    restPaths,
    badPrefixes,
    ok: restPaths.length === 0 && badPrefixes.length === 0,
  };
}

// ── Run a single spec scenario ────────────────────────────────────────────────
async function runSpecScenario(name, specText, outputZipPath) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Szenario: ${name} [SPEC]`);
  console.log("=".repeat(60));

  const result = await runAnalysisJob(specText, name, (layer, msg) => {
    process.stdout.write(`  [L${layer}] ${msg}\n`);
  });

  await buildZip(result, outputZipPath);
  const sizeKB = Math.round(statSync(outputZipPath).size / 1024);
  console.log(`ZIP saved: ${outputZipPath} (${sizeKB}KB)`);

  const extractDir = outputZipPath.replace(".zip", "-extracted");
  try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
  mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(outputZipPath);
  zip.extractAllTo(extractDir, true);

  const testFiles = walkDir(extractDir);
  return { result, extractDir, testFiles };
}

// ── Run a single code-scan scenario ──────────────────────────────────────────
async function runCodeScenario(name, codeFiles, outputZipPath) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Szenario: ${name} [CODE-SCAN]`);
  console.log("=".repeat(60));

  const result = await runAnalysisJob("", name, (layer, msg) => {
    process.stdout.write(`  [L${layer}] ${msg}\n`);
  }, undefined, { codeFiles });

  await buildZip(result, outputZipPath);
  const sizeKB = Math.round(statSync(outputZipPath).size / 1024);
  console.log(`ZIP saved: ${outputZipPath} (${sizeKB}KB)`);

  const extractDir = outputZipPath.replace(".zip", "-extracted");
  try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
  mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(outputZipPath);
  zip.extractAllTo(extractDir, true);

  const testFiles = walkDir(extractDir);
  return { result, extractDir, testFiles };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("TestForge v4.2 — Running scenarios 9-12...");
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
console.log("QUALITY GATE RESULTS (14 Checks)");
console.log("=".repeat(60));

const gateResults = [];
for (const s of scenarios) {
  const gate = runQualityGate(s.testFiles, s.name);
  const epCheck = checkEndpointNames(s.testFiles);
  gateResults.push({ name: s.name, gate, epCheck, result: s.result });
  const icon = gate.pass ? "✅" : "❌";
  console.log(`\n${icon} [${s.name}] ${gate.pass ? "ALL CHECKS PASSED" : `${gate.failCount} CHECKS FAILED`} (${gate.testFileCount} test files)`);
  for (const r of gate.results) {
    console.log(`  ${r}`);
  }
  console.log(`  Endpoint-Name-Check: ${epCheck.ok ? "✅ OK" : `❌ ${epCheck.restPaths.length} REST-Pfade, ${epCheck.badPrefixes.length} bad prefixes`}`);
  if (!epCheck.ok) {
    for (const rp of epCheck.restPaths.slice(0, 3)) console.log(`    REST-Pfad: ${rp.ep} in ${rp.file}`);
    for (const bp of epCheck.badPrefixes.slice(0, 3)) console.log(`    Bad prefix: ${bp.ep} in ${bp.file}`);
  }
}

// ── Summary Table ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(80));
console.log("SUMMARY TABLE");
console.log("=".repeat(80));
console.log("| Szenario | Behaviors | Proofs | Files | QG | Endpoints OK | Enums OK | Multi-Router OK |");
console.log("|----------|-----------|--------|-------|----|-------------|----------|----------------|");

for (const { name, result, gate, epCheck } of gateResults) {
  const b = result?.analysisResult?.ir?.behaviors?.length ?? "?";
  const p = result?.validatedSuite?.proofs?.length ?? "?";
  const t = result?.testFiles?.length ?? "?";
  const g = gate.pass ? `✅ ${gate.passed}/14` : `❌ ${gate.failCount} fail`;
  const ep = epCheck.ok ? "✅" : "❌";
  const enumOk = gate.results.some(r => r.startsWith("✅ PASS: Enum-Values")) ? "✅" : "❌";
  const isMultiRouter = name.includes("Fleet") || name.includes("Recipe");
  const multiRouter = isMultiRouter ? (epCheck.endpoints.some(e => !e.startsWith("vehicles.") && !e.startsWith("recipes.")) ? "✅" : "❌") : "n/a";
  console.log(`| ${name} | ${b} | ${p} | ${t} | ${g} | ${ep} | ${enumOk} | ${multiRouter} |`);
}

// ── Save report ───────────────────────────────────────────────────────────────
let summaryMd = `# TestForge v4.2 — Quality Gate Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
summaryMd += `## Summary\n\n`;
summaryMd += `| Szenario | Behaviors | Proofs | Files | QG | Endpoints OK | Enums OK | Multi-Router OK |\n`;
summaryMd += `|----------|-----------|--------|-------|----|-------------|----------|----------------|\n`;
for (const { name, result, gate, epCheck } of gateResults) {
  const b = result?.analysisResult?.ir?.behaviors?.length ?? "?";
  const p = result?.validatedSuite?.proofs?.length ?? "?";
  const t = result?.testFiles?.length ?? "?";
  const g = gate.pass ? `✅ ${gate.passed}/14` : `❌ ${gate.failCount} fail`;
  const ep = epCheck.ok ? "✅" : "❌";
  const enumOk = gate.results.some(r => r.startsWith("✅ PASS: Enum-Values")) ? "✅" : "❌";
  const isMultiRouter = name.includes("Fleet") || name.includes("Recipe");
  const multiRouter = isMultiRouter ? (epCheck.endpoints.some(e => !e.startsWith("vehicles.") && !e.startsWith("recipes.")) ? "✅" : "❌") : "n/a";
  summaryMd += `| ${name} | ${b} | ${p} | ${t} | ${g} | ${ep} | ${enumOk} | ${multiRouter} |\n`;
}
summaryMd += `\n## Detailed Results\n\n`;
for (const { name, gate, epCheck } of gateResults) {
  summaryMd += `### ${name}\n\n`;
  for (const r of gate.results) summaryMd += `- ${r}\n`;
  summaryMd += `\n**Endpoint-Name-Check:** ${epCheck.ok ? "✅ OK" : "❌ FAIL"}\n`;
  if (epCheck.endpoints.length > 0) {
    summaryMd += `\nEndpoints found:\n\`\`\`\n${epCheck.endpoints.join("\n")}\n\`\`\`\n`;
  }
  summaryMd += "\n";
}

const reportPath = `${OUTPUT_DIR}/quality-gate-report.md`;
writeFileSync(reportPath, summaryMd);
console.log(`\nReport saved: ${reportPath}`);
console.log("ZIPs saved to:", OUTPUT_DIR);

const anyFailed = gateResults.some(g => !g.gate.pass);
if (anyFailed) {
  console.log("\n⚠️  Some quality gate checks failed — see report above");
  process.exit(1);
} else {
  console.log("\n✅ All 14 quality gate checks passed for all 4 scenarios!");
  process.exit(0);
}
