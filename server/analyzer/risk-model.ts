import { invokeLLM } from "../_core/llm";
import { withTimeout, LLM_TIMEOUT_MS } from "./llm-parser";
import { getValidDefault } from "./proof-generator";
import type { Behavior, EndpointField, AnalysisIR, SpecHealthDimension, SpecHealth, AnalysisResult, CheckResult, RiskLevel, ProofType, ScoredBehavior, FieldConstraint, ProofTarget, RiskModel } from "./types";

// ─── LLM Checker ──────────────────────────────────────────────────────────────

function verifyAnchor(behavior: Behavior, specText: string): { found: boolean; score: number } {
  if (!behavior.specAnchor || behavior.specAnchor.length < 10) {
    return { found: false, score: 0.3 }; // No anchor provided — partial credit
  }

  // Exact match
  if (specText.includes(behavior.specAnchor)) {
    return { found: true, score: 1.0 };
  }

  // Fuzzy: check if 80% of words in anchor appear near each other in spec
  const anchorWords = behavior.specAnchor.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (anchorWords.length === 0) return { found: false, score: 0.2 };

  const specLower = specText.toLowerCase();
  const matchedWords = anchorWords.filter(w => specLower.includes(w));
  const score = matchedWords.length / anchorWords.length;

  return { found: score >= 0.7, score };
}

