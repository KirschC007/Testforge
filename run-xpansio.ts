/**
 * TestForge Pipeline — Xpansio Backend Code Scan
 * Runs the full analysis pipeline against the Xpansio backend codebase.
 */
import { runAnalysisJob } from "./server/analyzer/job-runner";
import type { CodeFile } from "./server/analyzer/code-parser";
import fs from "fs";
import path from "path";

const CODE_DIR = "/tmp/xpansio/xpansio-final-export/server";
const OUTPUT_DIR = "/home/ubuntu/testforge-xpansio-v9";
const LOG_FILE = "/tmp/xpansio-v9-run.log";

// Redirect console to log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });
const origLog = console.log.bind(console);
const origErr = console.error.bind(console);
console.log = (...args) => { origLog(...args); logStream.write(args.join(" ") + "\n"); };
console.error = (...args) => { origErr(...args); logStream.write("[ERR] " + args.join(" ") + "\n"); };

async function main() {
  console.log("[Xpansio] Starting TestForge pipeline against Xpansio backend code...");
  const t0 = Date.now();

  // Read all relevant server files
  const codeFiles: Record<string, string> = {};
  const filesToScan = [
    "routers.ts",
    "adminUsers.ts",
    "xpansio-db.ts",
    "angebotProcessor.ts",
    "cron.ts",
    "_core/index.ts",
    "integrations.ts",
    "db.ts",
  ];

  for (const f of filesToScan) {
    const fullPath = path.join(CODE_DIR, f);
    if (fs.existsSync(fullPath)) {
      codeFiles[f] = fs.readFileSync(fullPath, "utf-8");
      console.log(`[Xpansio] Loaded ${f} (${codeFiles[f].length} chars)`);
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Convert codeFiles dict to CodeFile[] array
  const codeFileArray: CodeFile[] = Object.entries(codeFiles).map(([filePath, content]) => ({
    path: filePath,
    content,
  }));

  const result = await runAnalysisJob(
    "", // no spec text — pure code scan
    "xpansio-backend",
    async (layer, message) => {
      console.log(`[Progress] Layer ${layer}: ${message}`);
    },
    undefined, // no industry pack
    {
      codeFiles: codeFileArray,
    }
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const behaviors = result.analysisResult?.ir?.behaviors?.length ?? 0;
  const endpoints = result.analysisResult?.ir?.apiEndpoints?.length ?? 0;
  const proofTargets = result.riskModel?.proofTargets?.length ?? 0;
  const testFileCount = result.testFiles?.length ?? 0;
  const checker = result.llmCheckerStats;

  console.log("\n[Xpansio] ===== PIPELINE COMPLETE =====");
  console.log(`[Xpansio] Elapsed: ${elapsed}s`);
  console.log(`[Xpansio] Behaviors: ${behaviors}`);
  console.log(`[Xpansio] Endpoints: ${endpoints}`);
  console.log(`[Xpansio] ProofTargets: ${proofTargets}`);
  console.log(`[Xpansio] TestFiles: ${testFileCount}`);
  console.log(`[Xpansio] LLM Checker: ${checker?.approved ?? 0} approved / ${checker?.flagged ?? 0} flagged / ${checker?.rejected ?? 0} rejected`);
  console.log(`[Xpansio] Files written to: ${OUTPUT_DIR}`);

  // Write all test files to disk
  for (const tf of result.testFiles || []) {
    const outPath = path.join(OUTPUT_DIR, tf.filename);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, tf.content);
  }

  // Write helpers
  const helpers = result.helpers as Record<string, string>;
  if (helpers) {
    for (const [filename, content] of Object.entries(helpers)) {
      if (typeof content === "string") {
        const outPath = path.join(OUTPUT_DIR, filename);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, content);
      }
    }
  }

  // Write extended suite
  const ext = result.extendedSuite as any;
  if (ext?.files) {
    for (const f of ext.files) {
      const outPath = path.join(OUTPUT_DIR, f.filename);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, f.content);
    }
  }

  // Write summary
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "pipeline-summary.json"),
    JSON.stringify({ elapsed, behaviors, endpoints, proofTargets, testFiles: testFileCount, checkerStats: checker, outputDir: OUTPUT_DIR }, null, 2)
  );

  // List all output files
  const allFiles = fs.readdirSync(OUTPUT_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(f => path.join(OUTPUT_DIR, f))
    .filter(f => fs.statSync(f).isFile());
  console.log(`\n[Xpansio] Output files (${allFiles.length}):`);
  allFiles.forEach(f => console.log(f));
}

main().catch(e => {
  console.error("[Xpansio] FATAL:", e);
  process.exit(1);
});
