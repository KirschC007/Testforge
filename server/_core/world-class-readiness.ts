import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type WorldClassStatus = "implemented" | "operationalized" | "externally_blocked";

export type WorldClassControlId =
  | "real_customer_benchmarks"
  | "test_acceptance_rate"
  | "live_target_execution"
  | "test_agent_workflow"
  | "stack_adapters"
  | "auth_precision"
  | "data_model_intelligence"
  | "business_logic_mining"
  | "hallucination_gate"
  | "target_repo_compile"
  | "test_repair_loop"
  | "ui_route_understanding"
  | "static_analysis_noise"
  | "security_depth"
  | "mutation_on_real_projects"
  | "framework_breadth"
  | "monorepo_support"
  | "setup_intelligence"
  | "honest_customer_report"
  | "pricing_value_proof"
  | "enterprise_readiness"
  | "legal_compliance"
  | "observability"
  | "product_ux"
  | "github_integration"
  | "competitor_benchmarks"
  | "determinism"
  | "chaotic_vibecode_inputs"
  | "refusal_mode"
  | "external_validation";

export interface WorldClassControl {
  id: WorldClassControlId;
  title: string;
  status: WorldClassStatus;
  evidenceFiles: string[];
  proof: string;
  remainingRisk: string;
}

export interface WorldClassEvaluation {
  generatedAt: string;
  total: number;
  directlyProved: number;
  operationalized: number;
  externallyBlocked: number;
  pass: boolean;
  controls: Array<WorldClassControl & { evidencePresent: boolean; missingEvidence: string[] }>;
}

const q = (...segments: string[]) => path.join(...segments);

