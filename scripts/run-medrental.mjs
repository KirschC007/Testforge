/**
 * TestForge — MedRental Ultimate Testcase
 * Tests: 17 ProofTypes, 4 Rollen, 2 Status-Machines, 6 User Flows, Browser E2E
 * Usage: npx tsx scripts/run-medrental.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";
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
    const extConfigs = ext.configs || {};
    for (const [name, content] of Object.entries(extConfigs)) {
      if (typeof content === "string") archive.append(content, { name });
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

// ── Run MedRental ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(70));
console.log("TestForge — MedRental Ultimate Testcase");
console.log("=".repeat(70));

const specText = readFileSync("/tmp/scenario-medrental/medrental-spec.md", "utf8");
const outputZip = `${OUTPUT_DIR}/medrental.zip`;

const result = await runAnalysisJob(specText, "MedRental", (layer, msg) => {
  process.stdout.write(`  [L${layer}] ${msg}\n`);
});

await buildZip(result, outputZip);
const sizeKB = Math.round(statSync(outputZip).size / 1024);
console.log(`\nZIP saved: ${outputZip} (${sizeKB}KB)`);

// Extract using system unzip
const extractDir = outputZip.replace(".zip", "-extracted");
try {
  execSync(`rm -rf "${extractDir}" && mkdir -p "${extractDir}" && unzip -o "${outputZip}" -d "${extractDir}"`, { stdio: "pipe" });
  console.log(`Extracted to: ${extractDir}`);
} catch (e) {
  console.log("Extraction error:", e.message);
}

const allFiles = walkDir(extractDir);
const testFiles = allFiles.filter(f => f.rel.endsWith(".spec.ts") || f.rel.endsWith(".test.ts") || f.rel.endsWith(".feature"));
const e2eFiles = allFiles.filter(f => f.rel.startsWith("tests/e2e/") && f.rel.endsWith(".spec.ts"));
const helperFiles = allFiles.filter(f => f.rel.startsWith("helpers/"));
const securityFiles = allFiles.filter(f => f.rel.startsWith("tests/security/") && f.rel.endsWith(".spec.ts"));
const businessFiles = allFiles.filter(f => f.rel.startsWith("tests/business/") && f.rel.endsWith(".spec.ts"));
const complianceFiles = allFiles.filter(f => f.rel.startsWith("tests/compliance/") && f.rel.endsWith(".spec.ts"));
const integrationFiles = allFiles.filter(f => f.rel.startsWith("tests/integration/") && f.rel.endsWith(".spec.ts"));

// Count behaviors from result
const behaviors = result.analysisResult?.ir?.behaviors || [];
const proofs = result.validatedSuite?.proofs || [];

console.log("\n" + "=".repeat(70));
console.log("VERIFIKATIONS-CHECKS");
console.log("=".repeat(70));

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  const icon = condition ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
  if (condition) passed++; else failed++;
}

// === STRUCTURE ===
console.log("\n--- STRUCTURE ---");
check("tests/security/idor.spec.ts", allFiles.some(f => f.rel === "tests/security/idor.spec.ts"));
check("tests/security/csrf.spec.ts", allFiles.some(f => f.rel === "tests/security/csrf.spec.ts"));
check("tests/security/auth-matrix.spec.ts", allFiles.some(f => f.rel === "tests/security/auth-matrix.spec.ts"));
check("tests/business/boundary.spec.ts", allFiles.some(f => f.rel === "tests/business/boundary.spec.ts"));
check("tests/business/logic.spec.ts", allFiles.some(f => f.rel === "tests/business/logic.spec.ts"));
check("tests/compliance/dsgvo.spec.ts", allFiles.some(f => f.rel === "tests/compliance/dsgvo.spec.ts"));
check("tests/integration/status-transitions.spec.ts", allFiles.some(f => f.rel === "tests/integration/status-transitions.spec.ts"));
check("tests/e2e/auth.spec.ts", allFiles.some(f => f.rel === "tests/e2e/auth.spec.ts"));
check("helpers/browser.ts", allFiles.some(f => f.rel === "helpers/browser.ts"));
check("helpers/api.ts", allFiles.some(f => f.rel === "helpers/api.ts"));
check("helpers/auth.ts", allFiles.some(f => f.rel === "helpers/auth.ts"));
check("helpers/factories.ts", allFiles.some(f => f.rel === "helpers/factories.ts"));
check(".github/workflows/testforge.yml", allFiles.some(f => f.rel === ".github/workflows/testforge.yml"));
check(".env.example", allFiles.some(f => f.rel === ".env.example"));
check("playwright.config.ts", allFiles.some(f => f.rel === "playwright.config.ts"));

// === ENDPOINTS ===
console.log("\n--- ENDPOINTS ---");
const allContent = testFiles.map(f => f.content).join("\n");
const expectedEndpoints = [
  "devices.create", "devices.list", "devices.maintenance",
  "rentals.create", "rentals.extend", "rentals.return",
  "patients.create", "patients.list",
  "patients.gdprDelete", "patients.export",
  "invoices.create", "invoices.payment",
  "reports.utilization"
];
for (const ep of expectedEndpoints) {
  check(`Endpoint: ${ep}`, allContent.includes(`"${ep}"`));
}

// === TENANT ===
console.log("\n--- TENANT ---");
const factoriesFile = allFiles.find(f => f.rel === "helpers/factories.ts");
check("TEST_CLINIC_ID in factories.ts", factoriesFile ? factoriesFile.content.includes("TEST_CLINIC_ID") : false);

// === DSGVO ===
console.log("\n--- DSGVO ---");
const dsgvoFile = allFiles.find(f => f.rel === "tests/compliance/dsgvo.spec.ts");
if (dsgvoFile) {
  check("DSGVO uses patients endpoint (not devices)", !dsgvoFile.content.includes('"devices.list"') && (dsgvoFile.content.includes('"patients.') || dsgvoFile.content.includes("patients")));
  check("DSGVO checks PII fields", dsgvoFile.content.includes("firstName") || dsgvoFile.content.includes("Gelöscht") || dsgvoFile.content.includes("REDACTED") || dsgvoFile.content.includes("null"));
} else {
  check("DSGVO file exists", false, "tests/compliance/dsgvo.spec.ts missing");
  check("DSGVO checks PII fields", false, "file missing");
}

// === BROWSER ===
console.log("\n--- BROWSER E2E ---");
const e2eCount = e2eFiles.length;
check(`Browser E2E files >= 4`, e2eCount >= 4, `found ${e2eCount}`);
const e2eWithPageGoto = e2eFiles.filter(f => f.content.includes("page.goto")).length;
check(`Browser tests with page.goto >= 4`, e2eWithPageGoto >= 4, `found ${e2eWithPageGoto}`);
const e2eWithApiVerify = e2eFiles.filter(f => f.content.includes("trpcQuery") || f.content.includes("trpcMutation")).length;
check(`Browser tests with API verify >= 5`, e2eWithApiVerify >= 5, `found ${e2eWithApiVerify}`);

// === AUTH-MATRIX: 4 Rollen ===
console.log("\n--- AUTH-MATRIX ---");
const authMatrixFile = allFiles.find(f => f.rel === "tests/security/auth-matrix.spec.ts");
if (authMatrixFile) {
  check("getAdminCookie in auth-matrix", authMatrixFile.content.includes("getAdminCookie") || authMatrixFile.content.includes("admin"));
  check("getTechnicianCookie in auth-matrix", authMatrixFile.content.includes("getTechnicianCookie") || authMatrixFile.content.includes("technician"));
  check("getNurseCookie in auth-matrix", authMatrixFile.content.includes("getNurseCookie") || authMatrixFile.content.includes("nurse"));
  check("getBillingCookie in auth-matrix", authMatrixFile.content.includes("getBillingCookie") || authMatrixFile.content.includes("billing"));
} else {
  check("getAdminCookie", false, "auth-matrix file missing");
  check("getTechnicianCookie", false, "auth-matrix file missing");
  check("getNurseCookie", false, "auth-matrix file missing");
  check("getBillingCookie", false, "auth-matrix file missing");
}

// === STATUS-TRANSITIONS: 2 Machines ===
console.log("\n--- STATUS-TRANSITIONS ---");
const statusFile = allFiles.find(f => f.rel === "tests/integration/status-transitions.spec.ts");
if (statusFile) {
  const testCount = (statusFile.content.match(/\btest\(/g) || []).length;
  check(`Status-Transitions >= 20 tests`, testCount >= 20, `found ${testCount}`);
  check("devices status machine covered", statusFile.content.includes("available") && statusFile.content.includes("rented") && statusFile.content.includes("maintenance") && statusFile.content.includes("decommissioned"));
  check("rentals status machine covered", statusFile.content.includes("reserved") && statusFile.content.includes("active") && statusFile.content.includes("overdue") && statusFile.content.includes("returned") && statusFile.content.includes("completed") && statusFile.content.includes("cancelled"));
} else {
  check("Status-Transitions file exists", false, "missing");
  check("devices status machine", false, "file missing");
  check("rentals status machine", false, "file missing");
}

// === CONSTRAINT-VIOLATIONS ===
console.log("\n--- CONSTRAINT-VIOLATIONS ---");
const logicFile = allFiles.find(f => f.rel === "tests/business/logic.spec.ts");
if (logicFile) {
  const violations = ["OVERPAYMENT", "MISSING_PRE_AUTH", "RENTAL_TOO_LONG", "DEVICE_IN_USE", "MAX_EXTENSIONS", "DEVICE_NOT_AVAILABLE"];
  const found = violations.filter(v => logicFile.content.includes(v));
  check(`Constraint-Violations >= 3 in logic.spec.ts`, found.length >= 3, `found: ${found.join(", ")}`);
} else {
  check("Constraint-Violations >= 3", false, "logic.spec.ts missing");
}

// === CI/CD ===
console.log("\n--- CI/CD ---");
const ciFile = allFiles.find(f => f.rel === ".github/workflows/testforge.yml");
if (ciFile) {
  check("CI: runs-on present", ciFile.content.includes("runs-on"));
  check("CI: playwright install present", ciFile.content.includes("playwright install") || ciFile.content.includes("install-deps"));
  check("CI: browser-e2e job present", ciFile.content.includes("browser-e2e"));
  check("CI: api-security job present", ciFile.content.includes("api-security"));
} else {
  check("CI: runs-on", false, "testforge.yml missing");
  check("CI: playwright install", false, "testforge.yml missing");
  check("CI: browser-e2e job", false, "testforge.yml missing");
  check("CI: api-security job", false, "testforge.yml missing");
}

// === PLAYWRIGHT CONFIG ===
console.log("\n--- PLAYWRIGHT CONFIG ---");
const playwrightFile = allFiles.find(f => f.rel === "playwright.config.ts");
if (playwrightFile) {
  check("playwright.config.ts: 2 projects", playwrightFile.content.includes("api-security") && playwrightFile.content.includes("browser-e2e"));
} else {
  check("playwright.config.ts: 2 projects", false, "file missing");
}

// === IDOR: 3 assertions ===
console.log("\n--- IDOR ---");
const idorFile = allFiles.find(f => f.rel === "tests/security/idor.spec.ts");
if (idorFile) {
  const firstBlock = idorFile.content.slice(0, 2000);
  const expectCount = (firstBlock.match(/expect\(/g) || []).length;
  check(`IDOR: >= 3 assertions in first test`, expectCount >= 3, `found ${expectCount}`);
} else {
  check("IDOR: >= 3 assertions", false, "idor.spec.ts missing");
}

// === SUMMARY ===
console.log("\n" + "=".repeat(70));
console.log("ZUSAMMENFASSUNG");
console.log("=".repeat(70));
console.log(`\nBehaviors:              ${behaviors.length}`);
console.log(`API-Security Tests:     ${securityFiles.length + businessFiles.length + complianceFiles.length + integrationFiles.length} Dateien`);
console.log(`Browser-E2E Tests:      ${e2eFiles.length} Dateien`);
console.log(`Total Proofs:           ${proofs.length}`);
console.log(`Helpers:                ${helperFiles.length} Dateien`);
console.log(`ZIP-Größe:              ${sizeKB}KB`);
console.log(`\nChecks bestanden:       ${passed}/${passed + failed}`);
console.log(`Checks fehlgeschlagen:  ${failed}/${passed + failed}`);

if (failed === 0) {
  console.log("\n🎉 ALLE CHECKS BESTANDEN!");
} else {
  console.log(`\n⚠️  ${failed} CHECK(S) FEHLGESCHLAGEN`);
}

console.log("\n" + "=".repeat(70));

// Save summary to file
const summary = {
  behaviors: behaviors.length,
  apiSecurityFiles: securityFiles.length + businessFiles.length + complianceFiles.length + integrationFiles.length,
  browserE2eFiles: e2eFiles.length,
  totalProofs: proofs.length,
  helpers: helperFiles.length,
  zipSizeKB: sizeKB,
  checksPassed: passed,
  checksFailed: failed,
  allFiles: allFiles.map(f => f.rel),
};
writeFileSync(`${OUTPUT_DIR}/medrental-summary.json`, JSON.stringify(summary, null, 2));
console.log(`Summary saved: ${OUTPUT_DIR}/medrental-summary.json`);
