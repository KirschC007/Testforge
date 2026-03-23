import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Shield, Zap, FileCode2, GitBranch, Lock, ArrowRight,
  CheckCircle2, Terminal, Package, Star, Activity,
  AlertTriangle, Layers, Database, RefreshCw, Eye,
  Cpu, Repeat2, Users, GitMerge, Clock, Webhook, ToggleLeft,
  Code2, Sparkles,
} from "lucide-react";

// ─── Proof type definitions (16 types) ────────────────────────────────────
const PROOF_TYPES = [
  { id: "idor",             label: "IDOR",             icon: <Lock className="w-4 h-4" />,        color: "var(--tf-red)",    desc: "Cross-tenant isolation, ownership checks" },
  { id: "csrf",             label: "CSRF",             icon: <Shield className="w-4 h-4" />,      color: "var(--tf-orange)", desc: "State-mutating endpoints, token validation" },
  { id: "boundary",         label: "Boundary",         icon: <Activity className="w-4 h-4" />,    color: "var(--tf-yellow)", desc: "Min/max/null/overflow with decimal precision" },
  { id: "business_logic",   label: "Business Logic",   icon: <Layers className="w-4 h-4" />,      color: "var(--tf-blue)",   desc: "Before/after state, stock decrements, counters" },
  { id: "status_transition",label: "Status Machine",   icon: <RefreshCw className="w-4 h-4" />,   color: "var(--tf-purple)", desc: "Valid transitions, skip-prevention, terminal states" },
  { id: "spec_drift",       label: "Spec Drift",       icon: <Eye className="w-4 h-4" />,         color: "var(--tf-green)",  desc: "Zod response schemas, field type validation" },
  { id: "dsgvo",            label: "DSGVO / GDPR",     icon: <Database className="w-4 h-4" />,    color: "var(--tf-yellow)", desc: "PII anonymization, data export isolation" },
  { id: "rate_limit",       label: "Rate Limit",       icon: <AlertTriangle className="w-4 h-4" />,color: "var(--tf-orange)", desc: "Auth brute-force, burst detection" },
  { id: "concurrency",      label: "Concurrency",      icon: <Cpu className="w-4 h-4" />,         color: "var(--tf-red)",    desc: "Race conditions, double-booking, atomic operations" },
  { id: "idempotency",      label: "Idempotency",      icon: <Repeat2 className="w-4 h-4" />,     color: "var(--tf-blue)",   desc: "Duplicate requests, retry safety, deduplication" },
  { id: "auth_matrix",      label: "Auth Matrix",      icon: <Users className="w-4 h-4" />,       color: "var(--tf-purple)", desc: "Role-based access: admin/user/unauthenticated/cross-tenant" },
  { id: "flow",             label: "Flow",             icon: <GitMerge className="w-4 h-4" />,    color: "var(--tf-blue)",   desc: "Multi-step workflows, saga patterns, rollback verification" },
  { id: "cron_job",         label: "Cron Job",         icon: <Clock className="w-4 h-4" />,       color: "var(--tf-green)",  desc: "Scheduled jobs, periodic tasks, batch processing" },
  { id: "webhook",          label: "Webhook",          icon: <Webhook className="w-4 h-4" />,     color: "var(--tf-orange)", desc: "Event delivery, HMAC signature, retry logic" },
  { id: "feature_gate",     label: "Feature Gate",     icon: <ToggleLeft className="w-4 h-4" />,  color: "var(--tf-purple)", desc: "Plan-based gating, tier checks, A/B rollout" },
  { id: "sqli",             label: "SQL Injection",    icon: <Code2 className="w-4 h-4" />,       color: "var(--tf-red)",    desc: "Input sanitization, parameterized queries" },
];

