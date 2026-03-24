import { invokeLLM } from "../_core/llm";
import { generateProofs } from "./proof-generator";
import type { AnalysisResult, RiskModel, ValidatedProof, AnalysisJobResult } from "./types";
import { parseSpec, withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";
import { parseSpecSmart } from "./smart-parser";
import { parseSpecDecomposed } from "./spec-decomposed-parser";
import { runLLMChecker, assessSpecHealth, buildRiskModel } from "./risk-model";
import { generateHelpers } from "./helpers-generator";
import { validateProofs, runIndependentChecker, mergeProofsToFile } from "./validator";
import { generateReport } from "./report";
import { generateExtendedTestSuite } from "./extended-suite";
import { applyProofPack, type IndustryPack } from "./industry-proof-packs";
import { parseCodeToIR, type CodeFile } from "./code-parser";
import { discoverAPI } from "./api-discovery";
import { normalizeEndpointName } from "./normalize";
import { sanitizeIR } from "./llm-sanitizer";
import { normalizeOutputFiles, normalizeOutputConfigs } from "./output-normalizer";

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
  const testFiles = normalizeOutputFiles(testFilesRaw);

  // Extended Test Suite (6 layers)
  const extendedSuiteRaw = generateExtendedTestSuite(analysisResult, testFiles);
  const extendedSuite = {
    ...extendedSuiteRaw,
    files: normalizeOutputFiles(extendedSuiteRaw.files),
    configs: normalizeOutputConfigs(extendedSuiteRaw.configs),
  };
  console.log(`[TestForge] Extended Suite: ${extendedSuite.files.length} files across 6 layers`);

  console.log(`[TestForge] Job DONE in ${Date.now() - jobStart}ms — ${testFiles.length} test files, ${validatedSuite.proofs.length} proofs`);

  return { analysisResult, riskModel, validatedSuite, report, testFiles, helpers, llmCheckerStats, extendedSuite };
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
