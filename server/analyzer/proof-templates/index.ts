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
 * ── Property-Based ────────────────────────────────────────────────────────────
 *   property_based    → proof-generator.ts (generatePropertyTest) ← NEW
 *                       Uses fast-check: 50 random inputs × 5 invariants
 *                       P1: no 500, P2: shape consistent, P3: injection safe,
 *                       P4: numeric overflow safe, P5: concurrent idempotent
 *
 * ── True E2E (Phase 1) ────────────────────────────────────────────────────────
 *   e2e_smart_form    → proof-generator.ts (generateE2ESmartFormTest) ← NEW
 *                       F1: happy path fill+submit, F2: validation, F3: persistence
 *                       Uses smart selector fallbacks (label→placeholder→testid→name)
 *
 *   e2e_user_journey  → proof-generator.ts (generateE2EUserJourneyTest) ← NEW
 *                       Multi-step flows from IR.userFlows mapped to navigate/fill/click/verify
 *
 *   e2e_perf_budget   → proof-generator.ts (generateE2EPerfBudgetTest) ← NEW
 *                       Core Web Vitals: LCP<2.5s, CLS<0.1, TTFB<800ms
 *                       Uses native PerformanceObserver — no external deps
 *
 *   Cross-browser/responsive matrix (config-level, not separate ProofType):
 *     playwright.config.ts has 5 projects: chromium, firefox, webkit,
 *     mobile-chrome, mobile-safari — all run the same e2e tests.
 *
 * ── True E2E (Phase 2) ────────────────────────────────────────────────────────
 *   e2e_visual        → proof-generator.ts (generateE2EVisualTest) ← NEW
 *                       V1: full-page screenshot, V2: above-fold, V3: post-click
 *                       Uses toHaveScreenshot with maxDiffPixelRatio thresholds
 *
 *   e2e_network       → proof-generator.ts (generateE2ENetworkTest) ← NEW
 *                       N1: slow 3G (CDP throttling), N2: offline (setOffline),
 *                       N3: API 500s (page.route mock), N4: API timeout (delay)
 *
 *   e2e_a11y_full     → proof-generator.ts (generateE2EAccessibilityFullTest) ← NEW
 *                       5 categorized axe runs: A1 contrast, A2 keyboard,
 *                       A3 form labels, A4 heading structure, A5 ARIA correctness
 *
 * ── Intelligence Utilities (Phase 3) ──────────────────────────────────────────
 *   These are NOT ProofTypes — they are scripts in the generated package:
 *     analyze-flakiness.mjs   — npm run analyze:flakiness  (reads results.json)
 *     visual-diff-report.mjs  — npm run report:visual-diff (HTML diff report)
 *     codegen-wrapper.mjs     — npm run codegen            (Playwright codegen wrap)
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
