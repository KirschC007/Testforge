/**
 * Declarative Risk Rule Engine for TestForge.
 * Replaces the 142 if-includes chains in determineProofTypes() with a
 * data-driven rule table. New ProofTypes = add one rule, no if-refactoring.
 */
import type { Behavior, APIEndpoint, AnalysisIR, ProofType } from "./types";

export interface RiskRule {
  proofType: ProofType;
  triggers: {
    /** behavior text (title + preconditions + postconditions + errorCases) contains one of these */
    keywords?: string[];
    /** endpoint name matches one of these patterns (*.action or exact) */
    endpointPatterns?: string[];
    /** behavior has one of these tags */
    tags?: string[];
    /** endpoint has one of these fields (by name or isTenantKey) */
    hasFields?: string[];
    /** custom condition functions */
    conditions?: ((behavior: Behavior, endpoint?: APIEndpoint) => boolean)[];
  };
  /** higher = evaluated first */
  priority: number;
}

export const RISK_RULES: RiskRule[] = [
  // ─── IDOR / Cross-Tenant ───────────────────────────────────────────────────
  {
    proofType: "idor",
    triggers: {
      hasFields: [
        "tenantId", "restaurantId", "shopId", "workspaceId", "clinicId",
        "hotelId", "agencyId", "companyId", "fleetId", "studioId",
        "kitchenId", "academyId", "organizerId",
      ],
      keywords: ["cross-tenant", "isolation", "multi-tenant", "belongs to", "idor"],
      tags: ["authorization", "security"],
    },
    priority: 100,
  },
  // ─── DSGVO / GDPR ─────────────────────────────────────────────────────────
  {
    proofType: "dsgvo",
    triggers: {
      keywords: [
        "gdpr", "dsgvo", "anonymize", "anonymise", "personal data", "pii",
        "art. 17", "recht auf löschung", "right to erasure", "data export",
        "data deletion", "privacy", "right to be forgotten",
      ],
      tags: ["dsgvo", "gdpr", "compliance", "pii"],
      endpointPatterns: [
        "*.gdprDelete", "*.gdprExport", "*.anonymize", "*.export",
        "*.delete", "*.anonymise",
      ],
    },
    priority: 95,
  },
  // ─── CSRF ─────────────────────────────────────────────────────────────────
  {
    proofType: "csrf",
    triggers: {
      keywords: ["csrf", "x-csrf", "double-submit", "csrf-token"],
      tags: ["csrf"],
      conditions: [
        (b) => {
          const method = (b as unknown as Record<string, unknown>).httpMethod as string | undefined;
          return method === "POST" || method === "PATCH" || method === "DELETE";
        },
      ],
    },
    priority: 90,
  },
  // ─── Status Transition ────────────────────────────────────────────────
  {
    proofType: "status_transition",
    triggers: {
      keywords: [
        "status", "transition", "state machine", "workflow", "→", "->",
        "state change", "forbidden transition",
      ],
      tags: ["state-machine", "transition"],
      endpointPatterns: [
        "*.updateStatus", "*.status", "*.freeze", "*.unfreeze",
        "*.cancel", "*.complete", "*.archive", "*.publish", "*.approve",
        "*.reject", "*.confirm", "*.activate", "*.suspend",
      ],
      // Fix 5: Only PATCH/PUT/POST endpoints trigger status-transition tests (not GET)
      conditions: [
        (b, ep) => {
          if (!ep) return false; // no endpoint → rely on keyword/tag match
          const m = (ep.method || "").toUpperCase();
          return m === "PATCH" || m === "PUT" || m === "POST";
        },
      ],
    },
    priority: 80,
  },
  // ─── Auth Matrix ──────────────────────────────────────────────────────────
  {
    proofType: "auth_matrix",
    triggers: {
      keywords: [
        "role", "permission", "authorization", "rbac", "access control",
        "forbidden", "admin only", "manager only", "403", "unauthorized",
      ],
      conditions: [
        (b) => {
          const auth = (b as unknown as Record<string, unknown>).auth as string | undefined;
          return auth !== "public" && auth !== "publicProcedure";
        },
      ],
    },
    priority: 75,
  },
  // ─── Boundary ─────────────────────────────────────────────────────────────
  {
    proofType: "boundary",
    triggers: {
      conditions: [
        (_, ep) => (ep?.inputFields || []).some(
          f => f.min !== undefined || f.max !== undefined
        ),
      ],
      keywords: ["min", "max", "range", "limit", "length", "boundary", "validation", "must not exceed", "at least", "at most"],
    },
    priority: 70,
  },
  // ─── Concurrency ──────────────────────────────────────────────────────────
  {
    proofType: "concurrency",
    triggers: {
      keywords: [
        "concurrent", "race condition", "race-condition", "atomic", "simultaneously",
        "last ticket", "last room", "last spot", "exactly one succeeds",
        "double-booking", "overbooking", "oversell", "parallel",
      ],
      tags: ["atomic", "concurrent", "concurrency", "overbooking", "race-condition"],
    },
    priority: 65,
  },
  // ─── Rate Limit ───────────────────────────────────────────────────────────
  {
    proofType: "rate_limit",
    triggers: {
      keywords: [
        "rate limit", "throttle", "brute force", "too many requests",
        "429", "lockout", "rate-limit",
      ],
      tags: ["rate-limit", "rate_limit"],
      endpointPatterns: ["auth.login", "auth.register"],
    },
    priority: 60,
  },
  // ─── Idempotency ──────────────────────────────────────────────────────────
  {
    proofType: "idempotency",
    triggers: {
      keywords: [
        "idempotent", "idempotency", "duplicate", "same key", "retry",
        "already exists", "409", "resubmit", "resend",
        "deduplication", "dedup",
      ],
      tags: ["retry", "idempotency", "idempotent", "deduplication", "dedup"],
      conditions: [
        (_, ep) => (ep?.inputFields || []).some(
          f => f.name.toLowerCase().includes("idempotency")
        ),
      ],
    },
    priority: 55,
  },
  // ─── Business Logic ───────────────────────────────────────────────────────
  {
    proofType: "business_logic",
    triggers: {
      keywords: [
        "calculate", "compute", "discount", "surcharge", "fee", "total",
        "balance", "stock", "capacity", "inventory", "side-effect",
        "business-logic",
      ],
      conditions: [
        (b) => (b.postconditions || []).length > 0,
      ],
    },
    priority: 50,
  },
  // ─── Risk Scoring ─────────────────────────────────────────────────────────
  {
    proofType: "risk_scoring",
    triggers: {
      keywords: [
        "no-show", "risk-scoring", "risk score", "fraud", "anomaly",
        "cron", "scheduled", "background job",
      ],
    },
    priority: 45,
  },
  // ─── Spec Drift ───────────────────────────────────────────────────────────
  {
    proofType: "spec_drift",
    triggers: {
      keywords: ["api-response", "response-schema", "spec-drift", "contract"],
      tags: ["api-response", "response-schema", "spec-drift"],
    },
    priority: 40,
  },
  // ─── Webhook ──────────────────────────────────────────────────────────────
  {
    proofType: "webhook",
    triggers: {
      keywords: [
        "webhook", "callback-url", "callback_url", "callback", "event-delivery",
        "hmac", "signature", "async-notification",
      ],
      tags: ["webhook", "callback"],
    },
    priority: 35,
  },
  // ─── Feature Gate ─────────────────────────────────────────────────────────
  {
    proofType: "feature_gate",
    triggers: {
      keywords: [
        "feature-gate", "feature_gate", "plan-upgrade", "professional-plan",
        "enterprise-plan", "gated", "premium", "tier", "toggle", "rollout",
      ],
    },
    priority: 30,
  },
  // ─── Cron Job ─────────────────────────────────────────────────────────────
  {
    proofType: "cron_job",
    triggers: {
      keywords: [
        "cron", "scheduled", "background-job", "background_job",
        "no-show-release", "periodic", "batch", "recurring",
      ],
    },
    priority: 25,
  },
  // ─── SQL Injection ──────────────────────────────────────────────────────────
  {
    proofType: "sql_injection",
    triggers: {
      keywords: [
        "sql injection", "sql-injection", "raw sql", "string concatenation",
        "parameterized", "prepared statement", "query builder", "orm bypass",
        "user input", "search query", "filter query", "dynamic query",
        "unsanitized", "unescaped", "injection attack",
      ],
      tags: ["sql-injection", "injection", "security"],
      endpointPatterns: ["*.search", "*.filter", "*.query", "*.list", "*.find"],
    },
    priority: 92,
  },
  // ─── Hardcoded Secret ─────────────────────────────────────────────────────
  {
    proofType: "hardcoded_secret",
    triggers: {
      keywords: [
        "hardcoded", "hardcoded secret", "hardcoded key", "hardcoded password",
        "jwt secret", "api key", "secret key", "private key", "env variable",
        "environment variable", "process.env", "config secret", "credential",
        "token rotation", "secret rotation", "secret management",
      ],
      tags: ["hardcoded-secret", "secret", "credential", "security"],
    },
    priority: 91,
  },
  // ─── E2E Flow ─────────────────────────────────────────────────────────────
  {
    proofType: "e2e_flow",
    triggers: {
      keywords: [
        "user flow", "user journey", "end-to-end", "e2e", "scenario",
        "happy path", "full flow",
      ],
      tags: ["e2e", "user-flow"],
    },
    priority: 20,
  },
  // ─── Flow (multi-step / workflow) ─────────────────────────────────────────────────────────────────────
  // Note: "flow" is a legacy ProofType alias. Tests expect 'flow' from tags/riskHints
  // like 'flow', 'multi-step', 'workflow', 'end-to-end'.
  {
    proofType: "flow" as ProofType,
    triggers: {
      keywords: [
        "multi-step", "workflow", "end-to-end",
      ],
      tags: ["flow", "multi-step", "workflow"],
    },
    priority: 18,
  },
  // ─── Negative Amount / Financial Bypass ────────────────────────────────────────────────
  {
    proofType: "negative_amount" as ProofType,
    triggers: {
      keywords: [
        "amount", "price", "payment", "transfer", "charge", "debit", "credit",
        "balance", "fee", "cost", "refund", "withdrawal", "deposit",
        "negative", "zero", "minimum amount", "positive",
        "financial", "monetary", "currency", "money",
      ],
      tags: ["financial", "payment", "amount", "money", "transfer"],
    },
    priority: 93,
  },
  // ─── AML / Structuring Bypass ─────────────────────────────────────────────────────────
  {
    proofType: "aml_bypass" as ProofType,
    triggers: {
      keywords: [
        "aml", "anti-money laundering", "structuring", "smurfing", "velocity",
        "threshold", "suspicious", "transaction limit", "daily limit",
        "compliance", "kyc", "know your customer", "reporting", "flagged",
        "large transaction", "bulk transaction", "rapid transaction",
      ],
      tags: ["aml", "compliance", "financial", "velocity", "kyc"],
    },
    priority: 96,
  },
  // ─── Cross-Tenant Chain Attack ───────────────────────────────────────────────────────
  {
    proofType: "cross_tenant_chain" as ProofType,
    triggers: {
      keywords: [
        "tenant", "organization", "workspace", "multi-tenant", "isolation",
        "cross-tenant", "tenant isolation", "data isolation", "tenant boundary",
        "tenant id", "org id", "workspace id", "tenant context",
        "access control", "resource ownership", "data segregation",
      ],
      tags: ["multi-tenant", "tenant", "isolation", "idor", "access-control"],
    },
    priority: 94,
  },
  // ─── Concurrent Write / Race Condition ────────────────────────────────────────────────
  {
    proofType: "concurrent_write" as ProofType,
    triggers: {
      keywords: [
        "concurrent", "race condition", "double spend", "double booking",
        "optimistic lock", "pessimistic lock", "version", "etag",
        "simultaneous", "parallel", "atomic", "transaction", "idempotent",
        "reserve", "book", "seat", "slot", "inventory", "stock",
      ],
      tags: ["concurrency", "race-condition", "locking", "atomic"],
    },
    priority: 88,
  },
  // ─── Mass Assignment / Parameter Pollution ──────────────────────────────────────────────
  {
    proofType: "mass_assignment" as ProofType,
    triggers: {
      keywords: [
        "mass assignment", "parameter pollution", "allowlist", "whitelist",
        "field filtering", "input sanitization", "role escalation",
        "privilege escalation", "admin field", "protected field",
        "readonly", "immutable", "not updatable", "cannot change",
        "prototype pollution", "__proto__",
      ],
      tags: ["mass-assignment", "security", "input-validation", "privilege-escalation"],
    },
    priority: 87,
  },
];

