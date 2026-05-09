import { parseCodeToIR, type CodeFile } from "../code-parser";
import { generateExtendedTestSuite } from "../extended-suite";
import { generateHelpers } from "../helpers-generator";
import { evaluateGeneratedSuiteQuality, type GeneratedSuiteGateResult } from "../generated-suite-gate";

export interface GeneratedSuiteQualityCase {
  name: string;
  codeFiles: CodeFile[];
  minReadiness: GeneratedSuiteGateResult["readiness"];
}

const readinessRank: Record<GeneratedSuiteGateResult["readiness"], number> = {
  unsupported: 0,
  draft_only: 1,
  compiles_needs_env: 2,
  ready_to_merge: 3,
};

export const GENERATED_SUITE_QUALITY_CASES: GeneratedSuiteQualityCase[] = [
  {
    name: "customer-seo-next-auth-single-tenant",
    minReadiness: "compiles_needs_env",
    codeFiles: [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "next-auth": "^5.0.0", zod: "^4.0.0" } }) },
      { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth'; import CredentialsProvider from 'next-auth/providers/credentials'; export const { handlers } = NextAuth({ providers: [CredentialsProvider({ authorize: async () => ({ id: '1' }) })] }); export const { GET, POST } = handlers;" },
      { path: "app/api/settings/models/route.ts", content: "import { z } from 'zod'; const schema = z.object({ provider: z.string() }); export async function GET(){ return Response.json({ models: [] }); } export async function POST(req: Request){ schema.parse(await req.json()); return Response.json({ ok: true }); }" },
      { path: "app/api/executor/tasks/[id]/approve/route.ts", content: "import { z } from 'zod'; const schema = z.object({ id: z.string() }); export async function POST(req: Request){ schema.parse(await req.json()); return Response.json({ ok: true }); }" },
      { path: "app/api/llm-visibility/route.ts", content: "import { z } from 'zod'; const schema = z.object({ targetDomain: z.string().url() }); export async function POST(req: Request){ schema.parse(await req.json()); return Response.json({ id: 'x' }); }" },
    ],
  },
  {
    name: "trpc-gold-tenant",
    minReadiness: "compiles_needs_env",
    codeFiles: [
      { path: "package.json", content: JSON.stringify({ dependencies: { "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" } }) },
      { path: "server/orders.ts", content: "import { z } from 'zod'; export const ordersRouter = createTRPCRouter({ create: protectedProcedure.input(z.object({ tenantId: z.number(), amount: z.number().min(1) })).mutation(async ({ input }) => ({ id: 1, ...input })), list: protectedProcedure.input(z.object({ tenantId: z.number() })).query(() => []) });" },
    ],
  },
];

export interface GeneratedSuiteQualityResult {
  name: string;
  passed: boolean;
  readiness: GeneratedSuiteGateResult["readiness"];
  failures: string[];
  warnings: string[];
}

export function runGeneratedSuiteQualitySuite(): GeneratedSuiteQualityResult[] {
  return GENERATED_SUITE_QUALITY_CASES.map((entry) => {
    const analysis = parseCodeToIR(entry.codeFiles);
    const suite = generateExtendedTestSuite(analysis, []);
    const helpers = generateHelpers(analysis);
    const gate = evaluateGeneratedSuiteQuality(analysis, suite.files, { ...helpers, "README.md": suite.readme, "package.json": suite.packageJson } as never, entry.codeFiles);
    const failures = [...gate.failures];
    if (readinessRank[gate.readiness] < readinessRank[entry.minReadiness]) {
      failures.push(`Expected readiness >= ${entry.minReadiness}, got ${gate.readiness}`);
    }
    return {
      name: entry.name,
      passed: failures.length === 0,
      readiness: gate.readiness,
      failures,
      warnings: gate.warnings,
    };
  });
}

export function summarizeGeneratedSuiteQuality(results: GeneratedSuiteQualityResult[]) {
  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
  };
}
