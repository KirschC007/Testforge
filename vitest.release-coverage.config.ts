import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
      "@assets": path.resolve(root, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "server/_core/cookies.ts",
        "server/_core/env.ts",
        "server/_core/rate-limit.ts",
        "server/_core/runtime-security.ts",
        "server/_core/security-headers.ts",
        "server/_core/ssrf-guard.ts",
        "server/_core/storage-keys.ts",
        "server/_core/upload-security.ts",
        "server/_core/url-safety.ts",
        "server/analyzer/output-normalizer.ts",
        "server/analyzer/risk-rules.ts",
        "server/analyzer/validator.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**", "scenario-outputs/**"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
        "server/_core/ssrf-guard.ts": {
          lines: 90,
          functions: 100,
          branches: 80,
        },
        "server/_core/rate-limit.ts": {
          lines: 85,
          functions: 100,
        },
      },
    },
  },
});
