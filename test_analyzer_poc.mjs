import { parseSpec, buildRiskModel, generateProofs, validateProofs, generateHelpers, generateReport } from "./server/analyzer.ts";

const spec = `# BookingAPI Spec

## 1. Multi-Tenant Architecture
Each restaurant has a unique restaurantId. All data is scoped to restaurantId.
INVARIANT: Users can only access data belonging to their own restaurantId.

## 2. Reservation Status Transitions
Reservations follow this state machine:
- pending -> confirmed (by staff/admin)
- confirmed -> seated (when guest arrives)
- confirmed -> no_show (if guest does not arrive)
- seated -> completed (when guest leaves)
- any -> cancelled (by admin only)

## 3. API Endpoints (tRPC)
- reservations.create(restaurantId, guestName, partySize, date, time)
- reservations.updateStatus(id, restaurantId, status)
- reservations.getById(id, restaurantId)
- reservations.list(restaurantId, date?)
- guests.getByPhone(restaurantId, phone)
- auth.login(username, password)
- auth.logout()

## 4. Auth
Login via POST /api/trpc/auth.login. Returns session cookie.
Roles: admin (full access), staff (read + status update), guest (own reservations only).
CSRF: Double-submit cookie pattern. X-CSRF-Token header required for mutations.
`;

const analysis = await parseSpec(spec);
console.log("=== LAYER 1: SPEC PARSING ===");
console.log("Behaviors found:", analysis.ir.behaviors.length);
console.log("API Endpoints found:", analysis.ir.apiEndpoints.length);
if (analysis.ir.apiEndpoints.length > 0) {
  console.log("Endpoints:", analysis.ir.apiEndpoints.map(e => e.name).join(", "));
}
console.log("Auth model login:", analysis.ir.authModel?.loginEndpoint);
console.log("Auth model CSRF:", analysis.ir.authModel?.csrfPattern);

const riskModel = buildRiskModel(analysis);
console.log("\n=== LAYER 2: RISK MODEL ===");
console.log("Proof targets:", riskModel.proofTargets.length);
console.log("IDOR vectors:", riskModel.idorVectors);
console.log("CSRF endpoints:", riskModel.csrfEndpoints);

const rawProofs = await generateProofs(riskModel, analysis);
console.log("\n=== LAYER 3: PROOF GENERATION ===");
console.log("Raw proofs generated:", rawProofs.length);

const validated = validateProofs(rawProofs, riskModel.proofTargets.map(p => p.behaviorId));
console.log("\n=== LAYER 4: VALIDATION ===");
console.log("Passed:", validated.verdict.passed);
console.log("Failed:", validated.verdict.failed);
console.log("Score:", validated.verdict.score);
console.log("Discarded:", validated.discardedProofs.length);
if (validated.discardedProofs.length > 0) {
  validated.discardedProofs.forEach(d => console.log("  DISCARDED:", d.rawProof.id, "—", d.reason));
}

const helpers = generateHelpers(analysis);
console.log("\n=== HELPERS GENERATED ===");
console.log("Files:", Object.keys(helpers).join(", "));

console.log("\n--- helpers/api.ts (first 600 chars) ---");
console.log(helpers["helpers/api.ts"]?.slice(0, 600) ?? "MISSING");

console.log("\n--- Test files summary ---");
for (const proof of validated.proofs) {
  const lines = proof.code.split('\n').length;
  console.log(`  ${proof.filename}: ${lines} lines, score=${proof.mutationScore.toFixed(2)}`);
}
