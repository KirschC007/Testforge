import { spawn } from "node:child_process";
import { releaseTestFiles } from "./release_test_files";

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
      ...releaseTestFiles,
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
