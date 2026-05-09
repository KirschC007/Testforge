import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import multer from "multer";
import { sdk } from "./sdk";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { getConfiguredAppUrl, getRequestAppUrl } from "./app-url";
import { getAnalysisById, getDb } from "../db";
import { sql } from "drizzle-orm";
import { securityHeaders } from "./security-headers";
import { ENV, assertProductionEnv } from "./env";
import { buildUserSpecKey } from "./storage-keys";
import { isLLMConfigured } from "./llm";
import { storageRead } from "../storage";
import {
  allowedHostGuard,
  fixedWindowRateLimit,
  requestId,
  requireHttpsInProduction,
} from "./runtime-security";
import {
  MAX_CODE_FILE_BYTES,
  MAX_CODE_FILES,
  MAX_CODE_TOTAL_BYTES,
  MAX_ZIP_ENTRIES,
  assertExtractedSpecSize,
  isAllowedSpecUpload,
  normalizeZipEntryPath,
  redactUploadedCode,
  safeUploadFilename,
  shouldIncludeCodePath,
} from "./upload-security";

const execFileAsync = promisify(execFile);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function uploadFailure(res: any, err: any, fallback: string) {
  const message = String(err?.message ?? "");
  if (/too large|max|unsupported|invalid|readable text|too many/i.test(message)) {
    return res.status(message.includes("too large") || message.includes("too many") ? 413 : 400).json({ error: message });
  }
  return res.status(500).json({ error: fallback });
}

async function requireApiUser(req: any, res: any) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user) return user;
  } catch {
    // Fall through to the uniform 401 response below.
  }
  res.status(401).json({ error: "Unauthorized" });
  return null;
}

