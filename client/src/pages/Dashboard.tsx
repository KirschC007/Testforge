import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Shield, Plus, Loader2, AlertCircle, Clock, CheckCircle2,
  XCircle, Ban, FileCode2, Download, ChevronRight, Activity,
  Star, Package, Zap, RefreshCw,
} from "lucide-react";

// ─── Proof type color map ─────────────────────────────────────────────────
const PROOF_COLORS: Record<string, string> = {
  idor:              "var(--tf-red)",
  csrf:              "var(--tf-orange)",
  boundary:          "var(--tf-yellow)",
  business_logic:    "var(--tf-blue)",
  status_transition: "var(--tf-purple)",
  spec_drift:        "var(--tf-green)",
  dsgvo:             "var(--tf-yellow)",
  rate_limit:        "var(--tf-orange)",
};

const PROOF_LABELS: Record<string, string> = {
  idor:              "IDOR",
  csrf:              "CSRF",
  boundary:          "Boundary",
  business_logic:    "Business",
  status_transition: "Status",
  spec_drift:        "Spec Drift",
  dsgvo:             "DSGVO",
  rate_limit:        "Rate Limit",
};

// ─── Grade color helper ───────────────────────────────────────────────────
function gradeStyle(grade: string): { color: string; bg: string; border: string } {
  switch (grade) {
    case "A": return { color: "var(--tf-green)",  bg: "var(--tf-green)/10",  border: "var(--tf-green)/30" };
    case "B": return { color: "var(--tf-blue)",   bg: "var(--tf-blue)/10",   border: "var(--tf-blue)/30" };
    case "C": return { color: "var(--tf-yellow)", bg: "var(--tf-yellow)/10", border: "var(--tf-yellow)/30" };
    case "D": return { color: "var(--tf-orange)", bg: "var(--tf-orange)/10", border: "var(--tf-orange)/30" };
    case "F": return { color: "var(--tf-red)",    bg: "var(--tf-red)/10",    border: "var(--tf-red)/30" };
    default:  return { color: "var(--tf-blue)",   bg: "var(--tf-blue)/10",   border: "var(--tf-blue)/30" };
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    pending:   { icon: <Clock className="w-3 h-3" />,        label: "Pending",    cls: "text-muted-foreground border-border" },
    running:   { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Running", cls: "text-[var(--tf-blue)] border-[var(--tf-blue)]/30" },
    completed: { icon: <CheckCircle2 className="w-3 h-3" />, label: "Completed",  cls: "text-[var(--tf-green)] border-[var(--tf-green)]/30" },
    failed:    { icon: <XCircle className="w-3 h-3" />,      label: "Failed",     cls: "text-[var(--tf-red)] border-[var(--tf-red)]/30" },
    cancelled: { icon: <Ban className="w-3 h-3" />,          label: "Cancelled",  cls: "text-muted-foreground border-border" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Proof breakdown mini-bar ─────────────────────────────────────────────
function ProofBreakdown({ proofs }: { proofs: any[] }) {
  if (!proofs || proofs.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const p of proofs) {
    const t = p.proofType || "other";
    counts[t] = (counts[t] || 0) + 1;
  }
  const total = proofs.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-muted">
        {entries.map(([type, count]) => (
          <div
            key={type}
            className="h-full transition-all"
            style={{
              width: `${(count / total) * 100}%`,
              background: PROOF_COLORS[type] || "var(--tf-blue)",
              minWidth: count > 0 ? "4px" : "0",
            }}
            title={`${PROOF_LABELS[type] || type}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.slice(0, 5).map(([type, count]) => (
          <span key={type} className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: PROOF_COLORS[type] || "var(--tf-blue)" }} />
            {PROOF_LABELS[type] || type} {count}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Analysis card ────────────────────────────────────────────────────────
function AnalysisCard({ analysis }: { analysis: any }) {
  const result = analysis.resultJson as any;
  const suite = result?.validatedSuite;
  const specHealth = result?.analysisResult?.specHealth;
  const allProofs: any[] = suite?.proofs || [];
  const avgMutation = allProofs.length > 0
    ? allProofs.reduce((s: number, p: any) => s + (p.mutationScore || 0), 0) / allProofs.length
    : 0;

  const gs = specHealth ? gradeStyle(specHealth.grade) : null;

  return (
    <Link href={`/analysis/${analysis.id}`}>
      <div className="bg-card border border-border rounded-lg p-5 hover:border-border/80 hover:bg-card/80 transition-all cursor-pointer group">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FileCode2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {analysis.projectName}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(analysis.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Spec Health Grade */}
            {gs && specHealth && (
              <div
                className="w-8 h-8 rounded-lg border text-sm font-black flex items-center justify-center"
                style={{ color: gs.color, background: `${gs.color}15`, borderColor: `${gs.border}` }}
                title={`Spec Health: ${specHealth.score}/100`}
              >
                {specHealth.grade}
              </div>
            )}
            <StatusBadge status={analysis.status} />
          </div>
        </div>

        {/* Metrics row (completed only) */}
        {analysis.status === "completed" && suite && (
          <div className="space-y-3">
            {/* Score + Mutation */}
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Verdict</div>
                <div className="text-base font-bold font-mono"
                  style={{ color: suite.verdict.score >= 8 ? "var(--tf-green)" : suite.verdict.score >= 6 ? "var(--tf-orange)" : "var(--tf-red)" }}>
                  {suite.verdict.score.toFixed(1)}/10
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mutation</div>
                <div className="text-base font-bold font-mono"
                  style={{ color: avgMutation >= 0.8 ? "var(--tf-green)" : avgMutation >= 0.6 ? "var(--tf-orange)" : "var(--tf-red)" }}>
                  {(avgMutation * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tests</div>
                <div className="text-base font-bold font-mono text-foreground">{allProofs.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Coverage</div>
                <div className="text-base font-bold font-mono"
                  style={{ color: suite.coverage.coveragePercent >= 80 ? "var(--tf-green)" : "var(--tf-orange)" }}>
                  {suite.coverage.coveragePercent}%
                </div>
              </div>
            </div>

            {/* Proof type breakdown */}
            <ProofBreakdown proofs={allProofs} />
          </div>
        )}

        {/* Running progress */}
        {(analysis.status === "running" || analysis.status === "pending") && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {(analysis as any).progressMessage || "Analyzing..."}
            </span>
          </div>
        )}

        {/* Download button */}
        {analysis.status === "completed" && analysis.outputZipUrl && (
          <div className="mt-3 flex items-center justify-between">
            <a
              href={analysis.outputZipUrl}
              download
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download ZIP
            </a>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "completed" | "running" | "failed">("all");

  const { data: analyses, isLoading } = trpc.analyses.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Sign in to view your analyses</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  const filtered = (analyses || []).filter(a => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const stats = {
    total: analyses?.length || 0,
    completed: analyses?.filter(a => a.status === "completed").length || 0,
    running: analyses?.filter(a => a.status === "running" || a.status === "pending").length || 0,
    failed: analyses?.filter(a => a.status === "failed").length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-bold text-sm tracking-tight">TestForge</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{user.name}</span>
            )}
            <Link href="/analysis/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Analysis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {stats.total === 0 ? "No analyses yet — start your first one." : `${stats.total} analysis${stats.total > 1 ? "es" : ""} total`}
          </p>
        </div>

        {/* Stats row */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total",     value: stats.total,     icon: <Activity className="w-4 h-4" />,     color: "var(--tf-blue)" },
              { label: "Completed", value: stats.completed, icon: <CheckCircle2 className="w-4 h-4" />, color: "var(--tf-green)" },
              { label: "Running",   value: stats.running,   icon: <RefreshCw className="w-4 h-4" />,    color: "var(--tf-orange)" },
              { label: "Failed",    value: stats.failed,    icon: <XCircle className="w-4 h-4" />,      color: "var(--tf-red)" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1" style={{ color: s.color }}>
                  {s.icon}
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        {stats.total > 0 && (
          <div className="flex gap-1 mb-5">
            {(["all", "completed", "running", "failed"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors capitalize ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Analysis list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            {stats.total === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No analyses yet</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                  Upload your first API specification and get a proof-grade test suite in minutes.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link href="/analysis/new">
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" /> Start Analysis
                    </Button>
                  </Link>
                  <Link href="/analysis/new?demo=1">
                    <Button variant="outline" className="gap-2">
                      <Zap className="w-4 h-4" /> Try Demo Spec
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No analyses match the current filter.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map(analysis => (
              <AnalysisCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        )}

        {/* Quick tips for new users */}
        {stats.total > 0 && stats.completed > 0 && (
          <div className="mt-8 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-[var(--tf-yellow)]" />
              <h3 className="text-sm font-semibold">Tips for better results</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: "🎯", tip: "Add min/max constraints to numeric fields to get precise boundary tests" },
                { icon: "🔑", tip: "Explicitly mark your tenant isolation key (e.g. shopId, orgId) for IDOR tests" },
                { icon: "📋", tip: "Define all enum values for status fields to get complete transition tests" },
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base">{t.icon}</span>
                  <p className="text-xs text-muted-foreground">{t.tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
