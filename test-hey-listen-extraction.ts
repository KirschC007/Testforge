import { extractRoles, extractTenantModel, extractStates, extractTransitions } from "./server/analyzer/spec-regex-extractor";
import { readFileSync } from "fs";

const spec = readFileSync("/home/ubuntu/upload/hey-listen-MASTER-SPEC-v10.md", "utf-8");
console.log("Spec size:", spec.length, "chars");

// Roles
const roles = extractRoles(spec);
console.log("\n=== Roles found:", roles.length, "===");
console.log(roles);

// Filter to meaningful roles
const meaningfulRoles = roles.filter(r => {
  if (r.includes("idx_") || r.includes("_id") || r.endsWith("_sessions") || r === "username" || r === "users") return false;
  return true;
});
console.log("\nMeaningful roles:", meaningfulRoles);

// Tenant
const tenant = extractTenantModel(spec);
console.log("\n=== Tenant found:", tenant, "===");

// States
const states = extractStates(spec);
console.log("\n=== States found:", states.length, "===");
// Filter to likely reservation states
const reservationStates = states.filter(s => 
  ["CONFIRMED", "SEATED", "CANCELLED", "NO_SHOW", "COMPLETED", "WAITING", "NOTIFIED", "EXPIRED"].includes(s)
);
console.log("Reservation states:", reservationStates);
console.log("All states (first 30):", states.slice(0, 30));

// Transitions
const transitions = extractTransitions(spec);
console.log("\n=== Transitions found:", transitions.length, "===");
console.log(transitions.slice(0, 10));
