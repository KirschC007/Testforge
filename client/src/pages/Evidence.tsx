import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  FileWarning,
  Lock,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicFooter from "@/components/PublicFooter";

const scoreboard = [
  ["Focused regressions", "68 tests"],
  ["Bug Zoo", "14/14"],
  ["Bug Kill", "7/7"],
  ["False positives", "10/10"],
  ["External repos", "12/12"],
  ["Output execution", "2/2"],
];

const cases = [
  {
    title: "Tenant leak in tRPC SaaS",
    risk: "Critical",
    icon: <Lock className="w-5 h-5" />,
    broken: "Reads by id without checking tenant ownership.",
    proof: "IDOR and auth-matrix tests replay resource ids across two tenant sessions.",
    value: "Catches customer-data leaks before launch.",
  },
  {
    title: "Mass assignment to admin",
    risk: "Critical",
    icon: <Shield className="w-5 h-5" />,
    broken: "Profile update accepts role, plan or isAdmin from the body.",
    proof: "Protected-field mutation tests assert role and plan cannot change.",
    value: "Finds AI-generated CRUD shortcuts that become privilege escalation.",
  },
  {
    title: "Negative amount payment",
    risk: "High",
    icon: <AlertTriangle className="w-5 h-5" />,
    broken: "Endpoint validates type but not business-domain constraints.",
    proof: "Negative-amount and boundary tests use concrete monetary payloads.",
    value: "Protects revenue logic from silent loss bugs.",
  },
  {
    title: "Unsigned webhook",
    risk: "High",
    icon: <Zap className="w-5 h-5" />,
    broken: "Webhook trusts payload without HMAC verification.",
    proof: "Spoofed webhook tests expect rejection without a valid signature.",
    value: "Stops fake provider events from changing state.",
  },
  {
    title: "No login lockout",
    risk: "Medium",
    icon: <FileWarning className="w-5 h-5" />,
    broken: "Correct password hashing, but unlimited failed attempts.",
    proof: "Rate-limit tests expect 429 after repeated bad logins.",
    value: "Turns auth hygiene into a visible release gate.",
  },
];

const proofTypes = [
  "IDOR",
  "Auth Matrix",
  "Mass Assignment",
  "Negative Amount",
  "Rate Limit",
  "Webhook",
  "SQL Injection",
  "CSRF",
  "Boundary",
  "Business Logic",
  "Status Transition",
  "Concurrency",
  "Idempotency",
  "DSGVO",
  "Spec Drift",
  "Feature Gate",
];

export default function Evidence() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 font-bold text-sm tracking-tight cursor-pointer">
              <Shield className="w-5 h-5 text-primary" />
              TestForge
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/demo"><span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Demo</span></Link>
            <Link href="/pricing"><span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Pricing</span></Link>
            <Link href="/analysis/new"><Button size="sm">Run Analysis</Button></Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-border/50">
        <div
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, var(--tf-blue)20, transparent 32%), radial-gradient(circle at 80% 0%, var(--tf-orange)18, transparent 30%), linear-gradient(var(--tf-grid) 1px, transparent 1px), linear-gradient(90deg, var(--tf-grid) 1px, transparent 1px)",
            backgroundSize: "auto, auto, 42px 42px, 42px 42px",
          }}
        />
        <div className="container relative py-20 md:py-28">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              Not a test generator. A launch-risk engine.
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-5">
              The proof wall for vibe-coded SaaS.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mb-8">
              TestForge is built for the bugs AI-generated apps usually miss: tenant leaks,
              privilege escalation, broken payments, unsigned webhooks, weak auth and business logic gaps.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/analysis/new">
                <Button size="lg" className="gap-2">
                  Run the first proof <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="gap-2">
                  See broken-app demo <Code2 className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/50 py-12">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {scoreboard.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="font-mono text-xl font-black text-primary">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/50 py-16">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black mb-2">Launch-killer bugs it is designed to expose</h2>
              <p className="text-muted-foreground max-w-2xl">
                The wow is not that tests are generated. The wow is that each generated test has a job:
                kill a concrete mutation that would otherwise ship.
              </p>
            </div>
            <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              Evidence API: <span className="font-mono text-foreground">product.evidence</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {cases.map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-card/70 p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--tf-red)]">{item.risk}</span>
                </div>
                <h3 className="font-bold mb-3">{item.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  <span className="text-foreground">Broken pattern:</span> {item.broken}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  <span className="text-foreground">Proof:</span> {item.proof}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">Buyer value:</span> {item.value}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/50 py-16">
        <div className="container grid lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
          <div>
            <h2 className="text-3xl font-black mb-3">Why this feels different</h2>
            <p className="text-muted-foreground mb-6">
              Generic AI test tools write plausible assertions. TestForge runs a risk model first,
              then generates proofs against known failure modes and blocks false-green output.
            </p>
            <div className="space-y-3">
              {[
                "Deterministic code-scan path for tRPC, Express and Next.js route handlers.",
                "False-green guard rejects always-pass assertions and unresolved placeholders.",
                "Bug-zoo, false-positive, external-repo and output-execution gates run before release.",
                "Server upload keys are tenant-scoped and user-bound.",
                "Production startup fails closed on placeholder secrets and unsafe URLs.",
              ].map((claim) => (
                <div key={claim} className="flex gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-[var(--tf-green)] shrink-0" />
                  <span>{claim}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/70 p-5">
            <div className="flex items-center gap-2 mb-5">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Proof coverage map</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {proofTypes.map((proof) => (
                <span
                  key={proof}
                  className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground"
                >
                  {proof}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center">
            <h2 className="text-3xl font-black mb-3">The first analysis should feel like a receipt.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Upload code or a spec, get concrete tests, concrete bug classes and a report you can show a cofounder,
              investor, customer or engineering lead.
            </p>
            <Link href="/analysis/new">
              <Button size="lg" className="gap-2">
                Generate my proof <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
