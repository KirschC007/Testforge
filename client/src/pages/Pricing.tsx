import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Shield, CheckCircle2, ArrowLeft, Zap, Users, Building2, Star,
  Lock, Activity, RefreshCw, Database, Package, Layers, ChevronRight,
  Globe, GitBranch,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    color: "var(--tf-blue)",
    icon: <Shield className="w-5 h-5" />,
    description: "For individual developers evaluating TestForge.",
    features: [
      "3 analyses / day",
      "All 16 proof types",
      "ZIP download",
      "OpenAPI / Swagger support",
      "tRPC + Express + Next.js code scan",
      "Community support",
    ],
    cta: "Start Free",
    ctaHref: "/new",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    period: "/ month",
    color: "var(--tf-orange)",
    icon: <Zap className="w-5 h-5" />,
    description: "For solo engineers and small teams shipping fast.",
    features: [
      "50 analyses / day",
      "All 16 proof types",
      "Smart Parser (3-pass, 4 parallel LLM calls)",
      "5 browser flow types (A–E) + helpers/browser.ts",
      "Spec Diff tracking",
      "GitHub PR — Branch + Commit + PR via API",
      "Priority email support",
    ],
    cta: "Start Pro",
    ctaHref: "/new",
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: 199,
    period: "/ month",
    color: "var(--tf-purple)",
    icon: <Users className="w-5 h-5" />,
    description: "For engineering teams with multiple services.",
    features: [
      "200 analyses / day",
      "All Pro features",
      "Feedback-Loop (test results → re-analysis)",
      "Repo-Scan (multi-file)",
      "Industry Proof Packs (FinTech, HealthTech, eCommerce)",
      "Slack / webhook notifications",
      "Dedicated Slack channel",
    ],
    cta: "Start Team",
    ctaHref: "/new",
    highlight: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    period: "custom",
    color: "var(--tf-green)",
    icon: <Building2 className="w-5 h-5" />,
    description: "For large organizations with compliance requirements.",
    features: [
      "Unlimited analyses",
      "All Team features",
      "Self-hosted Docker deployment",
      "SOC 2 / ISO 27001 compliance reports",
      "Custom Proof Packs",
      "SLA + dedicated CSM",
      "On-premise or VPC deployment",
    ],
    cta: "Contact Sales",
    ctaHref: "mailto:sales@testforge.dev",
    highlight: false,
  },
];

