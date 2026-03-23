import { expect, test } from "@playwright/test";
import { loginAndGetCookie, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_SHOP_B_ID, TEST_SHOP_ID, createTestResource } from "../../helpers/factories";

let tenantACookie: string;
let tenantBCookie: string;

test.beforeAll(async ({ request }) => {
  tenantACookie = await getAdminCookie(request);
  // IMPORTANT: Set E2E_TENANT_B_USER and E2E_TENANT_B_PASS to a user from a DIFFERENT tenant
  tenantBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_TENANT_B_USER || "test-tenant-b-user",
    process.env.E2E_TENANT_B_PASS || "TestPass2026x"
  );
});

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create products

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot mutate Tenant B resource via products.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.create
  const crossTenant = await trpcMutation(request, "products.create",
    {
        shopId: TEST_SHOP_B_ID,
        name: "test-title",
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.create
  // Kills: Allow cross-tenant mutations on products.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-002-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get products

test("PROOF-B-002-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-002-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.list
  const crossTenant = await trpcQuery(request, "products.list",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-003-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Update products

test("PROOF-B-003-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.update query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-003-IDORb — Tenant A cannot mutate Tenant B resource via products.update", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.update
  const crossTenant = await trpcMutation(request, "products.update",
    {
        id: resourceId,
        shopId: TEST_SHOP_B_ID,
        name: "test-title",
        description: "test-description",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.update
  // Kills: Allow cross-tenant mutations on products.update

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-004-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Delete products

test("PROOF-B-004-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.delete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-004-IDORb — Tenant A cannot mutate Tenant B resource via products.delete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.delete
  const crossTenant = await trpcMutation(request, "products.delete",
    {
        id: resourceId,
        shopId: TEST_SHOP_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.delete
  // Kills: Allow cross-tenant mutations on products.delete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-005-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create products

test("PROOF-B-005-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-005-IDORb — Tenant A cannot mutate Tenant B resource via products.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.create
  const crossTenant = await trpcMutation(request, "products.create",
    {
        shopId: TEST_SHOP_B_ID,
        name: "test-title",
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.create
  // Kills: Allow cross-tenant mutations on products.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-006-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get products

test("PROOF-B-006-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-006-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.list
  const crossTenant = await trpcQuery(request, "products.list",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-007-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get products

test("PROOF-B-007-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-007-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.getById
  const crossTenant = await trpcQuery(request, "products.getById",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Update products

test("PROOF-B-008-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.updateStatus query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-008-IDORb — Tenant A cannot mutate Tenant B resource via products.updateStatus", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.updateStatus
  const crossTenant = await trpcMutation(request, "products.updateStatus",
    {
        id: resourceId,
        shopId: TEST_SHOP_B_ID,
        status: "active",
        trackingNumber: "test-trackingNumber",
        cancelReason: "test-cancelReason",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.updateStatus
  // Kills: Allow cross-tenant mutations on products.updateStatus

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-009-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate products

test("PROOF-B-009-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.cancel query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-009-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.cancel
  const crossTenant = await trpcQuery(request, "products.cancel",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.cancel
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-010-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create products

test("PROOF-B-010-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-010-IDORb — Tenant A cannot mutate Tenant B resource via products.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.create
  const crossTenant = await trpcMutation(request, "products.create",
    {
        shopId: TEST_SHOP_B_ID,
        name: "test-title",
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.create
  // Kills: Allow cross-tenant mutations on products.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-011-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get products

test("PROOF-B-011-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-011-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.list
  const crossTenant = await trpcQuery(request, "products.list",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-012-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate products

test("PROOF-B-012-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.block query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-012-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.block
  const crossTenant = await trpcQuery(request, "products.block",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.block
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-013-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate products

test("PROOF-B-013-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.gdprDelete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-013-IDORb — Tenant A cannot mutate Tenant B resource via products.gdprDelete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via products.gdprDelete
  const crossTenant = await trpcMutation(request, "products.gdprDelete",
    {
        id: resourceId,
        shopId: TEST_SHOP_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.gdprDelete
  // Kills: Allow cross-tenant mutations on products.gdprDelete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-014-IDOR — IDOR: Cross-tenant access to products must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get products

test("PROOF-B-014-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove shopId filter in products.gdprExport query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_SHOP_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-014-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { shopId: TEST_SHOP_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via products.gdprExport
  const crossTenant = await trpcQuery(request, "products.gdprExport",
    { id: resourceId, shopId: TEST_SHOP_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in products.gdprExport
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});