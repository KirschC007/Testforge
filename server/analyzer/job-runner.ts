import { invokeLLM } from "../_core/llm";
import { generateProofs } from "./proof-generator";
import type { AnalysisResult, RiskModel, ValidatedProof, AnalysisJobResult } from "./types";
import { parseSpec, withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";
import { parseSpecSmart } from "./smart-parser";
import { runLLMChecker, assessSpecHealth, buildRiskModel } from "./risk-model";
import { generateHelpers } from "./helpers-generator";
import { validateProofs, runIndependentChecker, mergeProofsToFile } from "./validator";
import { generateReport } from "./report";
import { generateExtendedTestSuite } from "./extended-suite";
import { applyProofPack, type IndustryPack } from "./industry-proof-packs";
import { parseCodeToIR, type CodeFile } from "./code-parser";
import { discoverAPI } from "./api-discovery";

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
    // Code-Scan path: deterministic static analysis, no LLM call
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
      } else {
        // Standard 1-pass chunked parser for small specs
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

  // Universal endpoint normalization — applied after ALL parser paths
  // Ensures no "createAccount.create", "routers.list", or "auth.list" fallbacks reach the generators
  analysisResult.ir.apiEndpoints = analysisResult.ir.apiEndpoints.map(ep => {
    const raw = ep.name;
    // Already correct simple dot-notation: resource.action (all lowercase, simple words)
    if (/^[a-z][a-z0-9]*s?\.[a-z][a-z0-9]*$/.test(raw)) return ep;
    // FIRST: REST path normalization (starts with /)
    if (raw.startsWith("/")) {
      const segments = raw
        .replace(/^\/api\/(?:v\d+\/)?/, "")
        .split("/")
        .filter(s => !s.startsWith(":") && s.length > 0);
      if (segments.length >= 1) {
        const resource = segments[0].toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (segments.length === 1) return { ...ep, name: `${resource}.list` };
        const action = segments[segments.length - 1].toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const actionMap: Record<string, string> = {
          gdpr: "gdprDelete", export: "export", import: "import",
          freeze: "freeze", unfreeze: "unfreeze", cancel: "cancel",
          approve: "approve", reject: "reject", complete: "complete", archive: "archive",
        };
        return { ...ep, name: `${resource}.${actionMap[action] ?? action}` };
      }
    }
    // Delegate to the same logic as in llm-parser normalizeEndpointName
    // Inline here to avoid circular imports — keep in sync with llm-parser.ts
    let normalized = raw;
    // Duplicate-verb: "createAccount.create" → "accounts.create"
    const dupMatch = raw.match(/^(create|list|get|update|delete|find|add|remove)([A-Z]\w*)\.(\1)$/i);
    if (dupMatch) {
      const res = dupMatch[2].toLowerCase();
      normalized = `${res.endsWith("s") ? res : res + "s"}.${dupMatch[1].toLowerCase()}`;
    } else if (/^[a-z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/.test(raw)) {
      // camelCase left side: "listAccounts.list" → "accounts.list"
      const [left, right] = raw.split(".");
      const verbs = ["create","list","get","update","delete","add","remove","find","fetch","patch",
        "set","freeze","unfreeze","cancel","approve","reject","complete","archive","send",
        "export","import","anonymize","void","mark","close","open","start","stop","pause","resume","skip","scan"];
      const mv = verbs.find(v => left.toLowerCase().startsWith(v) && left.length > v.length);
      if (mv) {
        const resourceRaw = left.slice(mv.length);
        const resourceBase = resourceRaw.replace(/([A-Z][a-z]+)/g, m => m.toLowerCase() + "-").replace(/-+$/, "").split("-")[0];
        const resource = resourceBase.endsWith("s") ? resourceBase : resourceBase + "s";
        let action = right;
        const extra = resourceRaw.includes("-") ? resourceRaw.split("-").slice(1).join("") : "";
        if (extra && extra.toLowerCase() !== "s") action = right + extra.charAt(0).toUpperCase() + extra.slice(1).toLowerCase();
        if (resourceRaw.toUpperCase().includes("GDPR")) action = "gdpr" + right.charAt(0).toUpperCase() + right.slice(1);
        normalized = `${resource}.${action}`;
      }
    }
    return { ...ep, name: normalized };
  });

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
  const testFiles = Array.from(fileMap.entries()).map(([filename, proofs]) => ({
    filename,
    content: mergeProofsToFile(proofs),
  }));

  // Extended Test Suite (6 layers)
  const extendedSuite = generateExtendedTestSuite(analysisResult, testFiles);
  console.log(`[TestForge] Extended Suite: ${extendedSuite.files.length} files across 6 layers`);

  console.log(`[TestForge] Job DONE in ${Date.now() - jobStart}ms — ${testFiles.length} test files, ${validatedSuite.proofs.length} proofs`);

  return { analysisResult, riskModel, validatedSuite, report, testFiles, helpers, llmCheckerStats, extendedSuite };
}
