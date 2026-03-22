import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Shield, Upload, FileText, Github, ArrowLeft, Loader2,
  CheckCircle2, AlertCircle, Package, Star, Lock, Activity,
  Layers, Eye, Database, RefreshCw, AlertTriangle, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DEMO_SPEC = `# ShopCore API Specification

## Overview
ShopCore is a multi-tenant e-commerce API. Each shop is isolated by shopId.

## Endpoints

### POST /api/trpc/products.create
Input: shopId (number, tenant key), name (string, 1-100 chars), price (number, 0.01-999999.99), stock (number, 0-10000), sku (string, 3-50 chars), priority (enum: low|medium|high|critical)
Output: id, shopId, name, price, stock, sku, priority, createdAt

### POST /api/trpc/orders.create
Input: shopId (number, tenant key), customerId (number), items (array of {productId: number, quantity: number (1-100)}, max 50 items)
Output: id, shopId, status, total, createdAt
Behavior: When order is created, stock is decremented by quantity ordered. If stock < quantity, return 400.

### GET /api/trpc/orders.getById
Input: shopId (number), orderId (number)
Output: id, shopId, status, items, total, createdAt
Behavior: Returns 403 if order belongs to a different shopId.

### POST /api/trpc/orders.updateStatus
Input: shopId (number), orderId (number), status (enum: pending|processing|shipped|delivered|cancelled)
Output: id, status, updatedAt
Status transitions: pending→processing, processing→shipped, shipped→delivered. No skipping, no reverse. cancelled is terminal.

### DELETE /api/trpc/customers.anonymize
Input: shopId (number), customerId (number)
Behavior: Permanently anonymizes customer PII (name, email, phone). GDPR compliance required.

### GET /api/trpc/shop.exportData
Input: shopId (number)
Output: Full shop data export including customer PII
Behavior: GDPR data export. Must only return data for the requesting shopId.

## Security
- All endpoints require authentication via Bearer token
- shopId is the tenant isolation key — cross-tenant access must return 403
- Rate limiting: max 10 failed auth attempts per minute per IP

## Invariants
- Stock can never go below 0
- Order total = sum(price * quantity) for all items
- Cancelled orders cannot be updated
`;

// ─── Layer definitions ────────────────────────────────────────────────────
const LAYERS = [
  {
    n: 1, label: "Spec Parse",        color: "var(--tf-blue)",
    icon: <FileText className="w-3.5 h-3.5" />,
    desc: "LLM extracts behaviors, endpoints, status machines, invariants, tenant keys",
    output: "Structured IR (behaviors, endpoints, status machines)",
  },
  {
    n: 2, label: "Risk Model",        color: "var(--tf-orange)",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    desc: "Tenant isolation vectors, CSRF surfaces, boundary constraints, side effects",
    output: "Risk-ranked ProofTargets with priority scores",
  },
  {
    n: 3, label: "Test Generation",   color: "var(--tf-purple)",
    icon: <Layers className="w-3.5 h-3.5" />,
    desc: "8 proof types generated in parallel — typed payloads, Zod schemas, CI/CD config",
    output: "TypeScript Playwright tests + helpers + schemas",
  },
  {
    n: 4, label: "LLM Verification",  color: "var(--tf-yellow)",
    icon: <Eye className="w-3.5 h-3.5" />,
    desc: "Independent LLM checker validates each test against the original spec",
    output: "Verification scores per test (0.0–1.0)",
  },
  {
    n: 5, label: "False-Green Guard", color: "var(--tf-green)",
    icon: <Shield className="w-3.5 h-3.5" />,
    desc: "8 mutation rules discard tests that can't catch real regressions",
    output: "Validated test suite + mutation scores + ZIP",
  },
];

// ─── Proof type icons ─────────────────────────────────────────────────────
const PROOF_ICONS = [
  { id: "idor",              label: "IDOR",        icon: <Lock className="w-3.5 h-3.5" />,         color: "var(--tf-red)" },
  { id: "csrf",              label: "CSRF",        icon: <Shield className="w-3.5 h-3.5" />,       color: "var(--tf-orange)" },
  { id: "boundary",          label: "Boundary",    icon: <Activity className="w-3.5 h-3.5" />,     color: "var(--tf-yellow)" },
  { id: "business_logic",    label: "Business",    icon: <Layers className="w-3.5 h-3.5" />,       color: "var(--tf-blue)" },
  { id: "status_transition", label: "Status",      icon: <RefreshCw className="w-3.5 h-3.5" />,    color: "var(--tf-purple)" },
  { id: "spec_drift",        label: "Spec Drift",  icon: <Eye className="w-3.5 h-3.5" />,          color: "var(--tf-green)" },
  { id: "dsgvo",             label: "DSGVO",       icon: <Database className="w-3.5 h-3.5" />,     color: "var(--tf-yellow)" },
  { id: "rate_limit",        label: "Rate Limit",  icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "var(--tf-orange)" },
];

