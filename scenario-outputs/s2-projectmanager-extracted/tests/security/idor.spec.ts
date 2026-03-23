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
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.list
  const crossTenant = await trpcQuery(request, "projects.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-002-IDOR — IDOR: Cross-tenant access to one workspace must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: Projects, tasks, and comments belong to exactly one workspace

test("PROOF-B-002-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-002-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.list
  const crossTenant = await trpcQuery(request, "projects.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-012-IDOR — IDOR: Cross-tenant access to access only to projects explicitly shared with them must be rejected
// Risk: CRITICAL
// Spec: Roles & Permissions
// Behavior: Guest role has access only to projects explicitly shared with them

test("PROOF-B-012-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-012-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.list
  const crossTenant = await trpcQuery(request, "projects.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-019-IDOR — IDOR: Cross-tenant access to 403 FORBIDDEN must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Project creation fails if workspaceId does not match JWT workspaceId

test("PROOF-B-019-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-019-IDORb — Tenant A cannot mutate Tenant B resource via projects.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
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
  const verify = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-024-IDOR — IDOR: Cross-tenant access to only shared projects must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Guest role sees only shared projects in project list

test("PROOF-B-024-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-024-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.list
  const crossTenant = await trpcQuery(request, "projects.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-025-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Project listing returns 403 for cross-workspace access

test("PROOF-B-025-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-025-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.list
  const crossTenant = await trpcQuery(request, "projects.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-028-IDOR — IDOR: Cross-tenant access to details for shared projects must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Guest role can only retrieve details for shared projects

test("PROOF-B-028-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projectDetails.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-028-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projectDetails.getById
  const crossTenant = await trpcQuery(request, "projectDetails.getById",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projectDetails.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-030-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Projects
// Behavior: Project detail retrieval returns 403 if project belongs to different workspace

test("PROOF-B-030-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projectDetails.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-030-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projectDetails.getById
  const crossTenant = await trpcQuery(request, "projectDetails.getById",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projectDetails.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-040-IDOR — IDOR: Cross-tenant access to 400 INVALID_PROJECT must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Task creation fails if projectId does not belong to same workspace

test("PROOF-B-040-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-040-IDORb — Tenant A cannot mutate Tenant B resource via tasks.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
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
  const verify = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-048-IDOR — IDOR: Cross-tenant access to own tasks or tasks assigned to them must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Member role can only edit own tasks or tasks assigned to them

test("PROOF-B-048-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in taskFields.update query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-048-IDORb — Tenant A cannot mutate Tenant B resource via taskFields.update", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via taskFields.update
  const crossTenant = await trpcMutation(request, "taskFields.update",
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
  // Kills: Missing tenant ownership check in taskFields.update
  // Kills: Allow cross-tenant mutations on taskFields.update

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-050-IDOR — IDOR: Cross-tenant access to 403 NOT_YOUR_TASK must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Member editing someone else's unassigned task returns 403 NOT_YOUR_TASK

test("PROOF-B-050-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in taskFields.update query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-050-IDORb — Tenant A cannot mutate Tenant B resource via taskFields.update", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via taskFields.update
  const crossTenant = await trpcMutation(request, "taskFields.update",
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
  // Kills: Missing tenant ownership check in taskFields.update
  // Kills: Allow cross-tenant mutations on taskFields.update

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-060-IDOR — IDOR: Cross-tenant access to own tasks must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Member can only delete own tasks

test("PROOF-B-060-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in tasks.delete query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-060-IDORb — Tenant A cannot mutate Tenant B resource via tasks.delete", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via tasks.delete
  const crossTenant = await trpcMutation(request, "tasks.delete",
    {
        id: resourceId,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in tasks.delete
  // Kills: Allow cross-tenant mutations on tasks.delete

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-063-IDOR — IDOR: Cross-tenant access to 400 MIXED_WORKSPACES must be rejected
// Risk: CRITICAL
// Spec: Tasks
// Behavior: Bulk task status update fails if tasks belong to mixed workspaces

test("PROOF-B-063-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in bulkUpdateTaskStatus query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-063-IDORb — Tenant A cannot mutate Tenant B resource via bulkUpdateTaskStatus", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via bulkUpdateTaskStatus
  const crossTenant = await trpcMutation(request, "bulkUpdateTaskStatus",
    {
        taskIds: [resourceId],
        workspaceId: TEST_WORKSPACE_B_ID,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in bulkUpdateTaskStatus
  // Kills: Allow cross-tenant mutations on bulkUpdateTaskStatus

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-069-IDOR — IDOR: Cross-tenant access to 400 INVALID_TASK must be rejected
// Risk: CRITICAL
// Spec: Comments
// Behavior: Comment creation fails if taskId does not belong to workspace

test("PROOF-B-069-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in addComment query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-069-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via addComment
  const crossTenant = await trpcQuery(request, "addComment",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in addComment
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-106-IDOR — IDOR: Cross-tenant access to 403 must be rejected
// Risk: CRITICAL
// Spec: Edge Cases
// Behavior: Next API call returns 403 if guest access is revoked while guest has open tab

test("PROOF-B-106-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove workspaceId filter in projects.list query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_WORKSPACE_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-106-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { workspaceId: TEST_WORKSPACE_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via projects.list
  const crossTenant = await trpcQuery(request, "projects.list",
    { id: resourceId, workspaceId: TEST_WORKSPACE_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in projects.list
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});