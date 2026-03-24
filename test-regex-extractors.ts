import { extractRoles, extractTenantModel, extractStates } from "./server/analyzer/spec-regex-extractor";
import { readFileSync } from "fs";

const spec = readFileSync("/home/ubuntu/upload/hey-listen-MASTER-SPEC-v10.md", "utf-8");
console.log("Spec size:", spec.length, "chars");

const roles = extractRoles(spec);
console.log("\nRoles found:", roles);

const tenant = extractTenantModel(spec);
console.log("\nTenant found:", tenant);

const states = extractStates(spec);
console.log("\nStates found:", states.slice(0, 20));
console.log("Total states:", states.length);
