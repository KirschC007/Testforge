/**
 * Enterprise Hardening Pipeline v2
 * Runs the full TestForge pipeline against enterprise-hardening-spec-v2.md
 * and writes the output to /home/ubuntu/testforge-enterprise-v2/
 */
import { runAnalysisJob } from "./server/analyzer/job-runner";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEC_PATH = path.join(__dirname, "enterprise-hardening-spec-v2.md");
const OUT_DIR = "/home/ubuntu/testforge-enterprise-v2";
const LOG_FILE = "/tmp/enterprise-v2.log";

const logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });
const origLog = console.log.bind(console);
const origWarn = console.warn.bind(console);
console.log = (...args: unknown[]) => { origLog(...args); logStream.write(args.join(" ") + "\n"); };
console.warn = (...args: unknown[]) => { origWarn(...args); logStream.write("[WARN] " + args.join(" ") + "\n"); };

async function main() {
  const specText = fs.readFileSync(SPEC_PATH, "utf-8");

  console.log(`[Enterprise v2] Starting pipeline — spec: ${SPEC_PATH}`);
  console.log(`[Enterprise v2] Output: ${OUT_DIR}`);
  console.log(`[Enterprise v2] Spec length: ${specText.length} chars`);

  const t0 = Date.now();

  const result = await runAnalysisJob(
    specText,
    "BankCore-Enterprise-v2",
    (layer, message) => {
      console.log(`[Progress] Layer ${layer}: ${message}`);
    }
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const { analysisResult, riskModel, testFiles, helpers, llmCheckerStats, extendedSuite } = result;

  console.log(`\n[Enterprise v2] ===== PIPELINE COMPLETE =====`);
  console.log(`[Enterprise v2] Elapsed: ${elapsed}s`);
  console.log(`[Enterprise v2] Behaviors: ${analysisResult.ir.behaviors.length}`);
  console.log(`[Enterprise v2] Endpoints: ${analysisResult.ir.apiEndpoints.length}`);
  console.log(`[Enterprise v2] ProofTargets: ${riskModel.proofTargets.length}`);
  console.log(`[Enterprise v2] TestFiles: ${testFiles.length}`);
  console.log(`[Enterprise v2] LLM Checker: ${llmCheckerStats.approved} approved / ${llmCheckerStats.flagged} flagged / ${llmCheckerStats.rejected} rejected`);

  // Write all test files
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const file of testFiles) {
    const fullPath = path.join(OUT_DIR, file.filename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content);
  }

  // Write helpers — keys are either "auth", "api" etc. or full paths like "helpers/auth.ts"
  for (const [name, content] of Object.entries(helpers)) {
    if (typeof content === "string") {
      // If name already contains a path separator or extension, use as-is relative to OUT_DIR
      const filePath = name.includes("/") || name.includes(".")
        ? path.join(OUT_DIR, name)
        : path.join(OUT_DIR, "helpers", `${name}.ts`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
  }

  // Write extended suite files
  if (extendedSuite?.files) {
    for (const file of extendedSuite.files) {
      const fullPath = path.join(OUT_DIR, file.filename);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content);
    }
  }

  // Write playwright config
  const pwConfig = `import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: { baseURL: process.env.BASE_URL || "http://localhost:3000" },
});
`;
  fs.writeFileSync(path.join(OUT_DIR, "playwright.config.ts"), pwConfig);

  // Write summary
  const summary = {
    elapsed,
    behaviors: analysisResult.ir.behaviors.length,
    endpoints: analysisResult.ir.apiEndpoints.length,
    proofTargets: riskModel.proofTargets.length,
    testFiles: testFiles.length,
    checkerStats: llmCheckerStats,
    outputDir: OUT_DIR,
  };
  fs.writeFileSync(path.join(OUT_DIR, "pipeline-summary.json"), JSON.stringify(summary, null, 2));
  console.log(`[Enterprise v2] Files written to: ${OUT_DIR}`);

  logStream.end();
}

main().catch(err => {
  console.error("[Enterprise v2] FATAL:", err);
  logStream.end();
  process.exit(1);
});
