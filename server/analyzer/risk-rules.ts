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

  // ─── DB Transaction / Atomicity ─────────────────────────────────────────────
  {
    proofType: "db_transaction" as ProofType,
    triggers: {
      keywords: [
        "transaction", "rollback", "atomic", "atomicity", "commit",
        "saga", "two-phase", "2pc", "consistency", "acid",
        "partial write", "partial failure", "compensating",
        "multi-step", "multi step", "side-effect",
      ],
      tags: ["transaction", "atomic", "consistency", "acid", "rollback"],
    },
    priority: 76,
  },

  // ─── Audit Log Validation ────────────────────────────────────────────────────
  {
    proofType: "audit_log" as ProofType,
    triggers: {
      keywords: [
        "audit", "audit trail", "audit log", "event log", "immutable log",
        "history", "trail", "who did what", "activity log",
        "compliance log", "access log", "forensic", "non-repudiation",
        "hipaa", "psd2", "sox", "loggable",
      ],
      tags: ["audit", "compliance", "logging", "hipaa", "psd2", "sox", "forensic"],
    },
    priority: 86,
  },

  // ─── Accessibility / WCAG 2.1 AA ────────────────────────────────────────────
  {
    proofType: "accessibility" as ProofType,
    triggers: {
      keywords: [
        "user interface", "ui", "form", "modal", "dialog", "button", "input",
        "accessible", "wcag", "aria", "screen reader", "keyboard", "focus",
        "a11y", "accessibility", "tab order", "label", "alt text",
        "color contrast", "font size", "responsive", "mobile",
      ],
      tags: ["ui", "a11y", "wcag", "frontend", "accessibility", "form"],
    },
    priority: 22,
  },

  // ─── True E2E (Phase 1): Smart Form Tests ─────────────────────────────────────
  // Triggers for create/update endpoints — generates a UI test that fills the form,
  // submits, and verifies success. Uses smart selector fallbacks (label/placeholder/testid).
  {
    proofType: "e2e_smart_form" as ProofType,
    triggers: {
      conditions: [
        (_, ep) => {
          if (!ep) return false;
          const name = ep.name.toLowerCase();
          // Only fire for write endpoints with input fields
          const isWrite = name.includes("create") || name.includes("update") ||
            name.includes("add") || name.includes("edit") || name.includes("submit");
          return isWrite && (ep.inputFields || []).filter(f => !f.isTenantKey).length >= 1;
        },
      ],
      keywords: ["form", "submit", "input", "create form", "update form", "edit form"],
      tags: ["form", "ui", "e2e"],
    },
    priority: 17,
  },

  // ─── True E2E (Phase 1): Multi-Step User Journey ──────────────────────────────
  // Triggers when the IR has userFlows. Each flow becomes a multi-step UI test.
  {
    proofType: "e2e_user_journey" as ProofType,
    triggers: {
      keywords: ["user journey", "user flow", "happy path", "end-to-end scenario", "funnel"],
      tags: ["user-flow", "journey", "e2e", "scenario"],
    },
    priority: 16,
  },

  // ─── True E2E (Phase 1): Performance Budget (Core Web Vitals) ─────────────────
  // Triggers when behavior mentions performance/speed/UX requirements.
  // Generates a test that measures LCP, CLS, TTFB and asserts against budgets.
  {
    proofType: "e2e_perf_budget" as ProofType,
    triggers: {
      keywords: [
        "performance", "page speed", "load time", "core web vitals",
        "lcp", "cls", "fcp", "ttfb", "lighthouse", "web vitals",
      ],
      tags: ["performance", "perf", "speed", "web-vitals"],
    },
    priority: 14,
  },

  // ─── Phase A — Stateful API Sequences (Schemathesis-killer) ──────────────────
  // Triggers when a resource has BOTH create AND read endpoints — chains the full
  // CRUD lifecycle in a single test to catch sequence-dependent bugs that single-call
  // tests miss (orphaned records, stale caches, inconsistent state).
  {
    proofType: "stateful_sequence" as ProofType,
    triggers: {
      conditions: [
        (_, ep) => {
          if (!ep) return false;
          const n = ep.name.toLowerCase();
          // Trigger only on create endpoints — sequence builds outward from create
          return n.includes("create") || n.includes("add") || n.includes("post");
        },
      ],
      keywords: [
        "lifecycle", "crud", "stateful", "data flow", "sequence",
        "create then read", "create then update", "end to end data",
      ],
      tags: ["lifecycle", "crud", "sequence", "stateful"],
    },
    priority: 19, // High priority — catches integration bugs
  },

  // ─── True E2E (Phase 2): Visual Regression ────────────────────────────────────
  // Triggers when behavior mentions UI/visual concerns. Captures screenshot per page,
  // compares against baseline (auto-created on first run). Fails if >1% pixel diff.
  {
    proofType: "e2e_visual" as ProofType,
    triggers: {
      keywords: [
        "visual", "screenshot", "layout", "design", "styling", "appearance",
        "responsive design", "ui regression", "visual regression",
      ],
      tags: ["visual", "ui", "design", "screenshot"],
    },
    priority: 13,
  },

  // ─── True E2E (Phase 2): Network Conditions ───────────────────────────────────
  // Tests app behavior under slow 3G, offline, API errors, timeouts.
  // Triggers when behavior mentions reliability/error-handling/offline concerns.
  {
    proofType: "e2e_network" as ProofType,
    triggers: {
      keywords: [
        "offline", "network error", "slow connection", "3g", "timeout",
        "graceful degradation", "error boundary", "fallback ui", "retry",
        "connection lost", "no internet", "loading state",
      ],
      tags: ["network", "offline", "reliability", "error-handling"],
    },
    priority: 12,
  },

  // ─── True E2E (Phase 2): Full WCAG 2.1 AA Audit ───────────────────────────────
  // Categorized accessibility tests by WCAG criterion, not just one bulk axe scan.
  // Triggers similar to accessibility but with deeper coverage scope.
  {
    proofType: "e2e_a11y_full" as ProofType,
    triggers: {
      keywords: [
        "wcag 2.1", "wcag aa", "section 508", "ada compliance",
        "assistive technology", "screen reader compatibility",
        "color contrast", "keyboard navigation", "focus management",
      ],
      tags: ["wcag", "a11y-full", "accessibility-audit", "section-508"],
    },
    priority: 11,
  },

  // ─── Property-Based Fuzz Testing ──────────────────────────────────────────────
  // Triggers for any endpoint that has typed input fields — fast-check generates
  // 50 random valid inputs and verifies invariants hold (no 500, consistent shape).
  {
    proofType: "property_based" as ProofType,
    triggers: {
      conditions: [
        (_, ep) => (ep?.inputFields || []).filter(f => !f.isTenantKey).length >= 2,
      ],
      keywords: [
        "input validation", "field validation", "schema validation",
        "boundary", "range", "constraint", "type safety",
        "fuzz", "random", "arbitrary",
      ],
    },
    priority: 15, // Low priority — runs after all specific proof types
  },

  // ─── GraphQL Security ─────────────────────────────────────────────────────────
  {
    proofType: "graphql" as ProofType,
    triggers: {
      keywords: [
        "graphql", "graph ql", "schema definition language", "sdl",
        "type query", "type mutation", "type subscription",
        "__introspection", "query depth", "query complexity",
        "hasura", "apollo", "pothos", "nexus", "relay",
      ],
      tags: ["graphql", "gql", "api"],
      endpointPatterns: ["*/graphql", "graphql"],
    },
    priority: 89,
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
