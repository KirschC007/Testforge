import { readFileSync } from "fs";
import { runAnalysisJob } from "./server/analyzer/job-runner";

async function main() {
  const specText = readFileSync("/home/ubuntu/upload/hey-listen-MASTER-SPEC-v10.md", "utf-8");
  console.log(`[Test] Spec size: ${specText.length} chars (${Math.round(specText.length / 1024)}KB)`);

  const result = await runAnalysisJob(specText, "HeyListen", async (layer, msg) => {
    console.log(`[Progress L${layer}] ${msg}`);
  });

  const ir = result.analysisResult.ir;
  const proofs = result.proofs;
  const specHealth = result.analysisResult.specHealth;

  console.log("\n=== RAW PIPELINE OUTPUT ===\n");
  console.log("--- IR Summary ---");
  console.log(`Endpoints: ${ir.apiEndpoints.length}`);
  console.log(`Behaviors: ${ir.behaviors.length}`);
  const roles = ir.authModel?.roles?.map(r => r.name) ?? [];
  console.log(`Roles: ${JSON.stringify(roles)}`);
  console.log(`TenantKey: ${ir.tenantKey ?? "none"}`);
  const sm = ir.statusMachine;
  console.log(`StatusMachine states: ${JSON.stringify(sm?.states ?? [])}`);
  console.log(`StatusMachine transitions: ${JSON.stringify(sm?.transitions ?? [])}`);
  console.log(`StatusMachines (array): ${ir.statusMachines?.length ?? 0}`);

  console.log("\n--- Spec Health ---");
  console.log(`Score: ${specHealth?.score ?? "?"}/100 (${specHealth?.grade ?? "?"})`);
  console.log(`Summary: ${specHealth?.summary ?? "?"}`);
  if (specHealth?.dimensions) {
    for (const [k, v] of Object.entries(specHealth.dimensions)) {
      console.log(`  ${k}: ${v}`);
    }
  }

  console.log("\n--- Proofs ---");
  console.log(`Total proofs: ${proofs.length}`);
  const validated = proofs.filter(p => p.status === "validated");
  const rejected = proofs.filter(p => p.status === "rejected");
  const pending = proofs.filter(p => p.status === "pending");
  console.log(`  validated: ${validated.length}`);
  console.log(`  rejected: ${rejected.length}`);
  console.log(`  pending: ${pending.length}`);

  console.log("\n--- Endpoint Names (first 20) ---");
  ir.apiEndpoints.slice(0, 20).forEach(ep => console.log(`  ${ep.name} [${ep.method}] auth=${ep.auth}`));

  console.log("\n=== END ===");
}

main().catch(e => { console.error(e); process.exit(1); });
