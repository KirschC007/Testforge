import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Shield, Zap, FileCode2, GitBranch, Lock, ArrowRight,
  CheckCircle2, Terminal, Package, Star, Activity,
  AlertTriangle, Layers, Database, RefreshCw, Eye,
  Cpu, Repeat2, Users,
} from "lucide-react";

// ─── Proof type definitions ────────────────────────────────────────────────
const PROOF_TYPES = [
  { id: "idor",            label: "IDOR",             icon: <Lock className="w-4 h-4" />,        color: "var(--tf-red)",    desc: "Cross-tenant isolation, ownership checks" },
  { id: "csrf",            label: "CSRF",             icon: <Shield className="w-4 h-4" />,      color: "var(--tf-orange)", desc: "State-mutating endpoints, token validation" },
  { id: "boundary",        label: "Boundary",         icon: <Activity className="w-4 h-4" />,    color: "var(--tf-yellow)", desc: "Min/max/null/overflow with decimal precision" },
  { id: "business_logic",  label: "Business Logic",   icon: <Layers className="w-4 h-4" />,      color: "var(--tf-blue)",   desc: "Before/after state, stock decrements, counters" },
  { id: "status_transition", label: "Status Machine", icon: <RefreshCw className="w-4 h-4" />,   color: "var(--tf-purple)", desc: "Valid transitions, skip-prevention, terminal states" },
  { id: "spec_drift",      label: "Spec Drift",       icon: <Eye className="w-4 h-4" />,         color: "var(--tf-green)",  desc: "Zod response schemas, field type validation" },
  { id: "dsgvo",           label: "DSGVO / GDPR",     icon: <Database className="w-4 h-4" />,    color: "var(--tf-yellow)", desc: "PII anonymization, data export isolation" },
  { id: "rate_limit",      label: "Rate Limit",       icon: <AlertTriangle className="w-4 h-4" />, color: "var(--tf-orange)", desc: "Auth brute-force, burst detection" },
  { id: "concurrency",     label: "Concurrency",      icon: <Cpu className="w-4 h-4" />,          color: "var(--tf-red)",    desc: "Race conditions, double-booking, atomic operations" },
  { id: "idempotency",     label: "Idempotency",      icon: <Repeat2 className="w-4 h-4" />,      color: "var(--tf-blue)",   desc: "Duplicate requests, retry safety, deduplication" },
  { id: "auth_matrix",     label: "Auth Matrix",      icon: <Users className="w-4 h-4" />,        color: "var(--tf-purple)", desc: "Role-based access: admin/user/unauthenticated/cross-tenant" },
];

// ─── 5-Layer pipeline ─────────────────────────────────────────────────────
const LAYERS = [
  { n: 1, label: "Spec Parse",        color: "var(--tf-blue)",   desc: "LLM extracts behaviors, endpoints, status machines, invariants, tenant keys" },
  { n: 2, label: "Risk Model",        color: "var(--tf-orange)", desc: "Tenant isolation vectors, CSRF surfaces, boundary constraints, side effects" },
  { n: 3, label: "Test Generation",   color: "var(--tf-purple)", desc: "12 proof types generated in parallel — typed payloads, Zod schemas, CI/CD config" },
  { n: 4, label: "LLM Verification",  color: "var(--tf-yellow)", desc: "Independent checker validates each test against the original spec" },
  { n: 5, label: "False-Green Guard", color: "var(--tf-green)",  desc: "8 mutation rules discard tests that can't catch real regressions" },
];

