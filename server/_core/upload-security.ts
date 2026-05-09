import path from "node:path";

export const MAX_EXTRACTED_SPEC_CHARS = 1_000_000;
export const MAX_CODE_TOTAL_BYTES = 5 * 1024 * 1024;
export const MAX_CODE_FILE_BYTES = 512 * 1024;
export const MAX_CODE_FILES = 250;
export const MAX_ZIP_ENTRIES = 5_000;

const SPEC_EXTENSIONS = new Set([".md", ".txt", ".pdf", ".docx", ".doc", ".json", ".yaml", ".yml"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".py", ".prisma", ".json"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo"]);
const IGNORE_PATTERNS = [".test.", ".spec.", ".stories."];

export function safeUploadFilename(originalname: string, fallback = "upload.txt"): string {
  const base = path.basename(originalname || fallback).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base.slice(0, 120) : fallback;
}

export function isAllowedSpecUpload(originalname: string): boolean {
  return SPEC_EXTENSIONS.has(path.extname(originalname).toLowerCase());
}

export function assertExtractedSpecSize(text: string): void {
  if (text.length > MAX_EXTRACTED_SPEC_CHARS) {
    throw new Error(`Extracted text is too large (${text.length} chars, max ${MAX_EXTRACTED_SPEC_CHARS})`);
  }
}

export function normalizeZipEntryPath(entryName: string): string | null {
  if (!entryName || entryName.includes("\0")) return null;
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return null;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "..")) return null;

  return segments.length > 1 ? segments.slice(1).join("/") : segments[0];
}

export function shouldIncludeCodePath(normalizedPath: string): boolean {
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.some((segment) => IGNORE_DIRS.has(segment))) return false;
  if (IGNORE_PATTERNS.some((pattern) => normalizedPath.includes(pattern))) return false;
  if (normalizedPath.endsWith("package.json")) return true;
  return CODE_EXTENSIONS.has(path.extname(normalizedPath).toLowerCase());
}

export function redactUploadedCode(pathname: string, content: string): string {
  if (!/\.env(\.|$)|secret|credential/i.test(pathname)) return content;
  return content
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf("=");
      return index > 0 ? `${line.slice(0, index + 1)}[REDACTED]` : line;
    })
    .join("\n");
}
