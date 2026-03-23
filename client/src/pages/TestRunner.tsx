import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Play, CheckCircle2, XCircle, AlertCircle, Clock, Zap,
  ChevronDown, ChevronRight, Shield, ArrowLeft, RefreshCw,
  Target, TrendingUp, Eye, EyeOff, Wifi, WifiOff
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  testId: string;
  name: string;
  proofType: string;
  status: "pass" | "fail" | "error" | "skip";
  durationMs: number;
  actualStatus?: number;
  expectedStatus?: number[];
  failureReason?: string;
  mutationKill?: string;
}

interface RunSummary {
  runId: string;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;
  mutationScore: number;
  results: TestResult[];
  summary: string;
  startedAt: Date;
  completedAt: Date;
}

interface TestRun {
  id: number;
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;
  mutationScore: number;
  resultsJson: TestResult[] | null;
  summary: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

// SSE event types
type SSEEvent =
  | { type: "connected"; runId: string }
  | { type: "test_result"; result: TestResult; progress: { completed: number; total: number } }
  | { type: "run_complete"; summary: RunSummary }
  | { type: "run_error"; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TestResult["status"] }) {
  if (status === "pass") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "fail") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "error") return <AlertCircle className="w-4 h-4 text-amber-400" />;
  return <Clock className="w-4 h-4 text-zinc-400" />;
}

function ProofTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    idor: "bg-red-500/20 text-red-300 border-red-500/30",
    auth_matrix: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    status_transition: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    business_logic: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    concurrency: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    idempotency: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    dsgvo: "bg-green-500/20 text-green-300 border-green-500/30",
  };
  const color = colors[type] || "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${color}`}>
      {type}
    </span>
  );
}

// ─── Test Result Row ──────────────────────────────────────────────────────────

