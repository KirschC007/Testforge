import { runAnalysisJob } from "./server/analyzer/job-runner.js";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "/home/ubuntu/testforge-hey-listen-output";
const LOG_FILE = "/tmp/hey-listen-pipeline.log";

// Redirect console to log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });
const origLog = console.log;
const origError = console.error;
console.log = (...args) => { origLog(...args); logStream.write(args.join(" ") + "\n"); };
console.error = (...args) => { origError(...args); logStream.write("[ERR] " + args.join(" ") + "\n"); };

const codeContent = fs.readFileSync("/tmp/hey-listen-combined.ts", "utf-8");

const start = Date.now();
console.log("[TestForge] Starting hey-listen pipeline...");

const result = await runAnalysisJob(
  "",  // no spec — code-only mode
  "hey-listen",
  undefined,
  undefined,
  { codeFiles: [{ filename: "routes/index.js", content: codeContent }] }
);

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`[TestForge] Done in ${elapsed}s`);
const behaviors = result.analysisResult?.behaviors ?? [];
const proofTargets = result.riskModel?.proofTargets ?? [];
const staticFindings = (result as any).staticFindings ?? [];
console.log(`[TestForge] Behaviors: ${behaviors.length}`);
console.log(`[TestForge] ProofTargets: ${proofTargets.length}`);
console.log(`[TestForge] Static Findings: ${staticFindings.length}`);

// Write output files
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUTPUT_DIR, "tests"), { recursive: true });
fs.mkdirSync(path.join(OUTPUT_DIR, "helpers"), { recursive: true });

// Write test files
for (const tf of result.testFiles ?? []) {
  const fullPath = path.join(OUTPUT_DIR, tf.filename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, tf.content, "utf-8");
}

// Write helpers
const helpers = result.helpers ?? {};
for (const [key, content] of Object.entries(helpers)) {
  if (typeof content === 'string' && content.length > 0) {
    const filename = key.endsWith('.ts') ? key : `helpers/${key}.ts`;
    const fullPath = path.join(OUTPUT_DIR, filename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
}

// Write playwright.config.ts
const pwConfig = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
});
`;
fs.writeFileSync(path.join(OUTPUT_DIR, "playwright.config.ts"), pwConfig);

// Write package.json
const pkg = {
  name: "hey-listen-tests",
  version: "1.0.0",
  scripts: { test: "playwright test" },
  dependencies: { "@playwright/test": "^1.44.0", "axios": "^1.7.0" }
};
fs.writeFileSync(path.join(OUTPUT_DIR, "package.json"), JSON.stringify(pkg, null, 2));

// Write static findings report
if (staticFindings.length) {
  const report = staticFindings.map((f: any) => `[${f.severity}] ${f.rule}: ${f.message}\n  File: ${f.file}:${f.line}\n  Fix: ${f.fix}`).join("\n\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "static-findings.txt"), report);
  console.log(`[TestForge] Static findings written to static-findings.txt`);
}

// Write pipeline summary
const summary = {
  elapsed: `${elapsed}s`,
  behaviors: behaviors.length,
  proofTargets: proofTargets.length,
  staticFindings: staticFindings.length,
  testFiles: (result.testFiles ?? []).length,
  helperFiles: Object.keys(result.helpers ?? {}).length,
};
fs.writeFileSync(path.join(OUTPUT_DIR, "pipeline-summary.json"), JSON.stringify(summary, null, 2));
console.log("[TestForge] Summary:", JSON.stringify(summary));
