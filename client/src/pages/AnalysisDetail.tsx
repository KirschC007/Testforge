import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Loader2, Shield, ArrowLeft, Download, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronDown, ChevronUp, Ban, RotateCcw, FileText,
  Package, GitBranch, Zap, Lock, Scale, Activity, Search,
  RefreshCw, Database, Star, ChevronRight, Layers, GitCompare
} from "lucide-react";
import { Streamdown } from "streamdown";
import type { Analysis } from "../../../drizzle/schema";
import { SpecHealthPanel, type SpecHealth } from "@/components/SpecHealthPanel";

const STEPS = [
  { key: "pending",   label: "Queued",               desc: "Waiting to start",                     layer: 0 },
  { key: "layer1",    label: "Layer 1 — Spec Parse",  desc: "Extracting behaviors from spec",       layer: 1 },
  { key: "checker",   label: "LLM Checker",            desc: "Verifying behaviors against spec",     layer: 2 },
  { key: "layer2",    label: "Layer 2 — Risk Model",   desc: "Building risk model & proof targets",  layer: 2 },
  { key: "layer3",    label: "Layer 3 — Test Gen",     desc: "Generating proof tests (all parallel)", layer: 3 },
  { key: "layer45",   label: "Layer 4+5 — Validation", desc: "Independent check + false-green guard", layer: 4 },
  { key: "completed", label: "Complete",               desc: "Tests ready for download",              layer: 5 },
];

// Proof type → category mapping
const PROOF_CATEGORIES: Record<string, { label: string; color: string; icon: React.ReactNode; dir: string }> = {
  idor:              { label: "IDOR / Tenant Isolation", color: "var(--tf-red)",    icon: <Lock className="w-3.5 h-3.5" />,     dir: "tests/security/" },
  csrf:              { label: "CSRF / Session Binding",  color: "var(--tf-orange)", icon: <Shield className="w-3.5 h-3.5" />,   dir: "tests/security/" },
  rate_limit:        { label: "Rate Limiting",           color: "var(--tf-orange)", icon: <Zap className="w-3.5 h-3.5" />,      dir: "tests/security/" },
  spec_drift:        { label: "Spec Drift / Schema",     color: "var(--tf-blue)",   icon: <Search className="w-3.5 h-3.5" />,   dir: "tests/security/" },
  business_logic:    { label: "Business Logic",          color: "var(--tf-yellow)", icon: <Activity className="w-3.5 h-3.5" />, dir: "tests/business/" },
  boundary:          { label: "Boundary Values",         color: "var(--tf-yellow)", icon: <GitBranch className="w-3.5 h-3.5" />,dir: "tests/business/" },
  dsgvo:             { label: "DSGVO / GDPR",            color: "var(--tf-green)",  icon: <Scale className="w-3.5 h-3.5" />,    dir: "tests/compliance/" },
  status_transition: { label: "Status Transitions",      color: "var(--tf-blue)",   icon: <GitBranch className="w-3.5 h-3.5" />,dir: "tests/integration/" },
  risk_scoring:      { label: "Risk Scoring",            color: "var(--tf-blue)",   icon: <Activity className="w-3.5 h-3.5" />, dir: "tests/integration/" },
  sqli:              { label: "SQL Injection",            color: "var(--tf-red)",    icon: <AlertCircle className="w-3.5 h-3.5" />,dir: "tests/security/" },
  xss:               { label: "XSS / Injection",          color: "var(--tf-orange)", icon: <Shield className="w-3.5 h-3.5" />,    dir: "tests/security/" },
  concurrency:       { label: "Concurrency / Race",       color: "var(--tf-red)",    icon: <Layers className="w-3.5 h-3.5" />,    dir: "tests/integration/" },
  idempotency:       { label: "Idempotency",              color: "var(--tf-blue)",   icon: <RefreshCw className="w-3.5 h-3.5" />, dir: "tests/integration/" },
  auth_matrix:       { label: "Auth Matrix",              color: "var(--tf-purple)", icon: <Lock className="w-3.5 h-3.5" />,      dir: "tests/security/" },
  flow:              { label: "User Flows",               color: "var(--tf-blue)",   icon: <ChevronRight className="w-3.5 h-3.5" />,dir: "tests/integration/" },
  cron_job:          { label: "Cron Jobs",                color: "var(--tf-green)",  icon: <Star className="w-3.5 h-3.5" />,      dir: "tests/integration/" },
  webhook:           { label: "Webhooks",                 color: "var(--tf-orange)", icon: <Package className="w-3.5 h-3.5" />,   dir: "tests/integration/" },
  feature_gate:      { label: "Feature Gates",            color: "var(--tf-purple)", icon: <Database className="w-3.5 h-3.5" />,  dir: "tests/integration/" },
  data_integrity:    { label: "Data Integrity",           color: "var(--tf-yellow)", icon: <GitBranch className="w-3.5 h-3.5" />, dir: "tests/integration/" },
  rbac:              { label: "RBAC / Permissions",       color: "var(--tf-purple)", icon: <Shield className="w-3.5 h-3.5" />,    dir: "tests/security/" },
};