// ─── 5-Layer pipeline ─────────────────────────────────────────────────────
const LAYERS = [
  { n: 1, label: "Spec Parse",        color: "var(--tf-blue)",   desc: "LLM extracts behaviors, endpoints, status machines, invariants, tenant keys — 3-pass Smart Parser for large specs (>50KB)" },
  { n: 2, label: "Risk Model",        color: "var(--tf-orange)", desc: "Tenant isolation vectors, CSRF surfaces, boundary constraints, side effects, flow definitions, cron jobs, feature gates" },
  { n: 3, label: "Test Generation",   color: "var(--tf-purple)", desc: "16 proof types generated in parallel — typed payloads, Zod schemas, CI/CD config, validate-payloads.mjs" },
  { n: 4, label: "LLM Verification",  color: "var(--tf-yellow)", desc: "Independent checker validates each test against the original spec — cross-validates behaviors, improves weak ones" },
  { n: 5, label: "False-Green Guard", color: "var(--tf-green)",  desc: "8 mutation rules discard tests that can't catch real regressions — mutation score per test" },
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
          <div className="flex items-center gap-4">
            <Link href="/demo">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden sm:inline">Demo</span>
            </Link>
            <Link href="/pricing">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden sm:inline">Pricing</span>
            </Link>
            {!loading && (
              isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <Link href="/analysis/new">
                    <Button size="sm" variant="outline" className="gap-1.5 hidden sm:flex border-border/60">
                      <Zap className="w-3.5 h-3.5" /> Run Tests
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button size="sm" className="gap-1.5">
                      Dashboard <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
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
          {/* Badges row */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
              <Zap className="w-3 h-3 text-[var(--tf-yellow)]" />
              <span>16 Proof Types · 6 Test Layers · Spec Health Score</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1"
              style={{ color: "var(--tf-blue)", borderColor: "var(--tf-blue)40", background: "var(--tf-blue)10" }}>
              <Sparkles className="w-3 h-3" />
              <span>OpenAPI 3.x / Swagger 2.x — 100% deterministic, no LLM</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1"
              style={{ color: "var(--tf-purple)", borderColor: "var(--tf-purple)40", background: "var(--tf-purple)10" }}>
              <Cpu className="w-3 h-3" />
              <span>Large specs (&gt;50KB) use 3-pass Smart Parser for 2× better extraction</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-tight">
            Proof-Grade Tests<br />
            <span style={{ color: "var(--tf-blue)" }}>from Spec or Code</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            Upload your API spec <em>or</em> drop your codebase. TestForge extracts behaviors,
            builds a risk model, and generates a ready-to-run Playwright test suite — in under 3 minutes.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {isAuthenticated ? (
              <>
                <Link href="/analysis/new">
                  <Button size="lg" className="gap-2">
                    <FileCode2 className="w-4 h-4" /> From Spec
                  </Button>
                </Link>
                <Link href="/analysis/new?mode=code">
                  <Button size="lg" className="gap-2" style={{ background: "var(--tf-purple)", color: "#fff" }}>
                    <Code2 className="w-4 h-4" /> From Code
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Terminal className="w-4 h-4" /> Demo
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
                <Link href="/demo">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Terminal className="w-4 h-4" /> See Live Demo
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-8 mt-12 text-sm">
            {[
              { v: "16",    l: "Proof Types" },
              { v: "6",     l: "Test Layers" },
              { v: "3-Pass",l: "Smart Parser" },
              { v: "0",     l: "Config Required" },
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
            <h2 className="text-2xl font-bold mb-2">16 Proof Types — Automatically Detected</h2>
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
                    $ unzip testforge-output.zip &amp;&amp; npm install &amp;&amp; npm run validate &amp;&amp; npm test
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
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { v: "npm install",   l: "Step 1" },
                  { v: "npm run validate", l: "Step 2" },
                  { v: "npm test",      l: "Step 3" },
                  { v: "Done ✓",        l: "Step 4" },
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
                desc: "OpenAPI/Swagger (JSON/YAML) for 100% deterministic results, or Markdown/PDF/Word for LLM-based extraction. Large specs use the 3-pass Smart Parser automatically.",
              },
              {
                n: "02", icon: <Layers className="w-6 h-6" />, color: "var(--tf-purple)",
                title: "5-Layer Analysis",
                desc: "The pipeline parses behaviors, builds a risk model, generates 16 proof types in parallel, verifies them with an independent LLM checker, and filters false-greens.",
              },
              {
                n: "03", icon: <GitBranch className="w-6 h-6" />, color: "var(--tf-green)",
                title: "Download & Run",
                desc: "Get a ZIP with Playwright tests, CI/CD pipeline, Zod schemas, validate-payloads.mjs, and a full setup guide. npm install → npm run validate → npm test.",
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

      {/* ── Differentiators (Sprint 4+5) ────────────────────────────────── */}
      <section className="border-b border-border/50 py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">What Makes TestForge Different</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Beyond test generation — a complete quality compiler with feedback loops, diff tracking, and CI/CD integration.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <GitBranch className="w-5 h-5" />, color: "var(--tf-blue)",
                title: "Spec Diff Engine",
                desc: "Compare two analyses side-by-side. See exactly which behaviors changed, which endpoints were added/removed, and which proof types are now affected.",
                badge: "Sprint 4",
              },
              {
                icon: <RefreshCw className="w-5 h-5" />, color: "var(--tf-green)",
                title: "Feedback Loop",
                desc: "Run your tests, post results back to TestForge. Pass rates, failed proof IDs, and error messages flow back — improving the next analysis.",
                badge: "Sprint 4",
              },
              {
                icon: <Code2 className="w-5 h-5" />, color: "var(--tf-purple)",
                title: "GitHub PR Comments",
                desc: "Automatically post analysis results as PR comments. Includes verdict score, spec diff summary, and a link to the full report.",
                badge: "Sprint 4",
              },
              {
                icon: <Database className="w-5 h-5" />, color: "var(--tf-orange)",
                title: "Docker Self-Hosted",
                desc: "Enterprise plan: run TestForge entirely in your VPC. Docker Compose stack with MySQL, MinIO S3, and Nginx TLS termination included.",
                badge: "Enterprise",
              },
              {
                icon: <Eye className="w-5 h-5" />, color: "var(--tf-yellow)",
                title: "GitHub Repo Scanner",
                desc: "Point TestForge at any GitHub repo. It scans the tree for OpenAPI/Swagger specs, detects their type, and lets you pick which one to analyze.",
                badge: "Sprint 5",
              },
              {
                icon: <Layers className="w-5 h-5" />, color: "var(--tf-red)",
                title: "Industry Proof Packs",
                desc: "FinTech (PSD2/KYC), HealthTech (HIPAA/FHIR), eCommerce (PCI-DSS), SaaS (multi-tenancy). Pre-configured proof type sets with compliance frameworks.",
                badge: "Sprint 5",
              },
            ].map(f => (
              <div key={f.title} className="bg-card border border-border rounded-lg p-5 relative">
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full border"
                    style={{ color: f.color, borderColor: `${f.color}40`, background: `${f.color}10` }}>
                    {f.badge}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ color: f.color, background: `${f.color}15` }}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vibecoding Section ──────────────────────────────────────── */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border mb-4"
                  style={{ color: "var(--tf-purple)", borderColor: "var(--tf-purple)40", background: "var(--tf-purple)10" }}>
                  <Sparkles className="w-3.5 h-3.5" /> New: Code-Scan Mode
                </div>
                <h2 className="text-3xl font-black mb-4">
                  Built with AI?<br />
                  <span style={{ color: "var(--tf-purple)" }}>Verify it with TestForge.</span>
                </h2>
                <p className="text-muted-foreground mb-6">
                  Vibecoded your backend in an afternoon? TestForge scans your tRPC routers,
                  Drizzle schemas, and auth middleware — and generates security tests in under 10 seconds.
                  No spec required.
                </p>
                <ul className="space-y-2 mb-6">
                  {[
                    "Detects IDOR vectors in tRPC procedures",
                    "Finds missing auth middleware automatically",
                    "Generates auth matrix tests from role patterns",
                    "100% deterministic — no LLM, no hallucinations",
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--tf-purple)" }} />
                      {item}
                    </li>
                  ))}
                </ul>
                {isAuthenticated ? (
                  <Link href="/analysis/new?mode=code">
                    <Button className="gap-2" style={{ background: "var(--tf-purple)", color: "#fff" }}>
                      <Code2 className="w-4 h-4" /> Scan My Code
                    </Button>
                  </Link>
                ) : (
                  <a href={getLoginUrl()}>
                    <Button className="gap-2" style={{ background: "var(--tf-purple)", color: "#fff" }}>
                      <Code2 className="w-4 h-4" /> Try Code Scan Free
                    </Button>
                  </a>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  <span className="text-xs font-mono text-muted-foreground ml-2">testforge code-scan</span>
                </div>
                <div className="p-4 font-mono text-xs space-y-1.5">
                  {[
                    { t: "$", v: "testforge scan ./my-trpc-app", c: "text-muted-foreground" },
                    { t: "✓", v: "Detected: tRPC + Drizzle ORM", c: "text-[var(--tf-green)]" },
                    { t: "✓", v: "Found 12 procedures, 8 tables", c: "text-[var(--tf-green)]" },
                    { t: "⚠", v: "IDOR risk: getOrder — no tenantId check", c: "text-[var(--tf-orange)]" },
                    { t: "⚠", v: "Missing auth: updateProfile (publicProcedure)", c: "text-[var(--tf-orange)]" },
                    { t: "✓", v: "Generating 47 security tests...", c: "text-[var(--tf-blue)]" },
                    { t: "✓", v: "ZIP ready: testforge-output.zip (47 tests)", c: "text-[var(--tf-green)]" },
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`shrink-0 ${line.c}`}>{line.t}</span>
                      <span className={line.c}>{line.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl font-black mb-4">Ready to forge your tests?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Upload your first spec and get a proof-grade test suite in minutes.
            Free plan includes 3 analyses per month.
          </p>
          <div className="flex items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link href="/analysis/new">
                <Button size="lg" className="gap-2">
                  <FileCode2 className="w-4 h-4" /> Start Your First Analysis
                </Button>
              </Link>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button size="lg" className="gap-2">
                    <Shield className="w-4 h-4" /> Sign In to Get Started
                  </Button>
                </a>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="gap-2">
                    View Pricing
                  </Button>
                </Link>
              </>
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
          <div className="flex items-center gap-4">
            <Link href="/pricing"><span className="hover:text-foreground transition-colors cursor-pointer">Pricing</span></Link>
            <span>Built with Manus</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
