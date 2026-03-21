/**
 * Re-runs the retz analysis (id=30002) and saves the ZIP locally.
 * Usage: npx tsx scripts/rerun-retz.mts
 */
import { storageGet, storagePut } from "../server/storage";
import { runAnalysisJob } from "../server/analyzer";
import archiver from "archiver";

const ANALYSIS_ID = 30002;
const PROJECT_NAME = "retz";

// The spec was uploaded as a text file to S3 with key pattern: specs/{timestamp}-testforge-level5-spec.md.txt
// We need to find it. Let's try to get it from the DB first.
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Get all analyses for retz to find the spec key
  const [rows] = await conn.execute(
    "SELECT id, specFileKey, specFileUrl, specFileName, progressMessage FROM analyses WHERE id = ?",
    [ANALYSIS_ID]
  ) as any;

  const row = rows[0];
  console.log("Analysis row:", row);

  // The specKey was passed to startAnalysisJobFromKey but not stored in DB (bug!)
  // We need to find the spec text another way.
  // Check layer1Json - it has the analysisResult which was built from the spec
  const [layer1Rows] = await conn.execute(
    "SELECT layer1Json FROM analyses WHERE id = ?",
    [ANALYSIS_ID]
  ) as any;

  const layer1 = layer1Rows[0].layer1Json;
  if (!layer1) {
    console.error("No layer1Json found - cannot reconstruct tests");
    await conn.end();
    return;
  }

  const analysisResult = typeof layer1 === "string" ? JSON.parse(layer1) : layer1;
  console.log(`Layer 1: ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints?.length || 0} endpoints`);

  // Get layer2Json (risk model)
  const [layer2Rows] = await conn.execute(
    "SELECT layer2Json FROM analyses WHERE id = ?",
    [ANALYSIS_ID]
  ) as any;

  const layer2 = layer2Rows[0].layer2Json;
  const riskModel = typeof layer2 === "string" ? JSON.parse(layer2) : layer2;
  console.log(`Layer 2: ${riskModel.proofTargets.length} proof targets`);

  await conn.end();

  // Now we have the IR and risk model. We can generate proofs directly.
  // Import the proof generator
  const { generateProofs, runIndependentChecker, validateProofs, generateReport, generateHelpers } = await import("../server/analyzer");

  console.log("Generating proofs from saved IR...");
  const helpers = generateHelpers(analysisResult);
  const rawProofs = await generateProofs(riskModel, analysisResult);
  console.log(`Generated ${rawProofs.length} raw proofs`);

  const { checkedProofs } = await runIndependentChecker(rawProofs, analysisResult);
  console.log(`After independent check: ${checkedProofs.length} proofs`);

  const behaviorIds = analysisResult.ir.behaviors.map((b: any) => b.id);
  const validatedSuite = validateProofs(checkedProofs, behaviorIds);
  console.log(`Validated: ${validatedSuite.proofs.length}, Discarded: ${validatedSuite.discardedProofs.length}`);

  // Generate report
  const llmCheckerStats = { approved: 0, flagged: 0, rejected: 0, avgConfidence: 0 };
  const report = generateReport(analysisResult, riskModel, validatedSuite, PROJECT_NAME, llmCheckerStats);

  // Build ZIP
  const fileMap = new Map<string, string[]>();
  for (const proof of validatedSuite.proofs) {
    if (!fileMap.has(proof.filename)) fileMap.set(proof.filename, []);
    fileMap.get(proof.filename)!.push(proof.code);
  }
  const testFiles = Array.from(fileMap.entries()).map(([filename, codes]) => ({
    filename,
    content: codes.join("\n\n"),
  }));

  console.log(`\nTest files (${testFiles.length}):`);
  testFiles.forEach(f => console.log(` - ${f.filename}`));

  // Save ZIP locally
  const { createWriteStream } = await import("fs");
  const { mkdir } = await import("fs/promises");
  await mkdir("/home/ubuntu/retz-tests", { recursive: true });

  const archive = archiver.default("zip", { zlib: { level: 9 } });
  const output = createWriteStream("/home/ubuntu/retz-tests/testforge-retz-output.zip");

  archive.pipe(output);
  for (const tf of testFiles) {
    archive.append(tf.content, { name: tf.filename });
  }
  archive.append(report, { name: "testforge-report.md" });
  await archive.finalize();
  await new Promise<void>((resolve) => output.on("finish", resolve));

  console.log("\nZIP saved to /home/ubuntu/retz-tests/testforge-retz-output.zip");

  // Also save individual files
  const { writeFile } = await import("fs/promises");
  for (const tf of testFiles) {
    const parts = tf.filename.split("/");
    const dir = "/home/ubuntu/retz-tests/" + parts.slice(0, -1).join("/");
    await mkdir(dir, { recursive: true });
    await writeFile("/home/ubuntu/retz-tests/" + tf.filename, tf.content, "utf-8");
    console.log(`Saved: /home/ubuntu/retz-tests/${tf.filename}`);
  }
  await writeFile("/home/ubuntu/retz-tests/testforge-report.md", report, "utf-8");
  console.log("Saved: /home/ubuntu/retz-tests/testforge-report.md");
}

main().catch(console.error);
