import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Shield,
  Upload,
  FileText,
  Github,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "text/markdown",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function NewAnalysis() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [projectName, setProjectName] = useState("");
  const [specText, setSpecText] = useState("");       // local preview only
  const [specKey, setSpecKey] = useState("");          // S3 key after upload
  const [specFileName, setSpecFileName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [inputMode, setInputMode] = useState<"paste" | "github">("paste");
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const createMutation = trpc.analyses.create.useMutation({
    onSuccess: (data) => {
      toast.success("Analysis started! Redirecting to results...");
      navigate(`/analysis/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start analysis");
    },
  });

  const [fileLoading, setFileLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File too large. Maximum 5MB.");
      return;
    }

    // All files go through the server endpoint (handles PDF extraction + S3 storage)
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
      setSpecText(data.text);      // for local preview
      setSpecKey(data.specKey);    // S3 key for submission
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

    // If we have a specKey already (from file upload), use it directly
    if (specKey) {
      createMutation.mutate({
        projectName: projectName.trim(),
        specKey,
        specFileName: specFileName || undefined,
        githubUrl: githubUrl.trim() || undefined,
      });
      return;
    }

    // Pasted text: upload to S3 first, then submit
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
      createMutation.mutate({
        projectName: projectName.trim(),
        specKey: data.specKey,
        specFileName: specFileName || undefined,
        githubUrl: githubUrl.trim() || undefined,
      });
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setFileLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Sign in to start an analysis</p>
          <a href={getLoginUrl()}>
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 h-14 flex items-center">
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

      <div className="container py-10 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Start New Analysis</h1>
          <p className="text-muted-foreground text-sm">
            Upload your specification document. TestForge will extract behaviors, build a risk model,
            and generate proof-grade tests automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              placeholder="e.g. hey-listen, booking-service, payment-api"
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
              <Button
                type="button"
                variant={inputMode === "paste" ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setInputMode("paste")}
              >
                <FileText className="w-3.5 h-3.5" />
                Upload / Paste
              </Button>
              <Button
                type="button"
                variant={inputMode === "github" ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setInputMode("github")}
              >
                <Github className="w-3.5 h-3.5" />
                GitHub URL
              </Button>
            </div>

            {inputMode === "paste" && (
              <div className="space-y-3">
                {/* File drop zone */}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drop your spec here or <span className="text-primary">click to browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Markdown, Word, TXT — max 10MB · LLM analyzes up to 120k chars</p>
                  {fileLoading && (
                    <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting text...</span>
                    </div>
                  )}
                  {specFileName && !fileLoading && (
                    <div className="flex items-center justify-center gap-1.5 mt-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-[var(--tf-green)]" />
                      <span className="font-mono text-foreground">{specFileName}</span>
                      {specText && <span className="text-muted-foreground">({specText.length.toLocaleString()} chars)</span>}
                    </div>
                  )}
                  {fileError && (
                    <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {fileError}
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.md,.txt,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Or paste directly */}
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
                    <p className="text-xs text-muted-foreground">
                      {specText.length.toLocaleString()} characters
                    </p>
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
                  Direct link to a raw Markdown or text file in a public GitHub repository.
                  For private repos, paste the content directly above.
                </p>
                {githubUrl && (
                  <div className="space-y-1.5">
                    <Label htmlFor="specTextGh" className="text-xs text-muted-foreground">
                      Paste the spec content here (required even with GitHub URL)
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

          {/* What happens next */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What happens next</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {[
                "Schicht 1: LLM extracts behaviors",
                "Schicht 2: Risk model built",
                "Schicht 3: Tests generated",
                "Schicht 4: False-greens rejected",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </div>
                  {step}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">Typical analysis: 1–3 minutes depending on spec size.</p>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            size="lg"
            disabled={createMutation.isPending || fileLoading || !projectName.trim() || (!specKey && specText.trim().length < 100)}
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting Analysis...</>
            ) : (
              <><Shield className="w-4 h-4" /> Start Analysis</>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
