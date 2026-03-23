import { runAnalysisJob } from "./server/analyzer/job-runner.ts";

const pmSpec = `# ProjectManager API Specification v1.0
## Overview
ProjectManager is a multi-tenant SaaS project management tool. Each workspace (tenant) is isolated by workspaceId.
## Authentication
- All endpoints require Authorization: Bearer <jwt> header
- JWT contains: userId, workspaceId, role (enum: owner | admin | member | viewer | guest)
## Roles & Permissions
- owner: full access
- admin: can manage members, projects, tasks
- member: can create/edit tasks
## Endpoints
### Tasks
#### POST /api/tasks/bulk-status
Update status of multiple tasks atomically.
- Auth: owner, admin
- Input: { taskIds: string[], status: enum(todo|in_progress|done), workspaceId }
- Business rule: Atomic — partial success not allowed
- Business rule: Bulk status update is atomic
`;

const result = await runAnalysisJob(pmSpec, "Debug-PM", (layer, msg) => {
  process.stdout.write(`  [L${layer}] ${msg}\n`);
});

// Find concurrency proofs
const concurrencyProofs = result.validatedSuite.proofs.filter(p => p.proofType === "concurrency");
console.log(`\n=== CONCURRENCY PROOFS: ${concurrencyProofs.length} ===`);
for (const p of concurrencyProofs) {
  console.log(`\n--- ${p.id} ---`);
  console.log(p.code.split('\n').slice(0, 30).join('\n'));
  console.log("...");
  console.log("Has beforeAll in describe:", p.code.includes("test.describe") && p.code.includes("test.beforeAll"));
}
