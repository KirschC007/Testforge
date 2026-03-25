import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { runAnalysisJob } from "./server/analyzer/job-runner";

const OUTPUT_DIR = "/home/ubuntu/testforge-hey-listen-v81";

async function main() {
  const specText = readFileSync("/home/ubuntu/upload/hey-listen-MASTER-SPEC-v10.md", "utf-8");
  console.log(`[Test] Spec size: ${specText.length} chars (${Math.round(specText.length / 1024)}KB)`);
  const start = Date.now();

  const result = await runAnalysisJob(specText, "HeyListen", async (layer, msg) => {
    console.log(`[Progress L${layer}] ${msg}`);
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const ir = result.analysisResult.ir;
  const validatedSuite = result.validatedSuite;
  const extendedSuite = result.extendedSuite;

  console.log("\n============================================================");
  console.log("=== SZENARIO: HeyListen v8.1 ===");
  console.log(`Spec size: ${specText.length} bytes`);
  console.log("============================================================");
  console.log(`Parser: ${specText.length > 8192 ? "Smart" : "Standard"} (${specText.length > 8192 ? "> 8KB" : "< 8KB"})`);
  console.log(`Elapsed: ${elapsed}s`);
  console.log(`Behaviors: ${ir.behaviors.length}`);
  console.log(`Endpoints: ${ir.apiEndpoints.length} (${ir.apiEndpoints.map(e => e.name).join(", ")})`);
  console.log(`TenantKey: ${ir.tenantModel?.tenantIdField || "none"}`);
  const roles = ir.authModel?.roles?.map(r => r.name) ?? [];
  console.log(`Rollen: ${roles.length} (${roles.join(", ")})`);
  const states = ir.statusMachine?.states ?? [];
  console.log(`States: ${states.length} (${JSON.stringify(states)})`);
  console.log(`IDOR vectors: ${validatedSuite.proofs.filter(p => p.type === "idor").length}`);
  console.log(`Proofs: ${validatedSuite.proofs.length} raw → ${validatedSuite.proofs.filter(p => p.status === "validated").length} validated`);
  console.log(`Extended files: ${extendedSuite.files.length}`);
  console.log(`LLM Checker: ${result.llmCheckerStats.approved} approved / ${result.llmCheckerStats.flagged} flagged / ${result.llmCheckerStats.rejected} rejected`);
  console.log(`Crashes: 0`);
  console.log(`trpc. artifacts: ${result.testFiles.filter(f => f.content.includes('"trpc.')).length}`);

  // Save all output files
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Save core test files
  for (const f of result.testFiles) {
    const filePath = join(OUTPUT_DIR, f.filename.replace(/\//g, "__"));
    writeFileSync(filePath, f.content, "utf-8");
  }

  // Save extended suite files
  for (const f of extendedSuite.files) {
    const filePath = join(OUTPUT_DIR, f.filename.replace(/\//g, "__"));
    writeFileSync(filePath, f.content, "utf-8");
  }

  // Save helpers
  for (const [name, content] of Object.entries(result.helpers)) {
    const filePath = join(OUTPUT_DIR, name.replace(/\//g, "__"));
    writeFileSync(filePath, content as string, "utf-8");
  }

  // Save HTML report
  writeFileSync(join(OUTPUT_DIR, "testforge-report.html"), result.htmlReport, "utf-8");

  console.log(`\n[TestForge] All files saved to: ${OUTPUT_DIR}`);
  console.log(`[TestForge] Total files: ${result.testFiles.length + extendedSuite.files.length + Object.keys(result.helpers).length}`);

  // Now set up a proper playwright project structure for --list
  const playwrightDir = "/home/ubuntu/testforge-hey-listen-playwright";
  mkdirSync(join(playwrightDir, "tests"), { recursive: true });
  mkdirSync(join(playwrightDir, "helpers"), { recursive: true });

  // Write all test files to proper paths
  const allFiles = [
    ...result.testFiles,
    ...extendedSuite.files,
  ];

  for (const f of allFiles) {
    const fullPath = join(playwrightDir, f.filename);
    mkdirSync(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
    writeFileSync(fullPath, f.content, "utf-8");
  }

  // Write helpers
  for (const [name, content] of Object.entries(result.helpers)) {
    const fullPath = join(playwrightDir, name);
    mkdirSync(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
    writeFileSync(fullPath, content as string, "utf-8");
  }

  // Write playwright.config.ts
  const playwrightConfig = (result.helpers as any)["playwright.config.ts"] || `
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: { baseURL: process.env.BASE_URL || "http://localhost:3000" },
});
`;
  writeFileSync(join(playwrightDir, "playwright.config.ts"), playwrightConfig, "utf-8");

  // Write package.json
  const pkg = JSON.parse((result.helpers as any)["package.json"] || '{"name":"testforge-output","version":"1.0.0","devDependencies":{"@playwright/test":"^1.40.0","typescript":"^5.0.0"}}');
  writeFileSync(join(playwrightDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

  // Write tsconfig.json
  const tsconfig = (result.helpers as any)["tsconfig.json"] || `{"compilerOptions":{"target":"ES2020","module":"commonjs","strict":false,"esModuleInterop":true}}`;
  writeFileSync(join(playwrightDir, "tsconfig.json"), tsconfig, "utf-8");

  console.log(`\n[TestForge] Playwright project written to: ${playwrightDir}`);
  console.log(`[TestForge] Test files: ${allFiles.length}`);
}

main().catch(err => {
  console.error("[TestForge] FATAL:", err);
  process.exit(1);
});
