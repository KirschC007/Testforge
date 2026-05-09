import { spawn } from "node:child_process";
import { releaseTestFiles } from "./release_test_files";

const args = ["vitest", "run", "--config", "vitest.release-coverage.config.ts", "--coverage", ...releaseTestFiles];

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  throw error;
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