async function crossValidateBehavior(
  behavior: Behavior,
  specText: string,
  chunkSize = 8000
): Promise<{ verdict: "CORRECT" | "INCORRECT" | "PARTIAL"; confidence: number; issues: string[] }> {
  // Find the most relevant section of the spec for this behavior
  const anchor = behavior.specAnchor || behavior.title;
  const anchorIdx = specText.toLowerCase().indexOf(anchor.toLowerCase().slice(0, 30));
  const start = Math.max(0, anchorIdx - 500);
  const end = Math.min(specText.length, anchorIdx + chunkSize);
  const relevantSection = anchorIdx >= 0 ? specText.slice(start, end) : specText.slice(0, chunkSize);

  const prompt = `You are a spec verification expert. A behavior was extracted from a specification.
Verify if this behavior is correct, complete, and directly derivable from the spec text.

BEHAVIOR:
${JSON.stringify(behavior, null, 2)}

RELEVANT SPEC TEXT:
${relevantSection}

Answer in this exact JSON format:
{
  "verdict": "CORRECT" | "INCORRECT" | "PARTIAL",
  "confidence": 0.0-1.0,
  "issues": ["issue 1", "issue 2"] // empty if CORRECT
}

Output ONLY valid JSON.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      thinkingBudget: 0,
      maxTokens: 512,
    });
    const content = response.choices[0].message.content as string;
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { verdict: "PARTIAL", confidence: 0.5, issues: ["Cross-validation failed — using partial credit"] };
  }
}

async function improveBehavior(
  behavior: Behavior,
  issues: string[],
  specText: string,
  attempt: number
): Promise<Behavior | null> {
  const anchor = behavior.specAnchor || behavior.title;
  const anchorIdx = specText.toLowerCase().indexOf(anchor.toLowerCase().slice(0, 30));
  const start = Math.max(0, anchorIdx - 300);
  const end = Math.min(specText.length, anchorIdx + 4000);
  const relevantSection = anchorIdx >= 0 ? specText.slice(start, end) : specText.slice(0, 4000);

  const prompt = `Improve this behavior extracted from a spec. Attempt ${attempt + 1}/2.

CURRENT BEHAVIOR:
${JSON.stringify(behavior, null, 2)}

ISSUES TO FIX:
${issues.join("\n")}

RELEVANT SPEC TEXT:
${relevantSection}

Fix the behavior:
1. Add exact specAnchor (verbatim quote from spec text, 10-30 words)
2. Complete all postconditions (include all side-effects, HTTP codes, field changes)
3. Use concrete values (exact HTTP codes, field names, thresholds)
4. Remove anything not directly stated in the spec

Output ONLY the improved behavior as JSON (same structure, no markdown).`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      thinkingBudget: 0,
      maxTokens: 1024,
    });
    const content = response.choices[0].message.content as string;
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned) as Behavior;
  } catch {
    return null;
  }
}

export async function runLLMChecker(
  behaviors: Behavior[],
  specText: string
): Promise<{ checkedBehaviors: Behavior[]; stats: { approved: number; flagged: number; rejected: number; avgConfidence: number } }> {
  const t0 = Date.now();
  console.log(`[TestForge] LLM Checker: verifying ${behaviors.length} behaviors in parallel`);

  // Run all checks in parallel
  const checkResults = await Promise.all(
    behaviors.map(async (behavior): Promise<{ behavior: Behavior; result: CheckResult }> => {
      // Step 1: Anchor verification (fast, no LLM)
      const anchor = verifyAnchor(behavior, specText);

      // Step 2: Cross-validation (LLM call)
      const validation = await withTimeout(
        crossValidateBehavior(behavior, specText),
        30000,
        { verdict: "PARTIAL" as const, confidence: 0.5, issues: ["Timeout"] }
      );

      // Step 3: Confidence score
      const anchorScore = anchor.score;
      const validationScore = validation.verdict === "CORRECT" ? 1.0 : validation.verdict === "PARTIAL" ? 0.6 : 0.2;
      const confidence = (anchorScore * 0.4) + (validationScore * 0.4) + (validation.confidence * 0.2);

      if (confidence >= 0.8) {
        return {
          behavior,
          result: { behaviorId: behavior.id, verdict: "approved", confidence, issues: [], attempts: 0, anchorFound: anchor.found },
        };
      }

      if (confidence < 0.6 && validation.issues.length > 0) {
        // Step 4: Improvement loop (max 2 attempts)
        let current = behavior;
        let currentConfidence = confidence;
        let attempts = 0;

        for (let attempt = 0; attempt < 2; attempt++) {
          const improved = await withTimeout(
            improveBehavior(current, validation.issues, specText, attempt),
            30000,
            null
          );
          if (!improved) break;
          attempts++;

          const newAnchor = verifyAnchor(improved, specText);
          const newValidation = await withTimeout(
            crossValidateBehavior(improved, specText),
            30000,
            { verdict: "PARTIAL" as const, confidence: 0.5, issues: [] }
          );
          const newValidationScore = newValidation.verdict === "CORRECT" ? 1.0 : newValidation.verdict === "PARTIAL" ? 0.6 : 0.2;
          currentConfidence = (newAnchor.score * 0.4) + (newValidationScore * 0.4) + (newValidation.confidence * 0.2);
          current = improved;

          if (currentConfidence >= 0.6) break;
        }

        if (currentConfidence < 0.5) {
          return {
            behavior: current,
            result: { behaviorId: behavior.id, verdict: "rejected", confidence: currentConfidence, issues: validation.issues, attempts, anchorFound: anchor.found },
          };
        }

        return {
          behavior: current,
          result: { behaviorId: behavior.id, verdict: currentConfidence >= 0.8 ? "approved" : "flagged", confidence: currentConfidence, issues: validation.issues, attempts, anchorFound: anchor.found },
        };
      }

      return {
        behavior,
        result: { behaviorId: behavior.id, verdict: "flagged", confidence, issues: validation.issues, attempts: 0, anchorFound: anchor.found },
      };
    })
  );

  console.log(`[TestForge] LLM Checker done in ${Date.now() - t0}ms`);

  const approved = checkResults.filter(r => r.result.verdict === "approved").length;
  const flagged = checkResults.filter(r => r.result.verdict === "flagged").length;
  const rejected = checkResults.filter(r => r.result.verdict === "rejected").length;
  const avgConfidence = checkResults.reduce((sum, r) => sum + r.result.confidence, 0) / checkResults.length;

  console.log(`[TestForge] LLM Checker: ${approved} approved, ${flagged} flagged, ${rejected} rejected, avg confidence: ${avgConfidence.toFixed(2)}`);

  // Keep approved + flagged, discard rejected
  const checkedBehaviors = checkResults
    .filter(r => r.result.verdict !== "rejected")
    .map(r => r.behavior);

  return { checkedBehaviors, stats: { approved, flagged, rejected, avgConfidence } };
}

// ─── Spec Health Assessor ────────────────────────────────────────────────────

export function assessSpecHealth(ir: AnalysisIR): SpecHealth {
  const dims: SpecHealthDimension[] = [];

  // Dimension 1: Typed input fields (20 pts)
  // All endpoints should have typed EndpointField objects (not empty arrays)
  const epWithTypedFields = ir.apiEndpoints.filter(ep =>
    Array.isArray(ep.inputFields) && ep.inputFields.length > 0 &&
    typeof ep.inputFields[0] === "object" && "type" in ep.inputFields[0]
  );
  const typedFieldsRatio = ir.apiEndpoints.length > 0
    ? epWithTypedFields.length / ir.apiEndpoints.length : 0;
  const typedFieldsScore = Math.round(typedFieldsRatio * 20);
  dims.push({
    name: "typed_fields",
    label: "Typed Input Fields",
    passed: typedFieldsRatio >= 0.8,
    score: typedFieldsScore,
    maxScore: 20,
    tip: "Add field types (string/number/enum/array) and constraints (min/max) to all endpoint inputs",
    detail: `${epWithTypedFields.length}/${ir.apiEndpoints.length} endpoints have typed fields`,
  });

  // Dimension 2: Enum values defined (15 pts)
  // Endpoints with enum fields should have enumValues populated
  const enumFields = ir.apiEndpoints.flatMap(ep =>
    (ep.inputFields as Array<{type: string; enumValues?: string[]}>).filter(f => f.type === "enum")
  );
  const enumsWithValues = enumFields.filter(f => Array.isArray(f.enumValues) && f.enumValues.length > 0);
  const enumScore = enumFields.length === 0 ? 15 :
    Math.round((enumsWithValues.length / enumFields.length) * 15);
  dims.push({
    name: "enum_values",
    label: "Enum Values Defined",
    passed: enumFields.length === 0 || enumsWithValues.length === enumFields.length,
    score: enumScore,
    maxScore: 15,
    tip: "List all allowed values for enum fields (e.g. status: todo|in_progress|done)",
    detail: enumFields.length === 0 ? "No enum fields found" :
      `${enumsWithValues.length}/${enumFields.length} enum fields have values`,
  });

  // Dimension 3: Boundary constraints (min/max) (20 pts)
  // Numeric fields should have min/max defined
  const numericFields = ir.apiEndpoints.flatMap(ep =>
    (ep.inputFields as Array<{type: string; min?: number; max?: number; isBoundaryField?: boolean}>)
      .filter(f => f.type === "number")
  );
  const numericWithBounds = numericFields.filter(f => f.min !== undefined || f.max !== undefined);
  const boundaryScore = numericFields.length === 0 ? 20 :
    Math.round((numericWithBounds.length / numericFields.length) * 20);
  dims.push({
    name: "boundary_constraints",
    label: "Boundary Constraints",
    passed: numericFields.length === 0 || numericWithBounds.length === numericFields.length,
    score: boundaryScore,
    maxScore: 20,
    tip: "Add min/max constraints to numeric fields (e.g. price: 0.01–999999.99, quantity: 1–100)",
    detail: numericFields.length === 0 ? "No numeric fields found" :
      `${numericWithBounds.length}/${numericFields.length} numeric fields have bounds`,
  });

  // Dimension 4: Auth model present (15 pts)
  const hasAuth = ir.authModel !== null &&
    ir.authModel.loginEndpoint !== undefined &&
    ir.authModel.roles.length > 0;
  dims.push({
    name: "auth_model",
    label: "Authentication Model",
    passed: hasAuth,
    score: hasAuth ? 15 : 0,
    maxScore: 15,
    tip: "Document the login endpoint, session mechanism, and user roles (e.g. admin/user)",
    detail: hasAuth
      ? `Login: ${ir.authModel!.loginEndpoint}, ${ir.authModel!.roles.length} role(s)`
      : "No auth model found",
  });

  // Dimension 5: Tenant model present (15 pts)
  const hasTenant = ir.tenantModel !== null &&
    ir.tenantModel.tenantEntity !== undefined &&
    ir.tenantModel.tenantIdField !== undefined;
  dims.push({
    name: "tenant_model",
    label: "Multi-Tenant Isolation",
    passed: hasTenant,
    score: hasTenant ? 15 : 0,
    maxScore: 15,
    tip: "Specify the tenant entity and ID field (e.g. restaurantId, shopId) for IDOR test generation",
    detail: hasTenant
      ? `Tenant: ${ir.tenantModel!.tenantEntity} (field: ${ir.tenantModel!.tenantIdField})`
      : "No tenant model found",
  });

  // Dimension 6: Output fields documented (15 pts)
  const epWithOutput = ir.apiEndpoints.filter(ep =>
    Array.isArray(ep.outputFields) && ep.outputFields.length > 0
  );
  const outputRatio = ir.apiEndpoints.length > 0
    ? epWithOutput.length / ir.apiEndpoints.length : 0;
  const outputScore = Math.round(outputRatio * 15);
  dims.push({
    name: "output_fields",
    label: "Response Shape Documented",
    passed: outputRatio >= 0.8,
    score: outputScore,
    maxScore: 15,
    tip: "Document the response fields for each endpoint to enable spec_drift schema validation tests",
    detail: `${epWithOutput.length}/${ir.apiEndpoints.length} endpoints have output fields`,
  });

  // Calculate total score (0-100)
  const totalScore = dims.reduce((sum, d) => sum + d.score, 0);
  const maxPossible = dims.reduce((sum, d) => sum + d.maxScore, 0); // = 100
  const score = Math.round((totalScore / maxPossible) * 100);

  // Grade
  const grade: SpecHealth["grade"] =
    score >= 90 ? "A" :
    score >= 75 ? "B" :
    score >= 60 ? "C" :
    score >= 40 ? "D" : "F";

  // Summary
  const failedDims = dims.filter(d => !d.passed);
  const summary = failedDims.length === 0
    ? `Excellent spec — all ${dims.length} quality dimensions passed`
    : `${failedDims.length} dimension${failedDims.length > 1 ? "s" : ""} need improvement: ${failedDims.map(d => d.label).join(", ")}`;

  return { score, grade, dimensions: dims, summary };
}

export function assessSpecHealthFromResult(analysis: AnalysisResult): SpecHealth {
  return assessSpecHealth(analysis.ir);
}

// ─── Schicht 2: Risk Model Builder ────────────────────────────────────────────

export function buildRiskModel(analysis: AnalysisResult): RiskModel {
  const behaviors: ScoredBehavior[] = analysis.ir.behaviors.map(b => {
    const riskLevel = assessRiskLevel(b);
    return {
      behavior: b,
      riskLevel,
      proofTypes: determineProofTypes(b),
      priority: riskLevel === "critical" || riskLevel === "high" ? 0 : riskLevel === "medium" ? 1 : 2,
      rationale: buildRationale(b, riskLevel),
    };
  });

  const proofTargets: ProofTarget[] = [];
  let statusTransitionCounter = 0; // Increments per status_transition target to assign different transitions
  for (const sb of behaviors) {
    // Only generate proof targets for priority 0 (critical/high) and 1 (medium)
    // Low-risk behaviors (priority 2) don't get proof targets
    if (sb.priority === 2) continue;
    for (const pt of sb.proofTypes) {
      const target = buildProofTarget(sb, pt, analysis);
      if (target) {
        // Assign unique transitionIndex to each status_transition target
        if (pt === "status_transition") {
          target.transitionIndex = statusTransitionCounter++;
        }
        proofTargets.push(target);
      }
    }
  }

  // Bug 5 Fix: deduplicate boundary ProofTargets by (endpoint, fieldName) to avoid
  // identical test functions in the same file when multiple behaviors share the same endpoint+field
  const seenBoundaryKeys = new Set<string>();
  const deduplicatedProofTargets = proofTargets.filter(pt => {
    if (pt.proofType !== "boundary") return true;
    const fieldKey = pt.constraints?.[0]?.field || "value";
    const key = `${pt.endpoint || "unknown"}::${fieldKey}`;
    if (seenBoundaryKeys.has(key)) return false;
    seenBoundaryKeys.add(key);
    return true;
  });

  const idorVectors = analysis.ir.resources.reduce(
    (acc, r) => acc + r.operations.filter(o => o === "read" || o === "create").length, 0
  );
  const csrfEndpoints = behaviors.filter(b => b.proofTypes.includes("csrf")).length;

  return { behaviors, proofTargets: deduplicatedProofTargets, idorVectors, csrfEndpoints };
}

function assessRiskLevel(b: Behavior): RiskLevel {
  const combined = [...b.tags, ...b.riskHints].join(" ").toLowerCase();
  if (combined.includes("idor") || combined.includes("csrf") || combined.includes("cross-tenant") || combined.includes("bypass") || combined.includes("pii-leak") || combined.includes("dsgvo") || combined.includes("gdpr")) return "critical";
  if (combined.includes("no-show") || combined.includes("risk-scoring") || combined.includes("status") || combined.includes("state-change")) return "high";
  // business-logic behaviors with financial/inventory side-effects are high risk
  if (combined.includes("business-logic") || combined.includes("business_logic") ||
      combined.includes("balance") || combined.includes("deduct") || combined.includes("credit") ||
      combined.includes("restore") || combined.includes("stock") || combined.includes("inventory") ||
      combined.includes("refund") || combined.includes("transfer")) return "high";
  if (combined.includes("validation") || combined.includes("boundary") || combined.includes("limit")) return "medium";
  // api-response / spec-drift behaviors: at least medium (contract violations break clients)
  if (combined.includes("api-response") || combined.includes("response-schema") || combined.includes("spec-drift")) return "medium";
  // concurrency: race conditions and double-booking are high risk
  if (combined.includes("race-condition") || combined.includes("double-booking") || combined.includes("overbooking") ||
      combined.includes("atomic") || combined.includes("concurrent") || combined.includes("concurren")) return "high";
  // idempotency: duplicate/retry scenarios are high risk
  if (combined.includes("duplicate") || combined.includes("retry") || combined.includes("idempotent") ||
      combined.includes("deduplication") || combined.includes("dedup")) return "high";
  // auth_matrix: permission/role-based access is critical
  if (combined.includes("permission") || combined.includes("rbac") || combined.includes("authorization") ||
      combined.includes("role-based") || combined.includes("access-control") || combined.includes("auth-matrix")) return "critical";
  return "low";
}

export function determineProofTypes(b: Behavior): ProofType[] {
  const types = new Set<ProofType>();
  const combined = [...b.tags, ...b.riskHints].join(" ").toLowerCase();
  if (combined.includes("idor") || combined.includes("cross-tenant") || combined.includes("multi-tenant")) types.add("idor");
  // csrf: triggered by csrf tag, NOT by state-change (state-change belongs to status_transition)
  if (combined.includes("csrf")) types.add("csrf");
  if (combined.includes("brute-force") || combined.includes("rate-limit")) types.add("rate_limit");
  if (combined.includes("dsgvo") || combined.includes("privacy") || combined.includes("gdpr") || combined.includes("pii")) types.add("dsgvo");
  // state-machine behaviors: ONLY detect by explicit state-machine tag (NOT state-change riskHint)
  // state-change in riskHints means "writes to DB" (not a status-transition behavior)
  const behaviorTitle = b.title.toLowerCase();
  const tagsOnly = b.tags.join(" ").toLowerCase();
  const hasArrowInTitle = behaviorTitle.includes("→") || behaviorTitle.includes("->");
  if (tagsOnly.includes("state-machine") || hasArrowInTitle ||
      (tagsOnly.includes("transition") && !tagsOnly.includes("validation"))) {
    types.add("status_transition");
  }
  if (combined.includes("no-show") || combined.includes("risk-scoring") || combined.includes("cron")) types.add("risk_scoring");
  // Only add boundary if NOT a rate-limit or state-machine behavior (those have their own test types)
  const isRateLimit = combined.includes("rate-limit") || combined.includes("brute-force");
  const isStateMachine = tagsOnly.includes("state-machine") || hasArrowInTitle;
  if (!isRateLimit && !isStateMachine && (combined.includes("validation") || combined.includes("boundary") || combined.includes("limit"))) types.add("boundary");
  // Explicit business-logic tag: always add business_logic when tagged
  if (combined.includes("business-logic") || combined.includes("business_logic") ||
      combined.includes("side-effect") || combined.includes("side_effect")) {
    types.add("business_logic");
  }
  if (types.size === 0) types.add("business_logic");
  // spec_drift: add for behaviors tagged with api-response or that have an associated endpoint with outputFields
  // This generates tests that validate response shapes against Zod schemas
  if (combined.includes("api-response") || combined.includes("response-schema") || combined.includes("spec-drift")) {
    types.add("spec_drift");
  }
  // concurrency: race conditions, concurrent access, parallel requests, reservation/booking conflicts
  if (
    combined.includes("concurren") ||
    combined.includes("race-condition") ||
    combined.includes("race_condition") ||
    combined.includes("parallel") ||
    combined.includes("double-booking") ||
    combined.includes("double_booking") ||
    combined.includes("overbooking") ||
    combined.includes("atomic")
  ) {
    types.add("concurrency");
  }
  // idempotency: duplicate submissions, retry safety, exactly-once semantics
  if (
    combined.includes("idempoten") ||
    combined.includes("duplicate") ||
    combined.includes("retry") ||
    combined.includes("exactly-once") ||
    combined.includes("exactly_once") ||
    combined.includes("deduplication") ||
    combined.includes("dedup")
  ) {
    types.add("idempotency");
  }
  // auth_matrix: role-based access, permission checks, authorization rules
  if (
    combined.includes("auth-matrix") ||
    combined.includes("auth_matrix") ||
    combined.includes("role-based") ||
    combined.includes("rbac") ||
    combined.includes("permission") ||
    combined.includes("access-control") ||
    combined.includes("access_control") ||
    combined.includes("authorization")
  ) {
    types.add("auth_matrix");
  }
  // flow: multi-step flows defined in IR, or behaviors tagged with "flow" or "multi-step"
  if (
    combined.includes("flow") ||
    combined.includes("multi-step") ||
    combined.includes("multi_step") ||
    combined.includes("workflow") ||
    combined.includes("end-to-end") ||
    combined.includes("orchestration") ||
    combined.includes("saga") ||
    combined.includes("rollback")
  ) {
    types.add("flow");
  }
  // cron_job: scheduled jobs, cron triggers, background tasks
  if (
    combined.includes("cron") ||
    combined.includes("scheduled") ||
    combined.includes("background-job") ||
    combined.includes("background_job") ||
    combined.includes("no-show-release") ||
    combined.includes("noshowrelease") ||
    combined.includes("periodic") ||
    combined.includes("batch") ||
    combined.includes("recurring")
  ) {
    types.add("cron_job");
  }
  // webhook: webhook delivery, signature verification, retry logic
  if (
    combined.includes("webhook") ||
    combined.includes("callback-url") ||
    combined.includes("callback_url") ||
    combined.includes("callback") ||
    combined.includes("event-delivery") ||
    combined.includes("event_delivery") ||
    combined.includes("async-notification") ||
    combined.includes("hmac") ||
    combined.includes("signature")
  ) {
    types.add("webhook");
  }
  // feature_gate: plan-based feature gating, upgrade prompts
  if (
    combined.includes("feature-gate") ||
    combined.includes("feature_gate") ||
    combined.includes("plan-upgrade") ||
    combined.includes("plan_upgrade") ||
    combined.includes("professional-plan") ||
    combined.includes("enterprise-plan") ||
    combined.includes("gated") ||
    combined.includes("plan-gated") ||
    combined.includes("plan_gated") ||
    combined.includes("premium") ||
    combined.includes("tier") ||
    combined.includes("toggle") ||
    combined.includes("rollout") ||
    combined.includes("canary") ||
    combined.includes("a/b-test")
  ) {
    types.add("feature_gate");
  }
    // SEMANTIC HEURISTICS PASS 2: detect concurrency and idempotency from behavior content
  const semanticText = [
    b.title,
    ...(b.preconditions || []),
    ...(b.postconditions || []),
    ...(b.errorCases || []),
    b.specAnchor || "",
    b.subject || "",
    b.action || "",
    b.object || "",
  ].join(" ").toLowerCase();
  if (!types.has("concurrency")) {
    const isMoneyMutation =
      (semanticText.includes("transfer") || semanticText.includes("debit") ||
       semanticText.includes("credit") || semanticText.includes("payment") ||
       semanticText.includes("charge") || semanticText.includes("refund") ||
       semanticText.includes("withdraw") || semanticText.includes("deposit")) &&
      (semanticText.includes("amount") || semanticText.includes("balance") ||
       semanticText.includes("fund") || semanticText.includes("account"));
    const isInventoryMutation =
      (semanticText.includes("reserve") || semanticText.includes("book") ||
       semanticText.includes("allocate") || semanticText.includes("stock") ||
       semanticText.includes("seat") || semanticText.includes("slot") ||
       semanticText.includes("capacity") || semanticText.includes("inventory")) &&
      (semanticText.includes("create") || semanticText.includes("update") ||
       semanticText.includes("reduce") || semanticText.includes("decrement") ||
       semanticText.includes("consume") || semanticText.includes("use"));
    const hasAtomicKeyword =
      semanticText.includes("atomic") || semanticText.includes("must not") ||
      semanticText.includes("partial") || semanticText.includes("rollback") ||
      semanticText.includes("consistent") || semanticText.includes("integrity");
    if (isMoneyMutation || isInventoryMutation || hasAtomicKeyword) types.add("concurrency");
  }
  if (!types.has("idempotency")) {
    const hasIdempotencyKey =
      semanticText.includes("idempotencykey") || semanticText.includes("idempotency_key") ||
      semanticText.includes("requestid") || semanticText.includes("request_id") ||
      semanticText.includes("correlation") || semanticText.includes("x-request-id") ||
      semanticText.includes("x-idempotency");
    const hasRetrySemantics =
      semanticText.includes("retry") || semanticText.includes("duplicate") ||
      semanticText.includes("twice") || semanticText.includes("again") ||
      semanticText.includes("resubmit") || semanticText.includes("resend") ||
      semanticText.includes("already") || semanticText.includes("existing");
    const isPaymentOrTransfer =
      (semanticText.includes("payment") || semanticText.includes("transfer") ||
       semanticText.includes("charge") || semanticText.includes("order") ||
       semanticText.includes("submit")) &&
      (semanticText.includes("create") || semanticText.includes("initiate") ||
       semanticText.includes("process") || semanticText.includes("execute"));
    if (hasIdempotencyKey || hasRetrySemantics || isPaymentOrTransfer) types.add("idempotency");
  }
  return Array.from(types);
}

function buildRationale(b: Behavior, level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    critical: `Critical: "${b.title}" involves security boundary or PII. Failure = data breach or auth bypass.`,
    high: `High: "${b.title}" affects core business logic. Failure = financial or operational impact.`,
    medium: `Medium: "${b.title}" is a validation rule. Failure = incorrect feedback, no breach.`,
    low: `Low: "${b.title}" is a minor functional requirement.`,
  };
  return map[level];
}

function resolveEndpoint(behaviorId: string, proofType: ProofType, analysis: AnalysisResult): string | undefined {
  // Find endpoint that mentions this behavior
  const direct = analysis.ir.apiEndpoints.find(e => e.relatedBehaviors.includes(behaviorId));
  if (direct) return direct.name;

  // Fallback: find by proof type keywords
  const keywords: Record<ProofType, string[]> = {
    idor: ["list", "get", "find"],
    csrf: ["create", "update", "delete", "cancel"],
    status_transition: ["updateStatus", "status"],
    dsgvo: ["delete", "gdpr", "remove"],
    boundary: ["create", "update"],
    risk_scoring: ["risk", "scoring"],
    business_logic: ["create", "update"],
    rate_limit: [],
    spec_drift: ["get", "list", "create", "update"],
    concurrency: ["create", "update", "reserve", "book", "purchase"],
    idempotency: ["create", "update", "submit", "process"],
    auth_matrix: ["create", "update", "delete", "get", "list"],
    flow: ["create", "update", "status"],
    cron_job: ["cron", "trigger", "release", "debug"],
    webhook: ["webhook", "callback", "event"],
    feature_gate: ["create", "series", "ai", "premium"],
    e2e_flow: ["create", "submit", "book", "order", "register"],
  };

  const kws = keywords[proofType] || [];
  const match = analysis.ir.apiEndpoints.find(e =>
    kws.some(kw => e.name.toLowerCase().includes(kw))
  );
  return match?.name;
}

/**
 * Goldstandard: Extract structured field constraints from behavior text.
 * Parses preconditions, errorCases, and postconditions for boundary rules like:
 * - "title max 200 characters" → {field: "title", type: "string", max: 200}
 * - "partySize between 1 and 20" → {field: "partySize", type: "number", min: 1, max: 20}
 * - "dueDate must be in the future" → {field: "dueDate", type: "date", min: 1}
 * - "status: todo | in_progress | done" → {field: "status", type: "enum", enumValues: [...]}
 * - "taskIds max 50 items" → {field: "taskIds", type: "array", max: 50}
 */
export function extractConstraints(behavior: Behavior, ir: AnalysisIR): FieldConstraint[] {
  const constraints: FieldConstraint[] = [];
  const allText = [
    behavior.title,
    ...behavior.preconditions,
    ...behavior.postconditions,
    ...behavior.errorCases,
  ].join(" ");

  // Pattern: "<field> max <N> characters" or "<field> maximum <N> chars"
  const maxCharPattern = /(\w+)\s+(?:max|maximum)\s+(\d+)\s+(?:characters?|chars?|length)/gi;
  for (const m of Array.from(allText.matchAll(maxCharPattern))) {
    constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }

  // Pattern: "<field> min <N> characters"
  const minCharPattern = /(\w+)\s+(?:min|minimum)\s+(\d+)\s+(?:characters?|chars?|length)/gi;
  for (const m of Array.from(allText.matchAll(minCharPattern))) {
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.min = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", min: parseInt(m[2]) });
  }

  // Pattern: "<field> between <N> and <M>" or "<field> from <N> to <M>"
  const betweenPattern = /(\w+)\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)/gi;
  for (const m of Array.from(allText.matchAll(betweenPattern))) {
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) { existing.min = parseInt(m[2]); existing.max = parseInt(m[3]); }
    else constraints.push({ field: m[1], type: "number", min: parseInt(m[2]), max: parseInt(m[3]) });
  }

  // Pattern: "<field> max <N> items" or "<field> maximum <N> entries"
  const maxItemsPattern = /(\w+)\s+(?:max|maximum)\s+(\d+)\s+(?:items?|entries?|elements?|ids?)/gi;
  for (const m of Array.from(allText.matchAll(maxItemsPattern))) {
    constraints.push({ field: m[1], type: "array", max: parseInt(m[2]) });
  }

  // Pattern: "<field> must not exceed <N> characters" or "<field> cannot exceed <N>"
  const mustNotExceedPattern = /(\w+)\s+(?:must\s+not|cannot|can't|may\s+not)\s+exceed\s+(\d+)(?:\s+(?:characters?|chars?|items?|entries?))?/gi;
  for (const m of Array.from(allText.matchAll(mustNotExceedPattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if"].includes(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }
  // Pattern: "<field> exceeds <N>" or "<field> is empty or exceeds <N>"
  // Also handles: "<field> length exceeds <N>" → field is the word before "length"
  const exceedsPattern = /(\w+)\s+(?:length\s+)?(?:is\s+empty\s+or\s+)?exceeds?\s+(\d+)(?:\s+(?:characters?|chars?|items?|entries?))?/gi;
  for (const m of Array.from(allText.matchAll(exceedsPattern))) {
    const field = m[1].toLowerCase();
    // Skip common false positives and noise words
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if", "not", "length", "size", "array", "count"].includes(field)) continue;
    // Skip pure numbers (e.g. "400 if title exceeds" → skip "400")
    if (/^\d+$/.test(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }
  // Pattern: "<field> array exceeds <N> items" → extract field before "array"
  const arrayExceedsPattern = /(\w+)\s+array\s+exceeds?\s+(\d+)\s+(?:items?|entries?|elements?)/gi;
  for (const m of Array.from(allText.matchAll(arrayExceedsPattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which"].includes(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) { existing.max = parseInt(m[2]); existing.type = "array"; }
    else constraints.push({ field: m[1], type: "array", max: parseInt(m[2]) });
  }
  // Pattern: "<field> above <N>" (e.g. "pageSize above 100")
  const abovePattern = /(\w+)\s+(?:is\s+)?above\s+(\d+)/gi;
  for (const m of Array.from(allText.matchAll(abovePattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if"].includes(field)) continue;
    if (/^\d+$/.test(field)) continue;
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "number", max: parseInt(m[2]) });
  }
  // Pattern: "<field> limited to <N>" or "<field> up to <N>"
  const limitedToPattern = /(\w+)\s+(?:limited\s+to|up\s+to)\s+(\d+)(?:\s+(?:characters?|chars?|items?|entries?))?/gi;
  for (const m of Array.from(allText.matchAll(limitedToPattern))) {
    const existing = constraints.find(c => c.field === m[1]);
    if (existing) existing.max = parseInt(m[2]);
    else constraints.push({ field: m[1], type: "string", max: parseInt(m[2]) });
  }
  // Pattern: "max <N> <field>" or "maximum <N> <field>s"
  const maxNFieldPattern = /(?:max|maximum)\s+(\d+)\s+(\w+)/gi;
  const MAX_N_FIELD_NOISE = new Set(["characters", "chars", "items", "entries", "elements", "ids", "requests", "req", "calls", "per", "minute", "second", "hour", "day", "times"]);
  for (const m of Array.from(allText.matchAll(maxNFieldPattern))) {
    const field = m[2].replace(/s$/, ""); // remove plural
    if (MAX_N_FIELD_NOISE.has(m[2].toLowerCase())) continue; // skip noise words
    if (!constraints.find(c => c.field === field)) {
      const num = parseInt(m[1]);
      if (num > 0 && num < 10000) { // sanity check
        constraints.push({ field, type: "array", max: num });
      }
    }
  }
  // Pattern: "<field> array is empty" or "<field>s array is empty" → array min=1
  const arrayEmptyPattern = /(\w+)\s+(?:array|list|ids?)\s+is\s+empty/gi;
  for (const m of Array.from(allText.matchAll(arrayEmptyPattern))) {
    const field = m[1].toLowerCase();
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if", "the", "a", "an"].includes(field)) continue;
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "array", min: 1 });
    }
  }
  // Pattern: "<field> is empty" or "empty <field>" → min=1 (field must not be empty)
  const emptyFieldPattern = /(?:(\w+)\s+is\s+empty|empty\s+(\w+))/gi;
  for (const m of Array.from(allText.matchAll(emptyFieldPattern))) {
    const field = m[1] || m[2];
    const fl = field.toLowerCase();
    // Skip noise words and words that are actually array-type fields (handled above)
    if (["api", "it", "that", "this", "which", "value", "request", "returns", "return", "if", "the", "a", "an", "array", "list"].includes(fl)) continue;
    if (/^\d+$/.test(fl)) continue;
    if (!constraints.find(c => c.field === field)) {
      constraints.push({ field, type: "string", min: 1 });
    } else {
      const existing = constraints.find(c => c.field === field);
      if (existing && existing.min === undefined) existing.min = 1;
    }
  }
  // Pattern: "<field> must be in the future" or "<field> must be a future date"
  const futureDatePattern = /(\w*[Dd]ate\w*|\w*[Dd]ue\w*)\s+must\s+be\s+(?:in\s+the\s+)?future/gi;
  for (const m of Array.from(allText.matchAll(futureDatePattern))) {
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "date", min: 1 }); // min:1 means "tomorrow"
    }
  }

  // Pattern: "<field> must be in the past" or "past date"
  const pastDatePattern = /(\w*[Dd]ate\w*)\s+must\s+be\s+(?:in\s+the\s+)?past/gi;
  for (const m of Array.from(allText.matchAll(pastDatePattern))) {
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "date", max: -1 }); // max:-1 means "yesterday"
    }
  }
  // Pattern: "<field> is in the past" → implies must be future
  // e.g. "Returns 400 if dueDate is in the past"
  const isInPastPattern = /(\w*[Dd]ate\w*|\w*[Dd]ue\w*)\s+is\s+in\s+the\s+past/gi;
  for (const m of Array.from(allText.matchAll(isInPastPattern))) {
    if (!constraints.find(c => c.field === m[1])) {
      constraints.push({ field: m[1], type: "date", min: 1 }); // must be future
    }
  }

  // Merge with enums from IR
  for (const [field, vals] of Object.entries(ir.enums || {})) {
    if (!constraints.find(c => c.field === field)) {
      constraints.push({ field, type: "enum", enumValues: vals });
    }
  }

  return constraints;
}

export function buildProofTarget(sb: ScoredBehavior, pt: ProofType, analysis: AnalysisResult): ProofTarget | null {
  const b = sb.behavior;
  const base = { behaviorId: b.id, proofType: pt, riskLevel: sb.riskLevel };
  const endpoint = resolveEndpoint(b.id, pt, analysis);

  // Extract side-effects from postconditions (field changes, counter increments, balance changes)
  const sideEffects = b.postconditions.filter(pc => {
    const lpc = pc.toLowerCase();
    return pc.includes("+=") || pc.includes("=") || pc.includes("NOW()") || pc.includes("null") ||
      lpc.includes("count") || lpc.includes("balance") || lpc.includes("deduct") ||
      lpc.includes("credit") || lpc.includes("restore") || lpc.includes("stock") ||
      lpc.includes("refund") || lpc.includes("inventory");
  });
  // Sprint 3: pass through structured side-effects and error codes from Behavior
  const structuredSideEffects = b.structuredSideEffects;
  const errorCodes = b.errorCodes;

  if (pt === "idor") {
    return {
      ...base,
      id: `PROOF-${b.id}-IDOR`,
      description: `Cross-tenant access to ${b.object} must be rejected`,
      preconditions: ["TENANT_A and TENANT_B both exist with data", "User authenticated as TENANT_A"],
      assertions: [
        { type: "http_status", target: "response", operator: "in", value: [401, 403], rationale: "Cross-tenant access must be rejected" },
        { type: "field_absent", target: "response.data", operator: "not_contains", value: "TENANT_B_DATA", rationale: "No TENANT_B data must leak" },
      ],
      mutationTargets: [
        { description: `Remove ${analysis.ir.tenantModel?.tenantIdField || "tenantId"} filter in ${endpoint || "list"} query`, expectedKill: true },
        { description: "Return all records without tenant isolation", expectedKill: true },
      ],
      endpoint,
      sideEffects,
    };
  }

  if (pt === "csrf") {
    return {
      ...base,
      id: `PROOF-${b.id}-CSRF`,
      description: `${b.action} must be CSRF-protected`,
      preconditions: ["User authenticated", "No X-CSRF-Token header"],
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 403, rationale: "Must be exactly 403 without CSRF token" },
        { type: "db_state", target: "affected table", operator: "eq", value: 0, rationale: "No DB write without valid token" },
      ],
      mutationTargets: [
        { description: `Remove CSRF middleware from ${endpoint || "route"}`, expectedKill: true },
        { description: "Accept requests without CSRF token", expectedKill: true },
      ],
      endpoint,
      sideEffects,
    };
  }

  if (pt === "status_transition") {
    return {
      ...base,
      id: `PROOF-${b.id}-STATUS`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 200, rationale: "Valid transition must succeed" },
        { type: "field_value", target: "reservation.status", operator: "eq", value: "new_status", rationale: "Status must be updated in DB" },
      ],
      mutationTargets: [
        { description: `Remove ${b.action} transition from allowed list`, expectedKill: true },
        ...sideEffects.map(se => ({ description: `Remove ${se} side-effect`, expectedKill: true })),
      ],
      endpoint: endpoint || analysis.ir.apiEndpoints.find(e => e.name.toLowerCase().includes("status") || e.name.toLowerCase().includes("update"))?.name || "TODO_REPLACE_WITH_STATUS_ENDPOINT",
      sideEffects,
    };
  }

  if (pt === "dsgvo") {
    return {
      ...base,
      id: `PROOF-${b.id}-DSGVO`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: [
        { type: "field_value", target: "guest.name", operator: "eq", value: "[gelöscht]", rationale: "Name must be anonymized" },
        { type: "field_value", target: "guest.phone", operator: "eq", value: "[gelöscht]", rationale: "Phone must be anonymized" },
        { type: "field_value", target: "guest.email", operator: "eq", value: null, rationale: "Email must be deleted" },
      ],
      mutationTargets: [
        { description: "Skip name anonymization in GDPR delete handler", expectedKill: true },
        { description: "Skip phone anonymization", expectedKill: true },
        { description: "Cascade delete reservations instead of anonymizing", expectedKill: true },
      ],
      endpoint: endpoint || "guests.deleteGdpr",
      sideEffects,
    };
  }

  if (pt === "boundary") {
    // Extract boundary values from errorCases
    const boundaries = b.errorCases.filter(ec => ec.includes("→") || ec.includes("=") || ec.includes("→"));
    // Extract structured constraints from behavior text + IR enums
    const constraints = extractConstraints(b, analysis.ir);
    return {
      ...base,
      id: `PROOF-${b.id}-BOUND`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: boundaries.length > 0
        ? boundaries.map((ec) => ({
            type: "http_status" as const,
            target: "response",
            operator: "in" as const,
            value: ec.includes("allowed") ? [200] : [400, 422],
            rationale: ec,
          }))
        : [
            { type: "http_status" as const, target: "response", operator: "in" as const, value: [400, 422], rationale: "Boundary violation must be rejected" },
          ],
      mutationTargets: [
        { description: `Change >= to > in boundary validation (off-by-one)`, expectedKill: true },
        { description: `Remove null check`, expectedKill: true },
        ...constraints.filter(c => c.max !== undefined).map(c =>
          ({ description: `Remove max ${c.max} constraint on ${c.field}`, expectedKill: true })
        ),
      ],
      endpoint,
      sideEffects,
      constraints,
    };
  }

  if (pt === "risk_scoring") {
    return {
      ...base,
      id: `PROOF-${b.id}-RISK`,
      description: b.title,
      preconditions: ["guest.noShowRisk = 0 (verified)", "reservation.status = no_show"],
      assertions: [
        { type: "field_value", target: "guest.noShowRisk", operator: "gt", value: 0, rationale: "Risk must increase" },
        { type: "field_value", target: "guest.noShowRisk", operator: "lte", value: 100, rationale: "Risk must not exceed 100" },
        { type: "field_value", target: "guest.noShowCount", operator: "eq", value: "countBefore + 1", rationale: "Count must increment exactly once" },
      ],
      mutationTargets: [
        { description: "Remove noShowRisk update in riskScoring job", expectedKill: true },
        { description: "Set noShowRisk to 0 instead of incrementing", expectedKill: true },
      ],
      endpoint,
      sideEffects,
    };
  }

  // business_logic — only generate if endpoint is known
  if (pt === "business_logic") {
    if (!endpoint) return null; // No endpoint = no test (DiscardReason: no_endpoint)
    // Build resolvedPayload from endpoint inputFields
    const blEpDef = analysis.ir.apiEndpoints.find(e => e.name === endpoint);
    const blFields = blEpDef?.inputFields || [];
    const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
    const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
    const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
    const resolvedPayload: Record<string, unknown> = {};
    for (const f of blFields) {
      resolvedPayload[f.name] = getValidDefault(f, tenantConst);
    }
    return {
      ...base,
      id: `PROOF-${b.id}-BL`,
      description: b.title,
      preconditions: b.preconditions,
      assertions: b.postconditions.map((pc, i) => ({
        type: "field_value" as const,
        target: `result.${i}`,
        operator: "eq" as const,
        value: pc,
        rationale: `Spec postcondition: ${pc}`,
      })),
      mutationTargets: (() => {
        // Generate precise mutation targets from side-effects (Briefing Fix 5)
        const blMutations: Array<{description: string; expectedKill: boolean}> = [
          { description: `Remove success path in ${endpoint}`, expectedKill: true },
        ];
        for (const se of sideEffects) {
          if (se.includes("+=") || se.includes("-=") || se.toLowerCase().includes("stock") || se.toLowerCase().includes("count") || se.toLowerCase().includes("decrement") || se.toLowerCase().includes("increment")) {
            const fieldMatch = se.match(/(\w+)\s*(?:\+=|-=)/)?.[1] || se.split("=")[0].trim().split(".").pop();
            const field = fieldMatch || "counter";
            blMutations.push({ description: `Not updating ${field} after ${b.action} in ${endpoint}`, expectedKill: true });
          } else if (se.includes("NOW()") || se.toLowerCase().includes("timestamp") || se.toLowerCase().includes("createdat") || se.toLowerCase().includes("updatedat")) {
            const field = se.split("=")[0].trim().split(".").pop() || "timestamp";
            blMutations.push({ description: `Not setting ${field} timestamp in ${endpoint}`, expectedKill: true });
          } else {
            blMutations.push({ description: `Skip side effect: ${se}`, expectedKill: true });
          }
        }
        // Special case: stock decrement behaviors
        const titleLower = b.title.toLowerCase();
        if (titleLower.includes("stock") || titleLower.includes("decrement") || titleLower.includes("restore") || titleLower.includes("inventory")) {
          blMutations.push(
            { description: `Not decrementing stock after successful order`, expectedKill: true },
            { description: `Decrementing stock by wrong amount`, expectedKill: true }
          );
        }
        return blMutations;
      })(),
      endpoint,
      sideEffects,
      resolvedPayload: Object.keys(resolvedPayload).length > 0 ? resolvedPayload : undefined,
    };
  }

  if (pt === "spec_drift") {
    // Find the endpoint with outputFields to build schema validation assertions
    const epDef = endpoint ? analysis.ir.apiEndpoints.find(e => e.name === endpoint) : null;
    const outputFields = epDef?.outputFields || [];
    const inputFields = epDef?.inputFields || [];
    const tenantField = analysis.ir.tenantModel?.tenantIdField || "tenantId";
    const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
    const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
    // Build resolvedPayload for the query
    const resolvedPayload: Record<string, unknown> = {};
    for (const f of inputFields) {
      resolvedPayload[f.name] = getValidDefault(f, tenantConst);
    }
    const schemaName = endpoint ? `${endpoint.replace(/\./g, '_')}ResponseSchema` : null;
    return {
      ...base,
      id: `PROOF-${b.id}-DRIFT`,
      description: `API response shape for ${endpoint || b.object} matches spec (Zod validation)`,
      preconditions: ["Authenticated user", "At least one resource exists"],
      assertions: [
        { type: "http_status", target: "response", operator: "eq", value: 200, rationale: "Endpoint must return 200" },
        { type: "field_value", target: "response.data", operator: "not_null", value: null, rationale: "Response data must not be null" },
        ...outputFields.slice(0, 3).map(f => ({
          type: "field_value" as const,
          target: `response.data.${f}`,
          operator: "not_null" as const,
          value: null,
          rationale: `Spec requires field '${f}' in response`,
        })),
      ],
      mutationTargets: [
        { description: `Remove '${outputFields[0] || 'id'}' field from ${endpoint || b.object} response`, expectedKill: true },
        { description: `Return wrong type for response fields (e.g. string instead of number)`, expectedKill: true },
        ...outputFields.slice(1, 3).map(f => ({ description: `Omit '${f}' from response`, expectedKill: true })),
      ],
      endpoint,
      sideEffects,
      resolvedPayload: Object.keys(resolvedPayload).length > 0 ? resolvedPayload : undefined,
    };
  }
  if (pt === "concurrency") {
    // Build a valid payload for the concurrent operation
    const epDef = endpoint ? analysis.ir.apiEndpoints.find(e => e.name === endpoint) : null;
    const inputFields = epDef?.inputFields || [];
    const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
    const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
    const resolvedPayload: Record<string, unknown> = {};
    for (const f of inputFields) {
      resolvedPayload[f.name] = getValidDefault(f, tenantConst);
    }
    return {
      ...base,
      id: `PROOF-${b.id}-CONCURRENCY`,
      description: `Concurrent ${b.action} on ${b.object} must not cause race conditions or data corruption`,
      preconditions: [
        "Authenticated user",
        "Shared resource exists",
        "System under concurrent load",
      ],
      assertions: [
        { type: "http_status", target: "responses[0]", operator: "in", value: [200, 201, 409, 429], rationale: "First concurrent request must succeed or be rejected cleanly" },
        { type: "field_value", target: "finalState.count", operator: "eq", value: 1, rationale: "Exactly one operation must win — no double-processing" },
        { type: "field_value", target: "finalState.integrity", operator: "eq", value: true, rationale: "Data integrity must be maintained after concurrent access" },
      ],
      mutationTargets: [
        { description: `Remove mutex/lock around ${b.action} in ${endpoint || b.object}`, expectedKill: true },
        { description: `Allow both concurrent requests to succeed (double-booking)`, expectedKill: true },
        { description: `Not using atomic DB operation for ${b.object} update`, expectedKill: true },
      ],
      endpoint,
      sideEffects,
      resolvedPayload: Object.keys(resolvedPayload).length > 0 ? resolvedPayload : undefined,
    };
  }
  if (pt === "idempotency") {
    // Build a valid payload for the idempotent operation
    const epDef = endpoint ? analysis.ir.apiEndpoints.find(e => e.name === endpoint) : null;
    const inputFields = epDef?.inputFields || [];
    const tenantEntity = analysis.ir.tenantModel?.tenantEntity || "tenant";
    const tenantConst = `TEST_${tenantEntity.toUpperCase()}_ID`;
    const resolvedPayload: Record<string, unknown> = {};
    for (const f of inputFields) {
      resolvedPayload[f.name] = getValidDefault(f, tenantConst);
    }
    return {
      ...base,
      id: `PROOF-${b.id}-IDEMPOTENCY`,
      description: `Duplicate ${b.action} on ${b.object} must be idempotent — second call must not create duplicate`,
      preconditions: [
        "Authenticated user",
        "First request already succeeded",
      ],
      assertions: [
        { type: "http_status", target: "response2", operator: "in", value: [200, 201, 409], rationale: "Second identical request must return success or conflict — not 500" },
        { type: "field_value", target: "db.count", operator: "eq", value: 1, rationale: "Only one record must exist after two identical requests" },
        { type: "field_value", target: "response1.id", operator: "eq", value: "response2.id", rationale: "Both calls must return the same resource ID" },
      ],
      mutationTargets: [
        { description: `Remove duplicate-check before ${b.action} in ${endpoint || b.object}`, expectedKill: true },
        { description: `Not returning existing resource on duplicate ${b.action}`, expectedKill: true },
        { description: `Creating second record instead of returning existing one`, expectedKill: true },
      ],
      endpoint,
      sideEffects,
      resolvedPayload: Object.keys(resolvedPayload).length > 0 ? resolvedPayload : undefined,
    };
  }
  if (pt === "auth_matrix") {
    const roles = analysis.ir.authModel?.roles || [];
    const roleNames = roles.map(r => r.name);
    return {
      ...base,
      id: `PROOF-${b.id}-AUTHMATRIX`,
      description: `Authorization matrix for ${endpoint || b.object}: each role gets exactly the access it should`,
      preconditions: [
        "Multiple roles configured",
        "Endpoint requires specific role",
      ],
      assertions: [
        { type: "http_status", target: "unauthorizedResponse", operator: "in", value: [401, 403], rationale: "Unauthorized role must be rejected" },
        { type: "http_status", target: "authorizedResponse", operator: "in", value: [200, 201], rationale: "Authorized role must succeed" },
        { type: "field_absent", target: "unauthorizedResponse.data", operator: "eq", value: null, rationale: "Unauthorized response must not leak data" },
      ],
      mutationTargets: [
        { description: `Remove role check in ${endpoint || b.object}`, expectedKill: true },
        { description: `Allow lower-privileged role to access ${b.object}`, expectedKill: true },
        ...roleNames.slice(0, 2).map(role => ({
          description: `${role} should not be able to ${b.action} ${b.object}`,
          expectedKill: true,
        })),
      ],
      endpoint,
      sideEffects,
      structuredSideEffects,
      errorCodes,
    };
  }
  if (pt === "flow") {
    return {
      ...base,
      id: `PROOF-${b.id}-FLOW`,
      description: `Multi-step flow: ${b.title}`,
      preconditions: b.preconditions.length > 0 ? b.preconditions : ["System in initial state"],
      assertions: [
        { type: "http_status", target: "final_step_response", operator: "in", value: [200, 201], rationale: "Flow must complete successfully" },
        { type: "field_value", target: "final_state", operator: "not_null", value: null, rationale: "Final state must be set" },
      ],
      mutationTargets: [
        { description: "Skip intermediate step in flow", expectedKill: true },
        { description: "Allow flow to complete with missing precondition", expectedKill: true },
      ],
      endpoint,
      sideEffects,
      structuredSideEffects,
      errorCodes,
    };
  }
  if (pt === "cron_job") {
    return {
      ...base,
      id: `PROOF-${b.id}-CRON`,
      description: `Cron job: ${b.title}`,
      preconditions: b.preconditions.length > 0 ? b.preconditions : ["Cron trigger endpoint accessible"],
      assertions: [
        { type: "http_status", target: "trigger_response", operator: "in", value: [200, 204], rationale: "Cron trigger must succeed" },
        { type: "field_value", target: "processed_count", operator: "gt", value: 0, rationale: "Must process at least one record" },
      ],
      mutationTargets: [
        { description: "Remove cron job processing logic", expectedKill: true },
        { description: "Allow cron to run without precondition check", expectedKill: true },
      ],
      endpoint,
      sideEffects,
      structuredSideEffects,
      errorCodes,
    };
  }
  if (pt === "webhook") {
    return {
      ...base,
      id: `PROOF-${b.id}-WEBHOOK`,
      description: `Webhook: ${b.title}`,
      preconditions: b.preconditions.length > 0 ? b.preconditions : ["Webhook endpoint configured"],
      assertions: [
        { type: "http_status", target: "webhook_response", operator: "in", value: [200, 204], rationale: "Webhook must be delivered" },
        { type: "http_status", target: "invalid_sig_response", operator: "eq", value: 401, rationale: "Invalid signature must be rejected" },
      ],
      mutationTargets: [
        { description: "Remove webhook signature verification", expectedKill: true },
        { description: "Allow webhook delivery without retry on failure", expectedKill: true },
      ],
      endpoint,
      sideEffects,
      structuredSideEffects,
      errorCodes,
    };
  }
  if (pt === "rate_limit") {
    const loginEp = analysis.ir.authModel?.loginEndpoint || "/api/trpc/auth.login";
    return {
      ...base,
      id: `PROOF-${b.id}-RATELIMIT`,
      description: `Rate limit: ${b.title}`,
      preconditions: ["Login endpoint accessible", "Rate limit counter at 0"],
      assertions: [
        { type: "http_status" as const, target: "response_after_5_attempts", operator: "eq" as const, value: 429, rationale: "Must be rate-limited after repeated failed logins" },
        { type: "http_status" as const, target: "response_after_3_attempts", operator: "not_contains" as const, value: 429, rationale: "Must not be rate-limited prematurely" },
      ],
      mutationTargets: [
        { description: "Remove rate limiting middleware from login endpoint", expectedKill: true },
        { description: "Set rate limit threshold too high (> 100 attempts)", expectedKill: true },
        { description: "Never reset rate limit counter after successful login", expectedKill: true },
      ],
      endpoint: loginEp,
      sideEffects,
      structuredSideEffects,
      errorCodes,
    };
  }
  if (pt === "feature_gate") {
    return {
      ...base,
      id: `PROOF-${b.id}-FEATUREGATE`,
      description: `Feature gate: ${b.title}`,
      preconditions: b.preconditions.length > 0 ? b.preconditions : ["Free-tier user exists", "Professional-tier user exists"],
      assertions: [
        { type: "http_status", target: "free_tier_response", operator: "eq", value: 403, rationale: "Free-tier must be blocked" },
        { type: "http_status", target: "pro_tier_response", operator: "in", value: [200, 201], rationale: "Pro-tier must succeed" },
      ],
      mutationTargets: [
        { description: "Remove plan check from feature gate", expectedKill: true },
        { description: "Allow free-tier access to gated feature", expectedKill: true },
      ],
      endpoint,
      sideEffects,
      structuredSideEffects,
      errorCodes,
    };
  }

  return null;
}