function TestResultRow({ result, isNew }: { result: TestResult; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasFail = result.status === "fail" || result.status === "error";

  return (
    <div className={`border-b border-zinc-800 last:border-0 transition-all duration-300 ${hasFail ? "bg-red-950/10" : ""} ${isNew ? "animate-pulse-once" : ""}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
        onClick={() => hasFail && setExpanded(!expanded)}
      >
        <StatusIcon status={result.status} />
        <span className="flex-1 text-sm text-zinc-200 truncate">{result.name}</span>
        <ProofTypeBadge type={result.proofType} />
        <span className="text-xs text-zinc-500 w-16 text-right">{result.durationMs}ms</span>
        {result.mutationKill && (
          <span title={`Kills: ${result.mutationKill}`}>
            <Target className="w-3.5 h-3.5 text-violet-400" />
          </span>
        )}
        {hasFail && (
          expanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />
        )}
      </button>
      {expanded && hasFail && (
        <div className="px-11 pb-3 space-y-1.5">
          {result.failureReason && (
            <p className="text-xs text-red-300 font-mono bg-red-950/30 rounded px-3 py-2">
              {result.failureReason}
            </p>
          )}
          {result.actualStatus !== undefined && (
            <p className="text-xs text-zinc-400">
              Got HTTP <span className="text-red-300 font-mono">{result.actualStatus}</span>
              {result.expectedStatus && (
                <>, expected <span className="text-emerald-300 font-mono">{result.expectedStatus.join(" or ")}</span></>
              )}
            </p>
          )}
          {result.mutationKill && (
            <p className="text-xs text-violet-300">
              <Target className="w-3 h-3 inline mr-1" />
              Mutation kill: {result.mutationKill}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Metrics Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Live Progress Bar ────────────────────────────────────────────────────────

function LiveProgressBar({ completed, total, passed, failed }: {
  completed: number; total: number; passed: number; failed: number;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const passPct = completed > 0 ? Math.round((passed / completed) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300 font-medium">
          {completed} / {total} tests
        </span>
        <span className="text-zinc-500">{pct}%</span>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-violet-600 to-violet-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> {passed} passed
        </span>
        <span className="text-red-400 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {failed} failed
        </span>
        {completed > 0 && (
          <span className="text-zinc-500">{passPct}% pass rate so far</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestRunner() {
  const params = useParams<{ id: string }>();
  const analysisId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Form state
  const [baseUrl, setBaseUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [advisorToken, setAdvisorToken] = useState("");
  const [customerToken, setCustomerToken] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Run state
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [activeRunStringId, setActiveRunStringId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "fail" | "pass">("all");

  // SSE live state
  const [sseConnected, setSseConnected] = useState(false);
  const [liveResults, setLiveResults] = useState<TestResult[]>([]);
  const [liveProgress, setLiveProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [runComplete, setRunComplete] = useState<RunSummary | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [newResultIds, setNewResultIds] = useState<Set<string>>(new Set());
  const sseRef = useRef<EventSource | null>(null);
  const resultsEndRef = useRef<HTMLDivElement | null>(null);

  // tRPC
  const startMutation = trpc.testRuns.start.useMutation();
  const { data: pastRuns } = trpc.testRuns.listByAnalysis.useQuery(
    { analysisId },
    { enabled: !!analysisId }
  );

  // Auto-scroll to bottom as new results arrive
  useEffect(() => {
    if (liveResults.length > 0) {
      resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveResults.length]);

  // SSE connection management
  const connectSSE = useCallback((runId: string) => {
    // Close any existing connection
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const es = new EventSource(`/api/test-runs/${runId}/stream`, { withCredentials: true });
    sseRef.current = es;

    es.onopen = () => {
      setSseConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        if (data.type === "connected") {
          setSseConnected(true);
        } else if (data.type === "test_result") {
          const { result, progress } = data;
          setLiveResults(prev => [...prev, result]);
          setLiveProgress(progress);
          // Mark as new for animation
          setNewResultIds(prev => {
            const next = new Set(prev);
            next.add(result.testId);
            setTimeout(() => {
              setNewResultIds(curr => {
                const s = new Set(curr);
                s.delete(result.testId);
                return s;
              });
            }, 1000);
            return next;
          });
        } else if (data.type === "run_complete") {
          setRunComplete(data.summary);
          setIsRunning(false);
          setSseConnected(false);
          es.close();
        } else if (data.type === "run_error") {
          setRunError(data.error);
          setIsRunning(false);
          setSseConnected(false);
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setSseConnected(false);
      // Don't close — browser will auto-reconnect for transient errors
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, []);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      sseRef.current?.close();
    };
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Sign in to run tests</p>
        </div>
      </div>
    );
  }

  const handleStart = async () => {
    if (!baseUrl || !authToken) return;
    try {
      const roleTokens: Record<string, string> = {};
      if (advisorToken) roleTokens["advisor"] = advisorToken;
      if (customerToken) roleTokens["customer"] = customerToken;

      // Reset live state
      setLiveResults([]);
      setLiveProgress({ completed: 0, total: 0 });
      setRunComplete(null);
      setRunError(null);
      setIsRunning(true);

      const result = await startMutation.mutateAsync({
        analysisId,
        baseUrl: baseUrl.replace(/\/$/, ""),
        authToken,
        roleTokens: Object.keys(roleTokens).length > 0 ? roleTokens : undefined,
        timeout: 10000,
        concurrency: 5,
      });

      setActiveRunId(result.testRunId);
      setActiveRunStringId(result.runId);

      // Connect SSE for live streaming
      connectSSE(result.runId);
    } catch (err: unknown) {
      setIsRunning(false);
      console.error("Failed to start test run:", err);
    }
  };

  // Compute display results: live during run, final after complete
  const displayResults: TestResult[] = runComplete
    ? runComplete.results
    : liveResults;

  const filteredResults = displayResults.filter(r => {
    if (filter === "fail") return r.status === "fail" || r.status === "error";
    if (filter === "pass") return r.status === "pass";
    return true;
  });

  // Live metrics
  const livePassed = liveResults.filter(r => r.status === "pass").length;
  const liveFailed = liveResults.filter(r => r.status === "fail" || r.status === "error").length;

  // Final metrics (from SSE complete event or live)
  const finalPassed = runComplete?.passed ?? livePassed;
  const finalFailed = runComplete?.failed ?? liveFailed;
  const finalTotal = runComplete?.totalTests ?? liveProgress.total;
  const finalPassRate = runComplete?.passRate ?? (finalTotal > 0 ? Math.round((finalPassed / finalTotal) * 100) : 0);
  const finalMutationScore = runComplete?.mutationScore ?? 100;

  // Group results by proof type
  const byProofType = displayResults.reduce((acc, r) => {
    if (!acc[r.proofType]) acc[r.proofType] = { pass: 0, fail: 0, error: 0 };
    acc[r.proofType][r.status === "skip" ? "pass" : r.status]++;
    return acc;
  }, {} as Record<string, { pass: number; fail: number; error: number }>);

  const isDone = !!runComplete || !!runError;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(analysisId ? `/analysis/${analysisId}` : "/dashboard")}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              Test Runner
              {isRunning && (
                <span className="flex items-center gap-1.5 text-xs font-normal text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-0.5">
                  {sseConnected
                    ? <><Wifi className="w-3 h-3" /> Live</>
                    : <><WifiOff className="w-3 h-3" /> Connecting...</>
                  }
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500">
              {analysisId ? `Analysis #${analysisId} — ` : ""}Execute tests against your live API
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Config Form — shown when not running */}
        {!isRunning && !isDone && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-violet-400" />
                Configure Test Run
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Base URL <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="https://api.yourapp.com"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                  <p className="text-xs text-zinc-500">The root URL of your API (no trailing slash)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Admin Bearer Token <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showToken ? "text" : "password"}
                      placeholder="eyJhbGciOiJIUzI1NiJ9..."
                      value={authToken}
                      onChange={e => setAuthToken(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 pr-10"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">Used for admin-role tests</p>
                </div>
              </div>

              {/* Advanced: role tokens */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Additional role tokens (optional)
                </button>
                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-xs">Advisor Token</Label>
                      <Input
                        type="password"
                        placeholder="Bearer token for advisor role"
                        value={advisorToken}
                        onChange={e => setAdvisorToken(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-xs">Customer Token</Label>
                      <Input
                        type="password"
                        placeholder="Bearer token for customer role"
                        value={customerToken}
                        onChange={e => setCustomerToken(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleStart}
                  disabled={!baseUrl || !authToken || startMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                >
                  {startMutation.isPending ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" />Run Tests</>
                  )}
                </Button>
                {startMutation.isError && (
                  <p className="text-xs text-red-400">
                    {(startMutation.error as unknown as Error)?.message || "Failed to start"}
                  </p>
                )}
              </div>

              {/* Past runs */}
              {pastRuns && pastRuns.length > 0 && (
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-3">Previous runs</p>
                  <div className="space-y-2">
                    {(pastRuns as TestRun[]).slice(-5).reverse().map(r => (
                      <div
                        key={r.id}
                        className="w-full flex items-center gap-3 text-left px-3 py-2 rounded bg-zinc-800/50"
                      >
                        <span className={`w-2 h-2 rounded-full ${r.status === "completed" ? "bg-emerald-400" : r.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
                        <span className="text-xs text-zinc-300 flex-1 font-mono truncate">{r.runId}</span>
                        <span className="text-xs text-zinc-500">{r.passRate}% pass</span>
                        <span className="text-xs text-zinc-600">{new Date(r.startedAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Live Running State */}
        {isRunning && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" />
                Running Tests Live
                <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-zinc-400">
                  {sseConnected
                    ? <><Wifi className="w-3 h-3 text-emerald-400" /> SSE Connected</>
                    : <><WifiOff className="w-3 h-3 text-amber-400" /> Connecting...</>
                  }
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <LiveProgressBar
                completed={liveProgress.completed}
                total={liveProgress.total}
                passed={livePassed}
                failed={liveFailed}
              />
            </CardContent>
          </Card>
        )}

        {/* Live Results (shown during run) */}
        {isRunning && liveResults.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                Live Results
                <span className="text-xs font-normal text-zinc-500 ml-auto">
                  {liveResults.length} completed
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {liveResults.map(r => (
                <TestResultRow key={r.testId} result={r} isNew={newResultIds.has(r.testId)} />
              ))}
              <div ref={resultsEndRef} />
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {runError && (
          <Card className="bg-red-950/20 border-red-800">
            <CardContent className="py-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-red-300 font-medium">Test run failed</p>
              <p className="text-red-400/70 text-sm font-mono">{runError}</p>
              <Button
                variant="outline"
                onClick={() => { setRunError(null); setIsRunning(false); setLiveResults([]); }}
                className="border-red-700 text-red-300 hover:text-white"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Final Results */}
        {isDone && runComplete && (
          <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Pass Rate"
                value={`${finalPassRate}%`}
                sub={`${finalPassed}/${finalTotal} tests`}
                color={finalPassRate >= 80 ? "text-emerald-400" : finalPassRate >= 50 ? "text-amber-400" : "text-red-400"}
              />
              <MetricCard
                label="Mutation Score"
                value={`${finalMutationScore}%`}
                sub="Security kills caught"
                color={finalMutationScore >= 80 ? "text-violet-400" : "text-amber-400"}
              />
              <MetricCard
                label="Failed"
                value={finalFailed}
                sub={`${runComplete.errors} errors`}
                color={finalFailed > 0 ? "text-red-400" : "text-zinc-400"}
              />
              <MetricCard
                label="Duration"
                value={runComplete.completedAt
                  ? `${((new Date(runComplete.completedAt).getTime() - new Date(runComplete.startedAt).getTime()) / 1000).toFixed(1)}s`
                  : "—"}
                sub={`${finalTotal} total tests`}
              />
            </div>

            {/* Proof Type Breakdown */}
            {Object.keys(byProofType).length > 0 && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-400" />
                    Results by Proof Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(byProofType).map(([type, counts]) => {
                      const total = counts.pass + counts.fail + counts.error;
                      const pct = total > 0 ? Math.round((counts.pass / total) * 100) : 0;
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <ProofTypeBadge type={type} />
                          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 w-24 text-right">
                            {counts.pass}/{total} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Test Results List */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Test Results</CardTitle>
                  <div className="flex gap-2">
                    {(["all", "fail", "pass"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-xs px-3 py-1 rounded transition-colors ${filter === f ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                      >
                        {f === "all" ? `All (${displayResults.length})` : f === "fail" ? `Failed (${finalFailed})` : `Passed (${finalPassed})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredResults.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-sm">
                    No {filter === "fail" ? "failing" : filter === "pass" ? "passing" : ""} tests
                  </div>
                ) : (
                  <div>
                    {filteredResults.map(r => (
                      <TestResultRow key={r.testId} result={r} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRunComplete(null);
                  setRunError(null);
                  setLiveResults([]);
                  setLiveProgress({ completed: 0, total: 0 });
                  setIsRunning(false);
                  setActiveRunId(null);
                  setActiveRunStringId(null);
                }}
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                Run Again
              </Button>
              {analysisId > 0 && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/analysis/${analysisId}`)}
                  className="border-zinc-700 text-zinc-300 hover:text-white"
                >
                  Back to Analysis
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
