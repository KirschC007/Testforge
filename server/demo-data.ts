/**
 * Pre-computed demo analysis for the ShopCore API spec.
 * This is served via publicProcedure so unauthenticated users can explore TestForge.
 */

export const DEMO_ANALYSIS = {
  id: 0,
  projectName: "ShopCore Demo",
  specFileName: "shopcore-api.md",
  status: "done" as const,
  verdict: "10/10",
  proofCount: 18,
  progressLayer: 5,
  progressMessage: "Analysis complete",
  createdAt: new Date("2026-03-23T00:00:00Z"),
  updatedAt: new Date("2026-03-23T00:00:00Z"),

  // Layer 1: Structured IR
  layer1Json: {
    behaviors: [
      { id: "B01", name: "Create product with tenant isolation", endpoint: "POST /api/trpc/products.create", proofType: "idor", riskScore: 9, description: "shopId is tenant key — cross-tenant write must be blocked" },
      { id: "B02", name: "Create order with stock decrement", endpoint: "POST /api/trpc/orders.create", proofType: "data_integrity", riskScore: 8, description: "Stock decrements atomically; if stock < quantity return 400" },
      { id: "B03", name: "Get order by ID — tenant check", endpoint: "GET /api/trpc/orders.getById", proofType: "idor", riskScore: 9, description: "Returns 403 if order belongs to different shopId" },
      { id: "B04", name: "Update order status — state machine", endpoint: "POST /api/trpc/orders.updateStatus", proofType: "status_machine", riskScore: 8, description: "pending→processing→shipped→delivered; no skipping, no reverse" },
      { id: "B05", name: "Anonymize customer — GDPR", endpoint: "DELETE /api/trpc/customers.anonymize", proofType: "data_integrity", riskScore: 7, description: "Permanently anonymizes PII; must be tenant-scoped" },
      { id: "B06", name: "Export shop data — GDPR", endpoint: "GET /api/trpc/shop.exportData", proofType: "idor", riskScore: 9, description: "Must only return data for requesting shopId" },
      { id: "B07", name: "Auth required on all endpoints", endpoint: "*", proofType: "auth_matrix", riskScore: 8, description: "Bearer token required; 401 on missing/invalid token" },
      { id: "B08", name: "Rate limiting on auth failures", endpoint: "*", proofType: "auth_matrix", riskScore: 7, description: "Max 10 failed auth attempts per minute per IP" },
      { id: "B09", name: "Stock invariant: never below 0", endpoint: "POST /api/trpc/orders.create", proofType: "data_integrity", riskScore: 9, description: "Concurrent orders must not drive stock negative" },
      { id: "B10", name: "Order total invariant", endpoint: "POST /api/trpc/orders.create", proofType: "data_integrity", riskScore: 7, description: "total = sum(price × quantity) for all items" },
      { id: "B11", name: "Cancelled order is terminal", endpoint: "POST /api/trpc/orders.updateStatus", proofType: "status_machine", riskScore: 8, description: "Cancelled orders cannot be updated to any other status" },
      { id: "B12", name: "Cross-tenant product read", endpoint: "POST /api/trpc/products.create", proofType: "idor", riskScore: 9, description: "Cannot read products from another shopId" },
      { id: "B13", name: "Concurrent stock decrement", endpoint: "POST /api/trpc/orders.create", proofType: "concurrency", riskScore: 9, description: "Two simultaneous orders for last item — only one should succeed" },
      { id: "B14", name: "CSRF on state-changing endpoints", endpoint: "POST *", proofType: "csrf", riskScore: 7, description: "POST endpoints must validate CSRF token or use SameSite cookies" },
      { id: "B15", name: "SQL injection on product name", endpoint: "POST /api/trpc/products.create", proofType: "sqli", riskScore: 8, description: "name field must be sanitized; no raw SQL interpolation" },
      { id: "B16", name: "XSS in product name output", endpoint: "POST /api/trpc/products.create", proofType: "xss", riskScore: 7, description: "name field in responses must be HTML-escaped" },
      { id: "B17", name: "Idempotency of order creation", endpoint: "POST /api/trpc/orders.create", proofType: "idempotency", riskScore: 7, description: "Duplicate order submissions must not double-charge" },
      { id: "B18", name: "Feature gate: export requires paid plan", endpoint: "GET /api/trpc/shop.exportData", proofType: "feature_gate", riskScore: 6, description: "Data export only available on paid plans" },
    ],
    apiEndpoints: [
      { method: "POST", path: "/api/trpc/products.create" },
      { method: "POST", path: "/api/trpc/orders.create" },
      { method: "GET",  path: "/api/trpc/orders.getById" },
      { method: "POST", path: "/api/trpc/orders.updateStatus" },
      { method: "DELETE", path: "/api/trpc/customers.anonymize" },
      { method: "GET",  path: "/api/trpc/shop.exportData" },
    ],
    authModel: {
      type: "bearer",
      roles: [{ name: "admin", permissions: ["*"] }, { name: "user", permissions: ["read", "write:own"] }],
    },
    statusMachines: [
      { entity: "Order", states: ["pending", "processing", "shipped", "delivered", "cancelled"], transitions: [["pending","processing"],["processing","shipped"],["shipped","delivered"]] },
    ],
    tenantKey: "shopId",
    invariants: ["stock >= 0", "order.total = sum(item.price * item.quantity)", "cancelled orders are terminal"],
  },

  // Layer 2: Risk model
  layer2Json: {
    proofTargets: [
      { id: "PT01", behaviorId: "B01", proofType: "idor",          priority: 9, status: "approved", rationale: "Tenant isolation is the #1 risk in multi-tenant APIs" },
      { id: "PT02", behaviorId: "B03", proofType: "idor",          priority: 9, status: "approved", rationale: "Cross-tenant order read is a critical data leak" },
      { id: "PT03", behaviorId: "B06", proofType: "idor",          priority: 9, status: "approved", rationale: "GDPR export must be strictly tenant-scoped" },
      { id: "PT04", behaviorId: "B13", proofType: "concurrency",   priority: 9, status: "approved", rationale: "Race condition on last stock item is a classic e-commerce bug" },
      { id: "PT05", behaviorId: "B09", proofType: "data_integrity",priority: 9, status: "approved", rationale: "Stock invariant must hold under concurrent load" },
      { id: "PT06", behaviorId: "B02", proofType: "data_integrity",priority: 8, status: "approved", rationale: "Atomic stock decrement is business-critical" },
      { id: "PT07", behaviorId: "B04", proofType: "status_machine",priority: 8, status: "approved", rationale: "Invalid state transitions cause fulfillment bugs" },
      { id: "PT08", behaviorId: "B11", proofType: "status_machine",priority: 8, status: "approved", rationale: "Terminal state must be enforced" },
      { id: "PT09", behaviorId: "B07", proofType: "auth_matrix",   priority: 8, status: "approved", rationale: "All endpoints must require auth" },
      { id: "PT10", behaviorId: "B15", proofType: "sqli",          priority: 8, status: "approved", rationale: "Product name is user input — SQL injection surface" },
      { id: "PT11", behaviorId: "B12", proofType: "idor",          priority: 8, status: "approved", rationale: "Cross-tenant product read must be blocked" },
      { id: "PT12", behaviorId: "B05", proofType: "data_integrity",priority: 7, status: "approved", rationale: "GDPR anonymization must be complete and tenant-scoped" },
      { id: "PT13", behaviorId: "B08", proofType: "auth_matrix",   priority: 7, status: "approved", rationale: "Rate limiting prevents brute force" },
      { id: "PT14", behaviorId: "B14", proofType: "csrf",          priority: 7, status: "approved", rationale: "POST endpoints are CSRF surfaces" },
      { id: "PT15", behaviorId: "B16", proofType: "xss",           priority: 7, status: "approved", rationale: "Product name is reflected in responses" },
      { id: "PT16", behaviorId: "B10", proofType: "data_integrity",priority: 7, status: "approved", rationale: "Order total must match line items" },
      { id: "PT17", behaviorId: "B17", proofType: "idempotency",   priority: 7, status: "approved", rationale: "Duplicate submissions must be idempotent" },
      { id: "PT18", behaviorId: "B18", proofType: "feature_gate",  priority: 6, status: "approved", rationale: "Paid feature must be gated" },
    ],
  },

  // Generated test suite summary
  testFiles: [
    { name: "unit/idor.test.ts",          layer: "Unit",        tests: 4, description: "Tenant isolation unit tests" },
    { name: "unit/status-machine.test.ts",layer: "Unit",        tests: 3, description: "Order state machine unit tests" },
    { name: "integration/auth.test.ts",   layer: "Integration", tests: 3, description: "Auth matrix integration tests" },
    { name: "integration/idor.test.ts",   layer: "Integration", tests: 3, description: "Cross-tenant read/write integration tests" },
    { name: "e2e/order-flow.test.ts",     layer: "E2E",         tests: 2, description: "Full order lifecycle E2E tests" },
    { name: "security/sqli.test.ts",      layer: "Security",    tests: 1, description: "SQL injection security tests" },
    { name: "security/xss.test.ts",       layer: "Security",    tests: 1, description: "XSS security tests" },
    { name: "security/csrf.test.ts",      layer: "Security",    tests: 1, description: "CSRF security tests" },
    { name: "performance/concurrency.test.ts", layer: "Performance", tests: 1, description: "Concurrent stock decrement stress test" },
  ],

  report: `# TestForge Report — ShopCore Demo

## Executive Summary

**Verdict: 10/10** — 18 proof targets identified across 6 endpoints.

Critical risks: 5 IDOR vectors (tenant isolation), 1 concurrency race condition on stock.

## Top Findings

### CRITICAL: Tenant Isolation (IDOR)
- \`POST /products.create\` — shopId must be validated server-side, not trusted from client
- \`GET /orders.getById\` — must return 403 if order.shopId ≠ auth.shopId
- \`GET /shop.exportData\` — GDPR export must be strictly scoped to auth.shopId

### HIGH: Concurrency Race Condition
- \`POST /orders.create\` — two simultaneous orders for the last item in stock can both succeed, driving stock to -1

### HIGH: State Machine Violations
- \`POST /orders.updateStatus\` — shipped→pending must return 400; cancelled→any must return 400

## Generated Test Suite
- 18 proof targets → 18 test cases across 6 layers
- Unit, Integration, E2E, Security (SQLi/XSS/CSRF), Performance (concurrency)
`,
};

export type DemoAnalysis = typeof DEMO_ANALYSIS;
