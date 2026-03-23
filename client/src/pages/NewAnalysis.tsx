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
  Code2, Cpu, Zap, Search,
} from "lucide-react";
import { Link } from "wouter";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CODE_ZIP_SIZE = 50 * 1024 * 1024; // 50MB

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
    n: 1, label: "Parse",              color: "var(--tf-blue)",
    icon: <FileText className="w-3.5 h-3.5" />,
    desc: "Spec: LLM extracts behaviors · Code: deterministic static analysis",
  },
  {
    n: 2, label: "Risk Model",         color: "var(--tf-orange)",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    desc: "Tenant isolation vectors, CSRF surfaces, boundary constraints",
  },
  {
    n: 3, label: "Test Generation",    color: "var(--tf-purple)",
    icon: <Layers className="w-3.5 h-3.5" />,
    desc: "16 proof types generated in parallel — typed payloads, Zod schemas",
  },
  {
    n: 4, label: "LLM Verification",   color: "var(--tf-yellow)",
    icon: <Eye className="w-3.5 h-3.5" />,
    desc: "Independent checker validates each test against the original source",
  },
  {
    n: 5, label: "False-Green Guard",  color: "var(--tf-green)",
    icon: <Shield className="w-3.5 h-3.5" />,
    desc: "8 mutation rules discard tests that can't catch real regressions",
  },
];

const PROOF_ICONS = [
  { id: "idor",              label: "IDOR",         icon: <Lock className="w-3.5 h-3.5" />,          color: "var(--tf-red)" },
  { id: "csrf",              label: "CSRF",         icon: <Shield className="w-3.5 h-3.5" />,        color: "var(--tf-orange)" },
  { id: "boundary",         label: "Boundary",     icon: <Activity className="w-3.5 h-3.5" />,      color: "var(--tf-yellow)" },
  { id: "business_logic",   label: "Business",     icon: <Layers className="w-3.5 h-3.5" />,        color: "var(--tf-blue)" },
  { id: "status_transition",label: "Status",       icon: <RefreshCw className="w-3.5 h-3.5" />,     color: "var(--tf-purple)" },
  { id: "spec_drift",       label: "Spec Drift",   icon: <Eye className="w-3.5 h-3.5" />,           color: "var(--tf-green)" },
  { id: "dsgvo",            label: "DSGVO/GDPR",   icon: <Database className="w-3.5 h-3.5" />,      color: "var(--tf-yellow)" },
  { id: "rate_limit",       label: "Rate Limit",   icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "var(--tf-orange)" },
  { id: "concurrency",      label: "Concurrency",  icon: <Layers className="w-3.5 h-3.5" />,        color: "var(--tf-red)" },
  { id: "idempotency",      label: "Idempotency",  icon: <RefreshCw className="w-3.5 h-3.5" />,     color: "var(--tf-blue)" },
  { id: "auth_matrix",      label: "Auth Matrix",  icon: <Shield className="w-3.5 h-3.5" />,        color: "var(--tf-purple)" },
  { id: "flow",             label: "Flow",          icon: <ChevronRight className="w-3.5 h-3.5" />,  color: "var(--tf-blue)" },
  { id: "cron_job",         label: "Cron Job",      icon: <Star className="w-3.5 h-3.5" />,          color: "var(--tf-green)" },
  { id: "webhook",          label: "Webhook",       icon: <Package className="w-3.5 h-3.5" />,       color: "var(--tf-orange)" },
  { id: "risk_scoring",     label: "Risk Score",    icon: <AlertCircle className="w-3.5 h-3.5" />,   color: "var(--tf-red)" },
  { id: "feature_gate",     label: "Feature Gate",  icon: <Cpu className="w-3.5 h-3.5" />,           color: "var(--tf-purple)" },
];

type InputMode = "spec" | "code";
type SpecTab = "paste" | "github";
type CodeTab = "github" | "zip";

