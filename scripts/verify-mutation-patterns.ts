/**
 * Verifies the 6 mutation patterns in mutation-sandbox.mjs actually MATCH
 * the source code in the generated helpers/api.ts. If a pattern doesn't match,
 * the mutation does nothing — the sandbox would silently report it as "skipped".
 *
 * This is the gap unit tests can't catch: the regexes look right, but do they
 * actually find anything in the real generated code?
 */
import { generateHelpers } from "../server/analyzer/helpers-generator";
import type { AnalysisResult } from "../server/analyzer/types";

const MUTATIONS = [
  { name: "Remove auth header",                   regex: /headers\["Authorization"\]\s*=\s*cookieHeader;/ },
  { name: "Always return status 200",             regex: /status:\s*response\.status\(\)/ },
  { name: "Strip cookie from request",            regex: /headers\["Cookie"\]\s*=\s*cookieHeader;/ },
  { name: "Skip ok() check on login",             regex: /if \(!response\.ok\(\)\)/ },
  { name: "Return null instead of error data",    regex: /return\s*\{\s*response,\s*data,\s*error/ },
  { name: "Always return Bearer prefix in cookie", regex: /return setCookie;/ },
];

const minimalAnalysis: AnalysisResult = {
  ir: {
    behaviors: [], invariants: [], ambiguities: [], contradictions: [],
    tenantModel: { tenantEntity: "tenant", tenantIdField: "tenantId" },
    resources: [], apiEndpoints: [], enums: {}, statusMachine: null,
    authModel: { loginEndpoint: "/api/trpc/auth.login", roles: [{ name: "admin", envUserVar: "X", envPassVar: "Y", defaultUser: "a", defaultPass: "b" }] },
  },
  qualityScore: 5, specType: "test",
};

const apiSrc = generateHelpers(minimalAnalysis)["helpers/api.ts"];
console.log("Verifying 6 mutation patterns against generated helpers/api.ts:\n");

let matched = 0;
for (const mut of MUTATIONS) {
  if (mut.regex.test(apiSrc)) {
    console.log(`  ✓ "${mut.name}" — pattern matches`);
    matched++;
  } else {
    console.log(`  ✗ "${mut.name}" — DOES NOT MATCH (mutation would be silently skipped)`);
  }
}

console.log(`\n${matched}/${MUTATIONS.length} mutations would actually apply`);
if (matched < MUTATIONS.length) {
  console.error(`\nERROR: ${MUTATIONS.length - matched} mutation(s) wouldn't fire — sandbox is broken!`);
  process.exit(1);
}
