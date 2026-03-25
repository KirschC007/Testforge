import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Zap, Shield, Code2, GitBranch, Settings, ChevronRight,
  Terminal, FileText, Layers, CheckCircle2, AlertTriangle, Info
} from "lucide-react";

const sections = [
  { id: "overview", label: "Überblick", icon: BookOpen },
  { id: "quickstart", label: "Quickstart", icon: Zap },
  { id: "spec-format", label: "Spec-Format", icon: FileText },
  { id: "pipeline", label: "Pipeline (5 Schichten)", icon: Layers },
  { id: "hybrid", label: "Hybrid-Modus", icon: Code2 },
  { id: "security", label: "Security-Tests", icon: Shield },
  { id: "github", label: "GitHub-Integration", icon: GitBranch },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed border border-zinc-800">
      {children}
    </pre>
  );
}

function Note({ type = "info", children }: { type?: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-950/40 border-blue-800 text-blue-200",
    warning: "bg-amber-950/40 border-amber-800 text-amber-200",
    success: "bg-emerald-950/40 border-emerald-800 text-emerald-200",
  };
  const icons = { info: Info, warning: AlertTriangle, success: CheckCircle2 };
  const Icon = icons[type];
  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${styles[type]} my-4`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <Separator className="bg-zinc-800" />
      <div className="space-y-4 text-zinc-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState("overview");

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm">← Zurück</Link>
          <Separator orientation="vertical" className="h-5 bg-zinc-700" />
          <h1 className="font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-400" />
            TestForge Dokumentation
          </h1>
          <Badge variant="outline" className="ml-auto border-violet-700 text-violet-300 text-xs">v8.0</Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar Navigation */}
        <aside className="w-56 shrink-0 sticky top-24 self-start hidden lg:block">
          <nav className="space-y-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeSection === id
                    ? "bg-violet-900/50 text-violet-300 font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-16 min-w-0">

          {/* Overview */}
          <Section id="overview" title="Überblick">
            <p>
              TestForge ist ein KI-gestützter Test-Generator, der aus einer natürlichsprachlichen
              API-Spezifikation vollständige Playwright-Testsuites erzeugt — inklusive Security-Tests
              (IDOR, CSRF, Brute-Force), DSGVO-Compliance-Tests, State-Machine-Validierung und
              Boundary-Tests.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[
                { title: "5-Schichten-Pipeline", desc: "Parser → IR → Sanitizer → Proof-Generator → Checker", icon: Layers },
                { title: "Hybrid-Modus", desc: "Spec + Quellcode kombiniert für maximale Abdeckung", icon: Code2 },
                { title: "Gold Standard Tests", desc: "R1–R7 Regeln garantieren Qualität und Mutation-Killing", icon: Shield },
              ].map(({ title, desc, icon: Icon }) => (
                <Card key={title} className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                      <Icon className="w-4 h-4 text-violet-400" />
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-400">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <h3 className="text-lg font-semibold text-white mt-6">Was wird generiert?</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "Integration Tests (tRPC/REST)",
                "IDOR-Vektoren",
                "Auth-Matrix",
                "Status-Transitions",
                "Boundary Tests",
                "DSGVO-Compliance",
                "CSRF-Tests",
                "Concurrency Tests",
                "Idempotency Tests",
                "E2E Browser-Flows",
                "GitHub Actions CI",
                "HTML-Dashboard",
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </Section>

          {/* Quickstart */}
          <Section id="quickstart" title="Quickstart">
            <h3 className="text-lg font-semibold text-white">1. Spec schreiben</h3>
            <p>Schreibe eine Markdown-Datei die dein API beschreibt. TestForge versteht Deutsch und Englisch.</p>
            <CodeBlock>{`# MeinProjekt API

## Authentifizierung
POST /api/auth/login — Benutzer-Login
- E-Mail und Passwort erforderlich
- Gibt JWT-Token zurück
- Nach 5 Fehlversuchen: 15 Minuten Sperre (RATE_LIMIT_EXCEEDED)

## Aufgaben (Tasks)
Jede Aufgabe gehört zu einem Workspace (workspaceId = Tenant-Key).
Ein Benutzer darf nur Aufgaben seines eigenen Workspace sehen (403 sonst).

POST /api/tasks — Aufgabe erstellen (auth: user)
- title: string, 1–100 Zeichen
- priority: enum low|medium|high
- workspaceId: number (Tenant-Key)

Status-Übergänge: todo → in_progress → done
Verboten: todo → done (direkt)`}</CodeBlock>

            <h3 className="text-lg font-semibold text-white mt-6">2. Analyse starten</h3>
            <p>Gehe zu <Link href="/dashboard" className="text-violet-400 hover:underline">Dashboard</Link> → "Neue Analyse" → Spec einfügen → Analysieren.</p>

            <h3 className="text-lg font-semibold text-white mt-6">3. Tests herunterladen</h3>
            <p>Nach Abschluss der Analyse kannst du alle generierten Test-Dateien als ZIP herunterladen oder direkt als GitHub PR erstellen.</p>

            <Note type="success">
              TestForge erkennt automatisch ob deine Spec klein (&lt;8KB, Standard-Parser) oder groß (&gt;8KB, Smart-Parser mit 4-parallelen Extraktions-Calls) ist.
            </Note>
          </Section>

          {/* Spec Format */}
          <Section id="spec-format" title="Spec-Format">
            <p>TestForge akzeptiert jedes Markdown-Format. Es gibt keine strikte Syntax — der LLM-Parser extrahiert Behaviors aus natürlicher Sprache. Folgende Elemente werden erkannt:</p>

            <div className="space-y-4">
              {[
                {
                  title: "API-Endpunkte",
                  desc: "HTTP-Methode + Pfad oder tRPC-Prozedur-Namen",
                  example: "POST /api/orders — Bestellung erstellen\ntrpc.orders.create — Bestellung erstellen",
                },
                {
                  title: "Tenant-Modell",
                  desc: "Wer besitzt welche Ressource? TestForge erkennt Ownership-Checks.",
                  example: "Jede Bestellung gehört zu einer Filiale (filialeId).\nBenutzer darf nur eigene Bestellungen sehen (403 sonst).",
                },
                {
                  title: "Status-Maschinen",
                  desc: "Erlaubte und verbotene Übergänge",
                  example: "Status: draft → submitted → approved → rejected\nVerboten: approved → draft",
                },
                {
                  title: "Rollen & Berechtigungen",
                  desc: "Wer darf was? Rollen werden automatisch erkannt.",
                  example: "Rollen: admin, manager, user\nNur admin darf DELETE /api/users aufrufen.",
                },
                {
                  title: "DSGVO / PII",
                  desc: "Personenbezogene Daten und Lösch-Anforderungen",
                  example: "Benutzerprofil enthält: name, email, geburtsdatum (PII).\nDELETE /api/users/:id/dsgvo — Alle PII-Felder anonymisieren.",
                },
                {
                  title: "Fehler-Codes",
                  desc: "Exakte Error-Codes werden in Tests verwendet",
                  example: "Fehler-Codes: SLOT_TAKEN, MAX_CAPACITY_EXCEEDED, INVALID_TRANSITION",
                },
              ].map(({ title, desc, example }) => (
                <div key={title} className="space-y-2">
                  <h4 className="font-medium text-white">{title}</h4>
                  <p className="text-sm text-zinc-400">{desc}</p>
                  <CodeBlock>{example}</CodeBlock>
                </div>
              ))}
            </div>

            <Note type="info">
              <strong>Spec-Größe:</strong> Unter 8KB → Standard-Parser (1 LLM-Call). Über 8KB → Smart-Parser (4 parallele Calls + Pass 2 Behavior-Extraktion). Über 50KB → Smart-Parser mit Komprimierung.
            </Note>
          </Section>

          {/* Pipeline */}
          <Section id="pipeline" title="Pipeline (5 Schichten)">
            <p>TestForge verarbeitet jede Spec in 5 aufeinanderfolgenden Schichten:</p>

            <div className="space-y-4">
              {[
                {
                  num: "1",
                  title: "LLM-Parser / Smart-Parser",
                  color: "bg-violet-900/50 border-violet-700",
                  badge: "violet",
                  desc: "Extrahiert Behaviors, Endpoints, Tenant-Modell, Status-Maschinen und Auth-Modell aus der Spec. Für große Specs: 4 parallele Calls (Endpoints, Status, Auth, DSGVO) + Pass 2 für Behaviors.",
                },
                {
                  num: "2",
                  title: "Sanitizer (deterministisch)",
                  color: "bg-blue-900/50 border-blue-700",
                  badge: "blue",
                  desc: "52+ deterministische Fixes: Endpoint-Namen normalisieren, Tenant-Keys setzen, Tags ergänzen, Duplikate entfernen, Widersprüche auflösen. Kein LLM-Aufruf.",
                },
                {
                  num: "3",
                  title: "Proof-Generator",
                  color: "bg-cyan-900/50 border-cyan-700",
                  badge: "cyan",
                  desc: "Generiert für jedes Behavior einen oder mehrere Playwright-Tests. Deterministische Templates für Standard-Fälle, LLM für komplexe Behaviors. Gold Standard Rules R1–R7.",
                },
                {
                  num: "4",
                  title: "Extended Suite Generator",
                  color: "bg-emerald-900/50 border-emerald-700",
                  badge: "emerald",
                  desc: "Erzeugt die erweiterte Test-Suite: IDOR-Vektoren, Auth-Matrix, Status-Transitions, Boundary-Tests, DSGVO, CSRF, Concurrency, Idempotency, E2E Browser-Flows.",
                },
                {
                  num: "5",
                  title: "LLM Checker (Independent)",
                  color: "bg-amber-900/50 border-amber-700",
                  badge: "amber",
                  desc: "Unabhängiger LLM-Checker verifiziert jeden extrahierten Behavior gegen den Spec-Text. INCORRECT/PARTIAL → Behavior wird verworfen oder repariert.",
                },
              ].map(({ num, title, color, desc }) => (
                <div key={num} className={`rounded-lg border p-4 ${color}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-white shrink-0">{num}</div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">{title}</h4>
                      <p className="text-sm text-zinc-300">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-semibold text-white mt-6">Gold Standard Rules (R1–R7)</h3>
            <p className="text-sm">Jeder generierte Test muss diese Regeln erfüllen, sonst wird er verworfen:</p>
            <div className="space-y-2 mt-3">
              {[
                ["R1", "NO if-wrappers", "Nie if (x !== undefined) { expect(x)... } — stattdessen expect(x).toBeDefined() + unconditional assertions"],
                ["R2", "NO existence-only", "Nie nur toBeDefined()/toBeTruthy() — immer exakte Werte assertieren"],
                ["R3", "NO broad status codes", "Nie toBeGreaterThanOrEqual(400) — stattdessen expect([401, 403]).toContain(status)"],
                ["R4", "Security side-effect check", "Security-Tests MÜSSEN DB-State nach dem Angriff verifizieren"],
                ["R5", "Positive control", "IDOR/Security-Tests MÜSSEN legitimen Zugriff als Baseline verifizieren"],
                ["R6", "Counter baseline", "Zähler-Tests MÜSSEN Baseline BEFORE der Aktion messen"],
                ["R7", "Mutation comments", "Jede Assertion MUSS // Kills: <mutation> Kommentar haben"],
              ].map(([id, title, desc]) => (
                <div key={id} className="flex gap-3 text-sm">
                  <Badge variant="outline" className="border-zinc-600 text-zinc-300 shrink-0 font-mono">{id}</Badge>
                  <div>
                    <span className="font-medium text-white">{title}</span>
                    <span className="text-zinc-400"> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Hybrid Mode */}
          <Section id="hybrid" title="Hybrid-Modus">
            <p>
              Im Hybrid-Modus kombiniert TestForge die Spec mit dem tatsächlichen Quellcode.
              Der Code-Parser extrahiert Implementierungsdetails (Middleware, Validierungen, Fehler-Codes)
              die in der Spec fehlen könnten.
            </p>

            <Note type="info">
              Der Hybrid-Modus ist besonders nützlich wenn der Code bereits existiert und die Spec
              unvollständig ist. TestForge erkennt Diskrepanzen zwischen Spec und Implementierung.
            </Note>

            <h3 className="text-lg font-semibold text-white">Verwendung</h3>
            <p className="text-sm">Beim Erstellen einer neuen Analyse kannst du optional Code-Dateien hochladen oder ein GitHub-Repository angeben. TestForge kombiniert dann beide Quellen.</p>

            <h3 className="text-lg font-semibold text-white mt-4">Was wird aus dem Code extrahiert?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Middleware-Ketten (Auth, Rate-Limiting, CSRF)",
                "Exakte Fehler-Codes aus throw-Statements",
                "Validierungs-Constraints (min/max, regex)",
                "Enum-Werte aus TypeScript-Typen",
                "Tenant-Key-Felder aus DB-Queries",
                "Idempotency-Patterns (unique constraints)",
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                  <ChevronRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </Section>

          {/* Security Tests */}
          <Section id="security" title="Security-Tests">
            <p>TestForge generiert automatisch Security-Tests basierend auf dem erkannten Tenant-Modell und den Rollen:</p>

            <div className="space-y-4">
              {[
                {
                  title: "IDOR (Insecure Direct Object Reference)",
                  desc: "Für jeden Endpoint mit Tenant-Key werden Cross-Tenant-Zugriffe getestet. Jede Rolle versucht auf Ressourcen anderer Tenants zuzugreifen.",
                  example: "// Kills: Missing ownership check on GET /api/orders/:id\nconst res = await trpcQuery('orders.getById', { id: otherTenantOrderId }, userCookie);\nexpect([403, 404]).toContain(res.status); // Kills: Returns 200 for cross-tenant",
                },
                {
                  title: "Auth-Matrix",
                  desc: "Jede Rolle × Jeder Endpoint wird getestet. Verbotene Kombinationen müssen 401/403 zurückgeben.",
                  example: "// Kills: Missing role check — user can access admin endpoint\nconst res = await trpcMutation('admin.deleteUser', payload, userCookie);\nexpect([401, 403]).toContain(res.status);",
                },
                {
                  title: "CSRF",
                  desc: "Wenn ein CSRF-Token-Endpoint erkannt wird, werden alle mutierende Endpoints ohne Token getestet.",
                  example: "// Kills: Missing CSRF validation on POST /api/orders\nconst res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });\nexpect([403, 422]).toContain(res.status);",
                },
              ].map(({ title, desc, example }) => (
                <div key={title} className="space-y-2">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    {title}
                  </h4>
                  <p className="text-sm text-zinc-400">{desc}</p>
                  <CodeBlock>{example}</CodeBlock>
                </div>
              ))}
            </div>
          </Section>

          {/* GitHub Integration */}
          <Section id="github" title="GitHub-Integration">
            <p>TestForge kann die generierten Tests direkt als Pull Request in dein Repository pushen.</p>

            <h3 className="text-lg font-semibold text-white">Voraussetzungen</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
                GitHub Personal Access Token mit <code className="bg-zinc-800 px-1 rounded">repo</code> Scope
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
                Repository muss existieren (wird nicht automatisch erstellt)
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mt-4">Was wird in den PR eingefügt?</h3>
            <CodeBlock>{`testforge/
├── helpers/
│   ├── api.ts          # tRPC/REST Helpers
│   ├── auth.ts         # Cookie-Funktionen pro Rolle
│   ├── factories.ts    # Test-Daten-Factories
│   ├── browser.ts      # Playwright Browser-Helpers
│   └── schemas.ts      # Zod-Validierungs-Schemas
├── tests/
│   ├── security/
│   │   ├── idor.spec.ts
│   │   ├── auth-matrix.spec.ts
│   │   └── csrf.spec.ts
│   ├── integration/
│   │   ├── status-transitions.spec.ts
│   │   ├── boundary.spec.ts
│   │   └── dsgvo.spec.ts
│   └── e2e/
│       └── *.spec.ts
├── playwright.config.ts
├── package.json
└── .github/workflows/testforge.yml`}</CodeBlock>

            <Note type="warning">
              Der GitHub-Token wird nicht gespeichert — er wird nur für den PR-Erstellungs-Request verwendet.
            </Note>
          </Section>

          {/* Settings */}
          <Section id="settings" title="Einstellungen">
            <p>
              Als Admin kannst du alle System-Prompts und Pipeline-Parameter über die
              <Link href="/settings" className="text-violet-400 hover:underline mx-1">Einstellungen-Seite</Link>
              anpassen — ohne Code-Änderungen.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: "Schicht 1 Prompt", desc: "Steuert wie Behaviors aus der Spec extrahiert werden" },
                { title: "Smart-Parser Prompts", desc: "Base-Prompt und Pass-2-Prompt für große Specs" },
                { title: "Schicht 3 Prompt", desc: "Gold Standard Rules für den Test-Generator" },
                { title: "LLM Checker Prompt", desc: "Verifikations-Logik für extrahierte Behaviors" },
                { title: "Max. Behaviors", desc: "Obergrenze für Behaviors pro Analyse" },
                { title: "Job-Timeout", desc: "Maximale Laufzeit eines Analyse-Jobs" },
              ].map(({ title, desc }) => (
                <div key={title} className="flex gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <Settings className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Note type="warning">
              Prompt-Änderungen wirken sich sofort auf neue Analyse-Jobs aus. Der In-Memory-Cache wird bei jeder Änderung invalidiert.
            </Note>

            <div className="flex gap-3 mt-4">
              <Button asChild className="bg-violet-600 hover:bg-violet-700">
                <Link href="/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Zu den Einstellungen
                </Link>
              </Button>
            </div>
          </Section>

        </main>
      </div>
    </div>
  );
}
