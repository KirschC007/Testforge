import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      // Focus coverage on the server-side analyzer and core — UI is tested via E2E
      include: [
        "server/_core/ssrf-guard.ts",
        "server/_core/rate-limit.ts",
        "server/analyzer/risk-rules.ts",
        "server/analyzer/risk-model.ts",
        "server/analyzer/validator.ts",
        "server/analyzer/normalize.ts",
        "server/analyzer/har-parser.ts",
        "server/analyzer/proof-generator.ts",
        "server/analyzer/proof-templates-security.ts",
        "server/analyzer/helpers-generator.ts",
        "server/analyzer/extended-suite.ts",
        "server/openapi-parser.ts",                  // production file (the analyzer/ one is dead code)
        "server/analyzer/proof-pack-generator.ts",
        "server/analyzer/spec-diff.ts",
        "server/analyzer/smart-parser.ts",
        "server/analyzer/spec-regex-extractor.ts",
        "server/analyzer/code-builder.ts",
        "server/analyzer/output-normalizer.ts",
        "server/analyzer/active-scanner.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/node_modules/**",
        "scenario-outputs/**",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
        // Per-file thresholds for security-critical code
        "server/_core/ssrf-guard.ts": {
          lines: 90,
          functions: 100,
          branches: 80,
        },
        "server/_core/rate-limit.ts": {
          lines: 85,
          functions: 100,
        },
        // validator.ts has LLM-rework paths (runIndependentChecker → invokeLLM)
        // that need real LLM responses to exercise — covered by integration tests
        // when an LLM API key is set, otherwise inherently uncoverable in unit tests.
        "server/analyzer/validator.ts": {
          lines: 65,
          functions: 60,
          branches: 65,
        },
      },
    },
  },
});
