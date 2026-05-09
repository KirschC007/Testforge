import { readFileSync } from "node:fs";
import path from "node:path";

const strict = process.env.LAUNCH_STRICT === "1";
const root = process.cwd();

const requiredFiles = [
  "client/src/pages/Legal.tsx",
  "client/src/components/PublicFooter.tsx",
  "docs/LAUNCH_READY.md",
];

const requiredRoutes = ["/impressum", "/datenschutz", "/agb", "/avv", "/launch-checklist"];
const app = readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
const legal = readFileSync(path.join(root, "client/src/pages/Legal.tsx"), "utf8");
const footer = readFileSync(path.join(root, "client/src/components/PublicFooter.tsx"), "utf8");

const failures: string[] = [];
const warnings: string[] = [];

for (const file of requiredFiles) {
  try {
    readFileSync(path.join(root, file), "utf8");
  } catch {
    failures.push(`Missing launch file: ${file}`);
  }
}

for (const route of requiredRoutes) {
  if (!app.includes(`path="${route}"`)) failures.push(`Missing public route: ${route}`);
  if (!footer.includes(`href="${route}"`)) failures.push(`Missing footer link: ${route}`);
}

for (const term of ["Datenschutzerklärung", "AGB", "Auftragsverarbeitungsvertrag", "Impressum"]) {
  if (!legal.includes(term)) failures.push(`Legal page missing term: ${term}`);
}

if (legal.includes("TODO:")) {
  const message = "Legal pages still contain TODO placeholders. Replace them with real operator, processor, retention and contact data before public launch.";
  if (strict) failures.push(message);
  else warnings.push(message);
}

if (failures.length > 0) {
  console.error("Launch readiness verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Launch readiness verification passed.");
for (const warning of warnings) console.warn(`Warning: ${warning}`);
