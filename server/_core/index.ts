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
  app.post("/api/upload-spec", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (!text || text.trim().length < 50) {
        return res.status(422).json({ error: "Could not extract readable text from file" });
      }
      const trimmed = text.trim();
      // Store extracted text in S3 so analyses.create doesn't need to carry the full text
      const { storagePut } = await import("../storage");
      const key = `specs/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
      await storagePut(key, Buffer.from(trimmed, "utf-8"), "text/plain");
      res.json({ text: trimmed, filename: req.file.originalname, chars: trimmed.length, specKey: key });
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
