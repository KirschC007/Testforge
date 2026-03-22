/**
 * TestForge Industry Proof Packs (S5-2)
 *
 * Pre-configured proof type sets for specific industries.
 * Each pack adds domain-specific risk hints, tags, and test templates
 * that are injected into the analysis pipeline.
 *
 * Available packs:
 *   - fintech:    PSD2, KYC/AML, SEPA, fraud detection, regulatory compliance
 *   - healthtech: HIPAA, HL7/FHIR, PHI access, audit trails
 *   - ecommerce:  PCI-DSS, inventory race conditions, coupon abuse, order state machines
 *   - saas:       Multi-tenancy, subscription billing, feature gates, usage metering
 */

export type IndustryPack = "fintech" | "healthtech" | "ecommerce" | "saas";

export interface ProofPackConfig {
  id: IndustryPack;
  name: string;
  description: string;
  additionalProofTypes: string[];
  riskHintBoosts: Record<string, number>; // proof_type → priority boost (0-100)
  requiredTags: string[];
  complianceFrameworks: string[];
  customTestPatterns: Array<{
    name: string;
    description: string;
    proofType: string;
    template: string;
  }>;
}

export const INDUSTRY_PACKS: Record<IndustryPack, ProofPackConfig> = {
  fintech: {
    id: "fintech",
    name: "FinTech Pack",
    description: "PSD2, KYC/AML, SEPA, fraud detection, and regulatory compliance tests",
    additionalProofTypes: ["idor", "auth_matrix", "business_logic", "data_integrity", "idempotency", "concurrency"],
    riskHintBoosts: {
      idor: 30,
      auth_matrix: 30,
      business_logic: 25,
      data_integrity: 25,
      idempotency: 20,
      concurrency: 20,
    },
    requiredTags: ["payment", "transfer", "account", "balance", "kyc", "aml", "psd2"],
    complianceFrameworks: ["PSD2", "KYC/AML", "GDPR", "DSGVO", "ISO 27001"],
    customTestPatterns: [
      {
        name: "Double-spend prevention",
        description: "Verify that concurrent payment requests cannot result in double-spending",
        proofType: "concurrency",
        template: `// Double-spend: send same payment twice concurrently
const [r1, r2] = await Promise.all([
  api.post('/payments', { amount: 100, currency: 'EUR', idempotencyKey: 'pay-001' }),
  api.post('/payments', { amount: 100, currency: 'EUR', idempotencyKey: 'pay-001' }),
]);
// Only one should succeed
const successes = [r1, r2].filter(r => r.status === 200).length;
expect(successes).toBe(1);`,
      },
      {
        name: "KYC gate enforcement",
        description: "Verify that unverified users cannot access financial operations",
        proofType: "auth_matrix",
        template: `// KYC gate: unverified user cannot initiate transfer
const unverifiedToken = await getUnverifiedUserToken();
const r = await api.post('/transfers', { amount: 500 }, { headers: { Authorization: \`Bearer \${unverifiedToken}\` } });
expect(r.status).toBe(403);
expect(r.data.code).toMatch(/kyc_required|verification_required/i);`,
      },
      {
        name: "SEPA idempotency",
        description: "Verify SEPA transfers are idempotent with the same idempotency key",
        proofType: "idempotency",
        template: `// SEPA idempotency
const key = 'sepa-' + Date.now();
const r1 = await api.post('/sepa/transfers', { iban: 'DE89370400440532013000', amount: 100 }, { headers: { 'Idempotency-Key': key } });
const r2 = await api.post('/sepa/transfers', { iban: 'DE89370400440532013000', amount: 100 }, { headers: { 'Idempotency-Key': key } });
expect(r1.data.transferId).toBe(r2.data.transferId);`,
      },
    ],
  },

  healthtech: {
    id: "healthtech",
    name: "HealthTech Pack",
    description: "HIPAA, HL7/FHIR, PHI access control, audit trail, and patient data protection",
    additionalProofTypes: ["idor", "auth_matrix", "dsgvo", "data_integrity", "rbac"],
    riskHintBoosts: {
      idor: 40,
      auth_matrix: 35,
      dsgvo: 30,
      data_integrity: 25,
      rbac: 30,
    },
    requiredTags: ["patient", "health", "medical", "fhir", "phi", "record", "prescription"],
    complianceFrameworks: ["HIPAA", "HL7 FHIR R4", "GDPR", "DSGVO", "ISO 27799"],
    customTestPatterns: [
      {
        name: "PHI cross-patient isolation",
        description: "Verify that patient A cannot access patient B's health records",
        proofType: "idor",
        template: `// PHI isolation: patient A cannot read patient B records
const patientAToken = await getPatientToken('patient-a');
const patientBId = 'patient-b-id';
const r = await api.get(\`/patients/\${patientBId}/records\`, { headers: { Authorization: \`Bearer \${patientAToken}\` } });
expect(r.status).toBe(403);`,
      },
      {
        name: "Audit trail completeness",
        description: "Verify that all PHI access is logged in the audit trail",
        proofType: "data_integrity",
        template: `// Audit trail: every PHI read creates an audit log entry
const before = await api.get('/audit-logs?limit=1');
await api.get('/patients/test-patient/records');
const after = await api.get('/audit-logs?limit=1');
expect(after.data.total).toBe(before.data.total + 1);`,
      },
      {
        name: "Role-based PHI access",
        description: "Verify that nurses cannot access billing records and billing staff cannot access clinical notes",
        proofType: "rbac",
        template: `// RBAC: nurse cannot access billing, billing cannot access clinical notes
const nurseToken = await getRoleToken('nurse');
const billingR = await api.get('/billing/invoices', { headers: { Authorization: \`Bearer \${nurseToken}\` } });
expect(billingR.status).toBe(403);`,
      },
    ],
  },

  ecommerce: {
    id: "ecommerce",
    name: "eCommerce Pack",
    description: "PCI-DSS, inventory race conditions, coupon abuse, order state machines, and cart manipulation",
    additionalProofTypes: ["concurrency", "business_logic", "status_transition", "idempotency", "boundary"],
    riskHintBoosts: {
      concurrency: 35,
      business_logic: 30,
      status_transition: 25,
      idempotency: 20,
      boundary: 20,
    },
    requiredTags: ["order", "cart", "payment", "inventory", "coupon", "discount", "checkout"],
    complianceFrameworks: ["PCI-DSS", "GDPR", "DSGVO"],
    customTestPatterns: [
      {
        name: "Inventory race condition",
        description: "Verify that concurrent purchases of the last item in stock don't oversell",
        proofType: "concurrency",
        template: `// Inventory race: 10 concurrent purchases of 1 remaining item
const results = await Promise.all(
  Array.from({ length: 10 }, () => api.post('/cart/checkout', { productId: 'last-item', quantity: 1 }))
);
const successes = results.filter(r => r.status === 200).length;
expect(successes).toBeLessThanOrEqual(1);`,
      },
      {
        name: "Coupon abuse prevention",
        description: "Verify that single-use coupons cannot be used multiple times",
        proofType: "business_logic",
        template: `// Coupon abuse: single-use coupon cannot be applied twice
const coupon = 'SINGLE-USE-001';
const r1 = await api.post('/orders', { coupon });
expect(r1.status).toBe(200);
const r2 = await api.post('/orders', { coupon });
expect(r2.status).toBe(400);
expect(r2.data.error).toMatch(/coupon.*used|already.*redeemed/i);`,
      },
      {
        name: "Order state machine",
        description: "Verify that orders cannot skip states (e.g., pending → shipped without payment)",
        proofType: "status_transition",
        template: `// Order state machine: cannot ship without payment
const order = await api.post('/orders', { items: [{ id: 'prod-1', qty: 1 }] });
expect(order.data.status).toBe('pending');
// Try to skip to shipped
const r = await api.patch(\`/orders/\${order.data.id}\`, { status: 'shipped' });
expect(r.status).toBe(400);
expect(r.data.error).toMatch(/invalid.*transition|payment.*required/i);`,
      },
    ],
  },

  saas: {
    id: "saas",
    name: "SaaS Pack",
    description: "Multi-tenancy isolation, subscription billing, feature gates, usage metering, and plan enforcement",
    additionalProofTypes: ["idor", "feature_gate", "rate_limit", "business_logic", "auth_matrix"],
    riskHintBoosts: {
      idor: 30,
      feature_gate: 35,
      rate_limit: 25,
      business_logic: 20,
      auth_matrix: 25,
    },
    requiredTags: ["tenant", "workspace", "subscription", "plan", "feature", "quota", "billing"],
    complianceFrameworks: ["SOC 2 Type II", "ISO 27001", "GDPR"],
    customTestPatterns: [
      {
        name: "Tenant data isolation",
        description: "Verify that tenant A cannot access tenant B's data via any endpoint",
        proofType: "idor",
        template: `// Tenant isolation: tenant A cannot access tenant B resources
const tenantAToken = await getTenantToken('tenant-a');
const tenantBResourceId = await getTenantBResourceId();
const r = await api.get(\`/resources/\${tenantBResourceId}\`, { headers: { Authorization: \`Bearer \${tenantAToken}\` } });
expect(r.status).toBe(403);`,
      },
      {
        name: "Feature gate enforcement",
        description: "Verify that free-tier users cannot access pro features",
        proofType: "feature_gate",
        template: `// Feature gate: free plan cannot use pro features
const freeToken = await getPlanToken('free');
const r = await api.post('/exports/csv', {}, { headers: { Authorization: \`Bearer \${freeToken}\` } });
expect(r.status).toBe(402);
expect(r.data.error).toMatch(/upgrade|plan.*required|feature.*not.*available/i);`,
      },
      {
        name: "Usage quota enforcement",
        description: "Verify that usage limits are enforced and not bypassable",
        proofType: "rate_limit",
        template: `// Usage quota: cannot exceed plan limits
const token = await getPlanToken('free');
const limit = 3; // free plan limit
for (let i = 0; i < limit; i++) {
  await api.post('/analyses', { spec: 'test' }, { headers: { Authorization: \`Bearer \${token}\` } });
}
const r = await api.post('/analyses', { spec: 'test' }, { headers: { Authorization: \`Bearer \${token}\` } });
expect(r.status).toBe(429);`,
      },
    ],
  },
};

/**
 * Get the proof pack configuration for a given industry.
 */
export function getProofPack(industry: IndustryPack): ProofPackConfig {
  return INDUSTRY_PACKS[industry];
}

/**
 * Get all available industry packs as a list.
 */
export function listProofPacks(): Array<{ id: IndustryPack; name: string; description: string }> {
  return Object.values(INDUSTRY_PACKS).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
}

/**
 * Merge a proof pack's configuration into an analysis job config.
 * Boosts priority of relevant proof types and adds required tags.
 */
export function applyProofPack(
  industry: IndustryPack,
  baseProofTypes: string[]
): {
  proofTypes: string[];
  riskBoosts: Record<string, number>;
  complianceFrameworks: string[];
} {
  const pack = INDUSTRY_PACKS[industry];
  const merged = Array.from(new Set([...baseProofTypes, ...pack.additionalProofTypes]));
  return {
    proofTypes: merged,
    riskBoosts: pack.riskHintBoosts,
    complianceFrameworks: pack.complianceFrameworks,
  };
}
