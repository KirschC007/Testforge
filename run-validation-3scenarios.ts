/**
 * Validierung — 3 Edge-Case Szenarien
 * KitaManager, CoworkSpace, ResearchLab
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
      (_layer: string, _message: string) => {},
      undefined
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const ir = result.analysisResult?.ir;

    // testFiles is Array<{filename: string, content: string}>
    const testFilesArr: Array<{ filename: string; content: string }> = result.testFiles ?? [];
    const textFiles: Record<string, string> = {};
    for (const { filename, content } of testFilesArr) {
      textFiles[filename] = content;
    }

    // Extended suite files
    const extendedFilesArr: Array<{ filename: string; content: string }> =
      result.extendedSuite?.files ?? [];
    const allFiles: Record<string, string> = { ...textFiles };
    for (const { filename, content } of extendedFilesArr) {
      allFiles[filename] = content;
    }

    // Count proofs
    let rawProofs = 0;
    for (const content of Object.values(textFiles)) {
      const m = content.match(/\bit\s*\(|\btest\s*\(/g);
      if (m) rawProofs += m.length;
    }
    let totalProofs = 0;
    for (const content of Object.values(allFiles)) {
      const m = content.match(/\bit\s*\(|\btest\s*\(/g);
      if (m) totalProofs += m.length;
    }

    // IDOR assertions
    let idorCount = 0;
    for (const [fname, content] of Object.entries(allFiles)) {
      if (fname.includes("idor") || fname.includes("auth")) {
        const m = content.match(/expect|assert/g);
        if (m) idorCount += m.length;
      }
    }

    // Browser E2E files
    const browserFiles = extendedFilesArr
      .map((f) => f.filename)
      .filter((f) => f.includes("e2e") || f.includes("browser") || f.includes("playwright"));

    // trpc artifacts
    let trpcArtifacts = 0;
    for (const content of Object.values(allFiles)) {
      const m = content.match(/"trpc\.\w+"/g);
      if (m) trpcArtifacts += m.length;
    }

    // Endpoints from IR
    const endpoints = ir?.apiEndpoints?.map((e: any) => e.name ?? e.path) ?? [];
    const uniqueEndpoints = [...new Set(endpoints)].sort();

    // Cookie functions from auth-matrix
    const authMatrixKey = Object.keys(allFiles).find((k) => k.includes("auth-matrix"));
    const cookieFunctions: string[] = [];
    if (authMatrixKey) {
      const m = allFiles[authMatrixKey].match(/get\w+Cookie/g) ?? [];
      cookieFunctions.push(...[...new Set(m)].sort());
    }

    // States from status-transitions
    const statesKey = Object.keys(allFiles).find((k) => k.includes("status-transitions"));
    const statesInTests: string[] = [];
    if (statesKey) {
      const m = allFiles[statesKey].match(/"[A-Z][A-Z_]*"/g) ?? [];
      statesInTests.push(...[...new Set(m)].sort());
    }

    // Roles
    const roles = ir?.authModel?.roles?.map((r: any) => r.name ?? r) ?? [];

    // Tenant
    const tenantKey = ir?.tenantModel?.tenantIdField ?? "none";

    // Error codes in all tests
    const errorCodePattern = /[A-Z][A-Z_]*_[A-Z][A-Z_]*/g;
    const allErrorCodes = new Set<string>();
    for (const content of Object.values(allFiles)) {
      const m = content.match(errorCodePattern) ?? [];
      for (const code of m) {
        if (code.length > 5 && !code.startsWith("TEST_") && !code.startsWith("PROOF_")) {
          allErrorCodes.add(code);
        }
      }
    }

    // Endpoints from tests
    const endpointPattern = /"([a-z][a-zA-Z]*\.[a-zA-Z]*)"/g;
    const allEndpointsInTests = new Set<string>();
    for (const content of Object.values(allFiles)) {
      let m;
      const pat = new RegExp(endpointPattern.source, "g");
      while ((m = pat.exec(content)) !== null) {
        allEndpointsInTests.add(m[1]);
      }
    }

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
    console.log(`States in Tests: ${statesInTests.length} (${statesInTests.join(", ")})`);
    console.log(`IDOR: ${idorCount} assertions`);
    console.log(`Proofs: ${rawProofs} raw → ${totalProofs} total (incl. extended)`);
    console.log(`Test files: ${testFilesArr.length} core + ${extendedFilesArr.length} extended`);
    console.log(`Crashes: 0`);
    console.log(`trpc. artifacts: ${trpcArtifacts}`);
    console.log(`Browser-E2E: ${browserFiles.length} files`);

    if (llmStats) {
      console.log(
        `LLM Checker: ${llmStats.approved} approved / ${llmStats.flagged} flagged / ${llmStats.rejected} rejected`
      );
    }

    console.log(`\nEndpoint-Liste (aus Tests):`);
    console.log([...allEndpointsInTests].sort().join("\n"));

    console.log(`\nCookie-Funktionen:`);
    console.log(cookieFunctions.join("\n") || "(keine gefunden)");

    console.log(`\nStatus-States (aus Tests):`);
    console.log(statesInTests.join("\n") || "(keine gefunden)");

    console.log(`\nError-Codes in Tests:`);
    console.log([...allErrorCodes].sort().join("\n") || "(keine gefunden)");

    // Save individual test files
    const outDir = `/home/ubuntu/testforge-validation-${name.toLowerCase().replace(/\s+/g, "-")}-tests`;
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const [fname, content] of Object.entries(allFiles)) {
      const safeName = fname.replace(/\//g, "__");
      fs.writeFileSync(path.join(outDir, safeName), content, "utf-8");
    }
    console.log(`\nTest files gespeichert in: ${outDir}`);

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
  await runScenario("KitaManager", "/home/ubuntu/testforge/kita-spec.md");
  await runScenario("CoworkSpace", "/home/ubuntu/testforge/cowork-spec.md");
  await runScenario("ResearchLab", "/home/ubuntu/testforge/research-spec.md");
}

main().catch(console.error);
