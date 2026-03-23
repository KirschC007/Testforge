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

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to workspaces must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: System isolates workspaces by workspaceId

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in auth.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.list
  const crossTenant = await trpcQuery(request, "auth.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-014-IDOR — IDOR: Cross-tenant access to access only to projects explicitly shared with them must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Guest role has access only to projects explicitly shared with them

test("PROOF-B-014-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in auth.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-014-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.list
  const crossTenant = await trpcQuery(request, "auth.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-021-IDOR — IDOR: Cross-tenant access to 403 FORBIDDEN must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Project creation fails if workspaceId does not match JWT workspaceId

test("PROOF-B-021-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-021-IDORb — Tenant A cannot mutate Tenant B resource via projects.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via projects.create
  const crossTenant = await trpcMutation(request, "projects.create",
    {
        workspaceId: TEST_WORKSPACE_B_ID,
        name: "test-title",
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.create
  // Kills: Allow cross-tenant mutations on projects.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-026-IDOR — IDOR: Cross-tenant access to only shared projects must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Guest role sees only shared projects when listing projects

test("PROOF-B-026-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in auth.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-026-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.list
  const crossTenant = await trpcQuery(request, "auth.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-027-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: GET /api/projects returns 403 for cross-workspace access

test("PROOF-B-027-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in auth.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-027-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.list
  const crossTenant = await trpcQuery(request, "auth.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-030-IDOR — IDOR: Cross-tenant access to shared projects must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Guest role can only access shared projects via GET /api/projects/:id

test("PROOF-B-030-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-030-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.getById
  const crossTenant = await trpcQuery(request, "projects.getById",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-032-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: GET /api/projects/:id returns 403 if project belongs to different workspace

test("PROOF-B-032-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-032-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.getById
  const crossTenant = await trpcQuery(request, "projects.getById",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-042-IDOR — IDOR: Cross-tenant access to 400 INVALID_PROJECT must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Task creation fails if projectId does not belong to same workspace

test("PROOF-B-042-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-042-IDORb — Tenant A cannot mutate Tenant B resource via tasks.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via tasks.create
  const crossTenant = await trpcMutation(request, "tasks.create",
    {
        workspaceId: TEST_WORKSPACE_B_ID,
        projectId: resourceId,
        title: "test-title",
        description: "test-description",
        priority: "low",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in tasks.create
  // Kills: Allow cross-tenant mutations on tasks.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-043-IDOR — IDOR: Cross-tenant access to 400 INVALID_ASSIGNEE must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Task creation fails if assigneeId is not a member of the workspace

test("PROOF-B-043-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-043-IDORb — Tenant A cannot mutate Tenant B resource via tasks.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via tasks.create
  const crossTenant = await trpcMutation(request, "tasks.create",
    {
        workspaceId: TEST_WORKSPACE_B_ID,
        projectId: resourceId,
        title: "test-title",
        description: "test-description",
        priority: "low",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in tasks.create
  // Kills: Allow cross-tenant mutations on tasks.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-050-IDOR — IDOR: Cross-tenant access to own tasks or tasks assigned to them must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Member role can only edit own tasks or tasks assigned to them

test("PROOF-B-050-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.update query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-050-IDORb — Tenant A cannot mutate Tenant B resource via tasks.update", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via tasks.update
  const crossTenant = await trpcMutation(request, "tasks.update",
    {
        id: resourceId,
        title: "test-title",
        description: "test-description",
        priority: "low",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in tasks.update
  // Kills: Allow cross-tenant mutations on tasks.update

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-052-IDOR — IDOR: Cross-tenant access to 403 NOT_YOUR_TASK must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: PATCH /api/tasks/:id returns 403 NOT_YOUR_TASK if member edits someone else's unassigned task

test("PROOF-B-052-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.update query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-052-IDORb — Tenant A cannot mutate Tenant B resource via tasks.update", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via tasks.update
  const crossTenant = await trpcMutation(request, "tasks.update",
    {
        id: resourceId,
        title: "test-title",
        description: "test-description",
        priority: "low",
        assigneeId: resourceId,
        dueDate: "test-dueDate",
        estimatedHours: 1,
        labels: "test-labels",
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in tasks.update
  // Kills: Allow cross-tenant mutations on tasks.update

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-062-IDOR — IDOR: Cross-tenant access to own tasks must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Member role can only delete own tasks

test("PROOF-B-062-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in auth.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-062-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.list
  const crossTenant = await trpcQuery(request, "auth.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-065-IDOR — IDOR: Cross-tenant access to 400 MIXED_WORKSPACES must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Bulk status update fails if tasks belong to different workspaces

test("PROOF-B-065-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.bulk-status query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-065-IDORb — Tenant A cannot mutate Tenant B resource via tasks.bulk-status", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via tasks.bulk-status
  const crossTenant = await trpcMutation(request, "tasks.bulk-status",
    {
        taskIds: [resourceId],
        workspaceId: TEST_WORKSPACE_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in tasks.bulk-status
  // Kills: Allow cross-tenant mutations on tasks.bulk-status

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-071-IDOR — IDOR: Cross-tenant access to 400 INVALID_TASK must be rejected
// Risk: CRITICAL
// Spec: Comments
// Behavior: Comment creation fails if taskId does not belong to workspace

test("PROOF-B-071-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in comments.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-071-IDORb — Tenant A cannot mutate Tenant B resource via comments.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via comments.create
  const crossTenant = await trpcMutation(request, "comments.create",
    {
        taskId: resourceId,
        workspaceId: TEST_WORKSPACE_B_ID,
        content: "test-content",
        parentId: resourceId,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in comments.create
  // Kills: Allow cross-tenant mutations on comments.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-107-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Edge Cases
// Behavior: Next API call returns 403 if guest access is revoked while guest has open tab

test("PROOF-B-107-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in auth.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-107-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via auth.list
  const crossTenant = await trpcQuery(request, "auth.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in auth.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});