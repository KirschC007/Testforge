import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { OUTPUT_SNAPSHOT_CASES } from "./output-snapshots";

export interface OutputExecutionResult {
  name: string;
  passed: boolean;
  checkedFiles: number;
  playwrightSpecs: number;
  securitySpecs: number;
  packageScripts: string[];
  failures: string[];
}

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

function parsePackageScripts(packageJsonPath: string): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { scripts?: Record<string, string> };
    return parsed.scripts || {};
  } catch {
    return {};
  }
}

function hasBalancedDelimiters(content: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  let quote: string | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const next = content[index + 1];
    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      inLineComment = true;
      index++;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      index++;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") stack.push(char);
    if (char === ")" || char === "}" || char === "]") {
      if (stack.pop() !== pairs[char]) return false;
    }
  }
  return stack.length === 0 && quote === null;
}

export function runOutputExecutionCase(rootDir: string, name: string): OutputExecutionResult {
  const failures: string[] = [];
  if (!existsSync(rootDir)) {
    return {
      name,
      passed: false,
      checkedFiles: 0,
      playwrightSpecs: 0,
      securitySpecs: 0,
      packageScripts: [],
      failures: [`Snapshot directory missing: ${rootDir}`],
    };
  }

  const files = walkFiles(rootDir);
  const scripts = parsePackageScripts(path.join(rootDir, "package.json"));
  const requiredScripts = ["test", "test:list", "test:dry-run", "validate"];
  for (const script of requiredScripts) {
    if (!scripts[script]) failures.push(`Missing package script ${script}`);
  }
  if (!existsSync(path.join(rootDir, "playwright.config.ts"))) {
    failures.push("Missing playwright.config.ts");
  }

  let checkedFiles = 0;
  let playwrightSpecs = 0;
  let securitySpecs = 0;
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;
    checkedFiles++;
    const content = readFileSync(path.join(rootDir, file), "utf-8");
    if (!hasBalancedDelimiters(content)) {
      failures.push(`Unbalanced delimiters in ${file}`);
    }
    if (file.endsWith(".spec.ts") || file.endsWith(".test.ts")) {
      if (content.includes("test(")) playwrightSpecs++;
      if (!content.includes("@playwright/test") && !content.includes("vitest")) {
        failures.push(`Test file missing runner import in ${file}`);
      }
    }
    if (file.startsWith("tests/security/") && content.includes("test(")) {
      securitySpecs++;
      if (!content.includes("// Kills:")) {
        failures.push(`Security test missing mutation-kill comment in ${file}`);
      }
      if (/toBeGreaterThan(?:OrEqual)?\(\s*[34]\d\d\s*\)/.test(content)) {
        failures.push(`Security test uses broad status assertion in ${file}`);
      }
    }
    if (/TODO_REPLACE_WITH_[A-Z_]+/.test(content)) {
      failures.push(`Unresolved endpoint placeholder in ${file}`);
    }
  }

  if (playwrightSpecs === 0) failures.push("No Playwright/Vitest specs discovered");
  if (securitySpecs === 0) failures.push("No security specs discovered");

  return {
    name,
    passed: failures.length === 0,
    checkedFiles,
    playwrightSpecs,
    securitySpecs,
    packageScripts: Object.keys(scripts).sort(),
    failures,
  };
}

export function runOutputExecutionSuite(): OutputExecutionResult[] {
  return OUTPUT_SNAPSHOT_CASES.map((entry) => runOutputExecutionCase(entry.rootDir, entry.name));
}

export function summarizeOutputExecutionResults(results: OutputExecutionResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const totalSpecs = results.reduce((sum, result) => sum + result.playwrightSpecs, 0);
  const totalSecuritySpecs = results.reduce((sum, result) => sum + result.securitySpecs, 0);
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    totalSpecs,
    totalSecuritySpecs,
  };
}
