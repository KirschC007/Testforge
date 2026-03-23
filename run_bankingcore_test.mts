import { readFileSync } from "fs";
import { runAnalysisJob } from "./server/analyzer/index.js";

const spec = readFileSync("./test_bankingcore_spec.txt", "utf-8");
console.log(`\n${"=".repeat(60)}`);
console.log("TestForge — BankingCore API Analysis");
console.log(`Spec size: ${spec.length.toLocaleString()} chars`);
console.log("=".repeat(60));

const start = Date.now();

try {
  const result = await runAnalysisJob(
    spec,
    "BankingCore",
    async (layer, message, data) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`\n[${elapsed}s] Layer ${layer}: ${message}`);
      if (data?.analysisResult) {
        const ir = data.analysisResult as any;
        console.log(`  → Behaviors: ${ir.behaviors?.length ?? 0}`);
        console.log(`  → Endpoints: ${ir.apiEndpoints?.length ?? 0}`);
        console.log(`  → Status Machines: ${ir.statusMachines?.length ?? 0}`);
        console.log(`  → Tenant Key: ${ir.tenantKey ?? "none"}`);
        console.log(`  → Invariants: ${ir.invariants?.length ?? 0}`);
      }
      if (data?.riskModel) {
        const rm = data.riskModel as any;
        const targets = rm.proofTargets ?? [];
        console.log(`  → Proof Targets: ${targets.length}`);
        const byType: Record<string, number> = {};
        for (const t of targets) byType[t.proofType] = (byType[t.proofType] ?? 0) + 1;
        for (const [type, count] of Object.entries(byType)) {
          console.log(`    • ${type}: ${count}`);
        }
      }
    }
  );

  const totalTime = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  const { analysisResult, riskModel, validatedSuite, report, testFiles, extendedSuite } = result as any;

  console.log(`DONE in ${totalTime}s`);
  console.log(`Behaviors: ${analysisResult?.behaviors?.length ?? 0}`);
  console.log(`Proof Targets: ${riskModel?.proofTargets?.length ?? 0}`);
  console.log(`Validated Tests: ${validatedSuite?.proofs?.length ?? 0}`);
  console.log(`Extended Suite Files: ${extendedSuite?.files?.length ?? 0}`);

  console.log(`\nTest Files (Layer 3):`);
  for (const f of (testFiles ?? [])) {
    const lines = (f.content ?? '').split('\n').length;
    console.log(`  • ${f.filename} (${lines} lines)`);
  }

  console.log(`\nExtended Suite (6 Layers):`);
  for (const f of (extendedSuite?.files ?? [])) {
    const lines = (f.content ?? '').split('\n').length;
    console.log(`  • ${f.filename} — ${f.layer} (${lines} lines)`);
  }

  // Behaviours come from analysisResult directly
  const behaviors = analysisResult?.behaviors ?? [];
  console.log(`\nBehaviors (${behaviors.length} total):`);
  for (const b of behaviors.slice(0, 10)) {
    console.log(`  [${b.riskScore}/10] ${b.proofType.toUpperCase().padEnd(18)} ${b.name}`);
  }
  if (behaviors.length > 10) console.log(`  ... and ${behaviors.length - 10} more`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("REPORT EXCERPT (first 3000 chars):");
  console.log("=".repeat(60));
  console.log(result.report.slice(0, 3000));

} catch (err: any) {
  console.error("\nERROR:", err.message);
  console.error(err.stack);
  process.exit(1);
}
