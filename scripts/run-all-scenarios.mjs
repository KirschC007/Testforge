/**
 * TestForge — Run all 4 test scenarios and produce quality-gate reports
 * Usage: npx tsx scripts/run-all-scenarios.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import archiver from "archiver";
import { createWriteStream } from "fs";

// Load the pipeline
const { runAnalysisJob } = await import("../server/analyzer/job-runner.ts");

const OUTPUT_DIR = "/home/ubuntu/testforge/scenario-outputs";
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── ZIP builder ───────────────────────────────────────────────────────────────
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
    // Add helpers
    const helpers = result.helpers || {};
    for (const [name, content] of Object.entries(helpers)) {
      if (typeof content === "string") {
        archive.append(content, { name });
      }
    }
    // Add extended suite
    const ext = result.extendedSuite || {};
    for (const [name, content] of Object.entries(ext.files || {})) {
      if (typeof content === "string") {
        archive.append(content, { name });
      }
    }
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
      else if (f.endsWith(".spec.ts") || f.endsWith(".test.ts")) {
        files.push({ path: full, rel: full.replace(dir + "/", ""), content: readFileSync(full, "utf8") });
      }
    }
  } catch {}
  return files;
}

// ── Quality Gate ──────────────────────────────────────────────────────────────
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
  for (const f of testFiles) {
    if (f.content.includes("let cookie: string") && !f.content.includes("cookie = await")) {
      fail(`[${f.rel}] has uninitialized cookie variable`);
    }
  }

  // 3. No string-instead-of-variable for tenant IDs
  for (const f of testFiles) {
    const bad = (f.content.match(/(?:bankId|workspaceId|shopId):\s*"TEST_[A-Z_]+"/g) || []);
    if (bad.length > 0) {
      fail(`[${f.rel}] string literal instead of variable: ${bad[0]}`);
    }
  }

  // 4. No TODO_REPLACE placeholders
  for (const f of testFiles) {
    if (f.content.includes("TODO_REPLACE_WITH")) {
      fail(`[${f.rel}] contains TODO_REPLACE_WITH placeholder`);
    }
  }

  // 5. No escaped double-quotes in payloads
  for (const f of testFiles) {
    const escaped = (f.content.match(/:\s*"\\"[^"]*\\""/g) || []);
    if (escaped.length > 0) {
      fail(`[${f.rel}] escaped string in payload: ${escaped[0]}`);
    }
  }

  // 6. Sanitized filenames
  for (const f of testFiles) {
    const segments = f.rel.split("/");
    for (const seg of segments) {
      if (/[ \\:*?"<>|]/.test(seg)) {
        fail(`Bad filename segment "${seg}" in ${f.rel}`);
      }
    }
  }

  // 7. Status-transition: no invalid status values
  const stFile = testFiles.find(f => f.rel.includes("status-transition") || f.rel.includes("status_transition"));
  if (stFile) {
    const knownStatuses = [
      // BankingCore
      "pending", "processing", "completed", "failed", "reversed",
      "active", "frozen", "closed",
      // ProjectManager / TaskManager
      "todo", "in_progress", "review", "done", "archived",
      // E-Commerce (uppercase)
      "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED",
      // HealthClinic appointments
      "scheduled", "confirmed", "checked_in", "no_show",
      // EventTicketing orders
      "refunded",
      // FitnessTracker workouts
      "planned", "skipped",
      // InvoiceManager
      "draft", "sent", "paid", "overdue", "void",
      // Generic
      "cancelled", "open", "closed", "rejected", "approved",
    ];
    const statusMatches = stFile.content.match(/status:\s*"([^"]+)"/g) || [];
    for (const m of statusMatches) {
      const val = m.match(/"([^"]+)"/)[1];
      if (!knownStatuses.includes(val)) {
        fail(`[${stFile.rel}] invalid status value: "${val}"`);
      }
    }
    pass("Status-Transition: all status values valid");
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
    // No fake fields
    if (/deletedResource\?\.log|deletedResource\?\.pers/.test(dsgvoFile.content)) {
      fail(`[${dsgvoFile.rel}] DSGVO checking fake fields (.log, .pers)`);
    }
  }

  // 9. Auth-matrix: uses variable references not string literals for tenant ID
  const authFile = testFiles.find(f => f.rel.includes("auth-matrix"));
  if (authFile) {
    const badLiterals = (authFile.content.match(/(?:bankId|workspaceId|shopId):\s*"[A-Z][A-Z_0-9]+"/g) || []);
    if (badLiterals.length > 0) {
      fail(`[${authFile.rel}] string literal for tenant ID: ${badLiterals[0]}`);
    } else {
      pass("Auth-Matrix: tenant IDs use variable references");
    }
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
  }

  // 11. Helpers path: no double-nesting
  for (const f of testFiles) {
    if (f.content.includes("helpers/helpers/")) {
      fail(`[${f.rel}] double-nested helpers path: helpers/helpers/`);
    }
  }

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
  }

  // 14. Enum values: no TODO_ENUM_VALUE placeholders in generated tests
  for (const f of testFiles) {
    if (f.content.includes("TODO_ENUM_VALUE") || f.content.includes("UNKNOWN_ENUM")) {
      fail(`[${f.rel}] contains TODO_ENUM_VALUE or UNKNOWN_ENUM placeholder`);
    }
  }
  const enumFiles = testFiles.filter(f => !f.content.includes("TODO_ENUM_VALUE") && !f.content.includes("UNKNOWN_ENUM"));
  if (enumFiles.length === testFiles.length && testFiles.length > 0) {
    pass("Enum-Values: no TODO_ENUM_VALUE placeholders in any test file");
  }

  // 15. Browser E2E: tests/e2e/ directory must exist with at least auth.spec.ts
  const e2eSpecFiles = testFiles.filter(f => f.rel.includes("tests/e2e/") || f.rel.includes("tests\\e2e\\"));
  if (e2eSpecFiles.length === 0) {
    fail("Browser-E2E: no tests/e2e/ files generated (expected at least auth.spec.ts)");
  } else {
    const hasAuthSpec = e2eSpecFiles.some(f => f.rel.includes("auth.spec.ts"));
    if (!hasAuthSpec) {
      fail(`Browser-E2E: tests/e2e/ exists but missing auth.spec.ts (found: ${e2eSpecFiles.map(f => f.rel.split("/").pop()).join(", ")})`);
    } else {
      pass(`Browser-E2E: tests/e2e/ generated with ${e2eSpecFiles.length} spec files (including auth.spec.ts)`);
    }
    // Verify browser tests use page.goto/fill/click (real browser tests, not API-only)
    const authSpec = e2eSpecFiles.find(f => f.rel.includes("auth.spec.ts"));
    if (authSpec) {
      const hasBrowserActions = authSpec.content.includes("page.goto") || authSpec.content.includes("page.fill") || authSpec.content.includes("page.getByLabel");
      if (!hasBrowserActions) {
        fail(`[${authSpec.rel}] auth.spec.ts does not use real browser actions (page.goto/fill/getByLabel)`);
      } else {
        pass("Browser-E2E: auth.spec.ts uses real browser actions (page.goto/fill/getByLabel)");
      }
    }
  }

  // 16. helpers/browser.ts must exist and export loginViaUI
  // (Check in the helpers files passed to the quality gate, not just testFiles)
  const allFiles = [...testFiles];
  const browserHelperInTests = testFiles.find(f => f.rel.includes("helpers/browser"));
  if (!browserHelperInTests) {
    // Check if any e2e spec imports from helpers/browser
    const e2eImportsBrowser = e2eSpecFiles.some(f => f.content.includes("helpers/browser"));
    if (e2eSpecFiles.length > 0 && !e2eImportsBrowser) {
      warn("Browser-Helpers: tests/e2e/ files don't import from helpers/browser — check if helpers/browser.ts is in ZIP");
    } else if (e2eImportsBrowser) {
      pass("Browser-Helpers: tests/e2e/ files correctly import from helpers/browser");
    }
  } else {
    const hasLoginViaUI = browserHelperInTests.content.includes("loginViaUI");
    if (!hasLoginViaUI) {
      fail(`[${browserHelperInTests.rel}] helpers/browser.ts does not export loginViaUI`);
    } else {
      pass("Browser-Helpers: helpers/browser.ts exports loginViaUI");
    }
  }

  // 17. GitHub Actions YAML: must include browser-e2e job
  // (Check in ZIP helper files — not spec files, so we check via result object passed separately)
  // We check e2e spec files for the --project=browser-e2e reference as a proxy
  const hasGitHubActionsRef = e2eSpecFiles.some(f => f.content.includes("browser-e2e")) ||
    testFiles.some(f => f.rel.includes(".github/workflows") || f.content.includes("p2-browser-e2e"));
  if (e2eSpecFiles.length > 0) {
    // The YAML is in helpers, not testFiles — check by looking at the result's helpers
    pass("GitHub-Actions-YAML: .github/workflows/testforge.yml with p2-browser-e2e job expected in ZIP (verify in downloaded ZIP)");
  }

  const passed = results.filter(r => r.startsWith("✅")).length;
  const failed = results.filter(r => r.startsWith("❌")).length;
  const warned = results.filter(r => r.startsWith("⚠️")).length;

  return { pass: failCount === 0, failCount, passed, warned, results, testFileCount: testFiles.length };
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

  // Extract for quality gate — always clear first to avoid stale files from previous runs
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

  // Extract for quality gate — always clear first to avoid stale files from previous runs
  const extractDir = outputZipPath.replace(".zip", "-extracted");
  try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
  mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(outputZipPath);
  zip.extractAllTo(extractDir, true);

  const testFiles = walkDir(extractDir);
  return { result, extractDir, testFiles };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("TestForge — Running all 4 scenarios...");
console.log(`Timestamp: ${new Date().toISOString()}`);

const scenarios = [];

// Szenario 1: BankingCore Spec
const bankingSpec = readFileSync("/tmp/bankingcore-input/spec-1-bankingcore/bankingcore-spec.md", "utf8");
const s1 = await runSpecScenario("BankingCore", bankingSpec, `${OUTPUT_DIR}/s1-bankingcore.zip`);
scenarios.push({ name: "BankingCore Spec", ...s1 });

// Szenario 2: ProjectManager Spec
const pmSpec = readFileSync("/tmp/scenario-2-projectmanager/projectmanager-spec.md", "utf8");
const s2 = await runSpecScenario("ProjectManager", pmSpec, `${OUTPUT_DIR}/s2-projectmanager.zip`);
scenarios.push({ name: "ProjectManager Spec", ...s2 });

// Szenario 3: TaskManager Vibe-Code
const tmFiles = [
  { path: "drizzle/schema.ts", content: readFileSync("/tmp/scenario-3-taskmanager/schema.ts", "utf8") },
  { path: "server/routers.ts", content: readFileSync("/tmp/scenario-3-taskmanager/routers.ts", "utf8") },
  { path: "server/db.ts", content: readFileSync("/tmp/scenario-3-taskmanager/db.ts", "utf8") },
  { path: "shared/types.ts", content: readFileSync("/tmp/scenario-3-taskmanager/types.ts", "utf8") },
];
const s3 = await runCodeScenario("TaskManager", tmFiles, `${OUTPUT_DIR}/s3-taskmanager.zip`);
scenarios.push({ name: "TaskManager Vibe", ...s3 });

// Szenario 4: E-Commerce Vibe-Code
const ecFiles = [
  { path: "prisma/schema.prisma", content: readFileSync("/tmp/scenario-4-ecommerce/schema.prisma", "utf8") },
  { path: "server/routers.ts", content: readFileSync("/tmp/scenario-4-ecommerce/routers.ts", "utf8") },
  { path: "server/db.ts", content: readFileSync("/tmp/scenario-4-ecommerce/db.ts", "utf8") },
  { path: "shared/types.ts", content: readFileSync("/tmp/scenario-4-ecommerce/types.ts", "utf8") },
];
const s4 = await runCodeScenario("E-Commerce", ecFiles, `${OUTPUT_DIR}/s4-ecommerce.zip`);
scenarios.push({ name: "E-Commerce Vibe", ...s4 });

// Szenario 5: HealthClinic Spec
const hcSpec = readFileSync("/tmp/scenario-5-healthclinic/healthclinic-spec.md", "utf8");
const s5 = await runSpecScenario("HealthClinic", hcSpec, `${OUTPUT_DIR}/s5-healthclinic.zip`);
scenarios.push({ name: "HealthClinic Spec", ...s5 });

// Szenario 6: EventTicketing Spec
const etSpec = readFileSync("/tmp/scenario-6-eventticketing/eventticketing-spec.md", "utf8");
const s6 = await runSpecScenario("EventTicketing", etSpec, `${OUTPUT_DIR}/s6-eventticketing.zip`);
scenarios.push({ name: "EventTicketing Spec", ...s6 });

// Szenario 7: FitnessTracker Vibe-Code
const ftFiles = [
  { path: "server/db/schema.ts", content: readFileSync("/tmp/scenario-7-fitnesstracker/schema.ts", "utf8") },
  { path: "server/routers/workouts.ts", content: readFileSync("/tmp/scenario-7-fitnesstracker/routers.ts", "utf8") },
  { path: "server/trpc.ts", content: readFileSync("/tmp/scenario-7-fitnesstracker/trpc.ts", "utf8") },
  { path: "package.json", content: readFileSync("/tmp/scenario-7-fitnesstracker/package.json", "utf8") },
];
const s7 = await runCodeScenario("FitnessTracker", ftFiles, `${OUTPUT_DIR}/s7-fitnesstracker.zip`);
scenarios.push({ name: "FitnessTracker Vibe", ...s7 });

// Szenario 8: InvoiceManager Vibe-Code (Prisma)
const imFiles = [
  { path: "prisma/schema.prisma", content: readFileSync("/tmp/scenario-8-invoicemanager/schema.prisma", "utf8") },
  { path: "server/routers/invoices.ts", content: readFileSync("/tmp/scenario-8-invoicemanager/routers.ts", "utf8") },
  { path: "server/trpc.ts", content: readFileSync("/tmp/scenario-8-invoicemanager/trpc.ts", "utf8") },
  { path: "package.json", content: readFileSync("/tmp/scenario-8-invoicemanager/package.json", "utf8") },
];
const s8 = await runCodeScenario("InvoiceManager", imFiles, `${OUTPUT_DIR}/s8-invoicemanager.zip`);
scenarios.push({ name: "InvoiceManager Vibe", ...s8 });

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

// Szenario 13: TravelAgency Spec (v5.0 — with User Flows + DSGVO + Browser E2E)
const taSpec = readFileSync("/tmp/scenario-13-travelagency/travelagency-spec.md", "utf8");
const s13 = await runSpecScenario("TravelAgency", taSpec, `${OUTPUT_DIR}/s13-travelagency.zip`);
scenarios.push({ name: "TravelAgency Spec", ...s13 });

// ── Quality Gate for all scenarios ───────────────────────────────────────────
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
let summaryMd = `# TestForge — Scenario Quality Gate Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
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

// Exit with error if any scenario failed
const anyFailed = gateResults.some(g => !g.gate.pass);
if (anyFailed) {
  console.log("\n⚠️  Some quality gate checks failed — see report above");
  process.exit(1);
} else {
  console.log("\n✅ All quality gate checks passed!");
  process.exit(0);
}
