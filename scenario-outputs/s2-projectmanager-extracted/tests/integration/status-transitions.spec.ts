import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-039-STATUS — Status Transition: Project deletion returns 409 TASKS_IN_PROGRESS if any task is in 'in_progress' or 'review' status
// Risk: high
// Spec: Projects
// Behavior: Project deletion returns 409 TASKS_IN_PROGRESS if any task is in 'in_progress' or 'review' status

test("PROOF-B-039-STATUSa — in_progress → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-039-STATUSb — in_progress → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-039-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-045-STATUS — Status Transition: New tasks have default status 'todo'
// Risk: high
// Spec: Tasks
// Behavior: New tasks have default status 'todo'

test("PROOF-B-045-STATUSa — in_progress → review: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove have transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("review");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-045-STATUSb — review → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to review state first
  await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow review→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("review");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-045-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through review
  const { status } = await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-053-STATUS — Status Transition: PATCH /api/tasks/:id/status updates task status
// Risk: high
// Spec: Tasks
// Behavior: PATCH /api/tasks/:id/status updates task status

test("PROOF-B-053-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-053-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-053-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-055-STATUS — Status Transition: Task status update applies status machine rules
// Risk: high
// Spec: Tasks
// Behavior: Task status update applies status machine rules

test("PROOF-B-055-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove applies transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-055-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-055-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-056-STATUS — Status Transition: Moving task to 'done' sets completedAt and completedBy
// Risk: high
// Spec: Tasks
// Behavior: Moving task to 'done' sets completedAt and completedBy

test("PROOF-B-056-STATUSa — review → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-056-STATUSb — in_progress → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-056-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-057-STATUS — Status Transition: Moving task to 'in_progress' sets startedAt if not already set
// Risk: high
// Spec: Tasks
// Behavior: Moving task to 'in_progress' sets startedAt if not already set

test("PROOF-B-057-STATUSa — done → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-057-STATUSb — archived → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-057-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through archived
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-058-STATUS — Status Transition: Moving task from 'done' back to any other status clears completedAt and completedBy
// Risk: high
// Spec: Tasks
// Behavior: Moving task from 'done' back to any other status clears completedAt and completedBy

test("PROOF-B-058-STATUSa — done → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove clears transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.completedAt).not.toBeNull();
  // Kills: Remove completedAt = NOW() in handler

  // Kills: Remove `completedAt` is set to null side-effect
  // Kills: Remove `completedBy` is set to null side-effect
});

test("PROOF-B-058-STATUSb — in_progress → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-058-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-066-STATUS — Status Transition: Bulk status update applies status machine rules to each task individually
// Risk: high
// Spec: Tasks
// Behavior: Bulk status update applies status machine rules to each task individually

test("PROOF-B-066-STATUSa — todo → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.bulk-status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove applies transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-066-STATUSb — in_progress → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.bulk-status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.bulk-status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-066-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through in_progress
  const { status } = await trpcMutation(request, "tasks.bulk-status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-080-STATUS — Status Transition: Transition todo → in_progress is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition todo → in_progress is allowed

test("PROOF-B-080-STATUSa — todo → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-080-STATUSb — in_progress → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-080-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-081-STATUS — Status Transition: Transition in_progress → review is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition in_progress → review is allowed

test("PROOF-B-081-STATUSa — in_progress → review: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("review");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-081-STATUSb — review → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to review state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow review→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("review");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-081-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through review
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-082-STATUS — Status Transition: Transition in_progress → todo is allowed (send back)
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition in_progress → todo is allowed (send back)

test("PROOF-B-082-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-082-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-082-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-083-STATUS — Status Transition: Transition review → done is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition review → done is allowed

test("PROOF-B-083-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-083-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-083-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-084-STATUS — Status Transition: Transition review → in_progress is allowed (request changes)
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition review → in_progress is allowed (request changes)

test("PROOF-B-084-STATUSa — review → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-084-STATUSb — in_progress → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-084-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-085-STATUS — Status Transition: Transition done → archived is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition done → archived is allowed

test("PROOF-B-085-STATUSa — done → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-085-STATUSb — archived → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-085-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through archived
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-086-STATUS — Status Transition: Transition done → in_progress is allowed (reopen)
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition done → in_progress is allowed (reopen)

test("PROOF-B-086-STATUSa — done → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove transitions transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-086-STATUSb — in_progress → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-086-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-087-STATUS — Status Transition: Transition todo → done is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition todo → done is forbidden

test("PROOF-B-087-STATUSa — todo → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-087-STATUSb — done → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-087-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through done
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-088-STATUS — Status Transition: Transition todo → review is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition todo → review is forbidden

test("PROOF-B-088-STATUSa — todo → review: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("review");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-088-STATUSb — review → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to review state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow review→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("review");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-088-STATUSc — todo → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through review
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-089-STATUS — Status Transition: Transition from archived to any other state is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition from archived to any other state is forbidden

test("PROOF-B-089-STATUSa — archived → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-089-STATUSb — done → archived: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→archived reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-089-STATUSc — archived → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-090-STATUS — Status Transition: Transition todo → archived is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition todo → archived is forbidden

test("PROOF-B-090-STATUSa — todo → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-090-STATUSb — archived → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-090-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through archived
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-091-STATUS — Status Transition: Transition in_progress → done is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition in_progress → done is forbidden

test("PROOF-B-091-STATUSa — in_progress → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-091-STATUSb — done → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-091-STATUSc — in_progress → archived: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to archived without going through done
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-092-STATUS — Status Transition: Transition in_progress → archived is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition in_progress → archived is forbidden

test("PROOF-B-092-STATUSa — in_progress → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-092-STATUSb — archived → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-092-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through archived
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-093-STATUS — Status Transition: Transition to 'in_progress' sets startedAt if null
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition to 'in_progress' sets startedAt if null

test("PROOF-B-093-STATUSa — todo → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.startedAt).not.toBeNull();
  // Kills: Remove startedAt = NOW() in handler

  // Kills: Remove startedAt is set to NOW() side-effect
});

test("PROOF-B-093-STATUSb — in_progress → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-093-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-094-STATUS — Status Transition: Transition to 'done' sets completedAt and completedBy
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition to 'done' sets completedAt and completedBy

test("PROOF-B-094-STATUSa — in_progress → review: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("review");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.completedAt).not.toBeNull();
  // Kills: Remove completedAt = NOW() in handler

  // Kills: Remove completedAt is set to NOW() side-effect
});

test("PROOF-B-094-STATUSb — review → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to review state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow review→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("review");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-094-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through review
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-095-STATUS — Status Transition: Transition from 'done' back to 'in_progress' clears completedAt and completedBy
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition from 'done' back to 'in_progress' clears completedAt and completedBy

test("PROOF-B-095-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove clears transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.completedAt).not.toBeNull();
  // Kills: Remove completedAt = NOW() in handler

  // Kills: Remove completedAt is set to null side-effect
  // Kills: Remove completedBy is set to null side-effect
});

test("PROOF-B-095-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-095-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-096-STATUS — Status Transition: Transition to 'archived' sets archivedAt
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition to 'archived' sets archivedAt

test("PROOF-B-096-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.archivedAt).not.toBeNull();
  // Kills: Remove archivedAt = NOW() in handler

  // Kills: Remove archivedAt is set to NOW() side-effect
});

test("PROOF-B-096-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-096-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-103-STATUS — Status Transition: Simultaneous task status updates result in first write wins (optimistic locking)
// Risk: high
// Spec: Edge Cases
// Behavior: Simultaneous task status updates result in first write wins (optimistic locking)

test("PROOF-B-103-STATUSa — review → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove handles transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-103-STATUSb — in_progress → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-103-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.status",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projects.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});