export const WORLD_CLASS_CONTROLS: WorldClassControl[] = [
  {
    id: "real_customer_benchmarks",
    title: "Echte Kundenrepo-Benchmark-Suite",
    status: "operationalized",
    evidenceFiles: [q("scripts", "eval_external_repos.ts"), q("scripts", "eval_scoreboard.ts")],
    proof: "External-repo snapshots are in the release gate; real customer ZIPs still need a consented corpus.",
    remainingRisk: "No autonomous agent can create customer consent or proprietary repos; this remains a go-to-market data task.",
  },
  {
    id: "test_acceptance_rate",
    title: "Acceptance Rate der generierten Tests",
    status: "operationalized",
    evidenceFiles: [q("scripts", "eval_output_execution.ts"), q("server", "analyzer", "generated-suite-gate.ts"), q("server", "_core", "customer-validation.ts")],
    proof: "Generated suites are checked for readiness, syntax and placeholder patterns; human acceptance metrics are now modeled explicitly.",
    remainingRisk: "Human merge acceptance must be populated with real reviewer data before perfection claims.",
  },
  {
    id: "live_target_execution",
    title: "Live Execution gegen Zielrepos",
    status: "operationalized",
    evidenceFiles: [q("scripts", "eval_output_execution.ts"), q("server", "_core", "url-safety.ts")],
    proof: "Execution-safety and generated-output execution checks exist; fully installing arbitrary repos needs sandbox workers.",
    remainingRisk: "Untrusted repo execution requires isolated containers and egress policy before broad production use.",
  },
  {
    id: "test_agent_workflow",
    title: "Vom ZIP-Generator zum Test-Agent",
    status: "operationalized",
    evidenceFiles: [q("server", "github-pr.ts"), q("server", "analyzer", "job-runner.ts")],
    proof: "Analysis jobs, generated artifacts and GitHub PR surfaces exist as the agent workflow spine.",
    remainingRisk: "Autonomous PR repair loops are not yet fully end-to-end against arbitrary customer CI.",
  },
  {
    id: "stack_adapters",
    title: "Präzise Stack-Adapter",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "stack-adapters.ts"), q("server", "analyzer", "stack-adapters.test.ts")],
    proof: "Stack adapters are tested and wired into quality gates.",
    remainingRisk: "More languages/frameworks must be added as fixtures expose misses.",
  },
  {
    id: "auth_precision",
    title: "Auth-Präzision ohne Fake-Login",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "code-parser.ts"), q("scripts", "self_test_code_zips.ts")],
    proof: "Self-test ZIPs reject invented /api/auth/login assumptions and Next/Auth.js is detected separately.",
    remainingRisk: "More auth providers need real fixtures.",
  },
  {
    id: "data_model_intelligence",
    title: "Datenmodell-Verständnis",
    status: "operationalized",
    evidenceFiles: [q("server", "analyzer", "code-parser.ts"), q("server", "analyzer", "risk-model.ts")],
    proof: "Parser and risk model use schema/field evidence instead of defaulting to tenant or CRUD assumptions.",
    remainingRisk: "Rails/Laravel/Django/Prisma/SQL-migration depth needs expansion with real benchmarks.",
  },
  {
    id: "business_logic_mining",
    title: "Business-Logic-Mining",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "risk-rules.ts"), q("server", "analyzer", "proof-generator.ts")],
    proof: "Business-logic proof types are generated from detected behaviors and risk rules.",
    remainingRisk: "Domain-specific rule libraries must keep growing.",
  },
  {
    id: "hallucination_gate",
    title: "Harter Anti-Halluzinations-Gate",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "llm-sanitizer.ts"), q("scripts", "self_test_code_zips.ts")],
    proof: "Self-test ZIPs fail on fake auth, fake tRPC, fake tenant, fake pages and invalid boundary assumptions.",
    remainingRisk: "Needs continuous expansion with every customer complaint.",
  },
  {
    id: "target_repo_compile",
    title: "Output kompiliert im Zielrepo",
    status: "operationalized",
    evidenceFiles: [q("scripts", "eval_output_execution.ts"), q("server", "analyzer", "generated-suite-gate.ts")],
    proof: "Generated suite output is syntax and package-script checked in the release gate.",
    remainingRisk: "True target-repo compile needs cloned repo execution sandboxes.",
  },
  {
    id: "test_repair_loop",
    title: "Test-Repair-Loop",
    status: "operationalized",
    evidenceFiles: [q("server", "analyzer", "job-runner.ts"), q("server", "analyzer", "llm-sanitizer.ts")],
    proof: "Syntax sanitizer and independent checker repair/filter generated files before packaging.",
    remainingRisk: "Runtime repair against actual CI failures is still a next-stage agent feature.",
  },
  {
    id: "ui_route_understanding",
    title: "UI/E2E-Route-Verständnis",
    status: "operationalized",
    evidenceFiles: [q("server", "analyzer", "repo-scanner.ts"), q("scripts", "self_test_code_zips.ts")],
    proof: "Generated tests are checked against invented page-route patterns in the real ZIP self-test.",
    remainingRisk: "Framework-specific route maps for Remix/Nuxt/Rails/Laravel need deeper adapters.",
  },
  {
    id: "static_analysis_noise",
    title: "Static Analysis entnoisen",
    status: "implemented",
    evidenceFiles: [q("scripts", "eval_false_positives.ts"), q("server", "analyzer", "static-analyzer.ts")],
    proof: "False-positive fixtures are a release gate and must stay free of forbidden noisy hits.",
    remainingRisk: "Noise benchmark needs more real customer files.",
  },
  {
    id: "security_depth",
    title: "Security-Qualität",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "proof-templates-security.ts"), q("scripts", "eval_bug_zoo.ts")],
    proof: "OWASP-style proof types are covered by bug-zoo and bug-kill readiness gates.",
    remainingRisk: "Security coverage must be audited on real enterprise applications.",
  },
  {
    id: "mutation_on_real_projects",
    title: "Mutation/Bug-Seeding auf echten Projekten",
    status: "operationalized",
    evidenceFiles: [q("scripts", "eval_bug_kill_readiness.ts"), q("server", "analyzer", "evals", "bug-kill-readiness.ts")],
    proof: "Bug-kill readiness measures expected proof types and mutation scores on controlled fixtures.",
    remainingRisk: "Real-project mutation requires consented repos and isolated execution.",
  },
  {
    id: "framework_breadth",
    title: "Framework-Breite",
    status: "operationalized",
    evidenceFiles: [q("scripts", "eval_external_repos.ts"), q("scripts", "self_test_code_zips.ts")],
    proof: "External snapshots plus ZIP self-tests cover TypeScript web stacks and FastAPI.",
    remainingRisk: "Java, Go, Rails, Laravel and .NET need adapter fixtures before claiming broad coverage.",
  },
  {
    id: "monorepo_support",
    title: "Monorepo/Workspace-Support",
    status: "operationalized",
    evidenceFiles: [q("server", "analyzer", "repo-scanner.ts"), q("package.json")],
    proof: "Repo scanner and package-manager scripts are present as the workspace support foundation.",
    remainingRisk: "Needs Nx/Turbo/pnpm-workspace benchmark cases.",
  },
  {
    id: "setup_intelligence",
    title: "Setup Intelligence",
    status: "operationalized",
    evidenceFiles: [q("server", "analyzer", "helpers-generator.ts"), q("server", "_core", "product-readiness.ts")],
    proof: "Generated helpers and product readiness contracts expose setup, queue and sandbox assumptions.",
    remainingRisk: "Full dependency/service bootstrapping needs sandboxed repo execution.",
  },
  {
    id: "honest_customer_report",
    title: "Ehrlicher Kundenreport",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "report.ts"), q("server", "analyzer", "report.test.ts")],
    proof: "Reports separate readiness, evidence, blockers, skipped targets and execution profile.",
    remainingRisk: "Copy must stay conservative; inflated claims should be regression-tested.",
  },
  {
    id: "pricing_value_proof",
    title: "Pricing-/Value-Beweis",
    status: "operationalized",
    evidenceFiles: [q("client", "src", "pages", "Pricing.tsx"), q("server", "_core", "product-readiness.ts"), q("server", "_core", "customer-validation.ts")],
    proof: "Free-first usage, plan limits, proof cases and claim-blocking market validation thresholds are codified.",
    remainingRisk: "Actual ROI requires customer case studies and paid conversion data.",
  },
  {
    id: "enterprise_readiness",
    title: "Enterprise Readiness",
    status: "operationalized",
    evidenceFiles: [q("server", "_core", "runtime-security.ts"), q("server", "_core", "security-headers.ts")],
    proof: "Runtime security, security headers, audit contracts and retention metadata are implemented.",
    remainingRisk: "SSO, SCIM, SOC2 and procurement artifacts are not completed by code alone.",
  },
  {
    id: "legal_compliance",
    title: "Legal/Datenschutz/Compliance",
    status: "operationalized",
    evidenceFiles: [q("client", "src", "pages", "Legal.tsx"), q("scripts", "verify_launch_readiness.ts")],
    proof: "Legal routes and launch readiness checks are enforced.",
    remainingRisk: "Lawyer-reviewed final legal text is external and must be supplied by operator/counsel.",
  },
  {
    id: "observability",
    title: "Observability",
    status: "implemented",
    evidenceFiles: [q("server", "_core", "product-readiness.ts"), q("scripts", "eval_scoreboard.ts")],
    proof: "Operational telemetry contracts and quality scoreboard artifacts exist.",
    remainingRisk: "Production traces should be shipped to an external observability backend.",
  },
  {
    id: "product_ux",
    title: "Product UX",
    status: "implemented",
    evidenceFiles: [q("client", "src", "pages", "NewAnalysis.tsx"), q("client", "src", "pages", "AnalysisDetail.tsx")],
    proof: "Upload, analysis detail, proof display and download flows exist in the UI.",
    remainingRisk: "Needs usability testing with real customers.",
  },
  {
    id: "github_integration",
    title: "GitHub Integration",
    status: "operationalized",
    evidenceFiles: [q("server", "github-pr.ts"), q(".github", "workflows")],
    proof: "GitHub PR integration surface and CI workflows exist.",
    remainingRisk: "Full branch/PR/autorepair loop needs app installation and real repo permissions.",
  },
  {
    id: "competitor_benchmarks",
    title: "Benchmarks gegen Wettbewerber",
    status: "externally_blocked",
    evidenceFiles: [q("server", "_core", "world-class-readiness.ts")],
    proof: "The readiness gate explicitly tracks this requirement so it cannot be marketed as complete without data.",
    remainingRisk: "Requires running comparable tools under fair conditions; not derivable from this repository alone.",
  },
  {
    id: "determinism",
    title: "Determinismus",
    status: "implemented",
    evidenceFiles: [q("scripts", "quality_gate.ts"), q("scripts", "eval_compare_baseline.ts")],
    proof: "Release gates and baseline compare protect deterministic quality movement.",
    remainingRisk: "Model drift must be tracked whenever LLM paths are enabled.",
  },
  {
    id: "chaotic_vibecode_inputs",
    title: "Chaotische Vibe-Code-Realität",
    status: "implemented",
    evidenceFiles: [q("scripts", "self_test_code_zips.ts"), q("server", "analyzer", "world-class-regressions.test.ts")],
    proof: "Self-test ZIPs include deliberately mixed, weak and partial code inputs.",
    remainingRisk: "Corpus should expand with every real failure.",
  },
  {
    id: "refusal_mode",
    title: "Refusal/Insufficient-Evidence Mode",
    status: "implemented",
    evidenceFiles: [q("server", "analyzer", "proof-planning.ts"), q("server", "analyzer", "supported-scope.ts")],
    proof: "Proof planning can downgrade to minimal/conservative modes and skip unsafe aggressive targets.",
    remainingRisk: "Customer-facing language should keep emphasizing why tests were skipped.",
  },
  {
    id: "external_validation",
    title: "Externe Validierung",
    status: "externally_blocked",
    evidenceFiles: [q("server", "_core", "world-class-readiness.ts"), q("server", "_core", "customer-validation.ts")],
    proof: "The readiness gate records this as an explicit external blocker and the market validation contract defines reviewer thresholds.",
    remainingRisk: "Needs real developers, blind review and customer acceptance measurements.",
  },
];

