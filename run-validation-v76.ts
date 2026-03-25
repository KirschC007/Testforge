/**
 * Validierung v7.6 — Pipeline-Runner
 * Jagt PetClinic + LogisticsHub durch die Pipeline und gibt RAW Output zurück.
 */
import fs from "fs";
import path from "path";
import { runAnalysisJob } from "./server/analyzer/job-runner";

async function runScenario(name: string, specFile: string) {
  const specText = fs.readFileSync(path.resolve(specFile), "utf-8");
  const specBytes = Buffer.byteLength(specText, "utf-8");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== SZENARIO: ${name} ===`);
  console.log(`Spec size: ${specBytes} bytes`);
  console.log(`${"=".repeat(60)}`);

  const startTime = Date.now();

  try {
    const result = await runAnalysisJob(
      specText,
      name,
      (_layer: string, _message: string) => {
        // suppress progress output
      },
      undefined // no industry pack
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Extract key metrics
    const ir = result.analysisResult?.ir;

    // testFiles is Array<{filename: string, content: string}>
    const testFilesArr: Array<{ filename: string; content: string }> = result.testFiles ?? [];
    const fileNames = testFilesArr.map((f) => f.filename);

    // Build a map for easy lookup
    const textFiles: Record<string, string> = {};
    for (const { filename, content } of testFilesArr) {
      textFiles[filename] = content;
    }

    // Also include extended suite files
    const extendedFilesArr: Array<{ filename: string; content: string }> =
      result.extendedSuite?.files ?? [];
    const extendedFileNames = extendedFilesArr.map((f) => f.filename);
    const allFiles: Record<string, string> = { ...textFiles };
    for (const { filename, content } of extendedFilesArr) {
      allFiles[filename] = content;
    }

    // Count proofs (it/test calls) in core test files
    let rawProofs = 0;
    for (const content of Object.values(textFiles)) {
      const matches = content.match(/\bit\s*\(|\btest\s*\(/g);
      if (matches) rawProofs += matches.length;
    }
    // Also count in extended files
    let extendedProofs = 0;
    for (const content of Object.values(allFiles)) {
      const matches = content.match(/\bit\s*\(|\btest\s*\(/g);
      if (matches) extendedProofs += matches.length;
    }

    // Count IDOR assertions in all files
    let idorCount = 0;
    for (const [fname, content] of Object.entries(allFiles)) {
      if (fname.includes("idor") || fname.includes("auth")) {
        const matches = content.match(/expect|assert/g);
        if (matches) idorCount += matches.length;
      }
    }

    // Count browser E2E files (extended suite)
    const browserFiles = extendedFileNames.filter(
      (f) => f.includes("e2e") || f.includes("browser") || f.includes("playwright")
    );

    // Count trpc artifacts in ALL files
    let trpcArtifacts = 0;
    for (const content of Object.values(allFiles)) {
      const matches = content.match(/"trpc\.\w+"/g);
      if (matches) trpcArtifacts += matches.length;
    }

    // Endpoints from IR
    const endpoints = ir?.apiEndpoints?.map((e: any) => e.name ?? e.path) ?? [];
    const uniqueEndpoints = [...new Set(endpoints)].sort();

    // Cookie functions from auth-matrix
    const authMatrixKey = Object.keys(allFiles).find((k) =>
      k.includes("auth-matrix")
    );
    const cookieFunctions: string[] = [];
    if (authMatrixKey) {
      const matches = allFiles[authMatrixKey].match(/get\w+Cookie/g) ?? [];
      cookieFunctions.push(...[...new Set(matches)].sort());
    }

    // States
    const states = ir?.statusMachine?.states ?? [];

    // Roles
    const roles = ir?.authModel?.roles?.map((r: any) => r.name ?? r) ?? [];

    // Tenant
    const tenantKey = ir?.tenantModel?.tenantIdField ?? "none";

    // Core vs extended files
    const coreFiles = fileNames;
    const extFiles = extendedFileNames;

    // LLM checker stats
    const llmStats = result.llmCheckerStats;

    // Determine parser
    let parserUsed = "Standard";
    if (specBytes > 50000) parserUsed = "Decomposed";
    else if (specBytes > 8000) parserUsed = "Smart";

    console.log(`Parser: ${parserUsed}`);
    console.log(`Elapsed: ${elapsed}s`);
    console.log(`Behaviors: ${ir?.behaviors?.length ?? "?"}`);
    console.log(`Endpoints: ${uniqueEndpoints.length} (${uniqueEndpoints.join(", ")})`);
    console.log(`TenantKey: ${tenantKey}`);
    console.log(`Rollen: ${roles.length} (${roles.join(", ")})`);
    console.log(`States: ${states.length} (${states.join(", ")})`);
    console.log(`IDOR: ${idorCount} assertions`);
    console.log(`Proofs: ${rawProofs} raw (core) → ${extendedProofs} total (incl. extended)`);
    console.log(`Test files: ${coreFiles.length} core + ${extFiles.length} extended`);
    console.log(`Crashes: 0`);
    console.log(`trpc. artifacts: ${trpcArtifacts}`);
    console.log(`Browser-E2E: ${browserFiles.length} files`);

    if (llmStats) {
      console.log(
        `LLM Checker: ${llmStats.approved} approved / ${llmStats.flagged} flagged / ${llmStats.rejected} rejected`
      );
    }

    console.log(`\nEndpoint-Liste (aus Tests):`);
    // Extract from all test files
    const endpointPattern = /"([a-z][a-zA-Z]*\.[a-zA-Z]*)"/g;
    const allEndpointsInTests = new Set<string>();
    for (const content of Object.values(allFiles)) {
      let m;
      const pat = new RegExp(endpointPattern.source, "g");
      while ((m = pat.exec(content)) !== null) {
        if (!m[1].startsWith("trpc.") && !m[1].startsWith("s.")) {
          allEndpointsInTests.add(m[1]);
        }
      }
    }
    console.log([...allEndpointsInTests].sort().join("\n"));

    console.log(`\nCookie-Funktionen:`);
    console.log(cookieFunctions.join("\n") || "(keine gefunden)");

    console.log(`\nStatus-States:`);
    console.log(states.join("\n") || "(keine gefunden)");

    // Save ZIP for inspection
    const zipPath = `/home/ubuntu/testforge-validation-${name.toLowerCase().replace(/\s+/g, "-")}.zip`;
    if (result.zipBuffer) {
      fs.writeFileSync(zipPath, result.zipBuffer);
      console.log(`\nZIP gespeichert: ${zipPath}`);
    }

    // Save individual test files for grep verification
    const outDir = `/home/ubuntu/testforge-validation-${name.toLowerCase().replace(/\s+/g, "-")}-tests`;
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const [fname, content] of Object.entries(allFiles)) {
      const safeName = fname.replace(/\//g, "__");
      const filePath = path.join(outDir, safeName);
      fs.writeFileSync(filePath, content, "utf-8");
    }
    console.log(`Test files gespeichert in: ${outDir}`);
    console.log(`Gespeicherte Dateien: ${Object.keys(allFiles).join(", ")}`);

    return result;
  } catch (err: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Parser: ERROR`);
    console.log(`Elapsed: ${elapsed}s`);
    console.log(`CRASH: ${err.message}`);
    console.log(err.stack);
    return null;
  }
}

async function main() {
  await runScenario("PetClinic", "/home/ubuntu/testforge/petclinic-spec.md");
  await runScenario("LogisticsHub", "/home/ubuntu/testforge/logistics-spec.md");
}

main().catch(console.error);
