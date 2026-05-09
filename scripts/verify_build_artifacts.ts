import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), "dist", "public");
const indexPath = path.join(publicDir, "index.html");
const indexHtml = readFileSync(indexPath, "utf8");

const failures: string[] = [];
const indexBytes = statSync(indexPath).size;
const mainScriptMatch = indexHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
const mainScriptPath = mainScriptMatch?.[1]?.replace(/^\//, "");
const mainScriptBytes = mainScriptPath ? statSync(path.join(publicDir, mainScriptPath.replace(/^assets\//, "assets/"))).size : 0;

const maxIndexBytes = 10 * 1024;
const maxInitialScriptBytes = 260 * 1024;

if (indexBytes > maxIndexBytes) {
  failures.push(`index.html is ${indexBytes} bytes, expected <= ${maxIndexBytes}`);
}

if (!mainScriptPath) {
  failures.push("index.html does not reference a module entry script");
} else if (mainScriptBytes > maxInitialScriptBytes) {
  failures.push(`Initial module ${mainScriptPath} is ${mainScriptBytes} bytes, expected <= ${maxInitialScriptBytes}`);
}

for (const forbidden of ["__MANUS_HOST_DEV__", "manus-runtime", "%VITE_ANALYTICS_ENDPOINT%", "%VITE_ANALYTICS_WEBSITE_ID%"]) {
  if (indexHtml.includes(forbidden)) {
    failures.push(`index.html contains forbidden production marker: ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error("Build artifact verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Build artifact verification passed.");
console.log(`index.html: ${indexBytes} bytes`);
console.log(`initial module: ${mainScriptPath ?? "-"} (${mainScriptBytes} bytes)`);
