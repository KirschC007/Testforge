#!/usr/bin/env node
// S1-1: Smart Parser gegen hey-listen Spec testen
// Usage: node test_smart_parser_live.mjs [spec-file]

import { readFileSync, writeFileSync } from "fs";
import { parseSpecSmart } from "./server/analyzer/smart-parser.js";

const specFile = process.argv[2] || "hey-listen-spec.txt";
let spec;
try {
  spec = readFileSync(specFile, "utf-8");
} catch (e) {
  console.error(`Cannot read spec file: ${specFile}`);
  process.exit(1);
}

console.log(`\n[S1-1] Smart Parser Live Test`);
console.log(`Spec file: ${specFile} (${Math.round(spec.length / 1024)}KB)`);
console.log(`Starting 3-pass analysis...\n`);

const t0 = Date.now();
const result = await parseSpecSmart(spec);
const elapsed = Date.now() - t0;

// Save full IR for inspection
writeFileSync("ir-output.json", JSON.stringify(result, null, 2));
console.log(`\n[S1-1] IR saved to ir-output.json`);

// Quality Report
const ir = result.ir;
const behaviors = ir.behaviors || [];
const endpoints = ir.apiEndpoints || [];
const transitions = ir.statusMachine?.transitions || [];
const states = ir.statusMachine?.states || [];
const enums = ir.enums || {};
const cronJobs = ir.cronJobs || [];
const featureGates = ir.featureGates || [];
const flows = ir.flows || [];

const behaviorsWithSideEffects = behaviors.filter(b => b.structuredSideEffects?.length > 0);
const behaviorsWithErrorCodes = behaviors.filter(b => b.errorCodes?.length > 0);

console.log(`\n=== QUALITY REPORT (${elapsed}ms) ===`);
console.log(`Behaviors:                    ${behaviors.length}  (min: 80, good: 120, excellent: 150+)`);
console.log(`Endpoints:                    ${endpoints.length}  (min: 30, good: 50, excellent: 70+)`);
console.log(`Status Machine States:        ${states.length}`);
console.log(`Status Transitions:           ${transitions.length}  (min: 8, good: 10, excellent: 15+)`);
console.log(`Enums:                        ${Object.keys(enums).length}`);
console.log(`Behaviors w/ sideEffects:     ${behaviorsWithSideEffects.length}  (min: 10, good: 25, excellent: 40+)`);
console.log(`Behaviors w/ errorCodes:      ${behaviorsWithErrorCodes.length}  (min: 5, good: 15, excellent: 25+)`);
console.log(`CronJobs:                     ${cronJobs.length}  (min: 3, good: 8, excellent: 15+)`);
console.log(`FeatureGates:                 ${featureGates.length}`);
console.log(`Flows:                        ${flows.length}`);
console.log(`Spec Health Score:            ${result.specHealth?.score ?? "N/A"}/100`);

// Grade each metric
function grade(val, min, good, excellent) {
  if (val >= excellent) return "EXCELLENT ✅";
  if (val >= good) return "GOOD ✅";
  if (val >= min) return "MINIMUM ⚠️";
  return "BELOW MINIMUM ❌";
}

console.log(`\n=== GRADES ===`);
console.log(`Behaviors:        ${grade(behaviors.length, 80, 120, 150)}`);
console.log(`Endpoints:        ${grade(endpoints.length, 30, 50, 70)}`);
console.log(`Transitions:      ${grade(transitions.length, 8, 10, 15)}`);
console.log(`SideEffects:      ${grade(behaviorsWithSideEffects.length, 10, 25, 40)}`);
console.log(`ErrorCodes:       ${grade(behaviorsWithErrorCodes.length, 5, 15, 25)}`);
console.log(`CronJobs:         ${grade(cronJobs.length, 3, 8, 15)}`);

// Sample output
if (behaviors.length > 0) {
  console.log(`\n=== SAMPLE BEHAVIORS (first 3) ===`);
  behaviors.slice(0, 3).forEach((b, i) => {
    console.log(`[${i+1}] ${b.title}`);
    console.log(`    Tags: ${b.tags?.join(", ") || "none"}`);
    console.log(`    SideEffects: ${b.structuredSideEffects?.length || 0}`);
    console.log(`    ErrorCodes: ${b.errorCodes?.join(", ") || "none"}`);
  });
}

if (transitions.length > 0) {
  console.log(`\n=== STATUS TRANSITIONS ===`);
  transitions.forEach(t => console.log(`  ${t.from} → ${t.to}`));
}

if (cronJobs.length > 0) {
  console.log(`\n=== CRON JOBS ===`);
  cronJobs.forEach(c => console.log(`  ${c.name}: ${c.schedule}`));
}

// Overall verdict
const scores = [
  behaviors.length >= 80,
  endpoints.length >= 30,
  transitions.length >= 8,
  behaviorsWithSideEffects.length >= 10,
  behaviorsWithErrorCodes.length >= 5,
  cronJobs.length >= 3,
];
const passed = scores.filter(Boolean).length;
console.log(`\n=== OVERALL: ${passed}/${scores.length} checks passed ===`);
if (passed >= 5) console.log("✅ Smart Parser funktioniert korrekt");
else if (passed >= 3) console.log("⚠️  Smart Parser funktioniert teilweise — Prompts debuggen");
else console.log("❌ Smart Parser Prompts müssen überarbeitet werden");