// ─── ZIP output items (6 layers) ─────────────────────────────────────────────
const ZIP_ITEMS = [
  { layer: "Unit",        color: "var(--tf-blue)",   path: "tests/unit/",        desc: "Vitest: service isolation, validation, state machine" },
  { layer: "Integration", color: "var(--tf-purple)", path: "tests/integration/", desc: "Vitest: CRUD lifecycle, auth, tenant isolation" },
  { layer: "E2E",         color: "var(--tf-green)",  path: "tests/e2e/",         desc: "Playwright: user flows, auth, create→verify" },
  { layer: "UAT",         color: "var(--tf-yellow)", path: "tests/uat/",         desc: "Cucumber/Gherkin: human-readable acceptance criteria" },
  { layer: "Security",    color: "var(--tf-red)",    path: "tests/security/",    desc: "Playwright: IDOR, CSRF, Rate-Limit, Spec-Drift" },
  { layer: "Performance", color: "var(--tf-orange)", path: "tests/performance/", desc: "k6: load, spike, stress, rate-limit burst" },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm tracking-tight">TestForge</span>
            <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">by Manus</span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="sm" className="gap-1.5">
                    Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="sm">Sign In</Button>
                </a>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(var(--tf-grid) 1px, transparent 1px), linear-gradient(90deg, var(--tf-grid) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(ellipse, var(--tf-blue) 0%, transparent 70%)" }} />

        <div className="container relative py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1 mb-6">
            <Zap className="w-3 h-3 text-[var(--tf-yellow)]" />
            <span>12 Proof Types · 6 Test Layers · Spec Health Score</span>       </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-tight">
            Proof-Grade Tests<br />
            <span style={{ color: "var(--tf-blue)" }}>from your API Spec</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            Upload any API specification. TestForge extracts behaviors, builds a risk model,
            and generates a ready-to-run Playwright test suite — with CI/CD config included.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {isAuthenticated ? (
              <>
                <Link href="/analysis/new">
                  <Button size="lg" className="gap-2">
                    <FileCode2 className="w-4 h-4" /> Start Analysis
                  </Button>
                </Link>
                <Link href="/analysis/new?demo=1">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Terminal className="w-4 h-4" /> Try Demo Spec
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button size="lg" className="gap-2">
                    <Shield className="w-4 h-4" /> Get Started Free
                  </Button>
                </a>
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="outline" className="gap-2">
                    <Terminal className="w-4 h-4" /> Try Demo Spec
                  </Button>
                </a>
              </>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-8 mt-12 text-sm">
            {[
              { v: "12",  l: "Proof Types" },
              { v: "6",   l: "Test Layers" },
              { v: "~2min", l: "Avg Analysis Time" },
              { v: "0",   l: "Config Required" },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-xl font-bold font-mono" style={{ color: "var(--tf-blue)" }}>{s.v}</div>
                <div className="text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proof Types Grid ────────────────────────────────────────── */}
      <section className="border-b border-border/50 py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">12 Proof Types — Automatically Detected</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              TestForge reads your spec and determines which proof types apply to each endpoint.
              No manual configuration needed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {PROOF_TYPES.map(pt => (
              <div key={pt.id} className="bg-card border border-border rounded-lg p-4 hover:border-border/80 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ color: pt.color, background: `${pt.color}18` }}>
                    {pt.icon}
                  </div>
                  <span className="text-sm font-semibold">{pt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5-Layer Pipeline ────────────────────────────────────────── */}
      <section className="border-b border-border/50 py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">5-Layer Analysis Pipeline</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Each layer builds on the previous. The result is a test suite with a provable mutation score —
              not just coverage numbers.
            </p>
          </div>
          <div className="max-w-2xl mx-auto space-y-2">
            {LAYERS.map((layer, i) => (
              <div key={layer.n} className="flex items-start gap-4">
                {/* Connector */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                    style={{ borderColor: layer.color, color: layer.color, background: `${layer.color}12` }}>
                    {layer.n}
                  </div>
                  {i < LAYERS.length - 1 && (
                    <div className="w-px h-6 mt-1" style={{ background: `${layer.color}40` }} />
                  )}
                </div>
                <div className="pb-4">
                  <div className="text-sm font-semibold mb-0.5" style={{ color: layer.color }}>
                    Layer {layer.n} — {layer.label}
                  </div>
                  <p className="text-xs text-muted-foreground">{layer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Spec Health + ZIP Output ─────────────────────────────────── */}
      <section className="border-b border-border/50 py-16">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Spec Health */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-[var(--tf-yellow)]" />
                <h2 className="text-xl font-bold">Spec Health Score</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-5">
                Before generating tests, TestForge evaluates your spec's completeness across 6 dimensions.
                Better specs produce more precise tests — no TODO_ placeholders.
              </p>
              <div className="space-y-3">
                {[
                  { label: "Typed Fields",         score: 20, max: 20, passed: true,  detail: "All inputFields have type annotations" },
                  { label: "Enum Values",           score: 15, max: 15, passed: true,  detail: "Status enums fully enumerated" },
                  { label: "Boundary Constraints",  score: 10, max: 20, passed: false, detail: "Some fields missing min/max" },
                  { label: "Auth Model",            score: 15, max: 15, passed: true,  detail: "Bearer token + tenant isolation defined" },
                  { label: "Tenant Model",          score: 15, max: 15, passed: true,  detail: "shopId as tenant key identified" },
                  { label: "Response Shape",        score: 10, max: 15, passed: false, detail: "Some endpoints missing outputFields" },
                ].map(dim => (
                  <div key={dim.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {dim.passed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--tf-green)] shrink-0" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-[var(--tf-orange)] shrink-0" />
                        }
                        <span className="text-xs font-medium">{dim.label}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{dim.score}/{dim.max}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{
                        width: `${(dim.score / dim.max) * 100}%`,
                        background: dim.passed ? "var(--tf-green)" : "var(--tf-orange)"
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <div className="text-2xl font-black font-mono" style={{ color: "var(--tf-blue)" }}>85</div>
                <div>
                  <div className="text-sm font-semibold">Score B — Good</div>
                  <div className="text-xs text-muted-foreground">Add boundary constraints to reach Grade A</div>
                </div>
                <div className="ml-auto text-2xl font-black w-10 h-10 rounded-xl border-2 flex items-center justify-center"
                  style={{ color: "var(--tf-blue)", background: "var(--tf-blue)/10", borderColor: "var(--tf-blue)/30" }}>
                  B
                </div>
              </div>
            </div>

            {/* ZIP Output */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-[var(--tf-green)]" />
                <h2 className="text-xl font-bold">6-Layer Test Suite — Ready to Run</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-5">
                The output ZIP contains all 6 test layers with configs, helpers, and CI/CD pipeline.
                Unzip, install, run — no manual setup needed.
              </p>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                  <div className="font-mono text-xs text-[var(--tf-green)]">
                    $ unzip testforge-output.zip &amp;&amp; npm install &amp;&amp; npm run test:all
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  {ZIP_ITEMS.map(item => (
                    <div key={item.path} className="flex items-center gap-2.5">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: item.color, background: `${item.color}18` }}>
                        {item.layer}
                      </span>
                      <span className="text-xs font-mono text-foreground shrink-0">{item.path}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { v: "npm install", l: "Step 1" },
                  { v: "npm run test:all", l: "Step 2" },
                  { v: "Done ✓",     l: "Step 3" },
                ].map(s => (
                  <div key={s.l} className="bg-card border border-border rounded-lg p-3">
                    <div className="text-xs font-mono font-bold text-foreground">{s.v}</div>
                    <div className="text-xs text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="border-b border-border/50 py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">How it Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              {
                n: "01", icon: <FileCode2 className="w-6 h-6" />, color: "var(--tf-blue)",
                title: "Upload your Spec",
                desc: "PDF, Markdown, Word, or plain text. TestForge accepts any format and extracts the relevant information automatically.",
              },
              {
                n: "02", icon: <Layers className="w-6 h-6" />, color: "var(--tf-purple)",
                title: "5-Layer Analysis",
                desc: "The pipeline parses behaviors, builds a risk model, generates tests, verifies them, and filters false-greens — in ~2 minutes.",
              },
              {
                n: "03", icon: <GitBranch className="w-6 h-6" />, color: "var(--tf-green)",
                title: "Download & Run",
                desc: "Get a ZIP with Playwright tests, CI/CD pipeline, Zod schemas, and a full setup guide. npm install → npm test.",
              },
            ].map(step => (
              <div key={step.n} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ color: step.color, background: `${step.color}15` }}>
                    {step.icon}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{step.n}</span>
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl font-black mb-4">Ready to forge your tests?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Upload your first spec and get a proof-grade test suite in minutes.
            No credit card, no setup.
          </p>
          <div className="flex items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link href="/analysis/new">
                <Button size="lg" className="gap-2">
                  <FileCode2 className="w-4 h-4" /> Start Your First Analysis
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="gap-2">
                  <Shield className="w-4 h-4" /> Sign In to Get Started
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-6">
        <div className="container flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span>TestForge</span>
          </div>
          <span>Built with Manus</span>
        </div>
      </footer>
    </div>
  );
}
