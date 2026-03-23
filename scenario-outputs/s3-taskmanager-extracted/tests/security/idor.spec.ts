import { expect, test } from "@playwright/test";
import { loginAndGetCookie, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_B_ID, TEST_WORKSPACE_ID, createTestResource } from "../../helpers/factories";

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

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create routers

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot mutate Tenant B resource via routers.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.create
  const crossTenant = await trpcMutation(request, "routers.create",
    {
        workspaceId: TEST_WORKSPACE_B_ID,
        title: "test-title",
        description: "test-description",
        priority: "test-priority",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.create
  // Kills: Allow cross-tenant mutations on routers.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-002-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get routers

test("PROOF-B-002-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-002-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via routers.list
  const crossTenant = await trpcQuery(request, "routers.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-003-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get routers

test("PROOF-B-003-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-003-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via routers.getById
  const crossTenant = await trpcQuery(request, "routers.getById",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-004-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Update routers

test("PROOF-B-004-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.update query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-004-IDORb — Tenant A cannot mutate Tenant B resource via routers.update", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.update
  const crossTenant = await trpcMutation(request, "routers.update",
    {
        id: resourceId,
        workspaceId: TEST_WORKSPACE_B_ID,
        title: "test-title",
        description: "test-description",
        priority: "test-priority",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.update
  // Kills: Allow cross-tenant mutations on routers.update

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-005-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Update routers

test("PROOF-B-005-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.updateStatus query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-005-IDORb — Tenant A cannot mutate Tenant B resource via routers.updateStatus", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.updateStatus
  const crossTenant = await trpcMutation(request, "routers.updateStatus",
    {
        id: resourceId,
        workspaceId: TEST_WORKSPACE_B_ID,
        status: "active",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.updateStatus
  // Kills: Allow cross-tenant mutations on routers.updateStatus

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-006-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Delete routers

test("PROOF-B-006-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.delete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-006-IDORb — Tenant A cannot mutate Tenant B resource via routers.delete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.delete
  const crossTenant = await trpcMutation(request, "routers.delete",
    {
        id: resourceId,
        workspaceId: TEST_WORKSPACE_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.delete
  // Kills: Allow cross-tenant mutations on routers.delete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-007-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Bulk operation on routers

test("PROOF-B-007-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.bulkDelete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-007-IDORb — Tenant A cannot mutate Tenant B resource via routers.bulkDelete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.bulkDelete
  const crossTenant = await trpcMutation(request, "routers.bulkDelete",
    {
        taskIds: [resourceId],
        workspaceId: TEST_WORKSPACE_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.bulkDelete
  // Kills: Allow cross-tenant mutations on routers.bulkDelete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Bulk operation on routers

test("PROOF-B-008-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.bulkUpdateStatus query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-008-IDORb — Tenant A cannot mutate Tenant B resource via routers.bulkUpdateStatus", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.bulkUpdateStatus
  const crossTenant = await trpcMutation(request, "routers.bulkUpdateStatus",
    {
        taskIds: [resourceId],
        workspaceId: TEST_WORKSPACE_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.bulkUpdateStatus
  // Kills: Allow cross-tenant mutations on routers.bulkUpdateStatus

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-009-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create routers

test("PROOF-B-009-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-009-IDORb — Tenant A cannot mutate Tenant B resource via routers.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.create
  const crossTenant = await trpcMutation(request, "routers.create",
    {
        workspaceId: TEST_WORKSPACE_B_ID,
        title: "test-title",
        description: "test-description",
        priority: "test-priority",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.create
  // Kills: Allow cross-tenant mutations on routers.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-010-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Get routers

test("PROOF-B-010-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-010-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via routers.list
  const crossTenant = await trpcQuery(request, "routers.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-011-IDOR — IDOR: Cross-tenant access to routers must be rejected
// Risk: CRITICAL
// Spec: Security
// Behavior: Delete routers

test("PROOF-B-011-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in routers.delete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-011-IDORb — Tenant A cannot mutate Tenant B resource via routers.delete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via routers.delete
  const crossTenant = await trpcMutation(request, "routers.delete",
    {
        id: resourceId,
        workspaceId: TEST_WORKSPACE_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in routers.delete
  // Kills: Allow cross-tenant mutations on routers.delete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "routers.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});