export default function NewAnalysis() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  // ── Mode selection ────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode | null>(null);

  // ── Spec path state ───────────────────────────────────────────────────────
  const [specTab, setSpecTab] = useState<SpecTab>("paste");
  const [projectName, setProjectName] = useState("");
  const [specText, setSpecText] = useState("");
  const [specKey, setSpecKey] = useState("");
  const [specFileName, setSpecFileName] = useState("");
  const [specGithubUrl, setSpecGithubUrl] = useState("");
  const [industryPack, setIndustryPack] = useState<"" | "fintech" | "healthtech" | "ecommerce" | "saas">("");
  const [fileError, setFileError] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Code path state ───────────────────────────────────────────────────────
  const [codeTab, setCodeTab] = useState<CodeTab>("github");
  const [codeGithubUrl, setCodeGithubUrl] = useState("");
  const [codeFiles, setCodeFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [detectedFramework, setDetectedFramework] = useState("");
  const [codeZipFileName, setCodeZipFileName] = useState("");
  const [codeZipLoading, setCodeZipLoading] = useState(false);
  const [codeZipError, setCodeZipError] = useState("");
  const codeZipRef = useRef<HTMLInputElement>(null);

  // ── tRPC mutations ────────────────────────────────────────────────────────
  const createMutation = trpc.analyses.create.useMutation({
    onSuccess: (data) => { toast.success("Analysis started!"); navigate(`/analysis/${data.id}`); },
    onError: (err) => { toast.error(err.message || "Failed to start analysis"); },
  });

  const createFromCodeMutation = trpc.analyses.createFromCode.useMutation({
    onSuccess: (data) => {
      toast.success(`Analysis started! Detected: ${data.framework} · ${data.endpointCount} endpoints · ${data.tableCount} tables`);
      navigate(`/analysis/${data.id}`);
    },
    onError: (err) => { toast.error(err.message || "Failed to start code scan"); },
  });

  // Auto-fill demo spec if ?demo=1
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("demo") === "1") {
      setInputMode("spec");
      setProjectName("ShopCore Demo");
      setSpecText(DEMO_SPEC);
    }
    if (params.get("mode") === "code") {
      setInputMode("code");
    }
  }, [search]);

  // ── Spec handlers ─────────────────────────────────────────────────────────
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

  const handleSpecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) { toast.error("Project name is required"); return; }
    if (!specText.trim() || specText.length < 100) { toast.error("Spec content is too short (minimum 100 characters)"); return; }
    if (specKey) {
      createMutation.mutate({ projectName: projectName.trim(), specKey, specFileName: specFileName || undefined, githubUrl: specGithubUrl.trim() || undefined, industryPack: industryPack || undefined });
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
      createMutation.mutate({ projectName: projectName.trim(), specKey: data.specKey, specFileName: specFileName || undefined, githubUrl: specGithubUrl.trim() || undefined, industryPack: industryPack || undefined });
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setFileLoading(false);
    }
  };

  // ── Code handlers ─────────────────────────────────────────────────────────
  const handleCodeZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCodeZipError("");
    if (file.size > MAX_CODE_ZIP_SIZE) { setCodeZipError("ZIP too large. Maximum 50MB."); return; }
    if (!file.name.endsWith(".zip")) { setCodeZipError("Only ZIP files are supported."); return; }
    setCodeZipLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload-code", { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        setCodeZipError(err.error || "Could not extract code from ZIP");
        return;
      }
      const data = await resp.json();
      setCodeFiles(data.files);
      setDetectedFramework(data.framework);
      setCodeZipFileName(file.name);
      toast.success(`Extracted ${data.fileCount} files · Framework: ${data.framework}`);
    } catch (err: any) {
      setCodeZipError("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setCodeZipLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) { toast.error("Project name is required"); return; }
    if (codeTab === "github") {
      if (!codeGithubUrl.trim()) { toast.error("GitHub URL is required"); return; }
      createFromCodeMutation.mutate({
        projectName: projectName.trim(),
        githubUrl: codeGithubUrl.trim(),
        industryPack: industryPack || undefined,
      });
    } else {
      if (codeFiles.length === 0) { toast.error("Please upload a ZIP file first"); return; }
      createFromCodeMutation.mutate({
        projectName: projectName.trim(),
        codeFiles,
        industryPack: industryPack || undefined,
      });
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

  const specCanSubmit = !createMutation.isPending && !fileLoading && !!projectName.trim() && (!!specKey || specText.trim().length >= 100);
  const codeCanSubmit = !createFromCodeMutation.isPending && !!projectName.trim() && (
    (codeTab === "github" && !!codeGithubUrl.trim()) ||
    (codeTab === "zip" && codeFiles.length > 0)
  );

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
        <div className="max-w-5xl mx-auto">

          {/* ── Mode Selection ─────────────────────────────────────────── */}
          {!inputMode && (
            <div>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold mb-2">Start New Analysis</h1>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                  Choose your input type. Both paths produce the same ZIP output with 16 proof types.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                {/* Spec Card */}
                <button
                  type="button"
                  onClick={() => setInputMode("spec")}
                  className="group text-left border border-border rounded-xl p-6 hover:border-primary/60 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--tf-blue)]/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[var(--tf-blue)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">I have a Spec</h2>
                      <p className="text-xs text-muted-foreground">OpenAPI, Markdown, PDF, Word, paste text</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <p className="text-xs text-muted-foreground font-medium">Best for:</p>
                    <ul className="space-y-1">
                      {["Documented APIs", "Enterprise compliance", "OpenAPI / Swagger specs"].map(t => (
                        <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-[var(--tf-green)] shrink-0" /> {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Zap className="w-3 h-3 text-[var(--tf-green)]" />
                      <span className="text-[var(--tf-green)] font-medium">OpenAPI: &lt;30s, no LLM</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      <span>Markdown / PDF: 1–3 min</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary group-hover:gap-2.5 transition-all">
                    Select this <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Code Card */}
                <button
                  type="button"
                  onClick={() => setInputMode("code")}
                  className="group text-left border border-border rounded-xl p-6 hover:border-[var(--tf-purple)]/60 hover:bg-[var(--tf-purple)]/5 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--tf-purple)]/10 flex items-center justify-center">
                      <Code2 className="w-5 h-5 text-[var(--tf-purple)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">I have Code</h2>
                      <p className="text-xs text-muted-foreground">GitHub URL or upload project ZIP</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <p className="text-xs text-muted-foreground font-medium">Best for:</p>
                    <ul className="space-y-1">
                      {["Vibecoded projects", "Quick security check", '"Is my AI code safe?"'].map(t => (
                        <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-[var(--tf-purple)] shrink-0" /> {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Zap className="w-3 h-3 text-[var(--tf-purple)]" />
                      <span className="text-[var(--tf-purple)] font-medium">Code scan: &lt;10s, no LLM</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Search className="w-3 h-3" />
                      <span>100% deterministic · tRPC, Drizzle, Express</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--tf-purple)] group-hover:gap-2.5 transition-all">
                    Select this <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Spec Form ──────────────────────────────────────────────── */}
          {inputMode === "spec" && (
            <div className="grid lg:grid-cols-[1fr_380px] gap-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <button type="button" onClick={() => setInputMode(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold">Spec-based Analysis</h1>
                    <p className="text-xs text-muted-foreground">Upload or paste your API specification</p>
                  </div>
                </div>

                <form onSubmit={handleSpecSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input id="projectName" placeholder="e.g. shopcore, booking-service, payment-api"
                      value={projectName} onChange={(e) => setProjectName(e.target.value)} className="font-mono" />
                  </div>

                  <div className="space-y-3">
                    <Label>Specification Document</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={specTab === "paste" ? "default" : "outline"} size="sm"
                        className="gap-1.5" onClick={() => setSpecTab("paste")}>
                        <FileText className="w-3.5 h-3.5" /> Upload / Paste
                      </Button>
                      <Button type="button" variant={specTab === "github" ? "default" : "outline"} size="sm"
                        className="gap-1.5" onClick={() => setSpecTab("github")}>
                        <Github className="w-3.5 h-3.5" /> GitHub URL
                      </Button>
                    </div>

                    {specTab === "paste" && (
                      <div className="space-y-3">
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                            specFileName ? "border-[var(--tf-green)]/50 bg-[var(--tf-green)]/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => fileRef.current?.click()}
                        >
                          {fileLoading ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" /><span>Extracting text...</span>
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
                              <p className="text-sm text-muted-foreground">Drop your spec here or <span className="text-primary">click to browse</span></p>
                              <p className="text-xs text-muted-foreground mt-1">PDF, Markdown, Word, TXT, JSON, YAML — max 10MB</p>
                              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
                                style={{ color: "var(--tf-green)", borderColor: "var(--tf-green)40", background: "var(--tf-green)10" }}>
                                <span>⚡</span> OpenAPI 3.x / Swagger 2.x — deterministic, no LLM
                              </div>
                            </>
                          )}
                          {fileError && (
                            <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-destructive">
                              <AlertCircle className="w-4 h-4" /> {fileError}
                            </div>
                          )}
                        </div>
                        <input ref={fileRef} type="file" accept=".pdf,.md,.txt,.doc,.docx,.json,.yaml,.yml" className="hidden" onChange={handleFileChange} />
                        <div className="space-y-1.5">
                          <Label htmlFor="specText" className="text-xs text-muted-foreground">Or paste spec content directly</Label>
                          <Textarea id="specText" placeholder="Paste your specification text here..."
                            value={specText} onChange={(e) => setSpecText(e.target.value)}
                            className="font-mono text-xs min-h-40 resize-y" />
                          {specText && <p className="text-xs text-muted-foreground">{specText.length.toLocaleString()} characters</p>}
                        </div>
                      </div>
                    )}

                    {specTab === "github" && (
                      <div className="space-y-3">
                        <Input placeholder="https://github.com/org/repo/blob/main/SPEC.md"
                          value={specGithubUrl} onChange={(e) => setSpecGithubUrl(e.target.value)} className="font-mono text-sm" />
                        <p className="text-xs text-muted-foreground">Direct link to a Markdown or text file in a public GitHub repository.</p>
                        {specGithubUrl && (
                          <div className="space-y-1.5">
                            <Label htmlFor="specTextGh" className="text-xs text-muted-foreground">Paste the spec content here (required)</Label>
                            <Textarea id="specTextGh" placeholder="Paste your specification text here..."
                              value={specText} onChange={(e) => setSpecText(e.target.value)}
                              className="font-mono text-xs min-h-40 resize-y" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Industry Pack */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> Industry Pack <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: "", label: "None", icon: "—", desc: "Generic" },
                        { id: "fintech", label: "FinTech", icon: "💳", desc: "PSD2, KYC/AML" },
                        { id: "healthtech", label: "HealthTech", icon: "🏥", desc: "HIPAA, FHIR" },
                        { id: "ecommerce", label: "eCommerce", icon: "🛒", desc: "PCI-DSS" },
                        { id: "saas", label: "SaaS", icon: "☁️", desc: "Multi-tenant" },
                      ].map(pack => (
                        <button key={pack.id} type="button" onClick={() => setIndustryPack(pack.id as any)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-all ${
                            industryPack === pack.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                          }`}>
                          <span className="text-lg leading-none">{pack.icon}</span>
                          <span className="text-xs font-semibold">{pack.label}</span>
                          <span className="text-[10px] leading-tight opacity-70">{pack.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" size="lg" disabled={!specCanSubmit}>
                    {createMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Starting Analysis...</>
                    ) : (
                      <><Shield className="w-4 h-4" /> Start Analysis <ChevronRight className="w-4 h-4" /></>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Typical: 1–3 min (LLM) · &lt;30s (OpenAPI/Swagger) · PDF, MD, DOCX, JSON, YAML
                  </p>
                </form>
              </div>
              <PipelinePanel />
            </div>
          )}

          {/* ── Code Form ──────────────────────────────────────────────── */}
          {inputMode === "code" && (
            <div className="grid lg:grid-cols-[1fr_380px] gap-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <button type="button" onClick={() => setInputMode(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold">Code-Scan Analysis</h1>
                    <p className="text-xs text-muted-foreground">Paste your GitHub URL or upload a project ZIP</p>
                  </div>
                  <div className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
                    style={{ color: "var(--tf-purple)", borderColor: "var(--tf-purple)40", background: "var(--tf-purple)10" }}>
                    <Zap className="w-3 h-3" /> &lt;10s · No LLM · 100% deterministic
                  </div>
                </div>

                <form onSubmit={handleCodeSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="codeProjectName">Project Name</Label>
                    <Input id="codeProjectName" placeholder="e.g. my-trpc-app, vibecoded-saas"
                      value={projectName} onChange={(e) => setProjectName(e.target.value)} className="font-mono" />
                  </div>

                  <div className="space-y-3">
                    <Label>Code Source</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={codeTab === "github" ? "default" : "outline"} size="sm"
                        className="gap-1.5" onClick={() => setCodeTab("github")}>
                        <Github className="w-3.5 h-3.5" /> GitHub URL
                      </Button>
                      <Button type="button" variant={codeTab === "zip" ? "default" : "outline"} size="sm"
                        className="gap-1.5" onClick={() => setCodeTab("zip")}>
                        <Upload className="w-3.5 h-3.5" /> Upload ZIP
                      </Button>
                    </div>

                    {codeTab === "github" && (
                      <div className="space-y-3">
                        <Input placeholder="https://github.com/owner/repo"
                          value={codeGithubUrl} onChange={(e) => setCodeGithubUrl(e.target.value)} className="font-mono text-sm" />
                        <p className="text-xs text-muted-foreground">
                          TestForge scans your tRPC routers, Drizzle schemas, and auth middleware.
                          Works with public repositories. Max 100 files, 5MB total.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {["tRPC", "Drizzle ORM", "Prisma", "Express", "Next.js", "Zod"].map(fw => (
                            <span key={fw} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{fw}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {codeTab === "zip" && (
                      <div className="space-y-3">
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                            codeZipFileName ? "border-[var(--tf-purple)]/50 bg-[var(--tf-purple)]/5" : "border-border hover:border-[var(--tf-purple)]/50"
                          }`}
                          onClick={() => codeZipRef.current?.click()}
                        >
                          {codeZipLoading ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" /><span>Extracting code files...</span>
                            </div>
                          ) : codeZipFileName ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-[var(--tf-purple)]" />
                                <span className="font-mono text-foreground">{codeZipFileName}</span>
                                <span className="text-muted-foreground">({codeFiles.length} files)</span>
                              </div>
                              {detectedFramework && (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
                                  style={{ color: "var(--tf-purple)", borderColor: "var(--tf-purple)40", background: "var(--tf-purple)10" }}>
                                  <Cpu className="w-3 h-3" /> Detected: {detectedFramework}
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Drop your project ZIP here or <span className="text-[var(--tf-purple)]">click to browse</span></p>
                              <p className="text-xs text-muted-foreground mt-1">ZIP archive of your project — max 50MB</p>
                              <p className="text-xs text-muted-foreground mt-1">node_modules, dist, build are automatically excluded</p>
                            </>
                          )}
                          {codeZipError && (
                            <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-destructive">
                              <AlertCircle className="w-4 h-4" /> {codeZipError}
                            </div>
                          )}
                        </div>
                        <input ref={codeZipRef} type="file" accept=".zip" className="hidden" onChange={handleCodeZipChange} />
                      </div>
                    )}
                  </div>

                  {/* Industry Pack */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> Industry Pack <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: "", label: "None", icon: "—", desc: "Generic" },
                        { id: "fintech", label: "FinTech", icon: "💳", desc: "PSD2, KYC/AML" },
                        { id: "healthtech", label: "HealthTech", icon: "🏥", desc: "HIPAA, FHIR" },
                        { id: "ecommerce", label: "eCommerce", icon: "🛒", desc: "PCI-DSS" },
                        { id: "saas", label: "SaaS", icon: "☁️", desc: "Multi-tenant" },
                      ].map(pack => (
                        <button key={pack.id} type="button" onClick={() => setIndustryPack(pack.id as any)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-all ${
                            industryPack === pack.id ? "border-[var(--tf-purple)] bg-[var(--tf-purple)]/10 text-[var(--tf-purple)]" : "border-border hover:border-[var(--tf-purple)]/50 text-muted-foreground hover:text-foreground"
                          }`}>
                          <span className="text-lg leading-none">{pack.icon}</span>
                          <span className="text-xs font-semibold">{pack.label}</span>
                          <span className="text-[10px] leading-tight opacity-70">{pack.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" size="lg" disabled={!codeCanSubmit}
                    style={{ background: codeCanSubmit ? "var(--tf-purple)" : undefined }}>
                    {createFromCodeMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Scanning Code...</>
                    ) : (
                      <><Code2 className="w-4 h-4" /> Start Code Scan <ChevronRight className="w-4 h-4" /></>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Typical: &lt;10s (static analysis) · tRPC, Drizzle, Prisma, Express, Next.js
                  </p>
                </form>
              </div>
              <PipelinePanel codeMode />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Panel (right column) ───────────────────────────────────────────
function PipelinePanel({ codeMode = false }: { codeMode?: boolean }) {
  return (
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">16 Proof Types Generated</p>
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

      {/* Code-specific info */}
      {codeMode && (
        <div className="bg-card border border-[var(--tf-purple)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-3.5 h-3.5 text-[var(--tf-purple)]" />
            <span className="text-xs font-semibold">What gets detected</span>
          </div>
          <ul className="space-y-1">
            {[
              "tRPC procedures → endpoints + input schemas",
              "Drizzle / Prisma tables → data models + PII",
              "Tenant keys (workspaceId, bankId, orgId)",
              "Zod constraints → boundary tests",
              "Auth middleware → auth matrix tests",
              "Status enums → state machine tests",
            ].map(item => (
              <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-[var(--tf-purple)]/60 shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ZIP Output */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ZIP Output</p>
        </div>
        <div className="p-3 space-y-1">
          {[
            "tests/security/    — IDOR, CSRF, Rate-Limit",
            "tests/e2e/         — Playwright: user flows",
            "tests/unit/        — Vitest: validation",
            "helpers/           — api, auth, factories",
            ".github/workflows/testforge.yml",
            "README.md + playwright.config.ts",
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
    </div>
  );
}