function ProgressSteps({
  status, createdAt, progressLayer, progressMessage,
}: {
  status: Analysis["status"];
  createdAt: Date;
  progressLayer?: number | null;
  progressMessage?: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "running" && status !== "pending") return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, createdAt]);

  const currentLayer = status === "completed" ? 5
    : status === "failed" ? -1
    : status === "pending" ? 0
    : (progressLayer ?? Math.min(1 + Math.floor(elapsed / 30), 4));

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm">Analysis Progress</h2>
        {(status === "running" || status === "pending") && (
          <span className="text-xs font-mono text-muted-foreground">{elapsed}s elapsed</span>
        )}
      </div>
      {progressMessage && (status === "running" || status === "pending") && (
        <div className="mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded text-xs font-mono text-primary">
          {progressMessage}
        </div>
      )}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const isDone = step.layer < currentLayer || (status === "completed");
          const isCurrent = step.layer === currentLayer && status !== "completed" && status !== "failed";
          const isPending = step.layer > currentLayer && status !== "completed";
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                isDone ? "bg-[var(--tf-green)]/20" : isCurrent ? "bg-primary/20" : "bg-muted"
              }`}>
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--tf-green)]" />
                  : isCurrent ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-medium ${isPending ? "text-muted-foreground" : "text-foreground"}`}>{step.label}</div>
                <div className="text-xs text-muted-foreground">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: "text-[var(--tf-red)] bg-[var(--tf-red)]/10",
    high:     "text-[var(--tf-orange)] bg-[var(--tf-orange)]/10",
    medium:   "text-[var(--tf-yellow)] bg-[var(--tf-yellow)]/10",
    low:      "text-[var(--tf-green)] bg-[var(--tf-green)]/10",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${map[level] || "text-muted-foreground"}`}>
      {level}
    </span>
  );
}

function ProofTypeBadge({ type }: { type: string }) {
  const cat = PROOF_CATEGORIES[type];
  if (!cat) return <span className="text-xs font-mono text-muted-foreground">{type}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: cat.color, background: `${cat.color}18` }}>
      {cat.icon} {cat.label}
    </span>
  );
}

// Group proofs by category
function groupProofsByCategory(proofs: any[]) {
  const groups: Record<string, any[]> = {};
  for (const p of proofs) {
    const type = p.proofType || "other";
    if (!groups[type]) groups[type] = [];
    groups[type].push(p);
  }
  return groups;
}

const LAYER_COLORS: Record<string, string> = {
  unit: "var(--tf-blue)",
  integration: "var(--tf-purple)",
  e2e: "var(--tf-green)",
  uat: "var(--tf-yellow)",
  security: "var(--tf-red)",
  performance: "var(--tf-orange)",
};

const LAYER_LABELS: Record<string, string> = {
  unit: "Unit",
  integration: "Integration",
  e2e: "E2E",
  uat: "UAT",
  security: "Security",
  performance: "Performance",
};

function ZipContentsPreview() {
  const [open, setOpen] = useState(false);
  const layers = [
    {
      layer: "unit",
      label: "Layer 1 — Unit Tests (Vitest)",
      files: [
        { path: "tests/unit/<module>.test.ts", desc: "Service isolation: happy path, tenant isolation, validation" },
        { path: "tests/unit/state-machine.test.ts", desc: "State machine: valid/forbidden/skip transitions" },
      ],
      cmd: "npx vitest run tests/unit/",
    },
    {
      layer: "integration",
      label: "Layer 2 — Integration Tests (Vitest)",
      files: [
        { path: "tests/integration/<module>.integration.test.ts", desc: "CRUD lifecycle, auth, tenant isolation via real API" },
      ],
      cmd: "npx vitest run tests/integration/",
    },
    {
      layer: "e2e",
      label: "Layer 3 — E2E Tests (Playwright)",
      files: [
        { path: "tests/e2e/core-flows.spec.ts", desc: "Auth flow, create→list→verify user journeys" },
      ],
      cmd: "npx playwright test tests/e2e/",
    },
    {
      layer: "uat",
      label: "Layer 4 — UAT Tests (Cucumber/Gherkin)",
      files: [
        { path: "tests/uat/<chapter>.feature", desc: "Human-readable Given/When/Then acceptance criteria" },
        { path: "tests/uat/step-definitions/steps.ts", desc: "Cucumber step implementations" },
      ],
      cmd: "npx cucumber-js tests/uat/**/*.feature",
    },
    {
      layer: "security",
      label: "Layer 5 — Security Tests (Playwright)",
      files: [
        { path: "tests/security/idor.spec.ts", desc: "IDOR / Tenant Isolation attacks" },
        { path: "tests/security/csrf.spec.ts", desc: "CSRF / Session Binding attacks" },
        { path: "tests/security/rate-limit.spec.ts", desc: "Rate limiting verification" },
        { path: "tests/integration/spec-drift.spec.ts", desc: "Spec drift / schema validation" },
      ],
      cmd: "npx playwright test tests/security/",
    },
    {
      layer: "performance",
      label: "Layer 6 — Performance Tests (k6)",
      files: [
        { path: "tests/performance/load-test.js", desc: "Ramp-up + steady-state + spike scenarios" },
        { path: "tests/performance/stress-test.js", desc: "Find breaking point with progressive load" },
        { path: "tests/performance/rate-limit.js", desc: "Burst test to verify rate limiting" },
      ],
      cmd: "k6 run tests/performance/load-test.js",
    },
  ];
  const helpers = [
    { path: "helpers/api.ts", desc: "trpcMutation, trpcQuery, BASE_URL helpers" },
    { path: "helpers/auth.ts", desc: "loginAndGetCookie, session management" },
    { path: "helpers/factories.ts", desc: "createTestResource, spec-aware factories" },
    { path: "helpers/schemas.ts", desc: "Zod response & input schemas" },
    { path: "vitest.config.ts", desc: "Vitest config for unit + integration tests" },
    { path: "playwright.config.ts", desc: "Playwright config (ESM, JSON reporter)" },
    { path: "cucumber.config.ts", desc: "Cucumber config for UAT tests" },
    { path: "package.json", desc: "All test runners + npm scripts for all 6 layers" },
    { path: ".github/workflows/testforge-full.yml", desc: "Full 6-layer CI/CD pipeline" },
    { path: "README.md", desc: "Setup guide for all 6 test runners" },
    { path: ".env.example", desc: "Environment variable template" },
  ];
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        className="w-full px-5 py-3 border-b border-border flex items-center justify-between hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">ZIP Contents — 6 Test Layers — npm test</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="p-4 space-y-4">
          <div className="font-mono text-xs bg-muted/40 rounded p-3">
            <span className="text-[var(--tf-green)]">$</span> unzip testforge-output.zip && npm install && npm run install:browsers && npm run test:all
          </div>
          {layers.map(l => (
            <div key={l.layer}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color: LAYER_COLORS[l.layer], background: `${LAYER_COLORS[l.layer]}18` }}>
                  {LAYER_LABELS[l.layer]}
                </span>
                <span className="text-xs font-medium text-foreground">{l.label}</span>
                <span className="text-xs font-mono text-muted-foreground ml-auto">{l.cmd}</span>
              </div>
              <div className="space-y-0.5 pl-2">
                {l.files.map(f => (
                  <div key={f.path} className="flex items-start gap-2 py-0.5">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-xs font-mono text-foreground">{f.path}</span>
                    <span className="text-xs text-muted-foreground">— {f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Shared Helpers & Config</div>
            <div className="space-y-0.5">
              {helpers.map(f => (
                <div key={f.path} className="flex items-start gap-2 py-0.5">
                  <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs font-mono text-foreground">{f.path}</span>
                  <span className="text-xs text-muted-foreground">— {f.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [showFullReport, setShowFullReport] = useState(false);
  const utils = trpc.useUtils();
  const cancelMutation = trpc.analyses.cancel.useMutation({
    onSuccess: () => utils.analyses.getById.invalidate({ id: parseInt(id || "0") }),
  });
  const retryMutation = trpc.analyses.retry.useMutation({
    onSuccess: () => utils.analyses.getById.invalidate({ id: parseInt(id || "0") }),
  });

  const { data: analysis, isLoading } = trpc.analyses.getById.useQuery(
    { id: parseInt(id || "0") },
    {
      enabled: isAuthenticated && !!id,
      refetchInterval: (query) => {
        const data = query.state.data as Analysis | undefined;
        if (data?.status === "running" || data?.status === "pending") return 3000;
        return false;
      },
    }
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Analysis not found</p>
          <Link href="/dashboard"><Button variant="ghost" className="mt-4">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  const result = analysis.resultJson as any;
  const suite = result?.validatedSuite;
  const ir = result?.analysisResult?.ir;
  const report: string = result?.report || "";

  // Compute mutation score across all proofs
  const allProofs: any[] = suite?.proofs || [];
  const avgMutation = allProofs.length > 0
    ? allProofs.reduce((s: number, p: any) => s + (p.mutationScore || 0), 0) / allProofs.length
    : 0;

  // Compute spec_drift coverage (endpoints with schemas / total endpoints)
  const totalEndpoints = ir?.apiEndpoints?.length || 0;
  const specDriftProofs = allProofs.filter((p: any) => p.proofType === "spec_drift").length;
  const schemaCoverage = totalEndpoints > 0 ? Math.round((specDriftProofs / totalEndpoints) * 100) : 0;

  // Extract specHealth from result
  const specHealth: SpecHealth | null = result?.analysisResult?.specHealth || null;

  // Group proofs by type
  const proofGroups = groupProofsByCategory(allProofs);

  // Timeout detection: running for >8min
  const isTimedOut = (analysis.status === "running" || analysis.status === "pending") &&
    (Date.now() - new Date(analysis.createdAt).getTime()) > 8 * 60 * 1000;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center">
        <div className="container flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate">{analysis.projectName}</span>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold">{analysis.projectName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(analysis.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit"
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(analysis.status === "running" || analysis.status === "pending") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-red-400 hover:border-red-400/40"
                onClick={() => cancelMutation.mutate({ id: parseInt(id || "0") })}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Abbrechen
              </Button>
            )}
            {analysis.status === "completed" && analysis.outputZipUrl && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/analysis/${id}/run`}>
                  <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white">
                    <Zap className="w-3.5 h-3.5" /> Run Tests Live
                  </Button>
                </Link>
                <Link href={`/analysis/${id}/diff`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <GitCompare className="w-3.5 h-3.5" /> Compare Versions
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const prUrl = window.prompt("GitHub PR URL (e.g. https://github.com/org/repo/pull/42):");
                    if (!prUrl) return;
                    const token = window.prompt("GitHub Personal Access Token (repo scope):");
                    if (!token) return;
                    fetch("/api/trpc/github.postPRComment", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ json: { analysisId: parseInt(id || "0"), prUrl, githubToken: token } }),
                    }).then(r => r.json()).then(d => {
                      if (d.error) { alert("Error: " + d.error.message); return; }
                      alert("PR comment posted: " + (d.result?.data?.commentUrl || "success"));
                    }).catch(e => alert("Error: " + e.message));
                  }}
                >
                  <GitBranch className="w-3.5 h-3.5" /> Post PR Comment
                </Button>
                <a href={analysis.outputZipUrl} download>
                  <Button className="gap-2">
                    <Download className="w-4 h-4" /> Download Tests (.zip)
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Running / Pending */}
        {(analysis.status === "running" || analysis.status === "pending") && (
          <div className="max-w-md space-y-3">
            <ProgressSteps
              status={analysis.status}
              createdAt={analysis.createdAt}
              progressLayer={(analysis as any).progressLayer}
              progressMessage={(analysis as any).progressMessage}
            />
            {isTimedOut && (
              <div className="bg-[var(--tf-orange)]/10 border border-[var(--tf-orange)]/30 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-4 h-4 text-[var(--tf-orange)] shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  Die Analyse läuft länger als 8 Minuten. Sie wird automatisch beendet oder du kannst sie manuell abbrechen.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancelled */}
        {analysis.status === "cancelled" && (
          <div className="bg-muted/50 border border-border rounded-lg p-5 flex gap-3 max-w-xl">
            <Ban className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm mb-1">Analysis abgebrochen</div>
              <div className="text-sm text-muted-foreground mb-3">Diese Analyse wurde manuell gestoppt.</div>
              {(analysis as any).specFileKey && (
                <Button size="sm" variant="outline" className="gap-1.5"
                  onClick={() => retryMutation.mutate({ id: parseInt(id || "0") })}
                  disabled={retryMutation.isPending}>
                  {retryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Nochmal versuchen
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Failed */}
        {analysis.status === "failed" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-5 flex gap-3 max-w-xl">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm mb-1">Analysis Failed</div>
              <div className="text-sm text-muted-foreground font-mono mb-3">{analysis.errorMessage || "Unknown error"}</div>
              {(analysis as any).specFileKey && (
                <Button size="sm" variant="outline" className="gap-1.5"
                  onClick={() => retryMutation.mutate({ id: parseInt(id || "0") })}
                  disabled={retryMutation.isPending}>
                  {retryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Nochmal versuchen
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Completed */}
        {analysis.status === "completed" && suite && (
          <div className="space-y-6">
            {/* Spec Health Panel — top priority */}
            {specHealth && (
              <SpecHealthPanel specHealth={specHealth} />
            )}

            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard
                label="Verdict Score"
                value={`${(suite.verdict.score).toFixed(1)}/10`}
                color={suite.verdict.score >= 8 ? "var(--tf-green)" : suite.verdict.score >= 6 ? "var(--tf-orange)" : "var(--tf-red)"}
              />
              <MetricCard
                label="Coverage"
                value={`${suite.coverage.coveragePercent}%`}
                color={suite.coverage.coveragePercent >= 80 ? "var(--tf-green)" : "var(--tf-orange)"}
              />
              <MetricCard
                label="Mutation Score"
                value={`${(avgMutation * 100).toFixed(0)}%`}
                sub={`${allProofs.length} proofs`}
                color={avgMutation >= 0.8 ? "var(--tf-green)" : avgMutation >= 0.6 ? "var(--tf-orange)" : "var(--tf-red)"}
              />
              <MetricCard
                label="Schema Coverage"
                value={`${schemaCoverage}%`}
                sub={`${specDriftProofs}/${totalEndpoints} endpoints`}
                color={schemaCoverage >= 80 ? "var(--tf-green)" : "var(--tf-yellow)"}
              />
              <MetricCard
                label="Behaviors"
                value={ir?.behaviors?.length || 0}
                sub={`${suite.verdict.failed || 0} discarded`}
                color="var(--tf-blue)"
              />
            </div>

            {/* Ambiguities */}
            {ir?.ambiguities?.length > 0 && (
              <div className="bg-card border border-[var(--tf-yellow)]/30 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-[var(--tf-yellow)]" />
                  <h3 className="font-semibold text-sm">Ambiguity Gate — {ir.ambiguities.length} flagged</h3>
                </div>
                <div className="space-y-2">
                  {ir.ambiguities.slice(0, 5).map((a: any, i: number) => (
                    <div key={i} className="text-xs border-l-2 border-[var(--tf-yellow)]/50 pl-3 py-1">
                      <span className="font-mono text-muted-foreground">{a.behaviorId}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${a.impact === "blocks_test" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {a.impact === "blocks_test" ? "BLOCKS TEST" : "reduces confidence"}
                      </span>
                      <p className="text-muted-foreground mt-0.5">{a.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proofs grouped by category */}
            {allProofs.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Validated Proofs by Category ({allProofs.length} total)
                </h3>
                {Object.entries(proofGroups).map(([type, proofs]) => {
                  const cat = PROOF_CATEGORIES[type];
                  return (
                    <div key={type} className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ProofTypeBadge type={type} />
                          <span className="text-xs text-muted-foreground">
                            {cat?.dir && <span className="font-mono">{cat.dir}</span>}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{proofs.length} tests</span>
                      </div>
                      <div className="divide-y divide-border">
                        {proofs.map((proof: any) => (
                          <div key={proof.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">{proof.id}</span>
                                <RiskBadge level={proof.riskLevel} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{proof.filename}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-muted-foreground">Mutation</div>
                              <div className="text-sm font-mono font-bold"
                                style={{ color: proof.mutationScore >= 0.8 ? "var(--tf-green)" : "var(--tf-orange)" }}>
                                {(proof.mutationScore * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Discarded Proofs */}
            {suite.discardedProofs?.length > 0 && (
              <div className="bg-card border border-[var(--tf-red)]/20 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-[var(--tf-red)]" />
                  <h3 className="font-semibold text-sm">Discarded — False-Green Detection ({suite.discardedProofs.length})</h3>
                </div>
                <div className="divide-y divide-border">
                  {suite.discardedProofs.map((dp: any) => (
                    <div key={dp.rawProof.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{dp.rawProof.id}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono">{dp.reason}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{dp.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ZIP Contents Preview */}
            <ZipContentsPreview />

            {/* Full Report */}
            {report && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full px-5 py-3 border-b border-border flex items-center justify-between hover:bg-muted/30 transition-colors"
                  onClick={() => setShowFullReport(!showFullReport)}
                >
                  <span className="font-semibold text-sm">Full Report (testforge-report.md)</span>
                  {showFullReport ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {showFullReport && (
                  <div className="p-6 prose prose-invert prose-sm max-w-none">
                    <Streamdown>{report}</Streamdown>
                  </div>
                )}
              </div>
            )}

            {/* Download CTA */}
            {analysis.outputZipUrl && (
              <div className="bg-card border border-[var(--tf-green)]/20 rounded-lg p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm mb-1">Test Suite Ready — CI/CD Included</div>
                  <div className="text-xs text-muted-foreground">
                    {allProofs.length} validated tests + GitHub Actions + README — unzip, npm install, playwright test
                  </div>
                </div>
                <a href={analysis.outputZipUrl} download>
                  <Button className="gap-2 shrink-0">
                    <Download className="w-4 h-4" /> Download .zip
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
