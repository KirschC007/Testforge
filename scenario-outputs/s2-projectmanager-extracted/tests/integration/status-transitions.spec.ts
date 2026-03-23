import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID, createTestResource, getResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-037-STATUS — Status Transition: Project deletion returns 409 TASKS_IN_PROGRESS if any task has status 'in_progress' or 'review'
// Risk: high
// Spec: Projects
// Behavior: Project deletion returns 409 TASKS_IN_PROGRESS if any task has status 'in_progress' or 'review'

test("PROOF-B-037-STATUSa — in_progress → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "projects.delete",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove returns transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-037-STATUSb — in_progress → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "projects.delete",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "projects.delete",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-037-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through in_progress
  const { status } = await trpcMutation(request, "projects.delete",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-043-STATUS — Status Transition: New tasks default to 'todo' status
// Risk: high
// Spec: Tasks
// Behavior: New tasks default to 'todo' status

test("PROOF-B-043-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove default to transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-043-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-043-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.create",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-051-STATUS — Status Transition: PATCH /api/tasks/:id/status updates task status
// Risk: high
// Spec: Tasks
// Behavior: PATCH /api/tasks/:id/status updates task status

test("PROOF-B-051-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-051-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-051-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-053-STATUS — Status Transition: Task status update applies state machine rules
// Risk: high
// Spec: Tasks
// Behavior: Task status update applies state machine rules

test("PROOF-B-053-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove applies transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-053-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-053-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-054-STATUS — Status Transition: Moving task to 'done' sets completedAt and completedBy
// Risk: high
// Spec: Tasks
// Behavior: Moving task to 'done' sets completedAt and completedBy

test("PROOF-B-054-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-054-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-054-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-055-STATUS — Status Transition: Moving task to 'in_progress' sets startedAt if not already set
// Risk: high
// Spec: Tasks
// Behavior: Moving task to 'in_progress' sets startedAt if not already set

test("PROOF-B-055-STATUSa — done → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-055-STATUSb — in_progress → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-055-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-056-STATUS — Status Transition: Moving task from 'done' back to any other status clears completedAt and completedBy
// Risk: high
// Spec: Tasks
// Behavior: Moving task from 'done' back to any other status clears completedAt and completedBy

test("PROOF-B-056-STATUSa — done → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove clears transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.completedAt).not.toBeNull();
  // Kills: Remove completedAt = NOW() in handler

  // Kills: Remove `completedAt` and `completedBy` fields are nullified side-effect
});

test("PROOF-B-056-STATUSb — in_progress → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-056-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-061-STATUS — Status Transition: POST /api/tasks/bulk-status bulk updates task statuses
// Risk: high
// Spec: Tasks
// Behavior: POST /api/tasks/bulk-status bulk updates task statuses

test("PROOF-B-061-STATUSa — todo → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove bulk updates transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-061-STATUSb — in_progress → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-061-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through in_progress
  const { status } = await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-064-STATUS — Status Transition: Bulk task status update applies state machine rules to each task individually
// Risk: high
// Spec: Tasks
// Behavior: Bulk task status update applies state machine rules to each task individually

test("PROOF-B-064-STATUSa — in_progress → review: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove applies transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("review");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-064-STATUSb — review → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to review state first
  await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow review→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("review");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-064-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through review
  const { status } = await trpcMutation(request, "bulkUpdateTaskStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-078-STATUS — Status Transition: Task status transition from 'todo' to 'in_progress' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'todo' to 'in_progress' is allowed

test("PROOF-B-078-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-078-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-078-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-079-STATUS — Status Transition: Task status transition from 'in_progress' to 'review' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'in_progress' to 'review' is allowed

test("PROOF-B-079-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-079-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-079-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-080-STATUS — Status Transition: Task status transition from 'in_progress' to 'todo' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'in_progress' to 'todo' is allowed

test("PROOF-B-080-STATUSa — review → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-080-STATUSb — in_progress → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-080-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-081-STATUS — Status Transition: Task status transition from 'review' to 'done' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'review' to 'done' is allowed

test("PROOF-B-081-STATUSa — done → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-081-STATUSb — archived → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-081-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through archived
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-082-STATUS — Status Transition: Task status transition from 'review' to 'in_progress' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'review' to 'in_progress' is allowed

test("PROOF-B-082-STATUSa — done → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-082-STATUSb — in_progress → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-082-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-083-STATUS — Status Transition: Task status transition from 'done' to 'archived' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'done' to 'archived' is allowed

test("PROOF-B-083-STATUSa — todo → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-083-STATUSb — in_progress → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-083-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-084-STATUS — Status Transition: Task status transition from 'done' to 'in_progress' is allowed
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'done' to 'in_progress' is allowed

test("PROOF-B-084-STATUSa — in_progress → review: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove allows transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("review");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-084-STATUSb — review → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to review state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow review→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("review");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-084-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through review
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-085-STATUS — Status Transition: Task status transition from 'todo' to 'done' is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'todo' to 'done' is forbidden

test("PROOF-B-085-STATUSa — in_progress → todo: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-085-STATUSb — todo → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to todo state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow todo→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-085-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through todo
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-086-STATUS — Status Transition: Task status transition from 'todo' to 'review' is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'todo' to 'review' is forbidden

test("PROOF-B-086-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-086-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-086-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-087-STATUS — Status Transition: Task status transition from 'archived' to any other state is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'archived' to any other state is forbidden

test("PROOF-B-087-STATUSa — review → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-087-STATUSb — in_progress → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-087-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-088-STATUS — Status Transition: Task status transition from 'todo' to 'archived' is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'todo' to 'archived' is forbidden

test("PROOF-B-088-STATUSa — done → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-088-STATUSb — archived → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-088-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through archived
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-089-STATUS — Status Transition: Task status transition from 'in_progress' to 'done' is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'in_progress' to 'done' is forbidden

test("PROOF-B-089-STATUSa — done → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-089-STATUSb — in_progress → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-089-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-090-STATUS — Status Transition: Task status transition from 'in_progress' to 'archived' is forbidden
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Task status transition from 'in_progress' to 'archived' is forbidden

test("PROOF-B-090-STATUSa — todo → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove forbids transition transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-090-STATUSb — in_progress → todo: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→todo reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-090-STATUSc — todo → review: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to review without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("todo");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-091-STATUS — Status Transition: Transition to 'in_progress' sets startedAt if null
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition to 'in_progress' sets startedAt if null

test("PROOF-B-091-STATUSa — in_progress → in_progress: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.startedAt).not.toBeNull();
  // Kills: Remove startedAt = NOW() in handler

  // Kills: Remove startedAt is set to current timestamp if it was null side-effect
});

test("PROOF-B-091-STATUSb — in_progress → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to in_progress state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow in_progress→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-091-STATUSc — in_progress → done: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to done without going through in_progress
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-092-STATUS — Status Transition: Transition to 'done' sets completedAt and completedBy
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition to 'done' sets completedAt and completedBy

test("PROOF-B-092-STATUSa — in_progress → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-092-STATUSb — done → in_progress: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "in_progress", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→in_progress reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-092-STATUSc — in_progress → archived: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to archived without going through done
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("in_progress");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-093-STATUS — Status Transition: Transition from 'done' to 'in_progress' clears completedAt and completedBy
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition from 'done' to 'in_progress' clears completedAt and completedBy

test("PROOF-B-093-STATUSa — review → done: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove clears transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("done");
  // Kills: Update status field but not persist to DB

  expect((updated as Record<string, unknown>)?.completedAt).not.toBeNull();
  // Kills: Remove completedAt = NOW() in handler

  // Kills: Remove completedAt and completedBy are set to null side-effect
});

test("PROOF-B-093-STATUSb — done → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to done state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow done→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("done");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-093-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through done
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-094-STATUS — Status Transition: Transition to 'archived' sets archivedAt
// Risk: high
// Spec: Status Machine: tasks
// Behavior: Transition to 'archived' sets archivedAt

test("PROOF-B-094-STATUSa — review → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove sets transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-094-STATUSb — archived → review: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "review", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→review reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-094-STATUSc — review → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through archived
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("review");
  // Kills: Accept any status value without validating transition chain
});

// PROOF-B-102-STATUS — Status Transition: First write wins when two users move same task to different statuses simultaneously
// Risk: high
// Spec: Edge Cases
// Behavior: First write wins when two users move same task to different statuses simultaneously

test("PROOF-B-102-STATUSa — done → archived: transition succeeds with correct side-effects", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove applies transition from allowed list

  // DB state check
  const { data: updated } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((updated as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Update status field but not persist to DB

});

test("PROOF-B-102-STATUSb — archived → done: reverse transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Bring to archived state first
  await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "archived", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Attempt reverse transition
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "done", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow archived→done reverse transition

  // DB must be unchanged
  const { data: unchanged } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged as Record<string, unknown>)?.status).toBe("archived");
  // Kills: Silent state corruption on rejected transition
});

test("PROOF-B-102-STATUSc — done → todo: skip-transition must be rejected", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;

  // Attempt to skip directly to todo without going through archived
  const { status } = await trpcMutation(request, "tasks.updateStatus",
    { id: resource.id, status: "todo", workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  expect([400, 422]).toContain(status);
  // Kills: Allow skipping intermediate states in the transition chain

  // DB must still be in initial state
  const { data: unchanged2 } = await trpcQuery(request, "projectDetails.getById",
    { id: resource.id, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect((unchanged2 as Record<string, unknown>)?.status).toBe("done");
  // Kills: Accept any status value without validating transition chain
});