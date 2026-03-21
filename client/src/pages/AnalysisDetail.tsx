import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ArrowLeft, Download, CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Ban, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";
import type { Analysis } from "../../../drizzle/schema";

const STEPS = [
  { key: "pending",   label: "Queued",             desc: "Waiting to start",                    layer: 0 },
  { key: "layer1",    label: "Layer 1 — Spec Parse", desc: "Extracting behaviors from spec",      layer: 1 },
  { key: "checker",   label: "LLM Checker",          desc: "Verifying behaviors against spec",    layer: 2 },
  { key: "layer2",    label: "Layer 2 — Risk Model",  desc: "Building risk model & proof targets", layer: 2 },
  { key: "layer3",    label: "Layer 3 — Test Gen",    desc: "Generating proof tests (all parallel)",layer: 3 },
  { key: "layer45",   label: "Layer 4+5 — Validation",desc: "Independent check + false-green guard",layer: 4 },
  { key: "completed", label: "Complete",              desc: "Tests ready for download",             layer: 5 },
];

function ProgressSteps({
  status,
  createdAt,
  progressLayer,
  progressMessage,
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

  // Use real progressLayer from DB if available, else fall back to time estimate
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

      {/* Live progress message */}
      {progressMessage && (status === "running" || status === "pending") && (
        <div className="mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded text-xs font-mono text-primary">
          {progressMessage}
        </div>
      )}

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isDone = step.layer < currentLayer || (status === "completed");
          const isCurrent = step.layer === currentLayer && status !== "completed" && status !== "failed";
          const isPending = step.layer > currentLayer && status !== "completed";
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                isDone ? "bg-[var(--tf-green)]/20" :
                isCurrent ? "bg-primary/20" :
                "bg-muted"
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--tf-green)]" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-medium ${isPending ? "text-muted-foreground" : "text-foreground"}`}>
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: "text-[var(--tf-red)] bg-[var(--tf-red)]/10",
    high: "text-[var(--tf-orange)] bg-[var(--tf-orange)]/10",
    medium: "text-[var(--tf-yellow)] bg-[var(--tf-yellow)]/10",
    low: "text-[var(--tf-green)] bg-[var(--tf-green)]/10",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${map[level] || "text-muted-foreground"}`}>
      {level}
    </span>
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
              <a href={analysis.outputZipUrl} download>
                <Button className="gap-2">
                  <Download className="w-4 h-4" /> Download Tests (.zip)
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Running / Pending */}
        {(analysis.status === "running" || analysis.status === "pending") && (
          <div className="max-w-md">
            <ProgressSteps
              status={analysis.status}
              createdAt={analysis.createdAt}
              progressLayer={(analysis as any).progressLayer}
              progressMessage={(analysis as any).progressMessage}
            />
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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => retryMutation.mutate({ id: parseInt(id || "0") })}
                  disabled={retryMutation.isPending}
                >
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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => retryMutation.mutate({ id: parseInt(id || "0") })}
                  disabled={retryMutation.isPending}
                >
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
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                label="Validated Proofs"
                value={suite.verdict.passed}
                color="var(--tf-green)"
              />
              <MetricCard
                label="Behaviors Extracted"
                value={ir?.behaviors?.length || 0}
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

            {/* Validated Proofs */}
            {suite.proofs?.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--tf-green)]" />
                  <h3 className="font-semibold text-sm">Validated Proofs ({suite.proofs.length})</h3>
                </div>
                <div className="divide-y divide-border">
                  {suite.proofs.map((proof: any) => (
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
                        <div className="text-sm font-mono font-bold" style={{ color: proof.mutationScore >= 0.8 ? "var(--tf-green)" : "var(--tf-orange)" }}>
                          {(proof.mutationScore * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                  <div className="font-semibold text-sm mb-1">Test Suite Ready</div>
                  <div className="text-xs text-muted-foreground">
                    {suite.proofs?.length || 0} test files + report — drop into your project and run immediately
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