export default function NewAnalysis() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const [projectName, setProjectName] = useState("");
  const [specText, setSpecText] = useState("");
  const [specKey, setSpecKey] = useState("");
  const [specFileName, setSpecFileName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [inputMode, setInputMode] = useState<"paste" | "github">("paste");
  const [fileError, setFileError] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-fill demo spec if ?demo=1
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("demo") === "1") {
      setProjectName("ShopCore Demo");
      setSpecText(DEMO_SPEC);
    }
  }, [search]);

  const createMutation = trpc.analyses.create.useMutation({
    onSuccess: (data) => {
      toast.success("Analysis started!");
      navigate(`/analysis/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start analysis");
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (file.size > MAX_FILE_SIZE) { setFileError("File too large. Maximum 10MB."); return; }

    setFileLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload-spec", { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        setFileError(err.error || "Could not extract text from file");
        return;
      }
      const data = await resp.json();
      setSpecFileName(file.name);
      setSpecText(data.text);
      setSpecKey(data.specKey);
      toast.success(`Extracted ${data.chars.toLocaleString()} characters from ${file.name}`);
    } catch (err: any) {
      setFileError("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setFileLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) { toast.error("Project name is required"); return; }
    if (!specText.trim() || specText.length < 100) { toast.error("Spec content is too short (minimum 100 characters)"); return; }

    if (specKey) {
      createMutation.mutate({ projectName: projectName.trim(), specKey, specFileName: specFileName || undefined, githubUrl: githubUrl.trim() || undefined });
      return;
    }

    setFileLoading(true);
    try {
      const resp = await fetch("/api/upload-spec-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: specText.trim(), filename: specFileName || "spec.txt" }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        toast.error(err.error || "Failed to upload spec");
        return;
      }
      const data = await resp.json();
      createMutation.mutate({ projectName: projectName.trim(), specKey: data.specKey, specFileName: specFileName || undefined, githubUrl: githubUrl.trim() || undefined });
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setFileLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Sign in to start an analysis</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  const canSubmit = !createMutation.isPending && !fileLoading && !!projectName.trim() && (!!specKey || specText.trim().length >= 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">New Analysis</span>
          </div>
        </div>
      </nav>

      <div className="container py-10">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 max-w-5xl mx-auto">
          {/* ── Left: Form ──────────────────────────────────────────── */}
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1.5">Start New Analysis</h1>
              <p className="text-muted-foreground text-sm">
                Upload your API specification. TestForge extracts behaviors, builds a risk model,
                and generates a proof-grade Playwright test suite automatically.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  placeholder="e.g. shopcore, booking-service, payment-api"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Spec Input */}
              <div className="space-y-3">
                <Label>Specification Document</Label>

                {/* Mode toggle */}
                <div className="flex gap-2">
                  <Button type="button" variant={inputMode === "paste" ? "default" : "outline"} size="sm"
                    className="gap-1.5" onClick={() => setInputMode("paste")}>
                    <FileText className="w-3.5 h-3.5" /> Upload / Paste
                  </Button>
                  <Button type="button" variant={inputMode === "github" ? "default" : "outline"} size="sm"
                    className="gap-1.5" onClick={() => setInputMode("github")}>
                    <Github className="w-3.5 h-3.5" /> GitHub URL
                  </Button>
                </div>

                {inputMode === "paste" && (
                  <div className="space-y-3">
                    {/* Drop zone */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        specFileName ? "border-[var(--tf-green)]/50 bg-[var(--tf-green)]/5" : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => fileRef.current?.click()}
                    >
                      {fileLoading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Extracting text...</span>
                        </div>
                      ) : specFileName ? (
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-[var(--tf-green)]" />
                          <span className="font-mono text-foreground">{specFileName}</span>
                          {specText && <span className="text-muted-foreground">({specText.length.toLocaleString()} chars)</span>}
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Drop your spec here or <span className="text-primary">click to browse</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, Markdown, Word, TXT — max 10MB</p>
                        </>
                      )}
                      {fileError && (
                        <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-destructive">
                          <AlertCircle className="w-4 h-4" /> {fileError}
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf,.md,.txt,.doc,.docx" className="hidden" onChange={handleFileChange} />

                    {/* Paste area */}
                    <div className="space-y-1.5">
                      <Label htmlFor="specText" className="text-xs text-muted-foreground">
                        Or paste spec content directly
                      </Label>
                      <Textarea
                        id="specText"
                        placeholder="Paste your specification text here..."
                        value={specText}
                        onChange={(e) => setSpecText(e.target.value)}
                        className="font-mono text-xs min-h-40 resize-y"
                      />
                      {specText && (
                        <p className="text-xs text-muted-foreground">{specText.length.toLocaleString()} characters</p>
                      )}
                    </div>
                  </div>
                )}

                {inputMode === "github" && (
                  <div className="space-y-3">
                    <Input
                      placeholder="https://github.com/org/repo/blob/main/SPEC.md"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Direct link to a Markdown or text file in a public GitHub repository.
                    </p>
                    {githubUrl && (
                      <div className="space-y-1.5">
                        <Label htmlFor="specTextGh" className="text-xs text-muted-foreground">
                          Paste the spec content here (required)
                        </Label>
                        <Textarea
                          id="specTextGh"
                          placeholder="Paste your specification text here..."
                          value={specText}
                          onChange={(e) => setSpecText(e.target.value)}
                          className="font-mono text-xs min-h-40 resize-y"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2" size="lg" disabled={!canSubmit}>
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting Analysis...</>
                ) : (
                  <><Shield className="w-4 h-4" /> Start Analysis <ChevronRight className="w-4 h-4" /></>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Typical analysis time: 1–3 minutes · Supported: PDF, Markdown, Word, plain text
              </p>
            </form>
          </div>

          {/* ── Right: Pipeline + Output ─────────────────────────────── */}
          <div className="space-y-5">
            {/* 5-Layer Pipeline */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">5-Layer Pipeline</p>
              </div>
              <div className="p-4 space-y-0">
                {LAYERS.map((layer, i) => (
                  <div key={layer.n} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold"
                        style={{ borderColor: layer.color, color: layer.color, background: `${layer.color}12` }}>
                        {layer.n}
                      </div>
                      {i < LAYERS.length - 1 && (
                        <div className="w-px h-5 mt-0.5" style={{ background: `${layer.color}30` }} />
                      )}
                    </div>
                    <div className={`pb-4 ${i === LAYERS.length - 1 ? "pb-0" : ""}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span style={{ color: layer.color }}>{layer.icon}</span>
                        <span className="text-xs font-semibold" style={{ color: layer.color }}>{layer.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{layer.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proof Types */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">8 Proof Types Generated</p>
              </div>
              <div className="p-3 grid grid-cols-2 gap-1.5">
                {PROOF_ICONS.map(pt => (
                  <div key={pt.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/30">
                    <span style={{ color: pt.color }}>{pt.icon}</span>
                    <span className="text-xs font-medium">{pt.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ZIP Output */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ZIP Output</p>
              </div>
              <div className="p-3 space-y-1">
                {[
                  "tests/security/   — IDOR, CSRF, Rate-Limit, Spec-Drift",
                  "tests/business/   — Business Logic, Boundary",
                  "tests/compliance/ — DSGVO/GDPR",
                  "helpers/          — api, auth, factories, schemas",
                  ".github/workflows/testforge.yml",
                  "playwright.config.ts + tsconfig.json",
                  "README.md + .env.example",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                    <span className="text-xs font-mono text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border bg-muted/20">
                <p className="text-xs font-mono text-[var(--tf-green)]">$ npm install &amp;&amp; npm test</p>
              </div>
            </div>

            {/* Spec Health tip */}
            <div className="bg-card border border-[var(--tf-yellow)]/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3.5 h-3.5 text-[var(--tf-yellow)]" />
                <span className="text-xs font-semibold">Spec Health Score</span>
              </div>
              <p className="text-xs text-muted-foreground">
                After Layer 1, your spec is evaluated across 6 dimensions (typed fields, enums, boundaries, auth, tenant, response shape).
                Higher scores produce more precise tests with fewer TODO_ placeholders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
