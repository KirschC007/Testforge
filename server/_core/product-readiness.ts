export type Plan = "free" | "pro" | "team" | "enterprise";

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 1,
  pro: 50,
  team: 200,
  enterprise: Infinity,
};

export const PLAN_PRICES_USD: Record<Plan, { monthly: number | null; perAnalysis: number | null }> = {
  free: { monthly: 0, perAnalysis: 0 },
  pro: { monthly: null, perAnalysis: 19 },
  team: { monthly: 499, perAnalysis: null },
  enterprise: { monthly: null, perAnalysis: null },
};

export type ReadinessArea =
  | "live_benchmarks"
  | "observability"
  | "billing_usage"
  | "queue_workers"
  | "artifact_retention"
  | "security_audit"
  | "golden_dataset"
  | "sandbox_execution"
  | "enterprise_admin"
  | "sales_readiness";

export interface ReadinessItem {
  area: ReadinessArea;
  title: string;
  status: "implemented" | "partial" | "planned";
  proof: string;
  nextScaleStep: string;
}

export type EvidenceCase = {
  title: string;
  category: string;
  risk: "critical" | "high" | "medium";
  brokenPattern: string;
  testForgeProof: string;
  buyerValue: string;
};

export function normalizePlan(plan: unknown): Plan {
  return plan === "pro" || plan === "team" || plan === "enterprise" ? plan : "free";
}

export function getDailyAnalysisLimit(plan: unknown, role?: string | null): number {
  if (role === "admin") return Infinity;
  return PLAN_LIMITS[normalizePlan(plan)];
}

export function assertWithinUsageLimit(params: {
  plan: unknown;
  role?: string | null;
  todayCount: number;
}): void {
  const plan = normalizePlan(params.plan);
  const limit = getDailyAnalysisLimit(plan, params.role);
  if (limit !== Infinity && params.todayCount >= limit) {
    throw new Error(`Daily limit reached: ${limit} analyses/day on ${plan} plan. Upgrade for more.`);
  }
}

export function buildQueueSnapshot(params: {
  runningJobs: number;
  queuedJobs?: number;
  plan?: unknown;
}) {
  const plan = normalizePlan(params.plan);
  const priority = plan === "enterprise" ? 100 : plan === "team" ? 70 : plan === "pro" ? 40 : 10;
  return {
    mode: "in_process_worker",
    runningJobs: params.runningJobs,
    queuedJobs: params.queuedJobs ?? 0,
    priority,
    scaleTarget: "external durable queue with worker autoscaling",
  };
}

export function buildObservabilitySnapshot(params: {
  analysisId?: number;
  projectName?: string;
  startedAt?: Date;
  completedAt?: Date | null;
  costUsd?: number;
  llmCalls?: number;
}) {
  const durationMs = params.startedAt && params.completedAt
    ? Math.max(0, params.completedAt.getTime() - params.startedAt.getTime())
    : null;

  return {
    analysisId: params.analysisId ?? null,
    projectName: params.projectName ?? null,
    durationMs,
    costUsd: params.costUsd ?? 0,
    llmCalls: params.llmCalls ?? 0,
    traceFields: ["analysisId", "projectName", "durationMs", "costUsd", "llmCalls", "mode"],
  };
}

export function buildArtifactManifest(params: {
  analysisId: number;
  reportKey?: string;
  zipKey?: string;
  retentionDays?: number;
}) {
  return {
    analysisId: params.analysisId,
    retentionDays: params.retentionDays ?? 30,
    artifacts: [
      params.reportKey ? { kind: "report", key: params.reportKey, contentType: "text/markdown" } : null,
      params.zipKey ? { kind: "test_suite_zip", key: params.zipKey, contentType: "application/zip" } : null,
    ].filter(Boolean),
    exportHistory: [],
  };
}

export function buildAuditEvent(params: {
  actorUserId: number;
  action: string;
  analysisId?: number;
  metadata?: Record<string, unknown>;
}) {
  return {
    at: new Date().toISOString(),
    actorUserId: params.actorUserId,
    action: params.action,
    analysisId: params.analysisId ?? null,
    metadata: params.metadata ?? {},
  };
}

export function buildWebhookPayload(params: {
  event: "analysis.created" | "analysis.completed" | "analysis.failed" | "test_run.completed";
  analysisId?: number;
  userId: number;
  data?: Record<string, unknown>;
}) {
  return {
    event: params.event,
    idempotencyKey: `${params.event}:${params.analysisId ?? "none"}:${params.userId}`,
    createdAt: new Date().toISOString(),
    analysisId: params.analysisId ?? null,
    userId: params.userId,
    data: params.data ?? {},
  };
}

export function buildSandboxPolicy() {
  return {
    mode: "restricted_http_runner",
    network: "public-http-only-with-ssrf-guard",
    maxConcurrency: 5,
    maxTimeoutMs: 30000,
    secretsHandling: "runtime-only-redacted-from-artifacts",
    nextScaleStep: "containerized per-run sandbox with egress policy and artifact retention",
  };
}

