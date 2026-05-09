import ts from "typescript";
import { classifyStackAdapter } from "./stack-adapters";
import type { AnalysisResult, ExtendedTestFile, GeneratedHelpers } from "./types";
import type { CodeFile } from "./code-parser";

export type GeneratedSuiteReadiness = "ready_to_merge" | "compiles_needs_env" | "draft_only" | "unsupported";

export interface GeneratedSuiteGateResult {
  readiness: GeneratedSuiteReadiness;
  passed: boolean;
  checkedFiles: number;
  failures: string[];
  warnings: string[];
  evidence: string[];
}

function generatedEntries(files: ExtendedTestFile[], helpers: Partial<GeneratedHelpers>): Array<{ filename: string; content: string }> {
  return [
    ...files.map((file) => ({ filename: file.filename, content: file.content })),
    ...Object.entries(helpers).map(([filename, content]) => ({ filename, content: String(content) })),
  ];
}

function syntaxDiagnostics(filename: string, content: string): string[] {
  if (!/\.(ts|tsx)$/.test(filename)) return [];
  try {
    const result = ts.transpileModule(content, {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        strict: true,
      },
      reportDiagnostics: true,
    });
    return (result.diagnostics || [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
        return `${filename}: ${message}`;
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${filename}: TypeScript syntax validation crashed: ${message}`];
  }
}

function endpointMethod(endpoint: { name: string; method: string }): string {
  return (endpoint.method || endpoint.name || "").match(/^(GET|POST|PUT|PATCH|DELETE)\b/i)?.[1]?.toUpperCase() || "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactLineAliasPattern(alias: string): RegExp {
  return new RegExp(`Status Transition:[^\\n]*(?<![\\w/-])${escapeRegExp(alias)}(?![\\w/-])`, "i");
}

export function evaluateGeneratedSuiteQuality(
  analysis: AnalysisResult,
  files: ExtendedTestFile[],
  helpers: Partial<GeneratedHelpers> = {},
  sourceFiles: CodeFile[] = []
): GeneratedSuiteGateResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];
  const entries = generatedEntries(files, helpers);
  const allContent = entries.map((entry) => `\n// FILE: ${entry.filename}\n${entry.content}`).join("\n");
  const executableContent = entries
    .filter((entry) => /\.(ts|tsx|js|mjs)$/.test(entry.filename))
    .map((entry) => `\n// FILE: ${entry.filename}\n${entry.content}`)
    .join("\n");
  const apiHelper = entries.find((entry) => entry.filename === "helpers/api.ts")?.content || "";
  const authHelper = entries.find((entry) => entry.filename === "helpers/auth.ts")?.content || "";
  const factoriesHelper = entries.find((entry) => entry.filename === "helpers/factories.ts")?.content || "";
  const packageJson = entries.find((entry) => entry.filename === "package.json")?.content || "";
  const report = entries.find((entry) => entry.filename === "testforge-report.md")?.content || "";
  const adapter = classifyStackAdapter(sourceFiles, analysis.ir);
  evidence.push(`adapter=${adapter.adapter}`, `adapterConfidence=${adapter.confidence}`, `adapterMode=${adapter.recommendedMode}`);

  for (const entry of entries) {
    for (const diagnostic of syntaxDiagnostics(entry.filename, entry.content)) failures.push(diagnostic);
    if (/TODO_REPLACE_WITH_[A-Z_]+/.test(entry.content)) failures.push(`Unresolved TODO placeholder in ${entry.filename}`);
    if (/function\s+[A-Za-z_$][\w$]*-[\w$]+/.test(entry.content)) failures.push(`Invalid hyphenated function identifier in ${entry.filename}`);
    if (/export const\s+(GET|POST|PUT|PATCH|DELETE)\s+\//.test(entry.content)) failures.push(`Invalid REST path export identifier in ${entry.filename}`);
    if (/from\s+["']\.\.\/\.\.\/helpers\/api["']/.test(entry.content) && /trpc(?:Mutation|Query)\(\s*["']/.test(entry.content)) {
      failures.push(`Imported helpers/api call missing request fixture argument in ${entry.filename}`);
    }
    if (/function\s+api(?:Mutation|Query)\s*\(/.test(entry.content) && /endpoint\.includes\("\/"\)/.test(entry.content) && !/parseEndpoint\(/.test(entry.content)) {
      failures.push(`Local REST wrapper does not parse METHOD path endpoints in ${entry.filename}`);
    }
    const negativeAmountDeclarations = entry.content.match(/\bconst\s+NEGATIVE_AMOUNT_PAYLOADS\b/g) || [];
    if (negativeAmountDeclarations.length > 1) {
      failures.push(`Duplicate NEGATIVE_AMOUNT_PAYLOADS declaration in ${entry.filename}`);
    }
  }

  if (/Quality Score:\s*(?:[1-9]\d|100)(?:\.0)?\/10\.0/.test(report)) {
    failures.push("Report renders a 0-100 quality score on a /10 scale");
  }

  if (/playwright\s+test\s+--dry-run/.test(packageJson)) {
    failures.push("package.json uses unsupported Playwright --dry-run option; use test:list for no-execution validation");
  }

  if (/from\s+["']\.\.\/\.\.\/helpers\/factories["']/.test(allContent)) {
    const factoryImports = Array.from(allContent.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']\.\.\/\.\.\/helpers\/factories["']/g))
      .flatMap((match) => match[1].split(",").map((name) => name.trim().split(/\s+as\s+/i)[0].trim()))
      .filter(Boolean);
    for (const imported of Array.from(new Set(factoryImports))) {
      const exported = new RegExp(`export\\s+(?:const|async\\s+function|function|let|var)\\s+${escapeRegExp(imported)}\\b`).test(factoriesHelper);
      if (!exported) failures.push(`Factory import ${imported} is not exported by helpers/factories.ts`);
    }
  }

  if (/\bTEST_TENANTID\b/.test(allContent) && !/export\s+const\s+TEST_TENANTID\b/.test(factoriesHelper)) {
    failures.push("Generated TEST_TENANTID typo; expected TEST_TENANT_ID or the detected tenant constant");
  }

  if (/\bcreateTestResource\b/.test(allContent) && !/export\s+async\s+function\s+createTestResource\b/.test(factoriesHelper)) {
    failures.push("Generated tests call createTestResource but helpers/factories.ts does not export it");
  }

  if (/\b(?:process|Buffer)\b/.test(executableContent) && packageJson && !/"@types\/node"\s*:/.test(packageJson)) {
    failures.push("Generated TypeScript uses Node globals but package.json does not include @types/node");
  }

  if (/from\s+["']@cucumber\/cucumber["']/.test(allContent) && packageJson && !/"@cucumber\/cucumber"\s*:/.test(packageJson)) {
    failures.push("Generated UAT step definitions import @cucumber/cucumber but package.json does not include it");
  }

  if (/from\s+["']fast-check["']/.test(allContent) && packageJson && !/"fast-check"\s*:/.test(packageJson)) {
    failures.push("Generated property tests import fast-check but package.json does not include it");
  }

  const cookieHelperCount = (authHelper.match(/export\s+async\s+function\s+get[A-Za-z0-9_]+Cookie\b/g) || []).length;
  const detectedRoleCount = analysis.ir.authModel?.roles?.length || 0;
  if (cookieHelperCount > Math.max(12, detectedRoleCount + 6)) {
    failures.push(`Generated ${cookieHelperCount} auth cookie helpers; likely enum/status values were misclassified as roles`);
  }

  if (!analysis.ir.tenantModel) {
    if (/\{\s*tenantId\s*:|TEST_TENANT_ID\s*[,:=]/.test(executableContent)) failures.push("Generated tenant fixtures for a single-tenant analysis");
    if (/cross-tenant|other tenant|TEST_TENANT_B_ID/i.test(allContent)) warnings.push("Single-tenant analysis still contains tenant wording in docs/comments");
  }

  const restRoutes = analysis.ir.apiEndpoints
    .map((endpoint) => endpoint.method || endpoint.name)
    .filter((value) => /^(GET|POST|PUT|PATCH|DELETE)\s+\//i.test(value));
  if (restRoutes.length > 0 && /\/api\/trpc\/(?:executor|settings|cron|meta|modules|models)/.test(allContent)) {
    failures.push("Generated fake tRPC path for REST-only route evidence");
  }
  if (restRoutes.length > 0) {
    if (!apiHelper.includes("ENDPOINT_ALIASES") || !apiHelper.includes("resolveProcedure")) {
      failures.push("Generated REST route tests without endpoint alias resolution in helpers/api.ts");
    }
    if (!apiHelper.includes('kind: "query" | "mutation"')) {
      failures.push("helpers/api.ts must resolve REST endpoint aliases by query/mutation call type");
    }
    if (!apiHelper.includes('"set-cookie"') || !apiHelper.includes('"setCookie"')) {
      failures.push("helpers/api.ts must support both set-cookie and setCookie header shapes");
    }
    for (const route of restRoutes) {
      if (!apiHelper.includes(route)) failures.push(`Missing REST endpoint alias for ${route}`);
    }
  }

  if ((analysis.ir.userFlows || []).length === 0 && /\/(?:executor|settings|recommendations|modules|models)\/(?:new|create|edit|anlegen|erstellen|neu)/.test(allContent)) {
    failures.push("Generated guessed CRUD browser pages without explicit user-flow evidence");
  }

  const statusTransitionContent = entries
    .filter((entry) => entry.filename.endsWith("status-transitions.spec.ts"))
    .map((entry) => entry.content)
    .join("\n");
  if (statusTransitionContent) {
    if (/\bGET\s+\/api\//i.test(statusTransitionContent) || /Status Transition:\s*Get\s+GET/i.test(statusTransitionContent)) {
      failures.push("Generated status-transition proof for read-only GET endpoint");
    }
    const nonWorkflowEndpoints = analysis.ir.apiEndpoints.filter((endpoint) => {
      const method = endpointMethod(endpoint);
      const text = `${endpoint.name} ${endpoint.method} ${(endpoint.inputFields || []).map((field) => field.name).join(" ")}`.toLowerCase();
      return method === "GET" || !/status|state|transition|workflow|approve|reject|cancel|complete|archive|publish|unpublish|activate|suspend|freeze|unfreeze|ship/.test(text);
    });
    for (const endpoint of nonWorkflowEndpoints) {
      const aliases = [endpoint.name, endpoint.method].filter(Boolean).map(escapeRegExp);
      if (aliases.length && [endpoint.name, endpoint.method].filter(Boolean).some((alias) => exactLineAliasPattern(alias).test(statusTransitionContent))) {
        failures.push(`Generated status-transition proof without workflow evidence for ${endpoint.method || endpoint.name}`);
      }
    }
  }

  const boundaryContent = entries
    .filter((entry) => entry.filename.endsWith("boundary.spec.ts"))
    .map((entry) => entry.content)
    .join("\n");
  if (boundaryContent) {
    const numericFields = new Set<string>();
    const fieldTypes = new Map<string, Set<string>>();
    for (const endpoint of analysis.ir.apiEndpoints) {
      for (const field of endpoint.inputFields || []) {
        const types = fieldTypes.get(field.name) || new Set<string>();
        types.add(field.type);
        fieldTypes.set(field.name, types);
        if (field.type === "number") numericFields.add(field.name);
      }
    }
    const enumOnlyFields = Array.from(fieldTypes.entries())
      .filter(([, types]) => types.has("enum") && types.size === 1)
      .map(([name]) => name);
    for (const field of Array.from(numericFields)) {
      const name = escapeRegExp(field);
      if (new RegExp(`${name}=[^\\n]*(?:"A"\\.repeat|""|test-)`, "i").test(boundaryContent) ||
        new RegExp(`${name}:\\s*"[^"]*"`, "i").test(boundaryContent)) {
        failures.push(`Generated string boundary values for numeric field ${field}`);
      }
    }
    for (const field of enumOnlyFields) {
      const name = escapeRegExp(field);
      if (new RegExp(`${name}=[^\\n]*\\b-?\\d+(?:\\.\\d+)?\\b`, "i").test(boundaryContent)) {
        failures.push(`Generated numeric boundary values for enum field ${field}`);
      }
    }
  }

  if (!allContent.includes("playwright test --list")) warnings.push("README/package output does not expose a test-list sanity command");
  if (!allContent.includes("What we did not test") && !allContent.includes("Nicht getestet")) warnings.push("Customer output should explain what was not tested");
  if (!allContent.includes("Evidence") && !allContent.includes("evidence")) warnings.push("Customer output should include evidence notes");
  if (!adapter.supported) failures.push("No supported stack adapter detected");

  const compileClean = failures.length === 0;
  const hasEnvWarnings = warnings.some((warning) => /env|credential|Evidence|tested/i.test(warning));
  const readiness: GeneratedSuiteReadiness = !adapter.supported
    ? "unsupported"
    : !compileClean
      ? "draft_only"
      : hasEnvWarnings
        ? "compiles_needs_env"
        : "ready_to_merge";

  return {
    readiness,
    passed: compileClean && readiness !== "unsupported",
    checkedFiles: entries.length,
    failures,
    warnings,
    evidence,
  };
}
