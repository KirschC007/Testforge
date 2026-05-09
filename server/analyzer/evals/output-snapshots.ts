import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface OutputSnapshotCase {
  name: string;
  rootDir: string;
  requiredPaths: string[];
  requiredPrefixes: string[];
}

export interface OutputSnapshotResult {
  name: string;
  passed: boolean;
  discoveredFiles: number;
  failures: string[];
}

const SNAPSHOT_ROOT = path.resolve(process.cwd(), "scenario-outputs");

export const OUTPUT_SNAPSHOT_CASES: OutputSnapshotCase[] = [
  {
    name: "medrental-generated-suite",
    rootDir: path.join(SNAPSHOT_ROOT, "medrental-extracted"),
    requiredPaths: [
      "package.json",
      "playwright.config.ts",
      "vitest.config.ts",
      "cucumber.config.ts",
      "tests/uat/step-definitions/steps.ts",
    ],
    requiredPrefixes: [
      "tests/unit/",
      "tests/integration/",
      "tests/e2e/",
      "tests/security/",
      "tests/performance/",
      "tests/uat/",
    ],
  },
  {
    name: "travelagency-generated-suite",
    rootDir: path.join(SNAPSHOT_ROOT, "s13-travelagency-extracted"),
    requiredPaths: [
      "package.json",
      "playwright.config.ts",
    ],
    requiredPrefixes: [
      "tests/unit/",
      "tests/integration/",
      "tests/e2e/",
      "tests/security/",
    ],
  },
];

function walkFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const abs = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(rootDir, abs));
    } else {
      files.push(path.relative(rootDir, abs));
    }
  }
  return files;
}

export function runOutputSnapshotCase(input: OutputSnapshotCase): OutputSnapshotResult {
  const failures: string[] = [];
  if (!existsSync(input.rootDir)) {
    return {
      name: input.name,
      passed: false,
      discoveredFiles: 0,
      failures: [`Snapshot directory missing: ${input.rootDir}`],
    };
  }

  const files = walkFiles(input.rootDir);
  for (const requiredPath of input.requiredPaths) {
    if (!files.includes(requiredPath)) {
      failures.push(`Missing required file ${requiredPath}`);
    }
  }
  for (const prefix of input.requiredPrefixes) {
    if (!files.some((file) => file.startsWith(prefix))) {
      failures.push(`Missing files under ${prefix}`);
    }
  }
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs|md|json)$/.test(file)) continue;
    const content = readFileSync(path.join(input.rootDir, file), "utf-8");
    if (/TODO_REPLACE_WITH_[A-Z_]+/.test(content)) {
      failures.push(`Unresolved endpoint placeholder in ${file}`);
    }
    if (/toBeGreaterThan(?:OrEqual)?\(\s*[34]\d\d\s*\)/.test(content)) {
      failures.push(`Broad status-code assertion in ${file}`);
    }
    if (file.startsWith("tests/security/") && content.includes("test(") && !content.includes("// Kills:")) {
      failures.push(`Security test missing mutation-kill comment in ${file}`);
    }
    if (file.endsWith(".spec.ts") && !content.includes("@playwright/test")) {
      failures.push(`Playwright spec missing @playwright/test import in ${file}`);
    }
  }

  return {
    name: input.name,
    passed: failures.length === 0,
    discoveredFiles: files.length,
    failures,
  };
}

export function runOutputSnapshotSuite(): OutputSnapshotResult[] {
  return OUTPUT_SNAPSHOT_CASES.map(runOutputSnapshotCase);
}

export function summarizeOutputSnapshotResults(results: OutputSnapshotResult[]) {
  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
  };
}
