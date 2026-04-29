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
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function extractTextFromFile(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  // Markdown / plain text — read directly
  if (mimetype === "text/markdown" || mimetype === "text/plain" || originalname.endsWith(".md") || originalname.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }
  // PDF — use pdftotext
  if (mimetype === "application/pdf" || originalname.endsWith(".pdf")) {
    const tmpIn = join(tmpdir(), `tf-${Date.now()}.pdf`);
    const tmpOut = join(tmpdir(), `tf-${Date.now()}.txt`);
    try {
      await writeFile(tmpIn, buffer);
      await execAsync(`pdftotext -layout "${tmpIn}" "${tmpOut}"`);
      const text = await readFile(tmpOut, "utf-8");
      return text;
    } finally {
      await unlink(tmpIn).catch(() => {});
      await unlink(tmpOut).catch(() => {});
    }
  }
  // Word documents — extract raw text (basic)
  if (originalname.endsWith(".docx") || originalname.endsWith(".doc")) {
    // For DOCX: extract as plain text using strings command (rough but functional)
    const tmpIn = join(tmpdir(), `tf-${Date.now()}.docx`);
    try {
      await writeFile(tmpIn, buffer);
      const { stdout } = await execAsync(`strings "${tmpIn}" | grep -v '^[^a-zA-Z]*$' | head -2000`);
      return stdout;
    } finally {
      await unlink(tmpIn).catch(() => {});
    }
  }
  return buffer.toString("utf-8");
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
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // File upload endpoint for spec text extraction + S3 storage
  // Supports: .md, .txt, .pdf, .docx, .json (OpenAPI), .yaml/.yml (OpenAPI)
  app.post("/api/upload-spec", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const originalname: string = req.file.originalname;
      const mimetype: string = req.file.mimetype;
      const isJsonFile = originalname.endsWith(".json") || mimetype === "application/json";
      const isYamlFile = originalname.endsWith(".yaml") || originalname.endsWith(".yml") ||
        mimetype === "application/x-yaml" || mimetype === "text/yaml";
      const text = await extractTextFromFile(req.file.buffer, mimetype, originalname);
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
      const key = `specs/${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await storagePut(key, Buffer.from(trimmed, "utf-8"), isOpenAPI ? "application/json" : "text/plain");
      res.json({ text: trimmed, filename: originalname, chars: trimmed.length, specKey: key, isOpenAPI });
    } catch (err: any) {
      console.error("[upload-spec]", err);
      res.status(500).json({ error: err.message || "Extraction failed" });
    }
  });

  // Paste spec text endpoint - stores in S3, returns specKey
  app.post("/api/upload-spec-text", express.json({ limit: "20mb" }), async (req: any, res: any) => {
    try {
      const { text, filename } = req.body || {};
      if (!text || text.trim().length < 100) {
        return res.status(400).json({ error: "Text too short (minimum 100 characters)" });
      }
      const trimmed = text.trim();
      const { storagePut } = await import("../storage");
      const safeName = (filename || "spec.txt").replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `specs/${Date.now()}-${safeName}`;
      await storagePut(key, Buffer.from(trimmed, "utf-8"), "text/plain");
      res.json({ specKey: key, chars: trimmed.length, filename: filename || "spec.txt" });
    } catch (err: any) {
      console.error("[upload-spec-text]", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  // ─── Code Upload Endpoint ───────────────────────────────────────────────────
  // POST /api/upload-code
  // Accepts a ZIP file (max 50MB), extracts code files in memory,
  // detects framework, and returns files + framework for code-scan analysis.
  const codeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  app.post("/api/upload-code", codeUpload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const originalname: string = req.file.originalname;
      if (!originalname.endsWith(".zip")) {
        return res.status(400).json({ error: "Only ZIP files are supported" });
      }

      const { default: AdmZip } = await import("adm-zip");
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();

      const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".prisma", ".json", ".env.example"];
      const IGNORE_DIRS = ["node_modules/", ".git/", "dist/", "build/", ".next/", "coverage/", ".turbo/"];
      const IGNORE_PATTERNS = [".test.", ".spec.", ".stories."];

      const files: Array<{ path: string; content: string }> = [];
      let totalBytes = 0;
      const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB content limit

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryPath = entry.entryName;

        // Skip ignored paths
        if (IGNORE_DIRS.some(d => entryPath.includes(d))) continue;
        if (IGNORE_PATTERNS.some(p => entryPath.includes(p))) continue;

        // Only include code files
        const hasCodeExt = CODE_EXTENSIONS.some(ext =>
          entryPath.endsWith(ext) || (ext === ".json" && entryPath.endsWith("package.json"))
        );
        if (!hasCodeExt) continue;
        if (totalBytes >= MAX_TOTAL_BYTES) break;

        try {
          const content = entry.getData().toString("utf-8");
          totalBytes += content.length;
          // Normalize path: strip leading zip folder name if present
          const normalizedPath = entryPath.replace(/^[^/]+\//, "");
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
      res.status(500).json({ error: err.message || "ZIP extraction failed" });
    }
  });

  // ─── HAR Traffic Import Endpoint ────────────────────────────────────────────
  // POST /api/analyze-har
  // Accepts a HAR file (JSON from browser DevTools / proxy), parses real traffic,
  // and returns a ZIP containing Playwright tests:
  //   - tests/traffic/replay-authenticated.spec.ts  — auth endpoint replay
  //   - tests/traffic/security-authenticated.spec.ts — auth required checks
  //   - tests/traffic/replay-public.spec.ts          — public endpoint replay
  //   - tests/traffic/perf-baseline.spec.ts          — response time budgets
  // No LLM calls — fully deterministic, returns in <2s.
  const harUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  app.post("/api/analyze-har", harUpload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No HAR file provided" });

      // Parse HAR JSON
      let har: unknown;
      try {
        har = JSON.parse(req.file.buffer.toString("utf-8"));
      } catch {
        return res.status(422).json({ error: "Invalid JSON — upload a .har file exported from browser DevTools or a proxy tool" });
      }

      // Validate HAR structure
      const { validateHAR, parseHAR } = await import("../analyzer/har-parser");
      const validation = validateHAR(har);
      if (!validation.valid) {
        return res.status(422).json({ error: `Invalid HAR: ${validation.error}` });
      }

      // Parse and generate test files
      const suite = parseHAR(har as any, {
        baseUrl: req.body?.baseUrl || undefined,
      });

      if (suite.endpoints.length === 0) {
        return res.status(422).json({
          error: "No API calls found in HAR. Make sure to capture /api/ traffic and export from Chrome DevTools → Network → Export HAR.",
        });
      }

      // Bundle test files into ZIP
      const archiver = await import("archiver");
      const chunks: Buffer[] = [];
      const archive = archiver.default("zip", { zlib: { level: 1 } });
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));

      await new Promise<void>((resolve, reject) => {
        archive.on("end", resolve);
        archive.on("error", reject);

        for (const f of suite.testFiles) {
          archive.append(Buffer.from(f.content, "utf-8"), { name: f.filename });
        }

        // Include a summary JSON
        archive.append(Buffer.from(JSON.stringify(suite.summary, null, 2), "utf-8"), {
          name: "har-analysis-summary.json",
        });

        archive.finalize();
      });

      const zipBuffer = Buffer.concat(chunks);
      const filename = `testforge-har-${Date.now()}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-HAR-Summary", JSON.stringify(suite.summary));
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("[analyze-har]", err);
      res.status(500).json({ error: err.message || "HAR analysis failed" });
    }
  });

  // ─── SSE: Test Run Live Stream ─────────────────────────────────────────────
  // GET /api/test-runs/:runId/stream
  // Opens a Server-Sent Events connection. Emits:
  //   { type: "test_result", result, progress: { completed, total } }
  //   { type: "run_complete", summary }
  //   { type: "run_error", error }
  // Auth: session cookie required (same as tRPC)
  app.get("/api/test-runs/:runId/stream", async (req: any, res: any) => {
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
