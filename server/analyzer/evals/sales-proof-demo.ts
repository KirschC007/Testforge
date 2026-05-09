import { parseCodeToIR } from "../code-parser";
import { buildRiskModel } from "../risk-model";
import { generateExtendedTestSuite } from "../extended-suite";
import { generateHelpers } from "../helpers-generator";
import { evaluateGeneratedSuiteQuality } from "../generated-suite-gate";

export interface SalesProofDemoResult {
  passed: boolean;
  phasesProved: number;
  totalPhases: number;
  readiness: string;
  proofTypes: string[];
  failures: string[];
}

export function runSalesProofDemo(): SalesProofDemoResult {
  const codeFiles = [
    { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0", "next-auth": "^5.0.0", zod: "^4.0.0" } }) },
    { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth'; import CredentialsProvider from 'next-auth/providers/credentials'; export const { handlers } = NextAuth({ providers: [CredentialsProvider({ authorize: async () => ({ id: '1' }) })] }); export const { GET, POST } = handlers;" },
    { path: "app/api/settings/modules/route.ts", content: "import { z } from 'zod'; const schema = z.object({ module: z.string(), enabled: z.boolean() }); export async function POST(req: Request){ const input = schema.parse(await req.json()); return Response.json({ ok: true, ...input }); } export async function GET(){ return Response.json({ modules: [] }); }" },
    { path: "app/api/executor/tasks/[id]/approve/route.ts", content: "import { z } from 'zod'; const schema = z.object({ id: z.string(), visibleChange: z.boolean().optional() }); export async function POST(req: Request){ const input = schema.parse(await req.json()); if (input.visibleChange) return Response.json({ error: 'requires_preview' }, { status: 422 }); return Response.json({ ok: true }); }" },
    { path: "app/api/meta/route.ts", content: "export async function GET(req: Request){ if (!req.headers.get('authorization')) return Response.json({ error: 'unauthorized' }, { status: 401 }); return Response.json({ version: 'demo' }); }" },
  ];
  const analysis = parseCodeToIR(codeFiles);
  const riskModel = buildRiskModel(analysis);
  const suite = generateExtendedTestSuite(analysis, []);
  const helpers = generateHelpers(analysis);
  const gate = evaluateGeneratedSuiteQuality(analysis, suite.files, { ...helpers, "README.md": suite.readme, "package.json": suite.packageJson } as never, codeFiles);
  const proofTypes = Array.from(new Set(riskModel.proofTargets.map((target) => target.proofType)));
  const failures: string[] = [];

  const phaseProofs = [
    analysis.supportedScope?.primaryStack.includes("Next") || analysis.supportedScope?.primaryStack.includes("TypeScript"),
    gate.evidence.some((item) => item.includes("adapter=next-auth-app-router")) ||
      analysis.ir.authModel?.loginEndpoint === "POST /api/auth/callback/credentials",
    !gate.failures.some((failure) => /fake tRPC|tenant fixtures|CRUD browser/.test(failure)),
    suite.files.length > 0 && Object.keys(helpers).length > 0,
    proofTypes.includes("auth_matrix") || proofTypes.includes("boundary") || proofTypes.includes("mass_assignment"),
    gate.readiness === "compiles_needs_env" || gate.readiness === "ready_to_merge",
    gate.warnings.some((warning) => /not tested|Evidence|tested/i.test(warning)) || suite.readme.includes("What we did not test"),
    suite.readme.includes("playwright test --list") && suite.packageJson.includes("test:list"),
  ];

  phaseProofs.forEach((ok, index) => {
    if (!ok) failures.push(`Phase ${index + 1} proof failed`);
  });
  failures.push(...gate.failures);

  return {
    passed: failures.length === 0,
    phasesProved: phaseProofs.filter(Boolean).length,
    totalPhases: 8,
    readiness: gate.readiness,
    proofTypes,
    failures,
  };
}
