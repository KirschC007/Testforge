import type { AnalysisResult, ProofType } from "./types";

export type ProofGenerationMode = "gold" | "conservative" | "minimal";

export type ProofGenerationProfile = {
  mode: ProofGenerationMode;
  allowedProofTypes: Set<ProofType>;
  note: string;
  skippedNote: string;
};

const ALL_PROOF_TYPES: ProofType[] = [
  "idor",
  "csrf",
  "rate_limit",
  "business_logic",
  "dsgvo",
  "status_transition",
  "boundary",
  "risk_scoring",
  "spec_drift",
  "concurrency",
  "idempotency",
  "auth_matrix",
  "flow",
  "cron_job",
  "webhook",
  "feature_gate",
  "e2e_flow",
  "sql_injection",
  "hardcoded_secret",
  "negative_amount",
  "aml_bypass",
  "cross_tenant_chain",
  "concurrent_write",
  "mass_assignment",
  "db_transaction",
  "audit_log",
  "graphql",
  "accessibility",
  "property_based",
  "e2e_smart_form",
  "e2e_user_journey",
  "e2e_perf_budget",
  "e2e_visual",
  "e2e_network",
  "e2e_a11y_full",
  "stateful_sequence",
];

const CONSERVATIVE_PROOF_TYPES: ProofType[] = [
  "idor",
  "csrf",
  "rate_limit",
  "business_logic",
  "dsgvo",
  "status_transition",
  "boundary",
  "spec_drift",
  "auth_matrix",
  "webhook",
  "sql_injection",
  "hardcoded_secret",
  "negative_amount",
  "mass_assignment",
  "audit_log",
  "graphql",
  "accessibility",
  "property_based",
  "stateful_sequence",
];

const MINIMAL_PROOF_TYPES: ProofType[] = [
  "boundary",
  "spec_drift",
  "rate_limit",
  "webhook",
  "sql_injection",
  "hardcoded_secret",
];

export function getProofGenerationProfile(analysis: AnalysisResult): ProofGenerationProfile {
  const scope = analysis.supportedScope;
  if (!scope || scope.tier === "gold" || (scope.confidenceScore >= 90 && scope.goldReadinessScore >= 85)) {
    return {
      mode: "gold",
      allowedProofTypes: new Set(ALL_PROOF_TYPES),
      note: "Gold Standard path: full proof catalog enabled.",
      skippedNote: "",
    };
  }

  if (scope.tier === "supported" && scope.confidenceScore >= 60 && scope.goldReadinessScore >= 50) {
    return {
      mode: "conservative",
      allowedProofTypes: new Set(CONSERVATIVE_PROOF_TYPES),
      note: "Conservative mode: high-assumption proof types are disabled until Gold Readiness improves.",
      skippedNote: "Skipped high-assumption proof types for a non-gold stack.",
    };
  }

  return {
    mode: "minimal",
    allowedProofTypes: new Set(MINIMAL_PROOF_TYPES),
    note: "Minimal mode: only low-assumption proof types are generated for weak or heuristic stacks.",
    skippedNote: "Skipped aggressive proof types because stack signals are too weak for trustworthy generation.",
  };
}