const PROOF_TYPES = [
  { icon: <Lock className="w-3.5 h-3.5" />,        label: "IDOR",           color: "var(--tf-red)" },
  { icon: <Shield className="w-3.5 h-3.5" />,       label: "CSRF",           color: "var(--tf-orange)" },
  { icon: <Activity className="w-3.5 h-3.5" />,     label: "SQL Injection",  color: "var(--tf-red)" },
  { icon: <Layers className="w-3.5 h-3.5" />,       label: "Business Logic", color: "var(--tf-blue)" },
  { icon: <RefreshCw className="w-3.5 h-3.5" />,    label: "Status Machine", color: "var(--tf-purple)" },
  { icon: <Database className="w-3.5 h-3.5" />,     label: "DSGVO/GDPR",    color: "var(--tf-yellow)" },
  { icon: <Activity className="w-3.5 h-3.5" />,     label: "Boundary",       color: "var(--tf-yellow)" },
  { icon: <Zap className="w-3.5 h-3.5" />,          label: "Rate Limit",     color: "var(--tf-orange)" },
  { icon: <Layers className="w-3.5 h-3.5" />,       label: "Concurrency",    color: "var(--tf-red)" },
  { icon: <RefreshCw className="w-3.5 h-3.5" />,    label: "Idempotency",    color: "var(--tf-blue)" },
  { icon: <Shield className="w-3.5 h-3.5" />,       label: "Auth Matrix",    color: "var(--tf-purple)" },
  { icon: <ChevronRight className="w-3.5 h-3.5" />, label: "Flow",           color: "var(--tf-blue)" },
  { icon: <Star className="w-3.5 h-3.5" />,         label: "Cron Job",       color: "var(--tf-green)" },
  { icon: <Package className="w-3.5 h-3.5" />,      label: "Webhook",        color: "var(--tf-orange)" },
  { icon: <Database className="w-3.5 h-3.5" />,     label: "Feature Gate",   color: "var(--tf-purple)" },
  { icon: <Activity className="w-3.5 h-3.5" />,     label: "Spec Drift",     color: "var(--tf-green)" },
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Pricing</span>
          </div>
          <div className="ml-auto">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm">Sign In</Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="container py-16 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary mb-4">
            <Zap className="w-3 h-3" /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold mb-3">
            From spec to proof-grade tests
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            All plans include all 16 proof types, ZIP download, and OpenAPI + code-scan support.
            Upgrade for higher volume, browser flow tests, GitHub PR integration, and team collaboration.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card rounded-xl border overflow-hidden flex flex-col ${
                plan.highlight
                  ? "border-[var(--tf-orange)]/50 shadow-lg shadow-[var(--tf-orange)]/10"
                  : "border-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--tf-orange)] to-transparent" />
              )}
              {plan.highlight && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--tf-orange)20", color: "var(--tf-orange)", border: "1px solid var(--tf-orange)40" }}>
                    MOST POPULAR
                  </span>
                </div>
              )}
              <div className="p-5 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: plan.color }}>{plan.icon}</span>
                  <span className="font-bold text-sm" style={{ color: plan.color }}>{plan.name}</span>
                </div>
                <div className="mb-3">
                  {plan.price === null ? (
                    <div className="text-2xl font-bold">Custom</div>
                  ) : plan.price === 0 ? (
                    <div className="text-2xl font-bold">Free</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">${plan.price}</span>
                      <span className="text-xs text-muted-foreground">{plan.period}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                <div className="space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                      <span className="text-xs">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 pt-0">
                {plan.ctaHref.startsWith("mailto") ? (
                  <a href={plan.ctaHref} className="block">
                    <Button variant="outline" className="w-full" size="sm"
                      style={{ borderColor: `${plan.color}50`, color: plan.color }}>
                      {plan.cta}
                    </Button>
                  </a>
                ) : (
                  <Link href={plan.ctaHref}>
                    <Button className="w-full" size="sm"
                      style={plan.highlight ? { background: plan.color, color: "#fff" } : undefined}
                      variant={plan.highlight ? "default" : "outline"}>
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* All 16 Proof Types */}
        <div className="bg-card border border-border rounded-xl p-8 mb-12">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-2">All 16 Proof Types — Included in Every Plan</h2>
            <p className="text-sm text-muted-foreground">
              No proof type is gated behind a paywall. Every plan generates the full spectrum of security, business logic, and compliance tests.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {PROOF_TYPES.map((pt) => (
              <div key={pt.label} className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-muted/30 text-center">
                <span style={{ color: pt.color }}>{pt.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{pt.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What's in the ZIP */}
        <div className="bg-card border border-border rounded-xl p-8 mb-12">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-2">What's in the ZIP</h2>
            <p className="text-sm text-muted-foreground">
              Every analysis produces a ready-to-run test suite. No manual setup required.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: <Layers className="w-4 h-4" />,    color: "var(--tf-blue)",   label: "tests/unit/",                       desc: "Vitest unit tests" },
              { icon: <Database className="w-4 h-4" />,  color: "var(--tf-purple)", label: "tests/integration/",                desc: "Vitest integration tests" },
              { icon: <Globe className="w-4 h-4" />,     color: "var(--tf-green)",  label: "tests/e2e/",                        desc: "Playwright browser flows (5 types A–E)" },
              { icon: <Shield className="w-4 h-4" />,    color: "var(--tf-red)",    label: "tests/security/",                   desc: "Playwright IDOR, CSRF, Rate-Limit" },
              { icon: <Activity className="w-4 h-4" />,  color: "var(--tf-orange)", label: "tests/performance/",                desc: "k6 load + spike tests" },
              { icon: <Package className="w-4 h-4" />,   color: "var(--tf-yellow)", label: "helpers/browser.ts",                desc: "loginViaUI + loginAsRole" },
              { icon: <RefreshCw className="w-4 h-4" />, color: "var(--tf-blue)",   label: "playwright.config.ts",              desc: "2 projects: api-security + browser-e2e" },
              { icon: <GitBranch className="w-4 h-4" />, color: "var(--tf-purple)", label: ".github/workflows/testforge.yml",   desc: "CI/CD pipeline with 2 jobs" },
              { icon: <Zap className="w-4 h-4" />,       color: "var(--tf-green)",  label: "validate-payloads.mjs",             desc: "Payload schema validation" },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ color: item.color, background: `${item.color}18` }}>
                  {item.icon}
                </div>
                <div>
                  <div className="text-xs font-mono font-semibold">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "What counts as one analysis?",
                a: "One analysis = one spec file or codebase processed through the full 5-layer pipeline. The daily limit resets at UTC midnight.",
              },
              {
                q: "Can I use OpenAPI / Swagger specs?",
                a: "Yes. TestForge has a deterministic OpenAPI 3.x / Swagger 2.x parser that skips the LLM entirely, making it faster and cheaper. All plans support this.",
              },
              {
                q: "What is the Smart Parser?",
                a: "For specs larger than 50KB, TestForge uses a 3-pass architecture. Pass 1 runs 4 parallel LLM calls simultaneously — one for endpoints, one for status machines, one for auth model, one for chapters and PII tables. This reduces hallucinations and improves recall compared to a single monolith call.",
              },
              {
                q: "What are the 5 browser flow types?",
                a: "Type A: Auth login/logout. Type B: CRUD flows (create → verify → edit → delete). Type C: Status machine button clicks. Type D: DSGVO export and delete. Type E: User flows from your spec's ## User Flows section, or derived from endpoints if no section exists.",
              },
              {
                q: "How does GitHub PR integration work?",
                a: "createPR() creates a new branch in your repo, commits all generated test files, and opens a pull request via the GitHub API. You provide a GitHub token; TestForge handles the branch, commit, and PR creation.",
              },
              {
                q: "What code frameworks does code-scan support?",
                a: "tRPC (procedures + Drizzle schemas), Express (resource.action route names, Zod/Joi field extraction, auth middleware detection), and Next.js App Router (route.ts files). NestJS support is planned for a future release.",
              },
              {
                q: "Is self-hosted available?",
                a: "Yes, on the Enterprise plan. TestForge ships as a Docker Compose stack that runs entirely on your infrastructure. No data leaves your VPC.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-border rounded-lg p-4">
                <div className="font-medium text-sm mb-1.5">{q}</div>
                <div className="text-sm text-muted-foreground">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