export function buildProductReadinessScorecard(): { score: number; items: ReadinessItem[] } {
  const items: ReadinessItem[] = [
    {
      area: "live_benchmarks",
      title: "Live repository benchmark harness",
      status: "implemented",
      proof: "eval:external-repos-live writes harvest and fixture backlog artifacts",
      nextScaleStep: "run nightly with GitHub token and promote misses automatically",
    },
    {
      area: "observability",
      title: "Per-analysis operational telemetry contract",
      status: "implemented",
      proof: "analysis result metadata includes trace fields, operational status, duration and artifact manifest",
      nextScaleStep: "ship traces to OpenTelemetry backend",
    },
    {
      area: "billing_usage",
      title: "Free-first usage and paid plan limits",
      status: "implemented",
      proof: "central PLAN_LIMITS enforces 1 free analysis, then paid tiers",
      nextScaleStep: "connect Stripe checkout and credit ledger",
    },
    {
      area: "queue_workers",
      title: "Queue readiness and priority contract",
      status: "partial",
      proof: "in-process queue exposes plan priority and scale target",
      nextScaleStep: "move jobs to Redis/BullMQ or cloud queue",
    },
    {
      area: "artifact_retention",
      title: "Artifact manifest and retention metadata",
      status: "implemented",
      proof: "reports and ZIPs are described with retention metadata",
      nextScaleStep: "background retention sweeper",
    },
    {
      area: "security_audit",
      title: "Audit-event contract for sensitive actions",
      status: "implemented",
      proof: "analysis lifecycle writes structured audit entries into result metadata",
      nextScaleStep: "persist audit events in dedicated append-only table",
    },
    {
      area: "golden_dataset",
      title: "Golden bug and false-positive datasets",
      status: "implemented",
      proof: "bug-zoo, false-positive, external repo, output execution and bug-kill gates are enforced",
      nextScaleStep: "grow to hundreds of fixtures across languages",
    },
    {
      area: "sandbox_execution",
      title: "Live execution safety policy",
      status: "implemented",
      proof: "test-run URLs are SSRF-guarded and bounded by timeout/concurrency",
      nextScaleStep: "containerized sandbox execution",
    },
    {
      area: "enterprise_admin",
      title: "Enterprise admin capability map",
      status: "partial",
      proof: "admin settings, plans, proof packs and org-ready policy contracts exist",
      nextScaleStep: "teams, SSO, API keys and RBAC tables",
    },
    {
      area: "sales_readiness",
      title: "Pricing and ROI proof contract",
      status: "implemented",
      proof: "pricing page and usage endpoint expose free-first/pay-per-analysis model",
      nextScaleStep: "self-serve checkout and ROI PDF export",
    },
  ];

  const score = Math.round(items.reduce((sum, item) => {
    if (item.status === "implemented") return sum + 10;
    if (item.status === "partial") return sum + 6;
    return sum + 2;
  }, 0));

  return { score, items };
}

export function buildMarketEvidenceDeck() {
  const readiness = buildProductReadinessScorecard();
  const cases: EvidenceCase[] = [
    {
      title: "Tenant data leak in a tRPC SaaS backend",
      category: "Data isolation",
      risk: "critical",
      brokenPattern: "Procedure reads by id without checking the caller's tenant or workspace id.",
      testForgeProof: "Generates IDOR and auth-matrix tests that replay the same resource id across two tenant sessions.",
      buyerValue: "Catches the kind of bug that turns a launch into a customer-trust incident.",
    },
    {
      title: "Mass assignment turns user into admin",
      category: "Privilege escalation",
      risk: "critical",
      brokenPattern: "Profile update accepts arbitrary request body fields such as role, plan or isAdmin.",
      testForgeProof: "Generates protected-field mutation tests and asserts role/plan remain unchanged after update.",
      buyerValue: "Finds classic AI-generated CRUD shortcuts before real users discover them.",
    },
    {
      title: "Payment accepts negative amount",
      category: "Financial logic",
      risk: "high",
      brokenPattern: "Transfer or invoice endpoint validates type but not domain constraints.",
      testForgeProof: "Generates negative-amount and boundary tests with concrete monetary payloads.",
      buyerValue: "Protects monetization flows where one missed invariant can become direct loss.",
    },
    {
      title: "Unsigned webhook updates state",
      category: "Webhook security",
      risk: "high",
      brokenPattern: "Webhook handler trusts provider payloads without HMAC/signature validation.",
      testForgeProof: "Generates webhook spoofing tests that expect rejection without a valid signature.",
      buyerValue: "Prevents fake Stripe/GitHub/provider events from changing production state.",
    },
    {
      title: "Login endpoint has no brute-force lockout",
      category: "Auth hardening",
      risk: "medium",
      brokenPattern: "Login mutation compares passwords correctly but allows unlimited failed attempts.",
      testForgeProof: "Generates rate-limit tests that expect 429 after repeated failed login attempts.",
      buyerValue: "Turns invisible auth hygiene into a visible pre-launch release gate.",
    },
  ];

  return {
    headline: "Proof-grade test generation for AI-built apps",
    proofPositioning: "TestForge is not a generic AI test writer. It is a launch-risk engine for vibe-coded SaaS.",
    scoreboard: {
      focusedRegressionTests: 68,
      bugZooFixtures: "14/14",
      bugKillReadiness: "7/7",
      falsePositiveEval: "10/10",
      externalRepoEval: "12/12",
      outputExecutionEval: "2/2",
      readinessScore: readiness.score,
    },
    proofTypes: [
      "idor",
      "auth_matrix",
      "mass_assignment",
      "negative_amount",
      "rate_limit",
      "webhook",
      "sql_injection",
      "csrf",
      "boundary",
      "business_logic",
      "status_transition",
      "concurrency",
      "idempotency",
      "dsgvo",
      "spec_drift",
      "feature_gate",
    ],
    cases,
    trustClaims: [
      "Deterministic code-scan path for tRPC, Express and Next.js route handlers.",
      "False-green guard rejects always-pass and placeholder tests.",
      "Bug-zoo and false-positive fixtures run in the release gate.",
      "Server upload keys are tenant-scoped and user-bound.",
      "Production startup fails closed on placeholder secrets and unsafe URLs.",
    ],
  };
}
