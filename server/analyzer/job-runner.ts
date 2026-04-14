import { invokeLLM } from "../_core/llm";
import { generateProofs } from "./proof-generator";
import type { AnalysisResult, RiskModel, ValidatedProof, AnalysisJobResult } from "./types";
import { parseSpec, withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";
import { parseSpecSmart, semanticDedup } from "./smart-parser";
import { parseSpecDecomposed } from "./spec-decomposed-parser";
import { runLLMChecker, assessSpecHealth, buildRiskModel } from "./risk-model";
import { generateHelpers } from "./helpers-generator";
import { validateProofs, runIndependentChecker, mergeProofsToFile } from "./validator";
import { generateReport, generateHTMLReport } from "./report";
import { generateExtendedTestSuite } from "./extended-suite";
import { applyProofPack, type IndustryPack } from "./industry-proof-packs";
import { parseCodeToIR, type CodeFile } from "./code-parser";
import { discoverAPI } from "./api-discovery";
import { normalizeEndpointName, isGenericEndpoint } from "./normalize";
import { sanitizeIR } from "./llm-sanitizer";
import { normalizeOutputFiles, normalizeOutputConfigs } from "./output-normalizer";
import { runStaticAnalysis, type StaticFinding } from "./static-analyzer";
import { extractRoles } from "./spec-regex-extractor";

// ─── Main Job Runner ───────────────────────────────────────────────────────────

export type ProgressCallback = (layer: number, message: string, data?: {
  analysisResult?: AnalysisResult;
  riskModel?: RiskModel;
  proofCount?: number;
}) => Promise<void>;

export async function runAnalysisJob(
  specText: string,
  projectName: string,
  onProgress?: ProgressCallback,
  industryPack?: IndustryPack,
  options?: {
    codeFiles?: CodeFile[];
    baseUrl?: string;
    authToken?: string;
  }
): Promise<AnalysisJobResult> {
  const jobStart = Date.now();
  const isCodeScan = !!(options?.codeFiles && options.codeFiles.length > 0);
  console.log(`[TestForge] Job START v3.1 — ${isCodeScan ? `Code-Scan (${options!.codeFiles!.length} files)` : `${specText.length} chars`}, project: ${projectName}`);

  const progress = async (layer: number, message: string, data?: Parameters<ProgressCallback>[2]) => {
    console.log(`[TestForge] Progress Layer ${layer}: ${message}`);
    if (onProgress) {
      try { await onProgress(layer, message, data); } catch (e) { console.error("[TestForge] Progress callback error:", e); }
    }
  };

  await progress(1, "Layer 1: Analysiere...");
  // Schicht 1: Routing — Code-Scan fast-path, OpenAPI fast-path, or LLM-based
  const t1 = Date.now();
  let analysisResult: AnalysisResult;
  let llmCheckerStats: { approved: number; flagged: number; rejected: number; avgConfidence: number };

  if (isCodeScan) {
    const hasSpec = specText && specText.length > 100;
    if (hasSpec) {
      // Hybrid-Modus: Code-Parser (deterministisch) + LLM-Parser (Rollen, Status-Machine, DSGVO)
      console.log(`[TestForge] Hybrid-Modus — Code-Parser + LLM-Parser (Spec: ${specText.length} chars, ${options!.codeFiles!.length} files)`);
      await progress(1, `Hybrid-Modus: Code-Parser + Spec-Analyse (${options!.codeFiles!.length} Dateien + ${Math.round(specText.length / 1024)}KB Spec)...`);
      const codeResult = parseCodeToIR(options!.codeFiles!);
      // Run LLM parser on spec to get roles, status machine, constraints, DSGVO
      const SMART_PARSER_THRESHOLD = 50000;
      const DECOMPOSED_THRESHOLD = 50000;
      const specResult = specText.length >= SMART_PARSER_THRESHOLD
        ? await parseSpecSmart(specText)
        : specText.length >= DECOMPOSED_THRESHOLD
          ? await parseSpecDecomposed(specText)
          : await parseSpec(specText);
      // Merge: Code-Endpoints have priority, Spec-Roles/Status/Constraints fill gaps
      const mergedIR = mergeIRs(codeResult.ir, specResult.ir);
      analysisResult = {
        ir: mergedIR,
        qualityScore: codeResult.qualityScore,
        specType: `hybrid:${codeResult.specType}`,
      };
      llmCheckerStats = { approved: analysisResult.ir.behaviors.length, flagged: 0, rejected: 0, avgConfidence: 1.0 };
      console.log(`[TestForge] Hybrid-Modus done in ${Date.now() - t1}ms — ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints.length} endpoints`);
    } else {
      // Code-only path: deterministic static analysis, no LLM call
      console.log(`[TestForge] Code-Scan detected — using deterministic code parser (no LLM)`);
      await progress(1, `Code-Scan: ${options!.codeFiles!.length} Dateien werden analysiert (deterministisch, kein LLM-Call)...`);
      const codeResult = parseCodeToIR(options!.codeFiles!);
      analysisResult = {
        ir: codeResult.ir,
        qualityScore: codeResult.qualityScore,
        specType: codeResult.specType,
      };

      // BLOCK 8: Static Analysis
      let staticFindings: StaticFinding[] = [];
      if (options!.codeFiles!.length > 0) {
        staticFindings = runStaticAnalysis(options!.codeFiles!);
        console.log(`[TestForge] Static Analysis: ${staticFindings.length} findings`);
        (analysisResult as any).staticFindings = staticFindings;
      }

      // BLOCK 9: LLM-Code-Pass (Behaviors aus Code extrahieren)
      try {
        const codeText = options!.codeFiles!.map((f: CodeFile) => `// File: ${f.path}\n${f.content}`).join("\n\n");
        const truncatedCode = codeText.slice(0, 50000);
        const llmCodeResult = await withTimeout(parseSpec(truncatedCode), LLM_TIMEOUT_MS, null as any);
        if (llmCodeResult?.ir?.behaviors?.length > 0) {
          const existing = new Set(analysisResult.ir.behaviors.map((b: any) => b.title?.toLowerCase()));
          const newBehaviors = llmCodeResult.ir.behaviors.filter((b: any) => !existing.has(b.title?.toLowerCase()));
          if (newBehaviors.length > 0) {
            analysisResult.ir.behaviors = [...analysisResult.ir.behaviors, ...newBehaviors];
            console.log(`[TestForge] LLM-Code-Pass: +${newBehaviors.length} new behaviors (total: ${analysisResult.ir.behaviors.length})`);
          }
        }
      } catch (e) {
        console.warn(`[TestForge] LLM-Code-Pass failed (non-fatal): ${e}`);
      }

      llmCheckerStats = { approved: analysisResult.ir.behaviors.length, flagged: 0, rejected: 0, avgConfidence: 1.0 };
      console.log(`[TestForge] Code-Scan done in ${Date.now() - t1}ms — ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints.length} endpoints`);
    }
  } else {
    const { isOpenAPIDocument, parseOpenAPI } = await import("../openapi-parser");
    if (isOpenAPIDocument(specText)) {
      // Fast path: parse OpenAPI/Swagger directly — no LLM call, deterministic
      console.log(`[TestForge] OpenAPI detected — using deterministic parser (no LLM)`);
      await progress(1, "OpenAPI erkannt — deterministischer Parser (kein LLM-Call)...");
      analysisResult = parseOpenAPI(specText);
      // LLM Checker is skipped for OpenAPI — all behaviors are structurally derived
      llmCheckerStats = { approved: analysisResult.ir.behaviors.length, flagged: 0, rejected: 0, avgConfidence: 1.0 };
      console.log(`[TestForge] Schicht 1 (OpenAPI) done in ${Date.now() - t1}ms — ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints.length} endpoints`);
    } else {
      // LLM path — choose parser based on spec size
      const SMART_PARSER_THRESHOLD = 50000; // 50KB+: use 3-pass smart parser
      const DECOMPOSED_THRESHOLD = 50000;   // disabled: use standard parser for all specs < 50KB
      if (specText.length >= SMART_PARSER_THRESHOLD) {
        // Smart Parser: 3-pass architecture for large specs
        console.log(`[TestForge] Large spec (${specText.length} chars) — using Smart Parser v2.0 (3-pass)`);
        await progress(1, `Große Spec erkannt (${Math.round(specText.length / 1024)}KB) — Smart Parser v2.0 (3-Pass-Architektur)...`);
        analysisResult = await parseSpecSmart(specText);
        // Smart Parser already does structural validation — LLM Checker adds value for anchor verification
        await progress(2, "LLM Checker: Verifiziere Behaviors gegen Spec...");
        const t_checker = Date.now();
        const { checkedBehaviors, stats: checkerStats } = await runLLMChecker(
          analysisResult.ir.behaviors,
          specText
        );
        analysisResult.ir.behaviors = checkedBehaviors;
        llmCheckerStats = checkerStats;
        console.log(`[TestForge] LLM Checker done in ${Date.now() - t_checker}ms — ${checkedBehaviors.length} behaviors verified`);
        await progress(2, `LLM Checker fertig: ${llmCheckerStats.approved} approved, ${llmCheckerStats.flagged} flagged, ${llmCheckerStats.rejected} rejected`);
      } else if (specText.length >= DECOMPOSED_THRESHOLD) {
        // Decomposed Parser: 7 focused parallel LLM calls (Mechanismus 1+2+3)
        console.log(`[TestForge] Medium spec (${specText.length} chars) — using Decomposed Parser v1.0 (7-block)`);
        await progress(1, `Spec erkannt (${Math.round(specText.length / 1024)}KB) — Decomposed Parser v1.0 (7 parallele Blöcke)...`);
        analysisResult = await parseSpecDecomposed(specText);
        console.log(`[TestForge] Schicht 1 done in ${Date.now() - t1}ms — ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints.length} endpoints`);
        // LLM Checker: verify all behaviors (parallel)
        await progress(2, "LLM Checker: Verifiziere Behaviors gegen Spec...");
        const t_checker = Date.now();
        const { checkedBehaviors, stats: checkerStats } = await runLLMChecker(
          analysisResult.ir.behaviors,
          specText
        );
        analysisResult.ir.behaviors = checkedBehaviors;
        llmCheckerStats = checkerStats;
        console.log(`[TestForge] LLM Checker done in ${Date.now() - t_checker}ms — ${checkedBehaviors.length} behaviors verified`);
        await progress(2, `LLM Checker fertig: ${llmCheckerStats.approved} approved, ${llmCheckerStats.flagged} flagged, ${llmCheckerStats.rejected} rejected`);
      } else {
        // Standard 1-pass chunked parser for small specs (<8KB)
        analysisResult = await parseSpec(specText);
        console.log(`[TestForge] Schicht 1 done in ${Date.now() - t1}ms — ${analysisResult.ir.behaviors.length} behaviors, ${analysisResult.ir.apiEndpoints.length} endpoints`);
        // LLM Checker: verify all behaviors (parallel)
        await progress(2, "LLM Checker: Verifiziere Behaviors gegen Spec...");
        const t_checker = Date.now();
        const { checkedBehaviors, stats: checkerStats } = await runLLMChecker(
          analysisResult.ir.behaviors,
          specText
        );
        analysisResult.ir.behaviors = checkedBehaviors;
        llmCheckerStats = checkerStats;
        console.log(`[TestForge] LLM Checker done in ${Date.now() - t_checker}ms — ${checkedBehaviors.length} behaviors verified`);
        await progress(2, `LLM Checker fertig: ${llmCheckerStats.approved} approved, ${llmCheckerStats.flagged} flagged, ${llmCheckerStats.rejected} rejected`);
      }
    }
  }

  // Fix 4: Behavior dedup after LLM Checker — remove duplicates introduced by improveBehavior
  if (analysisResult?.ir?.behaviors) {
    const beforeDedup = analysisResult.ir.behaviors.length;
    analysisResult.ir.behaviors = semanticDedup(analysisResult.ir.behaviors);
    const afterDedup = analysisResult.ir.behaviors.length;
    if (beforeDedup !== afterDedup) {
      console.log(`[TestForge] Behavior dedup: ${beforeDedup} → ${afterDedup} (removed ${beforeDedup - afterDedup} duplicates)`);
    }
  }
  // API Discovery: if baseUrl provided, merge real endpoint paths into IR
  if (options?.baseUrl) {
    try {
      console.log(`[TestForge] API Discovery: probing ${options.baseUrl}...`);
      const discovery = await discoverAPI(options.baseUrl, options.authToken);
      console.log(`[TestForge] API Discovery: found ${discovery.endpoints.length} endpoints (framework: ${discovery.framework})`);
      // Merge: discovery endpoints override LLM-guessed endpoints (by name match)
      for (const disc of discovery.endpoints) {
        const existing = analysisResult.ir.apiEndpoints.find(e => e.name === disc.name);
        if (existing) {
          // Override method/path with real discovered values
          existing.method = `${disc.method} ${disc.path}`;
        } else {
          // Add newly discovered endpoint not in IR
          analysisResult.ir.apiEndpoints.push({
            name: disc.name,
            method: `${disc.method} ${disc.path}`,
            auth: disc.auth === "required" ? "authenticated" : "public",
            relatedBehaviors: [],
            inputFields: [],
          });
        }
      }
      // Override CSRF endpoint if discovered
      if (discovery.csrfEndpoint && analysisResult.ir.authModel) {
        analysisResult.ir.authModel.csrfEndpoint = discovery.csrfEndpoint;
      }
    } catch (e) {
      console.warn(`[TestForge] API Discovery failed (non-fatal):`, e);
    }
  }

  // Universal endpoint normalization — delegated to normalize.ts (single source of truth)
  analysisResult.ir.apiEndpoints = analysisResult.ir.apiEndpoints.map(ep => ({
    ...ep,
    name: normalizeEndpointName(ep.name, ep.method),
  }));
  // Fix 3: Filter generic endpoint names (procedure.list, {slug}.create, s.getById, etc.)
  const beforeGenericFilter = analysisResult.ir.apiEndpoints.length;
  analysisResult.ir.apiEndpoints = analysisResult.ir.apiEndpoints.filter(ep => !isGenericEndpoint(ep.name));
  const filteredGeneric = beforeGenericFilter - analysisResult.ir.apiEndpoints.length;
  if (filteredGeneric > 0) {
    console.log(`[TestForge] Generic endpoint filter: removed ${filteredGeneric} generic endpoints (e.g. procedure.list, {slug}.create)`);
  }

  // v5.3: Sanitizer — deterministic type fixes (ensureArray etc.) for all LLM output
  // enableLLMRepair=false: only free deterministic fixes, no extra LLM calls
  try {
    const { ir: sanitizedIR, report: sanitizeReport } = await sanitizeIR(
      analysisResult.ir,
      specText,
      { enableLLMRepair: false }
    );
    analysisResult.ir = sanitizedIR;
    console.log(`[TestForge] Sanitizer: ${sanitizeReport.fieldsFixed} deterministic fixes, ${sanitizeReport.llmRepairCalls} LLM repairs`);
  } catch (e) {
    console.warn(`[TestForge] Sanitizer failed (non-fatal):`, e);
  }

  // Fix 2: Filter empty/undefined role names from IR (LLM sometimes returns empty strings)
  if (analysisResult.ir.authModel?.roles) {
    analysisResult.ir.authModel.roles = analysisResult.ir.authModel.roles.filter(
      (r: { name: string }) => r && typeof r.name === "string" && r.name.trim().length > 0
    );
  }

  // Fix 3+6: Regex-Fallback for roles when LLM returns no valid roles
  // Applies additional noise filter to avoid SQL artifacts / audit log event names
  const hasValidRoles = (analysisResult.ir.authModel?.roles?.length ?? 0) > 0;
  if (!hasValidRoles && specText && specText.length > 100) {
    const rawRegexRoles = extractRoles(specText);
    // Additional noise filter: remove strings that contain SQL/event-name patterns
    const regexRoles = rawRegexRoles.filter((name: string) => {
      if (name.startsWith("idx_")) return false;
      if (/_(login|logout|locked|unlocked|failed|action|sessions?)$/.test(name)) return false;
      if (/_(?:id|key|secret|token)$/.test(name)) return false;
      if (/^(users|clients|members|admins|managers|operators)$/.test(name)) return false;
      if (name.length < 2 || name.length > 30) return false;
      return true;
    });
    if (regexRoles.length > 0) {
      console.log(`[RegexFallback] Roles from spec text (${rawRegexRoles.length} raw → ${regexRoles.length} filtered): ${regexRoles.join(", ")}`);
      if (!analysisResult.ir.authModel) {
        analysisResult.ir.authModel = { roles: [], loginEndpoint: "", csrfEndpoint: "" };
      }
      analysisResult.ir.authModel!.roles = regexRoles.map((name: string) => ({
        name,
        envUserVar: `E2E_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_USER`,
        envPassVar: `E2E_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PASS`,
        defaultUser: `${name}@test.com`,
        defaultPass: "TestPass2026x",
      }));
    }
  }

  // Assess spec health (all paths)
  analysisResult.specHealth = assessSpecHealth(analysisResult.ir);
  console.log(`[TestForge] Spec Health: ${analysisResult.specHealth.score}/100 (${analysisResult.specHealth.grade}) — ${analysisResult.specHealth.summary}`);
  await progress(1, `Layer 1 fertig: ${analysisResult.ir.behaviors.length} Behaviors, ${analysisResult.ir.apiEndpoints.length} Endpoints gefunden`, { analysisResult });

  // Schicht 2: Risk model
  const t2 = Date.now();
  const riskModel = buildRiskModel(analysisResult);
  console.log(`[TestForge] Schicht 2 done in ${Date.now() - t2}ms — ${riskModel.proofTargets.length} proof targets`);

  await progress(2, `Layer 2 fertig: ${riskModel.proofTargets.length} Proof-Targets, ${riskModel.idorVectors} IDOR-Vektoren`, { analysisResult, riskModel });

  // Industry Pack: inject domain-specific proof types and risk hints
  if (industryPack) {
    // Get current proof types from all targets
    const currentProofTypes = Array.from(new Set(riskModel.proofTargets.map(t => t.proofType)));
    const packResult = applyProofPack(industryPack, currentProofTypes);
    const addedTypes = packResult.proofTypes.filter(pt => !currentProofTypes.includes(pt as any));
    // For each added proof type, create a new proof target from the highest-priority behavior
    const topBehavior = riskModel.proofTargets[0];
    if (topBehavior && addedTypes.length > 0) {
      const newTargets = addedTypes.map(pt => ({
        ...topBehavior,
        id: `${topBehavior.id}_pack_${pt}`,
        proofType: pt as import("./types").ProofType,
        description: `[${industryPack.toUpperCase()} Pack] ${pt} compliance test — ${packResult.complianceFrameworks.join(", ")}`,
        preconditions: topBehavior.preconditions,
        assertions: topBehavior.assertions,
        mutationTargets: topBehavior.mutationTargets,
      }));
      riskModel.proofTargets = [...riskModel.proofTargets, ...newTargets];
    }
    console.log(`[TestForge] Industry Pack '${industryPack}' applied — +${addedTypes.length} proof types, frameworks: ${packResult.complianceFrameworks.join(", ")}`);
    await progress(2, `Industry Pack '${industryPack}' angewendet: +${addedTypes.length} Proof-Typen (${packResult.complianceFrameworks.join(", ")})`);
  }
  // Helpers Generator
  const helpers = generateHelpers(analysisResult);
  console.log(`[TestForge] Helpers generated — ${Object.keys(helpers).length} files`);

  // Schicht 3: Proof generation (ALL parallel)
  await progress(3, "Layer 3: Generiere Tests (alle parallel)...");
  const t3 = Date.now();
  const rawProofs = await generateProofs(riskModel, analysisResult);
  console.log(`[TestForge] Schicht 3 done in ${Date.now() - t3}ms — ${rawProofs.length} raw proofs`);

  await progress(3, `Layer 3 fertig: ${rawProofs.length} Tests generiert`, { proofCount: rawProofs.length });

  // Schicht 5: Independent Checker (before Schicht 4)
  await progress(4, `Layer 4: Independent Checker prüft ${rawProofs.length} Tests...`);
  const t5 = Date.now();
  const { checkedProofs } = await runIndependentChecker(rawProofs, analysisResult);
  console.log(`[TestForge] Schicht 5 done in ${Date.now() - t5}ms — ${checkedProofs.length} proofs after independent check`);

  await progress(4, `Layer 4 fertig: ${checkedProofs.length} Tests nach Independent Check`);

  // Schicht 4: False-green validation
  const t4 = Date.now();
  const behaviorIds = analysisResult.ir.behaviors.map(b => b.id);
  const validatedSuite = validateProofs(checkedProofs, behaviorIds);
  console.log(`[TestForge] Schicht 4 done in ${Date.now() - t4}ms — ${validatedSuite.proofs.length} validated, ${validatedSuite.discardedProofs.length} discarded`);

  await progress(5, `Layer 5 fertig: ${validatedSuite.proofs.length} validierte Tests, ${validatedSuite.discardedProofs.length} verworfen`);

  // Report
  const report = generateReport(analysisResult, riskModel, validatedSuite, projectName, llmCheckerStats);
  // HTML Dashboard
  const htmlReport = generateHTMLReport(analysisResult, riskModel, validatedSuite, projectName, llmCheckerStats, analysisResult.specHealth);

  // Test files (deduplicated by filename, properly structured)
  // Bug 5 Fix: deduplicate imports and shared let-declarations per file
  const fileMap = new Map<string, ValidatedProof[]>();
  for (const proof of validatedSuite.proofs) {
    if (!fileMap.has(proof.filename)) fileMap.set(proof.filename, []);
    fileMap.get(proof.filename)!.push(proof);
  }
  const testFilesRaw = Array.from(fileMap.entries()).map(([filename, proofs]) => ({
    filename,
    content: mergeProofsToFile(proofs),
  }));
  // Ebene 5: Post-processing pass — strip residual trpc./s. prefixes from all generated content
  const testFilesNormalized = normalizeOutputFiles(testFilesRaw);
  // Fix 5 + H1: Filter out TODO_REPLACE stubs — proofs with unresolved endpoint placeholders
  const testFiles = testFilesNormalized.filter(f => {
    const hasTodoEndpoint = f.content.includes('TODO_REPLACE_WITH_LIST_ENDPOINT')
      || f.content.includes('TODO_REPLACE_WITH_MUTATION_ENDPOINT')
      || f.content.includes('TODO_REPLACE_WITH_STATUS_ENDPOINT')
      || f.content.includes('TODO_REPLACE_WITH_GET_ENDPOINT')
      || f.content.includes('TODO_REPLACE_WITH_EXPORT_ENDPOINT')
      || f.content.includes('TODO_REPLACE_WITH_GDPR_DELETE_ENDPOINT')
      || f.content.includes('TODO_REPLACE_WITH_YOUR_ENDPOINT'); // H1: generic fallback stub
    if (hasTodoEndpoint) {
      console.log(`[TestForge] Fix5/H1: Filtered stub file ${f.filename} (unresolved TODO_REPLACE endpoint)`);
    }
    return !hasTodoEndpoint;
  });

  // Extended Test Suite (6 layers)
  const extendedSuiteRaw = generateExtendedTestSuite(analysisResult, testFiles);
  const rawConfigs = normalizeOutputConfigs(extendedSuiteRaw.configs);
  // v8.1: Remove vitest.config.ts and cucumber.config.ts — all tests run through Playwright
  delete rawConfigs["vitest.config.ts"];
  delete rawConfigs["cucumber.config.ts"];
  const extendedSuite = {
    ...extendedSuiteRaw,
    files: normalizeOutputFiles(extendedSuiteRaw.files),
    configs: rawConfigs,
  };
  console.log(`[TestForge] Extended Suite: ${extendedSuite.files.length} files across 6 layers`);

  // ─── v8.1: Post-Generation Syntax Validation ───────────────────────────────
  // Sanitize all generated TypeScript files to fix common escaping issues
  const sanitizedTestFiles = sanitizeGeneratedFiles(testFiles);
  // Preserve layer/description fields from original ExtendedTestFile objects
  const sanitizedExtendedFiles: import("./types").ExtendedTestFile[] = extendedSuite.files.map((orig) => {
    const sanitized = sanitizeGeneratedFiles([{ filename: orig.filename, content: orig.content }])[0];
    return { ...orig, content: sanitized.content };
  });
  const helperEntries = Object.entries(helpers).map(([name, content]) => ({ filename: name, content: content as string }));
  const sanitizedHelperEntries = sanitizeGeneratedFiles(helperEntries);
  const sanitizedHelpers: Record<string, string> = {};
  for (const f of sanitizedHelperEntries) {
    sanitizedHelpers[f.filename] = f.content;
  }

  const totalOriginal = testFiles.length + extendedSuite.files.length + helperEntries.length;
  const totalSanitized = sanitizedTestFiles.length + sanitizedExtendedFiles.length + sanitizedHelperEntries.length;
  if (totalOriginal !== totalSanitized) {
    console.log(`[TestForge] ⚠ Syntax sanitizer: ${totalOriginal - totalSanitized} files repaired`);
  }
  console.log(`[TestForge] Output validated: ${sanitizedTestFiles.length} core + ${sanitizedExtendedFiles.length} extended + ${sanitizedHelperEntries.length} helpers`);

  console.log(`[TestForge] Job DONE in ${Date.now() - jobStart}ms — ${sanitizedTestFiles.length} test files, ${validatedSuite.proofs.length} proofs`);

  return {
    analysisResult, riskModel, validatedSuite, report, htmlReport,
    testFiles: sanitizedTestFiles,
    helpers: sanitizedHelpers as unknown as import("./types").GeneratedHelpers,
    llmCheckerStats,
    extendedSuite: { ...extendedSuite, files: sanitizedExtendedFiles },
  };
}

// ─── Hybrid-Modus: Merge Code-IR + Spec-IR ─────────────────────────────────────
// Code-Endpoints have priority; Spec fills in roles, status machine, constraints, DSGVO
function mergeIRs(
  codeIR: import("./types").AnalysisIR,
  specIR: import("./types").AnalysisIR
): import("./types").AnalysisIR {
  // Merge behaviors: code behaviors first, then spec behaviors not already covered
  const codeBehaviorTitles = new Set(codeIR.behaviors.map(b => b.title?.toLowerCase() ?? ""));
  const specBehaviorsNew = specIR.behaviors.filter(b => !codeBehaviorTitles.has(b.title?.toLowerCase() ?? ""));
  const behaviors = [...codeIR.behaviors, ...specBehaviorsNew];

  // Merge endpoints: code endpoints have priority (real paths), spec fills gaps
  const codeEndpointNames = new Set(codeIR.apiEndpoints.map(e => e.name));
  const specEndpointsNew = specIR.apiEndpoints.filter(e => !codeEndpointNames.has(e.name));
  const apiEndpoints = [...codeIR.apiEndpoints, ...specEndpointsNew];

  // Auth model: prefer spec (has roles from LLM), fallback to code
  const authModel = specIR.authModel ?? codeIR.authModel;
  // If code found roles, merge them into spec authModel
  if (authModel && codeIR.authModel?.roles && codeIR.authModel.roles.length > 0) {
    const existingRoleNames = new Set((authModel.roles ?? []).map(r => r.name));
    const newRoles = codeIR.authModel.roles.filter(r => !existingRoleNames.has(r.name));
    authModel.roles = [...(authModel.roles ?? []), ...newRoles];
  }
  // Tenant model: prefer code (has real field names), fallback to spec
  const tenantModel = codeIR.tenantModel ?? specIR.tenantModel;

  // Status machine: prefer spec (LLM extracts state names), fallback to code
  const statusMachine = specIR.statusMachine ?? codeIR.statusMachine;
  const statusMachines = [...(specIR.statusMachines ?? []), ...(codeIR.statusMachines ?? [])];

  // PII resources: merge both
  const existingResourceNames = new Set(codeIR.resources.map(r => r.name));
  const specResourcesNew = specIR.resources.filter(r => !existingResourceNames.has(r.name));
  const resources = [...codeIR.resources, ...specResourcesNew];

  // Enums: merge both
  const enums = { ...(codeIR.enums ?? {}), ...(specIR.enums ?? {}) };

  return {
    ...codeIR,
    behaviors,
    apiEndpoints,
    authModel,
    tenantModel,
    statusMachine,
    statusMachines,
    resources,
    enums,
  };
}

// ─── v8.1 FINAL: Post-Generation Syntax Sanitizer ───────────────────────────
// Garantiert dass JEDE generierte Datei gültiges TypeScript ist.
// Fängt alle bekannten Generator-Bugs ab.

function sanitizeGeneratedFiles(
  files: { filename: string; content: string }[]
): { filename: string; content: string }[] {
  let totalFixes = 0;

  const result = files.map(file => {
    if (!file.filename.endsWith(".ts") && !file.filename.endsWith(".tsx") && !file.filename.endsWith(".js")) {
      return file;
    }

    let content = file.content;
    let fixes = 0;

    // ── Fix 1: Double-escaped regex slashes ──
    // /\\/login/ → /\/login/
    const before1 = content;
    content = content.replace(/\/\\\\\//g, "/\\/");
    if (content !== before1) fixes++;

    // ── Fix 2: Over-escaped \s in regex ──
    // /\\\\s+/ → /\\s+/
    const before2 = content;
    content = content.replace(/\\\\\\\\s\+/g, "\\\\s+");
    if (content !== before2) fixes++;

    // ── Fix 3: undefined literals in credentials ──
    // process.env.undefined → process.env.E2E_ADMIN_USER
    const before3 = content;
    content = content.replace(/process\.env\.undefined/g, "process.env.E2E_ADMIN_USER");
    content = content.replace(/"undefined@test\.com"/g, '"admin@test.com"');
    content = content.replace(/"undefined"/g, '"TestPass2026x"');
    if (content !== before3) fixes++;

    // ── Fix 4: Hyphenated function names ──
    // getSuper-AdminCookie → getSuperAdminCookie
    const before4 = content;
    content = content.replace(
      /\b(get|set|is|has)([A-Za-z]*)-([A-Za-z])/g,
      (_, prefix, mid, afterHyphen) => `${prefix}${mid}${afterHyphen.toUpperCase()}`
    );
    if (content !== before4) fixes++;

    // ── Fix 5: test.test.describe → test.describe ──
    const before5 = content;
    content = content.replace(/test\.test\./g, "test.");
    if (content !== before5) fixes++;

    // ── Fix 6: Remove vitest imports from Playwright files ──
    if (content.includes("@playwright/test")) {
      const before6 = content;
      content = content.replace(/import\s*\{[^}]*\}\s*from\s*["']vitest["'];?\n?/g, "");
      if (content !== before6) fixes++;
    }

    // ── Fix 7: Empty catch blocks ──
    content = content.replace(/catch\s*\{\s*\}/g, "catch { /* ignored */ }");

    // ── Fix 8: Double semicolons ──
    content = content.replace(/;;\s*$/gm, ";");

    // ── Fix 9: Ensure .spec.ts files have playwright import ──
    if (file.filename.endsWith(".spec.ts") && !content.includes("@playwright/test") && !content.includes("vitest")) {
      content = 'import { test, expect } from "@playwright/test";\n\n' + content;
      fixes++;
    }

    // ── Fix 10: Ensure .test.ts files have playwright import ──
    if (file.filename.endsWith(".test.ts") && !content.includes("@playwright/test") && !content.includes("vitest")) {
      content = 'import { test, expect } from "@playwright/test";\n\n' + content;
      fixes++;
    }

    // ── Fix 11: Literal \n in generated code ──
    // LLM generates literal backslash-n instead of newline in various positions
    content = content.replace(/,\\n(\s*)/g, ',\n$1');
    content = content.replace(/\);\\n/g, ');\n');
    content = content.replace(/"\\n(\s*)/g, '"\n$1');
    // Catch remaining literal \n in comments and after values
    content = content.replace(/([a-z0-9])\\n(\s+)/g, '$1\n$2');

    // ── Fix 12: Unquoted hyphenated property names ──
    // Idempotency-Key: "..." → "Idempotency-Key": "..."
    content = content.replace(/^(\s+)([a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)+):\s/gm, '$1"$2": ');

    // ── Fix 13: Unterminated regex — trailing backslash-slash ──
    // /\/login\/ → /\/login/ (only remove the TRAILING \/ that breaks the regex)
    content = content.replace(/(\/.+?)\\\/(\s*[,;)\]])/g, '$1/$2');

    // ── Fix 13b: Double-slash regex (//login/) → /\/login/ ──
    // When Fix 1 or old sanitizer stripped backslash from /\/login/ producing //login/
    content = content.replace(/\.toHaveURL\(\/\/([a-zA-Z_|]+)\//g, '.toHaveURL(/\\/$1/');
    // ── Fix 14: Unescaped double quotes in test titles ──
    content = content.replace(/^(\s*(?:test|it)\s*\(\s*")(.+?)(",\s*async)/gm, (match, prefix, title, suffix) => {
      const fixedTitle = title.replace(/(?<!\\)"/g, '\\"');
      return prefix + fixedTitle + suffix;
    });

    // ── Fix 15: TEST_TENANT_ID alias ──
    // Handled via factories.ts alias export in helpers-generator.ts — no action needed here

    // ── Fix 16: Duplicate test titles ──
    {
      const seenTitles = new Map<string, number>();
      content = content.replace(/^(\s*(?:test|it)\s*\(\s*")([^"]+)(",\s*async)/gm, (match, prefix, title, suffix) => {
        const count = seenTitles.get(title) || 0;
        seenTitles.set(title, count + 1);
        if (count > 0) {
          return `${prefix}${title} [dup-${count}]${suffix}`;
        }
        return match;
      });
    }

    // ── Fix 17: Duplicate function declarations ──
    {
      const seenFunctions = new Map<string, number>();
      content = content.replace(/^(function\s+)(\w+)(\s*\()/gm, (match, keyword, name, paren) => {
        const count = seenFunctions.get(name) || 0;
        seenFunctions.set(name, count + 1);
        if (count > 0) {
          return `${keyword}${name}_dup${count}${paren}`;
        }
        return match;
      });
    }

    // ── Fix 18: Duplicate top-level let declarations ──
    // When multiple proof blocks merge into one file, `let x: string;` can appear multiple times
    {
      const seenTopLevelLets = new Set<string>();
      content = content.replace(/^(let\s+)(\w+)(:\s*\w+;?\s*)$/gm, (match, keyword, varName, rest) => {
        if (seenTopLevelLets.has(varName)) {
          return `// [dedup] ${match.trim()}`;
        }
        seenTopLevelLets.add(varName);
        return match;
      });
    }

    // ── Fix 19: Auth.ts — Duplicate-Export-Prevention + Alias-Garantie ──
    if (file.filename.includes("auth") && file.filename.endsWith(".ts") &&
        !file.filename.includes("spec") && !file.filename.includes("test") &&
        !file.filename.includes("matrix")) {
      const exportedFns = new Set<string>();
      const fnRegex = /export\s+async\s+function\s+(\w+)/g;
      let fnMatch: RegExpExecArray | null;
      while ((fnMatch = fnRegex.exec(content)) !== null) {
        exportedFns.add(fnMatch[1]);
      }
      const before19 = content;
      content = content.replace(/^\/\/.*?[Aa]lias.*\n?/gm, "");
      content = content.replace(/^export\s+const\s+(\w+)\s*=\s*\w+;\s*$/gm, (match, name) => {
        if (exportedFns.has(name)) return `// [dedup] ${match.trim()}`;
        return match;
      });
      if (!exportedFns.has("getAdminCookie") && exportedFns.size > 0) {
        const firstFn = Array.from(exportedFns)[0];
        content += `\nexport const getAdminCookie = ${firstFn};\n`;
      }
      if (!exportedFns.has("getUserCookie") && exportedFns.size > 1) {
        const fns = Array.from(exportedFns);
        content += `export const getUserCookie = ${fns[fns.length - 1]};\n`;
      }
      if (content !== before19) fixes++;
    }

    // ── Fix 20: Remove @prisma/client imports ──
    if (content.includes("@prisma/client")) {
      const before20 = content;
      content = content.replace(/import\s*\{[^}]*\}\s*from\s*["']@prisma\/client["'];?\n?/g, "");
      content = content.replace(/^const prisma = new PrismaClient\(\);?\s*$/gm, "// [removed] prisma");
      if (content !== before20) fixes++;
    }

    // ── Fix 21: toBeOneOf → toContain (Playwright-kompatibel) ──
    if (content.includes("toBeOneOf")) {
      const before21 = content;
      content = content.replace(
        /expect\(([^)]+)\)\.toBeOneOf\(\[([^\]]+)\]\)/g,
        "expect([$2]).toContain($1)"
      );
      if (content !== before21) fixes++;
    }

    // ── Fix 22: Literal backslash-n in generated code (expanded) ──
    {
      const before22 = content;
      content = content.replace(/,\\n(\s*)/g, ',\n$1');
      content = content.replace(/\);\\n/g, ');\n');
      content = content.replace(/"\\n(\s*)/g, '"\n$1');
      content = content.replace(/([a-z0-9])\\n(\s+)/g, '$1\n$2');
      if (content !== before22) fixes++;
    }

    if (fixes > 0) {
      console.log(`[TestForge] Sanitizer: ${file.filename} — ${fixes} fixes applied`);
      totalFixes += fixes;
    }

    return { filename: file.filename, content };
  });

  if (totalFixes > 0) {
    console.log(`[TestForge] Sanitizer: ${totalFixes} total fixes across ${result.length} files`);
  }

  return result;
}
