/**
 * TestForge Proof Templates — Module Index
 *
 * This directory contains the test template generators, split by domain.
 * Each file is responsible for one group of related proof types.
 *
 * Template Registry (ProofType → File):
 *
 * ── Security ──────────────────────────────────────────────────────────────────
 *   idor              → proof-generator.ts (generateIDORTest)
 *   csrf              → proof-generator.ts (generateCSRFTest)
 *   auth_matrix       → proof-generator.ts (generateAuthMatrixTest)
 *   sql_injection     → proof-templates-security.ts
 *   hardcoded_secret  → proof-templates-security.ts
 *   negative_amount   → proof-templates-security.ts
 *   aml_bypass        → proof-templates-security.ts
 *   cross_tenant_chain→ proof-templates-security.ts
 *   mass_assignment   → proof-templates-security.ts
 *   concurrent_write  → proof-templates-security.ts
 *   graphql           → proof-templates/graphql.ts ← NEW
 *
 * ── Compliance ────────────────────────────────────────────────────────────────
 *   dsgvo             → proof-generator.ts (generateDSGVOTest)
 *   status_transition → proof-generator.ts (generateStatusTransitionTest)
 *   audit_log         → proof-templates/audit-log.ts ← NEW
 *
 * ── Business Logic ────────────────────────────────────────────────────────────
 *   boundary          → proof-generator.ts (generateBoundaryTest)
 *   business_logic    → proof-generator.ts (generateBusinessLogicTest)
 *   risk_scoring      → proof-generator.ts (generateRiskScoringTest)
 *   rate_limit        → proof-generator.ts (generateRateLimitTest)
 *   spec_drift        → proof-generator.ts (generateSpecDriftTest)
 *   feature_gate      → proof-generator.ts (generateFeatureGateTest)
 *
 * ── Concurrency ───────────────────────────────────────────────────────────────
 *   concurrency       → proof-generator.ts (generateConcurrencyTest)
 *   idempotency       → proof-generator.ts (generateIdempotencyTest)
 *
 * ── Integration ───────────────────────────────────────────────────────────────
 *   flow              → proof-generator.ts (generateFlowTest)
 *   cron_job          → proof-generator.ts (generateCronJobTest)
 *   webhook           → proof-generator.ts (generateWebhookTest)
 *   e2e_flow          → proof-generator.ts (generateE2EFlowTest)
 *   db_transaction    → proof-templates/db-transaction.ts ← NEW
 *
 * ── Accessibility ─────────────────────────────────────────────────────────────
 *   accessibility     → proof-templates/accessibility.ts ← NEW
 *
 * Adding a new ProofType:
 *   1. Add to PROOF_TYPES in types.ts
 *   2. Create proof-templates/<domain>.ts with the generator function
 *   3. Export from this index
 *   4. Add to FILENAME_MAP in proof-generator.ts (getFilename)
 *   5. Add to templateMap in proof-generator.ts (generateProofs)
 *   6. Add Risk Rule in risk-rules.ts
 *   7. Add keyword array in risk-model.ts resolveEndpoint
 */

// Re-export all template generators for external consumers
export {
  generateDBTransactionTest,
  generateAuditLogTest,
  generateGraphQLTest,
  generateAccessibilityTest,
} from "../proof-generator";

export {
  generateSQLInjectionTest,
  generateHardcodedSecretTest,
  generateNegativeAmountTest,
  generateAMLBypassTest,
  generateCrossTenantChainTest,
  generateConcurrentWriteTest,
  generateMassAssignmentTest,
} from "../proof-templates-security";

// Shared helpers used across all templates
export { getValidDefault, calcBoundaryValues, getPreferredRole, roleToCookieFn } from "../proof-generator";
