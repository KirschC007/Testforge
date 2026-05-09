import { spawn } from "node:child_process";

type GateStep = {
  name: string;
  command: string;
  args: string[];
};

const steps: GateStep[] = [
  { name: "Typecheck", command: "npm", args: ["run", "check"] },
  {
    name: "Focused regression tests",
    command: "npx",
    args: [
      "vitest",
      "run",
      "server/analyzer/static-analyzer.test.ts",
      "server/analyzer/evals/bug-zoo-eval.test.ts",
      "server/analyzer/evals/bug-kill-readiness.test.ts",
      "server/analyzer/evals/scoreboard.test.ts",
      "server/analyzer/evals/world-class-phases.test.ts",
      "server/analyzer/evals/scoreboard-compare.test.ts",
      "server/analyzer/stack-adapters.test.ts",
      "server/analyzer/buggy-system-smoke.test.ts",
      "server/analyzer/report.test.ts",
      "server/analyzer/risk-model-proof-types.test.ts",
      "server/analyzer/world-class-regressions.test.ts",
      "server/_core/customer-validation.test.ts",
      "server/_core/product-readiness.test.ts",
      "server/_core/world-class-readiness.test.ts",
      "server/_core/cookies.test.ts",
      "server/_core/env.test.ts",
      "server/_core/runtime-security.test.ts",
      "server/_core/security-headers.test.ts",
      "server/_core/storage-keys.test.ts",
      "server/_core/upload-security.test.ts",
      "server/_core/url-safety.test.ts",
    ],
  },
  { name: "Bug Zoo eval", command: "npm", args: ["run", "eval:bug-zoo", "--", "--json"] },
  { name: "Bug-kill readiness eval", command: "npm", args: ["run", "eval:bug-kill-readiness", "--", "--json"] },
  { name: "False-positive eval", command: "npm", args: ["run", "eval:false-positives", "--", "--json"] },
  { name: "External repo eval", command: "npm", args: ["run", "eval:external-repos", "--", "--json"] },
  { name: "Output execution eval", command: "npm", args: ["run", "eval:output-execution", "--", "--json"] },
  { name: "Quality scoreboard", command: "npm", args: ["run", "eval:scoreboard", "--", "--json"] },
  { name: "Baseline compare", command: "npm", args: ["run", "eval:compare-baseline", "--", "--json"] },
  { name: "Market validation contract", command: "npm", args: ["run", "verify:market-validation"] },
  { name: "Launch readiness", command: "npm", args: ["run", "verify:launch"] },
  { name: "World-class readiness", command: "npm", args: ["run", "verify:world-class"] },
  { name: "Production build", command: "npm", args: ["run", "build"] },
  { name: "Build artifact verification", command: "npm", args: ["run", "verify:build-artifacts"] },
];

function runStep(step: GateStep): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n[quality-gate] ${step.name}`);
    console.log(`[quality-gate] ${step.command} ${step.args.join(" ")}`);

    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.name} failed with exit code ${code}`));
    });
  });
}

for (const step of steps) {
  await runStep(step);
}

console.log("\n[quality-gate] PASS: all release gates completed.");
