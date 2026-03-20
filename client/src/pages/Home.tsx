import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  Shield,
  Zap,
  FileSearch,
  GitBranch,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lock,
  Database,
  Code2,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">TestForge</span>
            <Badge variant="secondary" className="text-xs font-mono">BETA</Badge>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Link href="/analysis/new">
                  <Button size="sm">New Analysis</Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm">Sign In</Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(oklch(0.25 0.01 240 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(0.25 0.01 240 / 0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="container relative py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-[var(--tf-green)] animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Quality Compiler for SaaS</span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              From Spec to{" "}
              <span className="text-primary">Proof-Grade</span>
              <br />Test Suite in Minutes
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Upload your specification. TestForge extracts every testable behavior, builds a risk model,
              generates TypeScript/Playwright tests with hard assertions, and validates them against
              7 False-Green rules — automatically.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <Link href="/analysis/new">
                  <Button size="lg" className="gap-2">
                    Start Analysis <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="gap-2">
                    Get Started Free <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              )}
              <Button variant="outline" size="lg" className="gap-2 font-mono text-sm">
                <Code2 className="w-4 h-4" />
                View Example Report
              </Button>
            </div>

            <div className="flex flex-wrap gap-6 mt-10 text-sm text-muted-foreground">
              {["PDF / Markdown / Word", "TypeScript + Playwright", "IDOR · CSRF · DSGVO", "False-Green Detection"].map(f => (
                <div key={f} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--tf-green)]" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="border-b border-border/50 py-20">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-4">The Problem with Existing Tests</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Most test suites look comprehensive but prove nothing. They pass when the system is broken.
                They fail when the system is fine. They give false confidence before every release.
              </p>
              <div className="space-y-3">
                {[
                  { bad: true, text: 'expect([200, 400, 403]).toContain(status) — always green' },
                  { bad: true, text: 'if (data?.id) { expect(data.id).toBeTruthy() } — soft assertion' },
                  { bad: true, text: 'IDOR test with hardcoded restaurantId: 999 — fake test' },
                  { bad: false, text: 'expect([401, 403]).toContain(status) + DB side-effect check' },
                  { bad: false, text: 'expect(guest.noShowRisk).toBeGreaterThan(0) after precondition' },
                  { bad: false, text: 'Positive control: verify legitimate access still works' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    {item.bad
                      ? <XCircle className="w-4 h-4 text-[var(--tf-red)] mt-0.5 shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 text-[var(--tf-green)] mt-0.5 shrink-0" />
                    }
                    <code className={`text-xs font-mono ${item.bad ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.text}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "629", label: "False-Green patterns in a typical 800-test suite", color: "var(--tf-red)" },
                { value: "0%", label: "Unit test coverage in most SaaS E2E test suites", color: "var(--tf-orange)" },
                { value: "7", label: "Validation rules that catch always-green tests", color: "var(--tf-blue)" },
                { value: "10x", label: "More proof-value per test after TestForge", color: "var(--tf-green)" },
              ].map((stat, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-5">
                  <div className="text-3xl font-bold font-mono mb-1" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border/50 py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-3">Four Layers. One Command.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              TestForge runs your specification through a four-layer quality compiler.
              Each layer builds on the previous one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                layer: "Schicht 1",
                icon: FileSearch,
                title: "Spec Understanding",
                desc: "LLM extracts behaviors, invariants, contradictions, and ambiguities from any format (PDF, Markdown, Word).",
                color: "var(--tf-blue)",
              },
              {
                layer: "Schicht 2",
                icon: Database,
                title: "Risk Model",
                desc: "Every behavior scored Critical/High/Medium/Low. IDOR vectors, CSRF endpoints, and proof targets identified.",
                color: "var(--tf-orange)",
              },
              {
                layer: "Schicht 3",
                icon: Code2,
                title: "Proof Generation",
                desc: "TypeScript/Playwright tests with hard assertions, DB side-effect checks, and positive controls generated.",
                color: "var(--tf-purple)",
              },
              {
                layer: "Schicht 4",
                icon: Shield,
                title: "False-Green Detection",
                desc: "7 validation rules reject tests that would pass even if the feature is broken. Mutation score calculated.",
                color: "var(--tf-green)",
              },
            ].map((step, i) => (
              <div key={i} className="relative bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: `${step.color}20` }}>
                    <step.icon className="w-4 h-4" style={{ color: step.color }} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{step.layer}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                {i < 3 && (
                  <ChevronRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-border hidden lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Output */}
      <section className="border-b border-border/50 py-20">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl font-bold mb-4">What You Get</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                A ZIP file with ready-to-run Playwright tests and a full analysis report.
                Drop the tests into your project and run them immediately.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Lock, title: "Security Tests", desc: "IDOR, CSRF, rate-limit — with side-effect checks and positive controls", color: "var(--tf-red)" },
                  { icon: Shield, title: "DSGVO / Compliance", desc: "Anonymization, consent withdrawal, PII absence verification", color: "var(--tf-blue)" },
                  { icon: GitBranch, title: "Business Logic", desc: "Status transitions, booking limits, risk scoring — spec-derived", color: "var(--tf-orange)" },
                  { icon: Zap, title: "Ambiguity Report", desc: "Every unclear requirement flagged before tests are written", color: "var(--tf-yellow)" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center" style={{ background: `${item.color}20` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock report preview */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[var(--tf-red)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--tf-yellow)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--tf-green)]" />
                </div>
                <span className="text-xs font-mono text-muted-foreground ml-2">testforge-report.md</span>
              </div>
              <div className="p-4 font-mono text-xs space-y-2 text-muted-foreground">
                <div className="text-foreground font-bold"># TestForge Report — hey-listen</div>
                <div className="text-muted-foreground">Generated: 2026-03-20 | Score: 8.4/10.0</div>
                <div className="mt-3 text-foreground font-semibold">## Verdict</div>
                <div><span className="text-[var(--tf-green)]">✓</span> 12/14 proofs passed validation</div>
                <div className="grid grid-cols-2 gap-x-4 mt-2">
                  <div>Behaviors: <span className="text-foreground">47</span></div>
                  <div>Coverage: <span className="text-[var(--tf-green)]">89%</span></div>
                  <div>IDOR Vectors: <span className="text-[var(--tf-orange)]">6</span></div>
                  <div>CSRF Endpoints: <span className="text-[var(--tf-orange)]">3</span></div>
                </div>
                <div className="mt-3 text-foreground font-semibold">## Risk Distribution</div>
                <div><span className="text-[var(--tf-red)]">🔴 Critical: 8</span></div>
                <div><span className="text-[var(--tf-orange)]">🟠 High: 12</span></div>
                <div><span className="text-[var(--tf-yellow)]">🟡 Medium: 19</span></div>
                <div><span className="text-[var(--tf-green)]">🟢 Low: 8</span></div>
                <div className="mt-3 text-foreground font-semibold">## Discarded (False-Green)</div>
                <div><span className="text-[var(--tf-red)]">✗</span> PROOF-B003-CSRF: broad_status_code</div>
                <div><span className="text-[var(--tf-red)]">✗</span> PROOF-B007-IDOR: no_positive_control</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to prove your system works?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Upload your spec and get a complete test suite in under 3 minutes.
          </p>
          {isAuthenticated ? (
            <Link href="/analysis/new">
              <Button size="lg" className="gap-2">
                Start Your First Analysis <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="lg" className="gap-2">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span>TestForge — Quality Compiler for SaaS</span>
          </div>
          <span className="font-mono">v1.0.0-beta</span>
        </div>
      </footer>
    </div>
  );
}
