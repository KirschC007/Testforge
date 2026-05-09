import { describe, expect, it } from "vitest";
import {
  MAX_EXTRACTED_SPEC_CHARS,
  assertExtractedSpecSize,
  isAllowedSpecUpload,
  normalizeZipEntryPath,
  redactUploadedCode,
  safeUploadFilename,
  shouldIncludeCodePath,
} from "./upload-security";

describe("upload security", () => {
  it("sanitizes user supplied filenames for object storage keys", () => {
    expect(safeUploadFilename("../../prod secret?.yaml")).toBe("prod_secret_.yaml");
    expect(safeUploadFilename("")).toBe("upload.txt");
  });

  it("allows only supported spec upload extensions", () => {
    expect(isAllowedSpecUpload("api.openapi.yaml")).toBe(true);
    expect(isAllowedSpecUpload("requirements.pdf")).toBe(true);
    expect(isAllowedSpecUpload("malware.exe")).toBe(false);
  });

  it("enforces extracted spec size limits before storage or LLM work", () => {
    expect(() => assertExtractedSpecSize("x".repeat(MAX_EXTRACTED_SPEC_CHARS))).not.toThrow();
    expect(() => assertExtractedSpecSize("x".repeat(MAX_EXTRACTED_SPEC_CHARS + 1))).toThrow(/too large/);
  });

  it("rejects unsafe ZIP entry paths", () => {
    expect(normalizeZipEntryPath("repo/src/index.ts")).toBe("src/index.ts");
    expect(normalizeZipEntryPath("../secret.ts")).toBeNull();
    expect(normalizeZipEntryPath("/etc/passwd")).toBeNull();
    expect(normalizeZipEntryPath("C:\\temp\\evil.ts")).toBeNull();
  });

  it("filters generated, dependency, and test files from code scans", () => {
    expect(shouldIncludeCodePath("src/router.ts")).toBe(true);
    expect(shouldIncludeCodePath("package.json")).toBe(true);
    expect(shouldIncludeCodePath("node_modules/pkg/index.ts")).toBe(false);
    expect(shouldIncludeCodePath("src/router.test.ts")).toBe(false);
    expect(shouldIncludeCodePath("README.md")).toBe(false);
  });

  it("redacts secret-like uploaded files before analysis transport", () => {
    expect(redactUploadedCode(".env.example", "TOKEN=abc\nEMPTY=")).toBe("TOKEN=[REDACTED]\nEMPTY=[REDACTED]");
    expect(redactUploadedCode("src/index.ts", "const value = 1;")).toBe("const value = 1;");
  });
});