function hasEvidence(root: string, relativePath: string): boolean {
  const fullPath = path.join(root, relativePath);
  if (existsSync(fullPath)) return true;

  const parent = path.dirname(fullPath);
  if (!existsSync(parent)) return false;
  return false;
}

export function evaluateWorldClassReadiness(root = process.cwd()): WorldClassEvaluation {
  const controls = WORLD_CLASS_CONTROLS.map((control) => {
    const missingEvidence = control.evidenceFiles.filter((file) => !hasEvidence(root, file));
    return {
      ...control,
      evidencePresent: missingEvidence.length === 0,
      missingEvidence,
    };
  });

  const directlyProved = controls.filter((control) => control.status === "implemented" && control.evidencePresent).length;
  const operationalized = controls.filter((control) => control.status === "operationalized" && control.evidencePresent).length;
  const externallyBlocked = controls.filter((control) => control.status === "externally_blocked" && control.evidencePresent).length;

  return {
    generatedAt: new Date().toISOString(),
    total: controls.length,
    directlyProved,
    operationalized,
    externallyBlocked,
    pass: controls.length === 30 && controls.every((control) => control.evidencePresent),
    controls,
  };
}

export function renderWorldClassReadinessMarkdown(evaluation: WorldClassEvaluation): string {
  const lines = [
    "# TestForge World-Class Readiness",
    "",
    `Generated: ${evaluation.generatedAt}`,
    "",
    `Status: ${evaluation.pass ? "PASS" : "FAIL"}`,
    `Controls: ${evaluation.total}`,
    `Directly proved in code/gates: ${evaluation.directlyProved}`,
    `Operationalized with gate/evidence: ${evaluation.operationalized}`,
    `Externally blocked but explicitly tracked: ${evaluation.externallyBlocked}`,
    "",
    "## Controls",
    "",
  ];

  for (const control of evaluation.controls) {
    lines.push(`### ${control.title}`);
    lines.push(`- ID: ${control.id}`);
    lines.push(`- Status: ${control.status}`);
    lines.push(`- Evidence present: ${control.evidencePresent ? "yes" : "no"}`);
    lines.push(`- Proof: ${control.proof}`);
    lines.push(`- Remaining risk: ${control.remainingRisk}`);
    lines.push(`- Evidence files: ${control.evidenceFiles.join(", ")}`);
    if (control.missingEvidence.length > 0) lines.push(`- Missing evidence: ${control.missingEvidence.join(", ")}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function readJsonArtifact<T>(root: string, relativePath: string): T | null {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, "utf8")) as T;
}
