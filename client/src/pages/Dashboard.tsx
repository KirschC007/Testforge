import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  Shield,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  LogOut,
  BarChart3,
} from "lucide-react";
import type { Analysis } from "../../../drizzle/schema";

function StatusBadge({ status }: { status: Analysis["status"] }) {
  const map = {
    pending: { label: "Pending", color: "bg-muted text-muted-foreground", icon: Clock },
    running: { label: "Running", color: "bg-blue-500/20 text-blue-400", icon: Loader2 },
    completed: { label: "Completed", color: "bg-green-500/20 text-green-400", icon: CheckCircle2 },
    failed: { label: "Failed", color: "bg-red-500/20 text-red-400", icon: XCircle },
  };
  const { label, color, icon: Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = score; // 0-100
  const color = pct >= 80 ? "var(--tf-green)" : pct >= 60 ? "var(--tf-orange)" : "var(--tf-red)";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{(pct / 10).toFixed(1)}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { data: analyses, isLoading } = trpc.analyses.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && data.some((a: Analysis) => a.status === "running" || a.status === "pending")) {
        return 3000;
      }
      return false;
    },
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
          <p className="text-muted-foreground mb-4">Sign in to access your dashboard</p>
          <a href={getLoginUrl()}>
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center">
        <div className="container flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">TestForge</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{user?.name || user?.email}</span>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={logout}>
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold">Analyses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {analyses?.length || 0} project{analyses?.length !== 1 ? "s" : ""} analyzed
            </p>
          </div>
          <Link href="/analysis/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Analysis
            </Button>
          </Link>
        </div>

        {/* Stats row */}
        {analyses && analyses.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Total Analyses",
                value: analyses.length,
                icon: BarChart3,
                color: "var(--tf-blue)",
              },
              {
                label: "Completed",
                value: analyses.filter((a: Analysis) => a.status === "completed").length,
                icon: CheckCircle2,
                color: "var(--tf-green)",
              },
              {
                label: "Avg. Coverage",
                value: (() => {
                  const completed = analyses.filter((a: Analysis) => a.coveragePercent !== null);
                  if (!completed.length) return "—";
                  const avg = completed.reduce((s: number, a: Analysis) => s + (a.coveragePercent || 0), 0) / completed.length;
                  return `${Math.round(avg)}%`;
                })(),
                icon: Shield,
                color: "var(--tf-orange)",
              },
              {
                label: "Running",
                value: analyses.filter((a: Analysis) => a.status === "running" || a.status === "pending").length,
                icon: Loader2,
                color: "var(--tf-yellow)",
              },
            ].map((stat, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold font-mono">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Analyses list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : analyses && analyses.length > 0 ? (
          <div className="space-y-2">
            {analyses.map((analysis: Analysis) => (
              <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                <div className="bg-card border border-border rounded-lg px-5 py-4 hover:border-primary/40 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{analysis.projectName}</span>
                          <StatusBadge status={analysis.status} />
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{new Date(analysis.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          {analysis.behaviorCount !== null && (
                            <span>{analysis.behaviorCount} behaviors</span>
                          )}
                          {analysis.validatedProofCount !== null && (
                            <span>{analysis.validatedProofCount} proofs</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      {analysis.coveragePercent !== null && (
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-muted-foreground mb-1">Coverage</div>
                          <ScoreBar score={analysis.coveragePercent} />
                        </div>
                      )}
                      {analysis.verdictScore !== null && (
                        <div className="text-right hidden md:block">
                          <div className="text-xs text-muted-foreground mb-1">Verdict</div>
                          <ScoreBar score={analysis.verdictScore} />
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No analyses yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Upload your first specification to get started.
            </p>
            <Link href="/analysis/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Start First Analysis
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
