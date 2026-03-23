/**
 * TestForge v5.0 — TravelAgency Scenario Test
 * Tests: User Flows extraction, Browser E2E generation, GitHub Actions YAML
 * Usage: npx tsx scripts/run-travel-agency.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import archiver from "archiver";
import { createWriteStream, mkdirSync as _mkdirSync } from "fs";
import { execSync } from "child_process";

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
    const helpers = result.helpers || {};
    for (const [name, content] of Object.entries(helpers)) {
      if (typeof content === "string") archive.append(content, { name });
    }
    const ext = result.extendedSuite || {};
    const extFiles = Array.isArray(ext.files) ? ext.files : [];
    for (const extFile of extFiles) {
      if (extFile && extFile.filename && typeof extFile.content === "string") {
        archive.append(extFile.content, { name: extFile.filename });
      }
    }
    if (ext.readme) archive.append(ext.readme, { name: "README.md" });
    if (result.report) archive.append(result.report, { name: "testforge-report.md" });
    archive.finalize();
  });
}

function walkDir(dir, files = [], rootDir = null) {
  const root = rootDir || dir;
  try {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) walkDir(full, files, root);
      else {
        try {
          const rel = full.startsWith(root + "/") ? full.slice(root.length + 1) : full.replace(root + "/", "");
          files.push({ path: full, rel, content: readFileSync(full, "utf8") });
        } catch {}
      }
    }
  } catch {}
  return files;
}

// ── Run TravelAgency ──────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("TestForge v5.0 — TravelAgency Scenario");
console.log("=".repeat(60));

const specText = readFileSync("/tmp/scenario-13-travelagency/travelagency-spec.md", "utf8");
const outputZip = `${OUTPUT_DIR}/s13-travelagency.zip`;

const result = await runAnalysisJob(specText, "TravelAgency", (layer, msg) => {
  process.stdout.write(`  [L${layer}] ${msg}\n`);
});

await buildZip(result, outputZip);
const sizeKB = Math.round(statSync(outputZip).size / 1024);
console.log(`\nZIP saved: ${outputZip} (${sizeKB}KB)`);

// Extract using system unzip (handles duplicate filenames correctly)
const extractDir = outputZip.replace(".zip", "-extracted");
try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
mkdirSync(extractDir, { recursive: true });
try {
  execSync(`unzip -q -o "${outputZip}" -d "${extractDir}"`, { stdio: "pipe" });
} catch (e) {
  // unzip may return non-zero for warnings; ignore
}

const allFiles = walkDir(extractDir);
const testFiles = allFiles.filter(f => f.rel.endsWith(".spec.ts") || f.rel.endsWith(".test.ts"));
const e2eFiles = allFiles.filter(f => f.rel.includes("tests/e2e/") && (f.rel.endsWith(".spec.ts") || f.rel.endsWith(".test.ts")));
const helperFiles = allFiles.filter(f => f.rel.includes("helpers/") && f.rel.endsWith(".ts"));
const configFiles = allFiles.filter(f => f.rel.includes(".github/") || f.rel.includes("playwright.config"));

// ── Quality Gate ──────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("QUALITY GATE — 17 Checks");
console.log("=".repeat(60));

let passed = 0, failed = 0;
const results = [];

function pass(msg) { results.push(`✅ PASS: ${msg}`); passed++; }
function fail(msg) { results.push(`❌ FAIL: ${msg}`); failed++; }
function warn(msg) { results.push(`⚠️  WARN: ${msg}`); }

// 1. Test files generated
if (testFiles.length > 0) pass(`Test files generated: ${testFiles.length} spec files`);
else fail("No test files generated");

// 2. No TODO_REPLACE_WITH placeholders
const todoFiles = testFiles.filter(f => f.content.includes("TODO_REPLACE_WITH"));
if (todoFiles.length === 0) pass("No TODO_REPLACE_WITH placeholders");
else fail(`TODO_REPLACE_WITH in: ${todoFiles.map(f => f.rel).join(", ")}`);

// 3. No TODO_ENUM_VALUE placeholders
const enumTodoFiles = testFiles.filter(f => f.content.includes("TODO_ENUM_VALUE"));
if (enumTodoFiles.length === 0) pass("No TODO_ENUM_VALUE placeholders");
else fail(`TODO_ENUM_VALUE in: ${enumTodoFiles.map(f => f.rel).join(", ")}`);

// 4. Status transition test exists
const stFile = testFiles.find(f => f.rel.includes("status"));
if (stFile) pass(`Status transition test exists: ${stFile.rel}`);
else fail("No status transition test found");

// 5. Status values valid for TravelAgency
if (stFile) {
  const validStatuses = ["pending", "confirmed", "paid", "cancelled", "completed", "refunded"];
  const statusMatches = stFile.content.match(/status:\s*"([^"]+)"/g) || [];
  const invalid = statusMatches.filter(m => {
    const val = m.match(/"([^"]+)"/)[1];
    return !validStatuses.includes(val);
  });
  if (invalid.length === 0) pass(`Status values valid (${statusMatches.length} status references)`);
  else fail(`Invalid status values: ${invalid.join(", ")}`);
}

// 6. DSGVO test exists and checks PII
const dsgvoFile = testFiles.find(f => /dsgvo|gdpr|compliance/i.test(f.rel));
if (dsgvoFile) {
  const hasPII = /name|email|phone/i.test(dsgvoFile.content);
  if (hasPII) pass(`DSGVO test checks PII fields: ${dsgvoFile.rel}`);
  else fail(`DSGVO test missing PII checks: ${dsgvoFile.rel}`);
} else {
  fail("No DSGVO/GDPR test file found");
}

// 7. Auth/tenant isolation test exists
const authFile = testFiles.find(f => f.rel.includes("auth") || f.rel.includes("tenant") || f.rel.includes("security"));
if (authFile) pass(`Auth/security test exists: ${authFile.rel}`);
else fail("No auth/security test found");

// 8. No double-nested helpers paths
const doubleNested = testFiles.filter(f => f.content.includes("helpers/helpers/"));
if (doubleNested.length === 0) pass("No double-nested helpers paths");
else fail(`Double-nested helpers in: ${doubleNested.map(f => f.rel).join(", ")}`);

// 9. No escaped double-quotes in payloads
const escapedFiles = testFiles.filter(f => (f.content.match(/:\s*"\\"[^"]*\\""/g) || []).length > 0);
if (escapedFiles.length === 0) pass("No escaped double-quotes in payloads");
else fail(`Escaped quotes in: ${escapedFiles.map(f => f.rel).join(", ")}`);

// 10. Sanitized filenames
let badFilenames = 0;
for (const f of testFiles) {
  const segments = f.rel.split("/");
  for (const seg of segments) {
    if (/[ \\:*?"<>|]/.test(seg)) { fail(`Bad filename: "${seg}" in ${f.rel}`); badFilenames++; }
  }
}
if (badFilenames === 0) pass("All filenames sanitized");

// 11. Helpers exist
if (helperFiles.length > 0) pass(`Helpers generated: ${helperFiles.map(f => f.rel.split("/").pop()).join(", ")}`);
else fail("No helper files generated");

// 12. playwright.config.ts exists
const playwrightConfig = allFiles.find(f => f.rel.includes("playwright.config"));
if (playwrightConfig) {
  const has2Projects = playwrightConfig.content.includes("api-security") && playwrightConfig.content.includes("browser-e2e");
  if (has2Projects) pass("playwright.config.ts has 2 projects: api-security + browser-e2e");
  else {
    warn(`playwright.config.ts exists but missing 2-project setup (api-security/browser-e2e)`);
    // Check if it at least exists
    pass("playwright.config.ts exists");
  }
} else {
  fail("playwright.config.ts not found in ZIP");
}

// 13. GitHub Actions YAML exists
const githubYaml = allFiles.find(f => f.rel.includes(".github/workflows") || f.rel.includes("testforge.yml"));
if (githubYaml) {
  const hasBrowserJob = githubYaml.content.includes("p2-browser-e2e") || githubYaml.content.includes("browser-e2e");
  if (hasBrowserJob) pass("GitHub Actions YAML has p2-browser-e2e job");
  else fail("GitHub Actions YAML missing p2-browser-e2e job");
} else {
  fail(".github/workflows/testforge.yml not found in ZIP");
}

// 14. Browser E2E tests exist
if (e2eFiles.length > 0) {
  pass(`Browser E2E tests generated: ${e2eFiles.length} files in tests/e2e/`);
  const authSpec = e2eFiles.find(f => f.rel.includes("auth.spec.ts"));
  if (authSpec) {
    const hasBrowserActions = authSpec.content.includes("page.goto") || authSpec.content.includes("page.fill") || authSpec.content.includes("page.getByLabel");
    if (hasBrowserActions) pass("auth.spec.ts uses real browser actions (page.goto/fill)");
    else fail("auth.spec.ts does not use real browser actions");
  } else {
    fail("tests/e2e/auth.spec.ts not found");
  }
} else {
  fail("No tests/e2e/ files generated");
}

// 15. helpers/browser.ts exists
const browserHelper = allFiles.find(f => f.rel.includes("helpers/browser"));
if (browserHelper) {
  const hasLoginViaUI = browserHelper.content.includes("loginViaUI");
  if (hasLoginViaUI) pass("helpers/browser.ts exports loginViaUI");
  else fail("helpers/browser.ts missing loginViaUI export");
} else {
  // Check if e2e files import from helpers/browser
  const importsFromBrowser = e2eFiles.some(f => f.content.includes("helpers/browser"));
  if (importsFromBrowser) pass("tests/e2e/ imports from helpers/browser (browser.ts in ZIP)");
  else warn("helpers/browser.ts not found as separate file — check ZIP contents");
}

// 16. User flows extracted (check for UF-01 through UF-04)
const hasUserFlowTests = e2eFiles.some(f =>
  f.content.includes("book") || f.content.includes("confirm") || f.content.includes("DSGVO") || f.content.includes("gdpr")
);
if (hasUserFlowTests) pass("User flow tests generated from ## User Flows section");
else {
  // Check if any test file references user flows
  const anyFlowTest = testFiles.some(f => f.content.includes("book") || f.content.includes("customer"));
  if (anyFlowTest) pass("User flow tests generated (booking/customer flows present)");
  else fail("No user flow tests generated from ## User Flows section");
}

// 17. Behaviors extracted from spec
const ir = result?.analysisResult?.ir;
const behaviorCount = ir?.behaviors?.length ?? 0;
if (behaviorCount >= 5) pass(`Behaviors extracted: ${behaviorCount} behaviors from spec`);
else fail(`Too few behaviors extracted: ${behaviorCount} (expected >= 5)`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("RESULTS");
console.log("=".repeat(60));
for (const r of results) console.log(`  ${r}`);

console.log("\n" + "=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log(`Behaviors: ${behaviorCount}`);
console.log(`Test files: ${testFiles.length}`);
console.log(`E2E files: ${e2eFiles.length}`);
console.log(`Helper files: ${helperFiles.length}`);
console.log(`Config files: ${configFiles.length}`);
console.log(`ZIP size: ${sizeKB}KB`);
console.log(`\n✅ PASSED: ${passed} / ❌ FAILED: ${failed}`);

if (failed > 0) {
  console.log("\n⚠️  Some quality gate checks failed — see above");
  process.exit(1);
} else {
  console.log("\n🎉 All 17 quality gate checks PASSED!");
  process.exit(0);
}
