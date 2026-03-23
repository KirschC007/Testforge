import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Shield, Lock, AlertCircle, ChevronRight, Layers, RefreshCw,
  Database, Star, Package, GitBranch, Zap, Activity, Search,
  Scale, CheckCircle2, FileText, ArrowLeft, Download
} from "lucide-react";
import { Streamdown } from "streamdown";

// ─── Proof type registry (same as AnalysisDetail) ────────────────────────────
const PROOF_CATEGORIES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  idor:           { label: "IDOR / Tenant Isolation", color: "var(--tf-red)",    icon: <Lock className="w-3.5 h-3.5" /> },
  csrf:           { label: "CSRF / Session Binding",  color: "var(--tf-orange)", icon: <Shield className="w-3.5 h-3.5" /> },
  rate_limit:     { label: "Rate Limiting",           color: "var(--tf-orange)", icon: <Zap className="w-3.5 h-3.5" /> },
  spec_drift:     { label: "Spec Drift / Schema",     color: "var(--tf-blue)",   icon: <Search className="w-3.5 h-3.5" /> },
  business_logic: { label: "Business Logic",          color: "var(--tf-yellow)", icon: <Activity className="w-3.5 h-3.5" /> },
  boundary:       { label: "Boundary Values",         color: "var(--tf-yellow)", icon: <GitBranch className="w-3.5 h-3.5" /> },
  dsgvo:          { label: "DSGVO / GDPR",            color: "var(--tf-green)",  icon: <Scale className="w-3.5 h-3.5" /> },
  sqli:           { label: "SQL Injection",            color: "var(--tf-red)",    icon: <AlertCircle className="w-3.5 h-3.5" /> },
  xss:            { label: "XSS / Injection",          color: "var(--tf-orange)", icon: <Shield className="w-3.5 h-3.5" /> },
  concurrency:    { label: "Concurrency / Race",       color: "var(--tf-red)",    icon: <Layers className="w-3.5 h-3.5" /> },
  idempotency:    { label: "Idempotency",              color: "var(--tf-blue)",   icon: <RefreshCw className="w-3.5 h-3.5" /> },
  auth_matrix:    { label: "Auth Matrix",              color: "var(--tf-purple)", icon: <Lock className="w-3.5 h-3.5" /> },
  flow:           { label: "User Flows",               color: "var(--tf-blue)",   icon: <ChevronRight className="w-3.5 h-3.5" /> },
  cron_job:       { label: "Cron Jobs",                color: "var(--tf-green)",  icon: <Star className="w-3.5 h-3.5" /> },
  webhook:        { label: "Webhooks",                 color: "var(--tf-orange)", icon: <Package className="w-3.5 h-3.5" /> },
  feature_gate:   { label: "Feature Gates",            color: "var(--tf-purple)", icon: <Database className="w-3.5 h-3.5" /> },
  data_integrity: { label: "Data Integrity",           color: "var(--tf-yellow)", icon: <GitBranch className="w-3.5 h-3.5" /> },
  rbac:           { label: "RBAC / Permissions",       color: "var(--tf-purple)", icon: <Shield className="w-3.5 h-3.5" /> },
  status_machine: { label: "Status Machine",           color: "var(--tf-blue)",   icon: <GitBranch className="w-3.5 h-3.5" /> },
};

const LAYER_COLORS = [
  "var(--tf-blue)", "var(--tf-orange)", "var(--tf-green)",
  "var(--tf-yellow)", "var(--tf-purple)", "var(--tf-red)",
];

