import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Play, CheckCircle2, XCircle, AlertCircle, Clock, Zap,
  ChevronDown, ChevronRight, Shield, ArrowLeft, RefreshCw,
  Target, TrendingUp, Eye, EyeOff
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

function TestResultRow({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasFail = result.status === "fail" || result.status === "error";

  return (
    <div className={`border-b border-zinc-800 last:border-0 ${hasFail ? "bg-red-950/10" : ""}`}>
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
  const [filter, setFilter] = useState<"all" | "fail" | "pass">("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tRPC
  const startMutation = trpc.testRuns.start.useMutation();
  const { data: runData, refetch: refetchRun } = trpc.testRuns.getResults.useQuery(
    { testRunId: activeRunId! },
    { enabled: !!activeRunId, refetchInterval: false }
  );
  const { data: pastRuns } = trpc.testRuns.listByAnalysis.useQuery(
    { analysisId },
    { enabled: !!analysisId }
  );

  // Poll while running
  useEffect(() => {
    if (!activeRunId) return;
    if (runData?.status === "running" || runData?.status === "pending") {
      pollRef.current = setInterval(() => refetchRun(), 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRunId, runData?.status, refetchRun]);

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

      const result = await startMutation.mutateAsync({
        analysisId,
        baseUrl: baseUrl.replace(/\/$/, ""),
        authToken,
        roleTokens: Object.keys(roleTokens).length > 0 ? roleTokens : undefined,
        timeout: 10000,
        concurrency: 5,
      });
      setActiveRunId(result.testRunId);
    } catch (err: unknown) {
      console.error("Failed to start test run:", err);
    }
  };

  const run = runData as TestRun | undefined;
  const results: TestResult[] = (run?.resultsJson as TestResult[]) || [];
  const filteredResults = results.filter(r => {
    if (filter === "fail") return r.status === "fail" || r.status === "error";
    if (filter === "pass") return r.status === "pass";
    return true;
  });

  const isRunning = run?.status === "running" || run?.status === "pending";
  const isDone = run?.status === "completed" || run?.status === "failed";

  // Group results by proof type
  const byProofType = results.reduce((acc, r) => {
    if (!acc[r.proofType]) acc[r.proofType] = { pass: 0, fail: 0, error: 0 };
    acc[r.proofType][r.status === "skip" ? "pass" : r.status]++;
    return acc;
  }, {} as Record<string, { pass: number; fail: number; error: number }>);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/analysis/${analysisId}`)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              Test Runner
            </h1>
            <p className="text-xs text-zinc-500">Analysis #{analysisId} — Execute tests against your live API</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Config Form */}
        {!activeRunId && (
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
                      <button
                        key={r.id}
                        onClick={() => setActiveRunId(r.id)}
                        className="w-full flex items-center gap-3 text-left px-3 py-2 rounded bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full ${r.status === "completed" ? "bg-emerald-400" : r.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
                        <span className="text-xs text-zinc-300 flex-1">{r.runId}</span>
                        <span className="text-xs text-zinc-500">{r.passRate}% pass</span>
                        <span className="text-xs text-zinc-600">{new Date(r.startedAt).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Running state */}
        {activeRunId && isRunning && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-8 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
              <p className="text-white font-medium">Running tests against your API...</p>
              <p className="text-zinc-400 text-sm">Tests execute with 5 parallel workers. Results appear when complete.</p>
              <Progress className="w-64 mx-auto" value={undefined} />
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {activeRunId && isDone && run && (
          <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Pass Rate"
                value={`${run.passRate}%`}
                sub={`${run.passed}/${run.totalTests} tests`}
                color={run.passRate >= 80 ? "text-emerald-400" : run.passRate >= 50 ? "text-amber-400" : "text-red-400"}
              />
              <MetricCard
                label="Mutation Score"
                value={`${run.mutationScore}%`}
                sub="Security kills caught"
                color={run.mutationScore >= 80 ? "text-violet-400" : "text-amber-400"}
              />
              <MetricCard
                label="Failed"
                value={run.failed}
                sub={`${run.errors} errors`}
                color={run.failed > 0 ? "text-red-400" : "text-zinc-400"}
              />
              <MetricCard
                label="Duration"
                value={run.completedAt
                  ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
                  : "—"}
                sub={`${run.totalTests} total tests`}
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
                        {f === "all" ? `All (${results.length})` : f === "fail" ? `Failed (${run.failed + run.errors})` : `Passed (${run.passed})`}
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
                onClick={() => { setActiveRunId(null); }}
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                Run Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/analysis/${analysisId}`)}
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                Back to Analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
