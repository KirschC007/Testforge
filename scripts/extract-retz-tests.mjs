/**
 * Extracts the 19 tests from the retz analysis (id=30002) using saved layer1Json + layer2Json.
 * Runs Layer 3 + 4+5 again and saves results to /home/ubuntu/retz-tests/
 */
import { createWriteStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { createRequire } from "module";
import { register } from "node:module";

// We need to run this via tsx since analyzer.ts is TypeScript
// This script is just a launcher
console.log("Use: npx tsx scripts/extract-retz-tests.mts");