export default function Demo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demo, isLoading } = (trpc as any).demo.getAnalysis.useQuery();
  const [activeTab, setActiveTab] = useState<"behaviors" | "proofs" | "files" | "report">("behaviors");
  const [expandedBehavior, setExpandedBehavior] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading demo...</span>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  const behaviors = demo.layer1Json?.behaviors ?? [];
  const proofTargets = demo.layer2Json?.proofTargets ?? [];
  const testFiles = demo.testFiles ?? [];

  // Group proof targets by type for summary
  const proofTypeCounts = (proofTargets as any[]).reduce((acc: Record<string, number>, pt: any) => {
    acc[pt.proofType] = (acc[pt.proofType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">TestForge</span>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-sm text-muted-foreground">Live Demo</span>
            </div>
          </div>
          <a href={getLoginUrl()}>
            <Button size="sm" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Analyze Your API
            </Button>
          </a>
        </div>
      </nav>

      {/* Demo Banner */}
      <div className="border-b border-[var(--tf-blue)]/30 bg-[var(--tf-blue)]/5 py-2.5">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--tf-blue)]/20 text-[var(--tf-blue)]">
              LIVE DEMO
            </span>
            <span className="text-muted-foreground">
              Real analysis of the <strong className="text-foreground">ShopCore</strong> multi-tenant e-commerce API — no login required
            </span>
          </div>
          <a href={getLoginUrl()}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              Analyze your own API <ChevronRight className="w-3 h-3" />
            </Button>
          </a>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{demo.projectName}</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--tf-green)]/20 text-[var(--tf-green)]">
                <CheckCircle2 className="w-3 h-3" /> DONE
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{demo.specFileName}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-[var(--tf-green)]">{demo.verdict}</div>
            <div className="text-xs text-muted-foreground">Verdict Score</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Behaviors Found",  value: behaviors.length,    color: "var(--tf-blue)" },
            { label: "Proof Targets",    value: proofTargets.length, color: "var(--tf-orange)" },
            { label: "Test Files",       value: testFiles.length,    color: "var(--tf-green)" },
            { label: "API Endpoints",    value: demo.layer1Json?.apiEndpoints?.length ?? 0, color: "var(--tf-purple)" },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-lg p-4 text-center">
              <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Proof type summary pills */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Proof Types Detected</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(proofTypeCounts) as [string, number][]).map(([type, count]) => {
              const cat = PROOF_CATEGORIES[type];
              if (!cat) return null;
              return (
                <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ color: cat.color, borderColor: `${cat.color}40`, background: `${cat.color}10` }}>
                  {cat.icon} {cat.label} {count > 1 && <span className="opacity-60">×{count}</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["behaviors", "proofs", "files", "report"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab === "behaviors" ? `Behaviors (${behaviors.length})` :
               tab === "proofs" ? `Proof Targets (${proofTargets.length})` :
               tab === "files" ? `Test Files (${testFiles.length})` : "Report"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "behaviors" && (
          <div className="space-y-2">
            {behaviors.map((b: any, i: number) => {
              const cat = PROOF_CATEGORIES[b.proofType];
              const isExpanded = expandedBehavior === b.id;
              return (
                <div key={b.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedBehavior(isExpanded ? null : b.id)}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">B{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{b.name}</span>
                        {cat && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ color: cat.color, background: `${cat.color}15` }}>
                            {cat.icon} {cat.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">{b.endpoint}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ color: b.riskScore >= 9 ? "var(--tf-red)" : b.riskScore >= 7 ? "var(--tf-orange)" : "var(--tf-green)",
                                 background: b.riskScore >= 9 ? "var(--tf-red)15" : b.riskScore >= 7 ? "var(--tf-orange)15" : "var(--tf-green)15" }}>
                        Risk {b.riskScore}/10
                      </span>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-3">
                      <p className="text-sm text-muted-foreground">{b.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "proofs" && (
          <div className="space-y-2">
            {proofTargets.map((pt: any, i: number) => {
              const cat = PROOF_CATEGORIES[pt.proofType];
              return (
                <div key={pt.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-8 shrink-0 pt-0.5">PT{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {cat && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{ color: cat.color, background: `${cat.color}15` }}>
                          {cat.icon} {cat.label}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">→ Behavior {pt.behaviorId}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{pt.rationale}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ color: pt.priority >= 9 ? "var(--tf-red)" : pt.priority >= 7 ? "var(--tf-orange)" : "var(--tf-green)",
                               background: pt.priority >= 9 ? "var(--tf-red)15" : pt.priority >= 7 ? "var(--tf-orange)15" : "var(--tf-green)15" }}>
                      P{pt.priority}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-2">
            {testFiles.map((f: any, i: number) => (
              <div key={f.name} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded border font-medium"
                    style={{ color: LAYER_COLORS[i % LAYER_COLORS.length], borderColor: `${LAYER_COLORS[i % LAYER_COLORS.length]}40`, background: `${LAYER_COLORS[i % LAYER_COLORS.length]}10` }}>
                    {f.layer}
                  </span>
                  <span className="text-xs text-muted-foreground">{f.tests} test{f.tests !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
            <div className="bg-[var(--tf-blue)]/5 border border-[var(--tf-blue)]/20 rounded-lg p-4 flex items-center gap-3">
              <Download className="w-4 h-4 text-[var(--tf-blue)] shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--tf-blue)]">Sign in to download the full test suite</p>
                <p className="text-xs text-muted-foreground mt-0.5">ZIP with all test files, helpers, CI workflow, and README</p>
              </div>
              <a href={getLoginUrl()}>
                <Button size="sm" className="gap-1.5 shrink-0">
                  Sign In <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {activeTab === "report" && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Streamdown>{demo.report}</Streamdown>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-primary/10 to-[var(--tf-blue)]/10 border border-primary/20 rounded-xl p-6 text-center space-y-3">
          <h2 className="text-lg font-bold">Ready to analyze your own API?</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Upload any spec — Markdown, OpenAPI, Swagger, PDF, Word — and get a full test suite in under 3 minutes.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href={getLoginUrl()}>
              <Button size="lg" className="gap-2">
                <Shield className="w-4 h-4" /> Start Free Analysis
              </Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="gap-2">
                View Pricing <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">Free tier: 3 analyses/day · No credit card required</p>
        </div>
      </div>
    </div>
  );
}