/**
 * Determine proof types for a behavior using declarative rules.
 * Replaces the 200-line if-chain in risk-model.ts determineProofTypes().
 *
 * Falls back to "business_logic" if no rules match.
 */
export function evaluateRiskRules(
  behavior: Behavior,
  endpoint?: APIEndpoint,
  _ir?: AnalysisIR
): Set<ProofType> {
  const types = new Set<ProofType>();

  // Build combined text for keyword matching
  const combined = [
    behavior.title,
    ...(behavior.preconditions || []),
    ...(behavior.postconditions || []),
    ...(behavior.errorCases || []),
    ...(behavior.tags || []),
    ...(behavior.riskHints || []),
    behavior.specAnchor || "",
  ].join(" ").toLowerCase();

  // Sort rules by priority (descending) and evaluate
  const sortedRules = [...RISK_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    let matched = false;

    // Keyword match
    if (!matched && rule.triggers.keywords) {
      matched = rule.triggers.keywords.some(kw => combined.includes(kw.toLowerCase()));
    }

    // Tag match
    if (!matched && rule.triggers.tags) {
      matched = rule.triggers.tags.some(tag => (behavior.tags || []).includes(tag));
    }

    // Endpoint pattern match
    if (!matched && rule.triggers.endpointPatterns && endpoint) {
      matched = rule.triggers.endpointPatterns.some(pat => {
        if (pat.startsWith("*.")) return endpoint.name.endsWith(pat.slice(1));
        return endpoint.name === pat;
      });
    }

    // Field match (endpoint has a tenant key or named field)
    if (!matched && rule.triggers.hasFields && endpoint) {
      matched = rule.triggers.hasFields.some(
        f => (endpoint.inputFields || []).some(
          ef => ef.name === f || ef.isTenantKey
        )
      );
    }

    // Custom condition match
    if (!matched && rule.triggers.conditions) {
      matched = rule.triggers.conditions.some(fn => {
        try { return fn(behavior, endpoint); } catch { return false; }
      });
    }

    if (matched) types.add(rule.proofType);
  }

  // Fallback: always emit business_logic if nothing else matched
  if (types.size === 0) types.add("business_logic");

  return types;
}
