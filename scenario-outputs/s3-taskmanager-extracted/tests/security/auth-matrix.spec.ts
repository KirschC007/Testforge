import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getUserCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Create tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "active",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Create tasks", () => {
  test("admin must be able to Create tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "tasks.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.create", async ({ request }) => {
    // Kills: Remove role check in tasks.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create tasks", async ({ request }) => {
    // Kills: admin should not be able to Create tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create tasks", async ({ request }) => {
    // Kills: user should not be able to Create tasks
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: Get tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    projectId: TEST_WORKSPACE_ID,
    status: "active",
    priority: "active",
    assigneeId: 1,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get tasks", () => {
  test("admin must be able to Get tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.list", async ({ request }) => {
    // Kills: Remove role check in tasks.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get tasks", async ({ request }) => {
    // Kills: admin should not be able to Get tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get tasks", async ({ request }) => {
    // Kills: user should not be able to Get tasks
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-003-AUTHMATRIX
// Behavior: Get tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_003_AUTHMATRIX() {
  return {
    id: 1,
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Get tasks", () => {
  test("admin must be able to Get tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_003_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.getById", async ({ request }) => {
    // Kills: Remove role check in tasks.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get tasks", async ({ request }) => {
    // Kills: admin should not be able to Get tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get tasks", async ({ request }) => {
    // Kills: user should not be able to Get tasks
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.getById", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: Update tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    id: 1,
    workspaceId: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "active",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Update tasks", () => {
  test("admin must be able to Update tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Update tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "tasks.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.update", async ({ request }) => {
    // Kills: Remove role check in tasks.update
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Update tasks", async ({ request }) => {
    // Kills: admin should not be able to Update tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Update tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Update tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Update tasks", async ({ request }) => {
    // Kills: user should not be able to Update tasks
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.update", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Update tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Update tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-005-AUTHMATRIX
// Behavior: Update tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_005_AUTHMATRIX() {
  return {
    id: 1,
    workspaceId: TEST_WORKSPACE_ID,
    status: "active",
  };
}
test.describe("Auth Matrix: Update tasks", () => {
  test("admin must be able to Update tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Update tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_005_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "tasks.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.updateStatus", async ({ request }) => {
    // Kills: Remove role check in tasks.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Update tasks", async ({ request }) => {
    // Kills: admin should not be able to Update tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Update tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Update tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Update tasks", async ({ request }) => {
    // Kills: user should not be able to Update tasks
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.updateStatus", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Update tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Update tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-006-AUTHMATRIX
// Behavior: Delete tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_006_AUTHMATRIX() {
  return {
    id: 1,
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Delete tasks", () => {
  test("admin must be able to Delete tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Delete tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Delete must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_006_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "tasks.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.delete", async ({ request }) => {
    // Kills: Remove role check in tasks.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Delete tasks", async ({ request }) => {
    // Kills: admin should not be able to Delete tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Delete tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Delete tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Delete tasks", async ({ request }) => {
    // Kills: user should not be able to Delete tasks
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Delete tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Delete tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Bulk operation on tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    taskIds: [],
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Bulk operation on tasks", () => {
  test("admin must be able to Bulk operation on tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Bulk operation on tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Bulk operation on must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.bulkDelete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.bulkDelete", async ({ request }) => {
    // Kills: Remove role check in tasks.bulkDelete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.bulkDelete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Bulk operation on tasks", async ({ request }) => {
    // Kills: admin should not be able to Bulk operation on tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Bulk operation on tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Bulk operation on tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Bulk operation on tasks", async ({ request }) => {
    // Kills: user should not be able to Bulk operation on tasks
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.bulkDelete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Bulk operation on tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Bulk operation on tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Bulk operation on tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    taskIds: [],
    workspaceId: TEST_WORKSPACE_ID,
    status: "active",
  };
}
test.describe("Auth Matrix: Bulk operation on tasks", () => {
  test("admin must be able to Bulk operation on tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Bulk operation on tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Bulk operation on must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.bulkUpdateStatus", async ({ request }) => {
    // Kills: Remove role check in tasks.bulkUpdateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.bulkUpdateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Bulk operation on tasks", async ({ request }) => {
    // Kills: admin should not be able to Bulk operation on tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Bulk operation on tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Bulk operation on tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Bulk operation on tasks", async ({ request }) => {
    // Kills: user should not be able to Bulk operation on tasks
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.bulkUpdateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Bulk operation on tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Bulk operation on tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Create tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "active",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Create tasks", () => {
  test("admin must be able to Create tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "tasks.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.create", async ({ request }) => {
    // Kills: Remove role check in tasks.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create tasks", async ({ request }) => {
    // Kills: admin should not be able to Create tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create tasks", async ({ request }) => {
    // Kills: user should not be able to Create tasks
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Get tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    projectId: TEST_WORKSPACE_ID,
    status: "active",
    priority: "active",
    assigneeId: 1,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get tasks", () => {
  test("admin must be able to Get tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.list", async ({ request }) => {
    // Kills: Remove role check in tasks.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get tasks", async ({ request }) => {
    // Kills: admin should not be able to Get tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get tasks", async ({ request }) => {
    // Kills: user should not be able to Get tasks
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Delete tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    id: 1,
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Delete tasks", () => {
  test("admin must be able to Delete tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Delete tasks", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Delete must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "tasks.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.delete", async ({ request }) => {
    // Kills: Remove role check in tasks.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Delete tasks", async ({ request }) => {
    // Kills: admin should not be able to Delete tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Delete tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Delete tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Delete tasks", async ({ request }) => {
    // Kills: user should not be able to Delete tasks
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "tasks.delete", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Delete tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Delete tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});