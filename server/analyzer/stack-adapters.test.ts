import { describe, expect, it } from "vitest";
import { classifyStackAdapter } from "./stack-adapters";
import { evaluateGeneratedSuiteQuality } from "./generated-suite-gate";
import type { AnalysisResult, ExtendedTestFile } from "./types";

describe("stack adapter classification", () => {
  it("identifies the customer-style Next/Auth.js App Router stack", () => {
    const result = classifyStackAdapter([
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "next-auth": "^5.0.0" } }) },
      { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth'; import CredentialsProvider from 'next-auth/providers/credentials';" },
    ]);

    expect(result.adapter).toBe("next-auth-app-router");
    expect(result.recommendedMode).toBe("conservative");
    expect(result.confidence).toBeGreaterThanOrEqual(90);
  });
});

describe("generated suite gate", () => {
  const analysis: AnalysisResult = {
    qualityScore: 8,
    specType: "code:Next.js",
    ir: {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: null,
      resources: [],
      apiEndpoints: [{ name: "POST /api/settings/models", method: "POST /api/settings/models", auth: "requireAuth", relatedBehaviors: [], inputFields: [], outputFields: ["ok"] }],
      authModel: { loginEndpoint: "POST /api/auth/callback/credentials", roles: [{ name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin@example.com", defaultPass: "TestPass2026x" }] },
      enums: {},
      statusMachine: null,
      userFlows: [],
    },
  };

  it("fails fake tRPC, invented tenant fixtures, and guessed CRUD pages", () => {
    const files: ExtendedTestFile[] = [
      {
        filename: "tests/unit/settings.test.ts",
        layer: "unit",
        description: "bad output",
        content: `import { test } from "@playwright/test";
test("bad", async () => {
  await fetch("/api/trpc/settings.update", { method: "POST", body: JSON.stringify({ tenantId: 1 }) });
  await page.goto("/settings/new");
});`,
      },
    ];

    const result = evaluateGeneratedSuiteQuality(analysis, files, {}, [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "next-auth": "^5.0.0" } }) },
      { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth';" },
    ]);

    expect(result.passed).toBe(false);
    expect(result.failures.join("\n")).toContain("tenant fixtures");
    expect(result.failures.join("\n")).toContain("fake tRPC");
    expect(result.failures.join("\n")).toContain("CRUD browser");
  });

  it("requires REST endpoint aliases when tests use normalized procedure names", () => {
    const files: ExtendedTestFile[] = [
      {
        filename: "tests/security/auth-matrix.spec.ts",
        layer: "security",
        description: "normalized route call",
        content: `import { test } from "@playwright/test";
import { trpcQuery } from "../../helpers/api";
test("model settings auth", async ({ request }) => {
  await trpcQuery(request, "settings.models", {});
});`,
      },
    ];
    const sourceFiles = [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "next-auth": "^5.0.0" } }) },
      { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth';" },
    ];

    const withoutAliases = evaluateGeneratedSuiteQuality(analysis, files, {
      "helpers/api.ts": "export async function trpcQuery() {}",
    }, sourceFiles);
    expect(withoutAliases.passed).toBe(false);
    expect(withoutAliases.failures.join("\n")).toContain("endpoint alias");

    const withAliases = evaluateGeneratedSuiteQuality(analysis, files, {
      "helpers/api.ts": `type EndpointAlias = { default: string; query?: string; mutation?: string };
const ENDPOINT_ALIASES: Record<string, EndpointAlias> = { "settings.models": { default: "POST /api/settings/models", mutation: "POST /api/settings/models" } };
function resolveProcedure(procedure: string, kind: "query" | "mutation") { const alias = ENDPOINT_ALIASES[procedure]; return !alias ? procedure : kind === "query" ? alias.query || alias.default : alias.mutation || alias.default; }
const headerShapes = ["set-cookie", "setCookie"];
export async function trpcQuery() {}`,
    }, sourceFiles);
    expect(withAliases.failures.join("\n")).not.toContain("endpoint alias");
  });
});
