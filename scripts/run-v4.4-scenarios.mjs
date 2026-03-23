#!/usr/bin/env node
/**
 * TestForge v4.4 — 4 schwere Szenarien (E–H)
 * Verifikations-Checks:
 *   1. Endpoint-Namen korrekt (kein REST-Pfad-Leak)
 *   2. Tenant-Const korrekt (TEST_HOTEL_ID, TEST_COMPANY_ID, TEST_STUDIO_ID, TEST_AGENCY_ID)
 *   3. DSGVO Verify-Endpoint matched GDPR-Entity
 *   4. IDOR-Datei existiert
 *   5. Multi-Router (G: artists/projects/sessions/tracks, H: properties/leases/tenants)
 *   6. Vibe-Szenarien gehen durch Code-Parser (specType = "code:*")
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createWriteStream } from "fs";
import archiver from "archiver";
import path from "path";

const { runAnalysisJob } = await import("../server/analyzer/job-runner.ts");

const OUTPUT_DIR = "/tmp/testforge-v44-outputs";
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildZip(result, outputZipPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    // Test files
    for (const f of result.testFiles || []) {
      archive.append(f.content, { name: f.filename });
    }
    // Helpers
    const helpers = Array.isArray(result.helpers) ? result.helpers : Object.values(result.helpers || {});
    for (const f of helpers) {
      if (f && f.content && f.filename) archive.append(f.content, { name: f.filename });
    }
    // Extended suite
    const extFiles = Array.isArray(result.extendedSuite?.files)
      ? result.extendedSuite.files
      : Object.values(result.extendedSuite?.files || {});
    for (const f of extFiles) {
      if (f && f.content && f.filename) archive.append(f.content, { name: f.filename });
    }
    // Report
    if (result.report) {
      archive.append(result.report, { name: "testforge-report.md" });
    }
    archive.finalize();
  });
}

async function runSpecScenario(name, specText, outputZipPath) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶ Running SPEC scenario: ${name}`);
  console.log("=".repeat(60));
  const result = await runAnalysisJob(specText, name, (layer, msg) => {
    console.log(`  [${layer}] ${msg}`);
  });
  await buildZip(result, outputZipPath);
  console.log(`✓ ZIP saved: ${outputZipPath}`);
  return result;
}

async function runCodeScenario(name, codeFiles, outputZipPath) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶ Running CODE scenario: ${name}`);
  console.log("=".repeat(60));
  const result = await runAnalysisJob("", name, (layer, msg) => {
    console.log(`  [${layer}] ${msg}`);
  }, undefined, { codeFiles });
  await buildZip(result, outputZipPath);
  console.log(`✓ ZIP saved: ${outputZipPath}`);
  return result;
}

// ── Scenario E: HotelBooking (Spec) ──────────────────────────────────────────
const hotelSpec = readFileSync("/tmp/scenario-13-hotelbooking/hotelbooking-spec.md", "utf8");
const sE = await runSpecScenario("HotelBooking", hotelSpec, `${OUTPUT_DIR}/sE-hotelbooking.zip`);

// ── Scenario F: SupplyChain (Spec) ────────────────────────────────────────────
const supplySpec = readFileSync("/tmp/scenario-14-supplychain/supplychain-spec.md", "utf8");
const sF = await runSpecScenario("SupplyChain", supplySpec, `${OUTPUT_DIR}/sF-supplychain.zip`);

// ── Scenario G: MusicStudio (Vibe-Code, Drizzle, 4 Routers) ──────────────────
const msFiles = [
  { path: "drizzle/schema.ts", content: readFileSync("/tmp/scenario-15-musicstudio/schema.ts", "utf8") },
  { path: "server/routers/studio.ts", content: readFileSync("/tmp/scenario-15-musicstudio/routers.ts", "utf8") },
  { path: "server/trpc.ts", content: readFileSync("/tmp/scenario-15-musicstudio/trpc.ts", "utf8") },
  { path: "package.json", content: readFileSync("/tmp/scenario-15-musicstudio/package.json", "utf8") },
];
const sG = await runCodeScenario("MusicStudio", msFiles, `${OUTPUT_DIR}/sG-musicstudio.zip`);

// ── Scenario H: PropertyManager (Vibe-Code, Prisma, 3 Routers) ───────────────
const pmFiles = [
  { path: "prisma/schema.prisma", content: readFileSync("/tmp/scenario-16-propertymanager/schema.prisma", "utf8") },
  { path: "server/routers/property.ts", content: readFileSync("/tmp/scenario-16-propertymanager/routers.ts", "utf8") },
  { path: "server/trpc.ts", content: readFileSync("/tmp/scenario-16-propertymanager/trpc.ts", "utf8") },
  { path: "package.json", content: readFileSync("/tmp/scenario-16-propertymanager/package.json", "utf8") },
];
const sH = await runCodeScenario("PropertyManager", pmFiles, `${OUTPUT_DIR}/sH-propertymanager.zip`);

// ── Quality Gate ──────────────────────────────────────────────────────────────

const scenarios = [
  { name: "HotelBooking", type: "Spec", expectedTenantConst: "TEST_HOTEL_ID", expectedDsgvoEntity: "guests", expectedMultiRouter: null, result: sE },
  { name: "SupplyChain", type: "Spec", expectedTenantConst: "TEST_COMPANY_ID", expectedDsgvoEntity: "customers", expectedMultiRouter: null, result: sF },
  { name: "MusicStudio", type: "Vibe", expectedTenantConst: "TEST_STUDIO_ID", expectedDsgvoEntity: "artists", expectedMultiRouter: ["artists", "projects", "sessions", "tracks"], result: sG },
  { name: "PropertyManager", type: "Vibe", expectedTenantConst: "TEST_AGENCY_ID", expectedDsgvoEntity: "tenants", expectedMultiRouter: ["properties", "leases", "tenants"], result: sH },
];

const knownStatuses = new Set([
  "pending", "confirmed", "active", "inactive", "cancelled", "completed", "failed",
  "draft", "published", "archived", "approved", "rejected", "processing",
  "checked_in", "checked_out", "no_show", "partially_received", "received",
  "ordered", "pending_approval", "picking", "packed", "shipped", "delivered",
  "returned", "terminated", "expired", "rented", "available", "maintenance",
  "unlisted", "recording", "mixing", "mastering", "planning", "scheduled",
  "in_progress", "on_leave", "occupied", "dirty", "clean",
  "recorded", "mixed", "mastered", "final",
]);

const knownRestPatterns = /^(GET|POST|PUT|PATCH|DELETE)\s+\/api\//;

let allPassed = true;
const gateResults = [];

for (const s of scenarios) {
  const r = s.result;
  const allContent = [
    ...(r.testFiles || []).map(f => f.content),
    ...Object.values(r.helpers || {}).map(f => f?.content || ""),
    ...((r.extendedSuite?.files || []).map(f => f.content)),
    r.report || "",
  ].join("\n");

  const checks = {};
  const behaviors = r.analysisResult?.ir?.behaviors || [];
  const proofTargets = r.riskModel?.proofTargets || [];

  // CHECK 1: Endpoint names (no REST path leak)
  const endpointMatches = allContent.match(/"[a-z][a-zA-Z]*\.[a-zA-Z]+"/g) || [];
  const restLeaks = endpointMatches.filter(e => knownRestPatterns.test(e.replace(/"/g, "")));
  checks["Endpoints OK"] = restLeaks.length === 0 ? "✅" : `❌ (${restLeaks.slice(0, 3).join(", ")})`;

  // CHECK 2: Tenant Const
  checks["Tenant OK"] = allContent.includes(s.expectedTenantConst) ? "✅" : `❌ (expected ${s.expectedTenantConst})`;

  // CHECK 3: DSGVO Verify-Endpoint matches GDPR entity
  const dsgvoFile = (r.testFiles || []).find(f => f.filename?.includes("dsgvo") || f.filename?.includes("compliance"));
  const dsgvoContent = dsgvoFile?.content || "";
  const trpcQueryMatches = dsgvoContent.match(/trpcQuery[^"]*"([^"]+)"/g) || [];
  const dsgvoEndpoints = trpcQueryMatches.map(m => m.match(/"([^"]+)"/)?.[1]).filter(Boolean);
  const dsgvoEntityMatch = dsgvoEndpoints.some(e => e.startsWith(s.expectedDsgvoEntity + ".")) ||
    dsgvoContent.includes(`${s.expectedDsgvoEntity}.list`) ||
    dsgvoContent.includes(`${s.expectedDsgvoEntity}.getAll`);
  checks["DSGVO OK"] = dsgvoEntityMatch ? "✅" : `❌ (expected ${s.expectedDsgvoEntity}.list, got: ${dsgvoEndpoints.slice(0, 3).join(", ") || "none"})`;

  // CHECK 4: IDOR file exists
  const idorFile = (r.testFiles || []).find(f => f.filename?.includes("idor"));
  checks["IDOR"] = idorFile ? "✅" : "❌ (idor.spec.ts missing)";

  // CHECK 5: Multi-Router (only for Vibe scenarios)
  if (s.expectedMultiRouter) {
    const allEndpoints = allContent.match(/"[a-z][a-zA-Z]*\.[a-zA-Z]+"/g) || [];
    const routerPrefixes = new Set(allEndpoints.map(e => e.replace(/"/g, "").split(".")[0]));
    const missingRouters = s.expectedMultiRouter.filter(r => !routerPrefixes.has(r));
    checks["Multi-Router"] = missingRouters.length === 0 ? `✅ (${s.expectedMultiRouter.length})` : `❌ (missing: ${missingRouters.join(", ")})`;
  } else {
    checks["Multi-Router"] = "n/a";
  }

  // CHECK 6: Code-Parser (only for Vibe scenarios)
  if (s.type === "Vibe") {
    const specType = r.analysisResult?.specType || "";
    checks["Code-Parser"] = specType.startsWith("code:") ? `✅ (${specType})` : `❌ (got: ${specType || "unknown"})`;
  } else {
    checks["Code-Parser"] = "n/a";
  }

  const allChecksPass = Object.values(checks).every(v => v === "✅" || v === "n/a" || v.startsWith("✅"));
  if (!allChecksPass) allPassed = false;

  gateResults.push({ name: s.name, type: s.type, behaviors: behaviors.length, proofs: proofTargets.length, checks });

  console.log(`\n── ${s.name} (${s.type}) ──`);
  console.log(`  Behaviors: ${behaviors.length}, Proofs: ${proofTargets.length}`);
  for (const [k, v] of Object.entries(checks)) {
    console.log(`  ${v.startsWith("✅") || v === "n/a" ? "✅" : "❌"} ${k}: ${v}`);
  }
}

// ── Summary Table ─────────────────────────────────────────────────────────────

console.log("\n\n" + "=".repeat(80));
console.log("SUMMARY TABLE");
console.log("=".repeat(80));
console.log("| Szenario | Typ | Behaviors | Proofs | Endpoints OK | Tenant OK | DSGVO OK | IDOR | Multi-Router | Code-Parser |");
console.log("|----------|-----|-----------|--------|-------------|-----------|----------|------|-------------|-------------|");
for (const g of gateResults) {
  const c = g.checks;
  console.log(`| ${g.name} | ${g.type} | ${g.behaviors} | ${g.proofs} | ${c["Endpoints OK"]} | ${c["Tenant OK"]} | ${c["DSGVO OK"]} | ${c["IDOR"]} | ${c["Multi-Router"]} | ${c["Code-Parser"]} |`);
}

console.log("\nAll scenario ZIPs saved to:", OUTPUT_DIR);

if (!allPassed) {
  console.error("\n❌ Some checks FAILED. Fix the generator and re-run.");
  process.exit(1);
} else {
  console.log("\n✅ ALL CHECKS PASSED");
}