async function extractTextFromFile(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  // Markdown / plain text — read directly
  if (mimetype === "text/markdown" || mimetype === "text/plain" || originalname.endsWith(".md") || originalname.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }
  // PDF — use pdftotext
  if (mimetype === "application/pdf" || originalname.endsWith(".pdf")) {
    const tmpRoot = await mkdtemp(join(tmpdir(), "tf-spec-"));
    const tmpIn = join(tmpRoot, "input.pdf");
    const tmpOut = join(tmpRoot, "output.txt");
    try {
      await writeFile(tmpIn, buffer);
      await execFileAsync("pdftotext", ["-layout", tmpIn, tmpOut]);
      const text = await readFile(tmpOut, "utf-8");
      assertExtractedSpecSize(text);
      return text;
    } finally {
      await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
  // Word documents — extract raw text (basic)
  if (originalname.endsWith(".docx") || originalname.endsWith(".doc")) {
    // For DOCX: extract as plain text using strings command (rough but functional)
    const tmpRoot = await mkdtemp(join(tmpdir(), "tf-spec-"));
    const tmpIn = join(tmpRoot, "input.docx");
    try {
      await writeFile(tmpIn, buffer);
      const { stdout } = await execFileAsync("strings", [tmpIn], { maxBuffer: 2 * 1024 * 1024 });
      const text = stdout
        .split(/\r?\n/)
        .filter((line) => /[a-zA-Z]/.test(line))
        .slice(0, 2000)
        .join("\n");
      assertExtractedSpecSize(text);
      return text;
    } finally {
      await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
  const text = buffer.toString("utf-8");
  assertExtractedSpecSize(text);
  return text;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertProductionEnv();
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY ?? (ENV.isProduction ? "loopback, linklocal, uniquelocal" : false));
  app.use(requestId());
  app.use(allowedHostGuard(ENV.appBaseUrl));
  app.use(requireHttpsInProduction(ENV.isProduction));
  app.use(securityHeaders());
  app.use("/api/", fixedWindowRateLimit({ windowMs: 60_000, max: 240, keyPrefix: "api" }));
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "testforge",
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || process.env.npm_package_version || "dev",
      appBaseUrl: getConfiguredAppUrl(),
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/api/ready", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not configured");
      }
      await db.execute(sql`SELECT 1`);
      res.json({
        ok: true,
        checks: {
          database: "ok",
          llm: isLLMConfigured() ? "ok" : "missing",
          storage: process.env.S3_ENDPOINT || ENV.forgeApiUrl ? "configured" : "missing",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(503).json({
        ok: false,
        checks: {
          database: "failed",
          llm: isLLMConfigured() ? "ok" : "missing",
          storage: process.env.S3_ENDPOINT || ENV.forgeApiUrl ? "configured" : "missing",
        },
        error: error?.message || "Database not ready",
        timestamp: new Date().toISOString(),
      });
    }
  });
  app.get("/api/meta", (req, res) => {
    res.json({
      ok: true,
      service: "testforge",
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || process.env.npm_package_version || "dev",
      appBaseUrl: getConfiguredAppUrl(),
      requestBaseUrl: getRequestAppUrl(req),
      commitSha: process.env.GIT_SHA || null,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/analyses/:analysisId/download", fixedWindowRateLimit({ windowMs: 60_000, max: 60, keyPrefix: "download" }), async (req: any, res: any) => {
    try {
      const user = await requireApiUser(req, res);
      if (!user) return;

      const analysisId = Number(req.params.analysisId);
      if (!Number.isInteger(analysisId) || analysisId <= 0) {
        return res.status(400).json({ error: "Invalid analysis id" });
      }

      const analysis = await getAnalysisById(analysisId);
      if (!analysis) return res.status(404).json({ error: "Analysis not found" });
      if (analysis.userId !== user.id) return res.status(403).json({ error: "Forbidden" });
      if (analysis.status !== "completed") return res.status(409).json({ error: "Analysis is not completed yet" });
      if (!analysis.outputZipKey) return res.status(404).json({ error: "No ZIP artifact found for this analysis" });

      const artifact = await storageRead(analysis.outputZipKey);
      res.setHeader("Content-Type", artifact.contentType || "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="testforge-analysis-${analysisId}.zip"`);
      res.setHeader("Content-Length", String(artifact.data.byteLength));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(artifact.data);
    } catch (err: any) {
      console.error("[download-analysis]", err);
      return res.status(500).json({ error: "Download failed" });
    }
  });

  // File upload endpoint for spec text extraction + S3 storage
  // Supports: .md, .txt, .pdf, .docx, .json (OpenAPI), .yaml/.yml (OpenAPI)
  app.post("/api/upload-spec", fixedWindowRateLimit({ windowMs: 60_000, max: 20, keyPrefix: "upload-spec" }), upload.single("file"), async (req: any, res: any) => {
    try {
      const user = await requireApiUser(req, res);
      if (!user) return;
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const originalname = safeUploadFilename(req.file.originalname);
      if (!isAllowedSpecUpload(originalname)) {
        return res.status(400).json({ error: "Unsupported file type" });
      }
      const mimetype: string = req.file.mimetype;
      const isJsonFile = originalname.endsWith(".json") || mimetype === "application/json";
      const isYamlFile = originalname.endsWith(".yaml") || originalname.endsWith(".yml") ||
        mimetype === "application/x-yaml" || mimetype === "text/yaml";
      const text = await extractTextFromFile(req.file.buffer, mimetype, originalname);
      assertExtractedSpecSize(text);
      if (!text || text.trim().length < 50) {
        return res.status(422).json({ error: "Could not extract readable text from file" });
      }
      const trimmed = text.trim();
      // Detect OpenAPI/Swagger documents — JSON or YAML files that have openapi/swagger key
      let isOpenAPI = false;
      if (isJsonFile || isYamlFile) {
        const { isOpenAPIDocument } = await import("../openapi-parser");
        isOpenAPI = isOpenAPIDocument(trimmed);
      }
      // Store raw content in S3 so analyses.create can choose LLM or OpenAPI path
      const { storagePut } = await import("../storage");
      const key = buildUserSpecKey(user.id, originalname);
      await storagePut(key, Buffer.from(trimmed, "utf-8"), isOpenAPI ? "application/json" : "text/plain");
      res.json({ text: trimmed, filename: originalname, chars: trimmed.length, specKey: key, isOpenAPI });
    } catch (err: any) {
      console.error("[upload-spec]", err);
      uploadFailure(res, err, "Extraction failed");
    }
  });

  // Paste spec text endpoint - stores in S3, returns specKey
  app.post("/api/upload-spec-text", fixedWindowRateLimit({ windowMs: 60_000, max: 20, keyPrefix: "upload-spec-text" }), express.json({ limit: "20mb" }), async (req: any, res: any) => {
    try {
      const user = await requireApiUser(req, res);
      if (!user) return;
      const { text, filename } = req.body || {};
      if (!text || text.trim().length < 100) {
        return res.status(400).json({ error: "Text too short (minimum 100 characters)" });
      }
      const trimmed = text.trim();
      assertExtractedSpecSize(trimmed);
      const { storagePut } = await import("../storage");
      const safeName = safeUploadFilename(filename || "spec.txt");
      const key = buildUserSpecKey(user.id, safeName);
      await storagePut(key, Buffer.from(trimmed, "utf-8"), "text/plain");
      res.json({ specKey: key, chars: trimmed.length, filename: filename || "spec.txt" });
    } catch (err: any) {
      console.error("[upload-spec-text]", err);
      uploadFailure(res, err, "Upload failed");
    }
  });

  // ─── Code Upload Endpoint ───────────────────────────────────────────────────
  // POST /api/upload-code
  // Accepts a ZIP file (max 50MB), extracts code files in memory,
  // detects framework, and returns files + framework for code-scan analysis.
  const codeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  app.post("/api/upload-code", fixedWindowRateLimit({ windowMs: 60_000, max: 10, keyPrefix: "upload-code" }), codeUpload.single("file"), async (req: any, res: any) => {
    try {
      const user = await requireApiUser(req, res);
      if (!user) return;
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const originalname = safeUploadFilename(req.file.originalname);
      if (!originalname.endsWith(".zip")) {
        return res.status(400).json({ error: "Only ZIP files are supported" });
      }

      const { default: AdmZip } = await import("adm-zip");
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();
      if (entries.length > MAX_ZIP_ENTRIES) {
        return res.status(413).json({ error: `ZIP contains too many entries (max ${MAX_ZIP_ENTRIES})` });
      }

      const files: Array<{ path: string; content: string }> = [];
      let totalBytes = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const normalizedPath = normalizeZipEntryPath(entry.entryName);
        if (!normalizedPath || !shouldIncludeCodePath(normalizedPath)) continue;
        if (files.length >= MAX_CODE_FILES || totalBytes >= MAX_CODE_TOTAL_BYTES) break;

        try {
          const raw = entry.getData();
          if (raw.length > MAX_CODE_FILE_BYTES) continue;
          const content = redactUploadedCode(normalizedPath, raw.toString("utf-8"));
          totalBytes += content.length;
          files.push({ path: normalizedPath, content });
        } catch {
          // Skip unreadable files
        }
      }

      if (files.length === 0) {
        return res.status(422).json({ error: "No code files found in ZIP (expected .ts, .tsx, .js, .prisma, package.json)" });
      }

      // Detect framework
      const { detectFramework } = await import("../analyzer/code-parser");
      const framework = detectFramework(files);

      res.json({ files, framework, fileCount: files.length });
    } catch (err: any) {
      console.error("[upload-code]", err);
      uploadFailure(res, err, "ZIP extraction failed");
    }
  });

  // ─── SSE: Test Run Live Stream ─────────────────────────────────────────────
  // GET /api/test-runs/:runId/stream
  // Opens a Server-Sent Events connection. Emits:
  //   { type: "test_result", result, progress: { completed, total } }
  //   { type: "run_complete", summary }
  //   { type: "run_error", error }
  // Auth: session cookie required (same as tRPC)
  app.get("/api/test-runs/:runId/stream", fixedWindowRateLimit({ windowMs: 60_000, max: 30, keyPrefix: "sse" }), async (req: any, res: any) => {
    const { runId } = req.params;
    if (!runId || typeof runId !== "string") {
      return res.status(400).json({ error: "runId required" });
    }

    // Authenticate via session cookie
    let user: import("../../drizzle/schema").User | null = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    // Send initial heartbeat so client knows connection is open
    res.write(`data: ${JSON.stringify({ type: "connected", runId })}\n\n`);

    // Register this client in the SSE bus
    const { registerSSEClient } = await import("../test-run-sse");
    const cleanup = registerSSEClient(runId, res);

    // Clean up on client disconnect
    req.on("close", cleanup);
    res.on("close", cleanup);
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
