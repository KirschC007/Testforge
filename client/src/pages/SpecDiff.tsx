import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, GitCompare, Plus, Minus, RefreshCw, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Loader2, ArrowRight,
  Shield, Zap, Lock, Activity, Search, GitBranch
} from "lucide-react";

// ─── Types (mirrored from spec-diff.ts) ──────────────────────────────────────
interface BehaviorDiff {
  type: "added" | "removed" | "changed";
  id: string;
  title: string;
  changes?: Array<{ field: string; before: string; after: string }>;
  behavior?: { chapter?: string; tags?: string[]; riskHints?: string[] };
  riskHints?: string[];
  tags?: string[];
}
interface EndpointDiff {
  type: "added" | "removed" | "changed";
  name: string;
  changes?: Array<{ field: string; before: string; after: string }>;
}
interface SpecDiffResult {
  behaviorDiffs: BehaviorDiff[];
  endpointDiffs: EndpointDiff[];
  statusMachineDiff: {
    addedStates: string[];
    removedStates: string[];
    addedTransitions: [string, string][];
    removedTransitions: [string, string][];
  } | null;
  summary: {
    addedBehaviors: number;
    removedBehaviors: number;
    changedBehaviors: number;
    addedEndpoints: number;
    removedEndpoints: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    affectedProofTypes: string[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
};

const PROOF_ICONS: Record<string, React.ReactNode> = {
  idor: <Lock className="w-3 h-3" />,
  csrf: <Shield className="w-3 h-3" />,
  rate_limit: <Zap className="w-3 h-3" />,
  status_machine: <Activity className="w-3 h-3" />,
  data_integrity: <CheckCircle2 className="w-3 h-3" />,
};

function DiffBadge({ type }: { type: "added" | "removed" | "changed" }) {
  if (type === "added")   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><Plus className="w-3 h-3" />Added</span>;
  if (type === "removed") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30"><Minus className="w-3 h-3" />Removed</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"><RefreshCw className="w-3 h-3" />Changed</span>;
}

function BehaviorDiffCard({ diff }: { diff: BehaviorDiff }) {
  const [expanded, setExpanded] = useState(diff.type === "changed");
  const borderColor = diff.type === "added" ? "border-l-emerald-500" : diff.type === "removed" ? "border-l-red-500" : "border-l-yellow-500";
  const bgColor = diff.type === "added" ? "bg-emerald-500/5" : diff.type === "removed" ? "bg-red-500/5" : "bg-yellow-500/5";

  return (
    <div className={`border-l-2 ${borderColor} ${bgColor} rounded-r-lg p-4 mb-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <DiffBadge type={diff.type} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{diff.id}</span>
              <span className="text-sm font-medium text-foreground truncate">{diff.title}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {(diff.behavior?.chapter) && (
                <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{diff.behavior.chapter}</span>
              )}
              {(diff.riskHints || diff.behavior?.riskHints || []).slice(0, 3).map((h: string) => (
                <span key={h} className="text-xs text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20">
                  {PROOF_ICONS[h] || null} {h}
                </span>
              ))}
              {(diff.tags || diff.behavior?.tags || []).slice(0, 2).map((t: string) => (
                <span key={t} className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          </div>
        </div>
        {diff.type === "changed" && diff.changes && diff.changes.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Changed fields detail */}
      {diff.type === "changed" && expanded && diff.changes && diff.changes.length > 0 && (
        <div className="mt-3 space-y-2 pl-2 border-l border-yellow-500/20">
          {diff.changes.map((change, i) => (
            <div key={i} className="text-xs">
              <span className="text-muted-foreground font-mono font-semibold">{change.field}:</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2 font-mono text-red-300 text-xs break-all">
                  <span className="text-red-400 font-bold">− </span>{change.before}
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2 font-mono text-emerald-300 text-xs break-all">
                  <span className="text-emerald-400 font-bold">+ </span>{change.after}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EndpointDiffCard({ diff }: { diff: EndpointDiff }) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = diff.type === "added" ? "border-l-emerald-500" : diff.type === "removed" ? "border-l-red-500" : "border-l-yellow-500";
  const bgColor = diff.type === "added" ? "bg-emerald-500/5" : diff.type === "removed" ? "bg-red-500/5" : "bg-yellow-500/5";

  return (
    <div className={`border-l-2 ${borderColor} ${bgColor} rounded-r-lg p-3 mb-2`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DiffBadge type={diff.type} />
          <span className="text-sm font-mono font-medium text-foreground">{diff.name}</span>
        </div>
        {diff.type === "changed" && diff.changes && diff.changes.length > 0 && (
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
      {diff.type === "changed" && expanded && diff.changes && diff.changes.length > 0 && (
        <div className="mt-2 space-y-1 pl-2 border-l border-yellow-500/20">
          {diff.changes.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-mono font-semibold">{c.field}:</span>
              <span className="text-red-400 ml-2">− {c.before}</span>
              <span className="text-emerald-400 ml-2">+ {c.after}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SpecDiff() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // The "base" analysis is the one from the URL param
  const baseId = params.id ? parseInt(params.id, 10) : null;

  // The "head" analysis is selected by the user
  const [headId, setHeadId] = useState<number | null>(null);
  const [headInput, setHeadInput] = useState("");
  const [filter, setFilter] = useState<"all" | "added" | "removed" | "changed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load user's analyses for the selector
  const { data: analyses } = trpc.analyses.list.useQuery(undefined, { enabled: !!user });

  // Run the diff query
  const {
    data: diffResult,
    isLoading: diffLoading,
    error: diffError,
    refetch,
  } = trpc.diff.compare.useQuery(
    { baseId: baseId!, headId: headId! },
    { enabled: !!baseId && !!headId }
  );

  const baseAnalysis = analyses?.find(a => a.id === baseId);
  const headAnalysis = analyses?.find(a => a.id === headId);

  // Filter and search behaviors
  const filteredBehaviors = useMemo(() => {
    if (!diffResult) return [];
    return diffResult.behaviorDiffs.filter(d => {
      if (filter !== "all" && d.type !== filter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return d.title.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) ||
          (d.behavior?.chapter || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [diffResult, filter, searchQuery]);

  const filteredEndpoints = useMemo(() => {
    if (!diffResult) return [];
    return diffResult.endpointDiffs.filter(d => {
      if (filter !== "all" && d.type !== filter) return false;
      if (searchQuery) return d.name.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
  }, [diffResult, filter, searchQuery]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href={baseId ? `/analysis/${baseId}` : "/dashboard"}>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Spec Diff</h1>
          </div>
          {diffResult && (
            <Badge
              variant="outline"
              className={`ml-auto text-xs border ${RISK_COLORS[diffResult.summary.riskLevel]}`}
            >
              {diffResult.summary.riskLevel.toUpperCase()} RISK
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Analysis Selector */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Compare Analyses</h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
            {/* Base */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Base (v1 — older)</Label>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-3">
                {baseAnalysis ? (
                  <div>
                    <div className="text-sm font-medium truncate">{baseAnalysis.projectName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      #{baseAnalysis.id} · {new Date(baseAnalysis.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Analysis #{baseId}</div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center pb-1">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* Head selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Head (v2 — newer)</Label>
              <select
                className="w-full bg-muted/30 border border-border/50 rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={headId ?? ""}
                onChange={e => setHeadId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">Select an analysis to compare...</option>
                {(analyses || [])
                  .filter(a => a.id !== baseId && a.status === "completed")
                  .sort((a, b) => b.id - a.id)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      #{a.id} — {a.projectName} ({new Date(a.createdAt).toLocaleDateString()})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {headId && (
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onClick={() => refetch()}
                disabled={diffLoading}
                className="gap-2"
              >
                {diffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                {diffLoading ? "Comparing..." : "Compare"}
              </Button>
            </div>
          )}
        </div>

        {/* Error */}
        {diffError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-red-400">Diff failed</div>
              <div className="text-xs text-muted-foreground mt-0.5">{diffError.message}</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {diffLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <div className="text-sm text-muted-foreground">Comparing spec versions...</div>
            </div>
          </div>
        )}

        {/* Results */}
        {diffResult && !diffLoading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Added Behaviors", value: diffResult.summary.addedBehaviors, color: "text-emerald-400", icon: <Plus className="w-4 h-4" /> },
                { label: "Removed Behaviors", value: diffResult.summary.removedBehaviors, color: "text-red-400", icon: <Minus className="w-4 h-4" /> },
                { label: "Changed Behaviors", value: diffResult.summary.changedBehaviors, color: "text-yellow-400", icon: <RefreshCw className="w-4 h-4" /> },
                { label: "Endpoint Changes", value: diffResult.summary.addedEndpoints + diffResult.summary.removedEndpoints, color: "text-blue-400", icon: <GitBranch className="w-4 h-4" /> },
              ].map(card => (
                <div key={card.label} className="bg-card/50 border border-border/50 rounded-xl p-4">
                  <div className={`flex items-center gap-2 ${card.color} mb-1`}>
                    {card.icon}
                    <span className="text-2xl font-bold">{card.value}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Affected Proof Types */}
            {diffResult.summary.affectedProofTypes.length > 0 && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">Affected Proof Types — re-run these tests</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {diffResult.summary.affectedProofTypes.map(pt => (
                    <span key={pt} className="text-xs font-mono bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2 py-1 rounded">
                      {pt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Status Machine Diff */}
            {diffResult.statusMachineDiff && (
              <div className="bg-card/50 border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">State Machine Changes</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {diffResult.statusMachineDiff.addedStates.length > 0 && (
                    <div>
                      <div className="text-xs text-emerald-400 font-semibold mb-2">+ Added States</div>
                      {diffResult.statusMachineDiff.addedStates.map(s => (
                        <div key={s} className="text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded mb-1">{s}</div>
                      ))}
                    </div>
                  )}
                  {diffResult.statusMachineDiff.removedStates.length > 0 && (
                    <div>
                      <div className="text-xs text-red-400 font-semibold mb-2">− Removed States</div>
                      {diffResult.statusMachineDiff.removedStates.map(s => (
                        <div key={s} className="text-xs font-mono bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-1 rounded mb-1">{s}</div>
                      ))}
                    </div>
                  )}
                  {diffResult.statusMachineDiff.addedTransitions.length > 0 && (
                    <div>
                      <div className="text-xs text-emerald-400 font-semibold mb-2">+ Added Transitions</div>
                      {diffResult.statusMachineDiff.addedTransitions.map(([f, t], i) => (
                        <div key={i} className="text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded mb-1">{f} → {t}</div>
                      ))}
                    </div>
                  )}
                  {diffResult.statusMachineDiff.removedTransitions.length > 0 && (
                    <div>
                      <div className="text-xs text-red-400 font-semibold mb-2">− Removed Transitions</div>
                      {diffResult.statusMachineDiff.removedTransitions.map(([f, t], i) => (
                        <div key={i} className="text-xs font-mono bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-1 rounded mb-1">{f} → {t}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Filter + Search Bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                {(["all", "added", "removed", "changed"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? `All (${diffResult.behaviorDiffs.length})` :
                     f === "added" ? `Added (${diffResult.summary.addedBehaviors})` :
                     f === "removed" ? `Removed (${diffResult.summary.removedBehaviors})` :
                     `Changed (${diffResult.summary.changedBehaviors})`}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search behaviors..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm bg-muted/30 border-border/50"
                />
              </div>
            </div>

            {/* Behavior Diffs */}
            {filteredBehaviors.length > 0 && (
              <div className="bg-card/50 border border-border/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  Behavior Changes
                  <span className="text-xs text-muted-foreground font-normal">({filteredBehaviors.length} shown)</span>
                </h3>
                <div className="space-y-1">
                  {filteredBehaviors.map(diff => (
                    <BehaviorDiffCard key={`${diff.type}-${diff.id}`} diff={diff} />
                  ))}
                </div>
              </div>
            )}

            {/* Endpoint Diffs */}
            {filteredEndpoints.length > 0 && (
              <div className="bg-card/50 border border-border/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  Endpoint Changes
                  <span className="text-xs text-muted-foreground font-normal">({filteredEndpoints.length})</span>
                </h3>
                <div className="space-y-1">
                  {filteredEndpoints.map(diff => (
                    <EndpointDiffCard key={`${diff.type}-${diff.name}`} diff={diff} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filteredBehaviors.length === 0 && filteredEndpoints.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                <div className="text-sm font-medium text-foreground">No differences found</div>
                <div className="text-xs mt-1">The two spec versions are identical{filter !== "all" ? ` for the "${filter}" filter` : ""}.</div>
              </div>
            )}
          </>
        )}

        {/* Empty state — no head selected */}
        {!headId && !diffLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <div className="text-sm font-medium text-foreground">Select a second analysis to compare</div>
            <div className="text-xs mt-1">Choose a "head" analysis above to see what changed between spec versions.</div>
          </div>
        )}
      </div>
    </div>
  );
}
