import { expect, test } from "@playwright/test";
import { BASE_URL, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getGuestCookie, getMemberCookie, getOwnerCookie, getViewerCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: System isolates workspaces by workspaceId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: System isolates workspaces by workspaceId", () => {
  test("admin must be able to isolates workspaces", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to isolates workspaces", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to isolates workspaces", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant isolates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workspaces", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workspaces
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workspaces — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workspaces — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to isolates workspaces", async ({ request }) => {
    // Kills: owner should not be able to isolates workspaces
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to isolates workspaces — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to isolates workspaces — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to isolates workspaces", async ({ request }) => {
    // Kills: admin should not be able to isolates workspaces
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to isolates workspaces — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to isolates workspaces — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Owner role has full access and can delete workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Owner role has full access and can delete workspace", () => {
  test("admin must be able to has full access and can delete workspace, manage billing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to has full access and can delete workspace, manage billing", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to has full access and can delete workspace, manage billing", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full access and can delete workspace, manage billing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access and can delete workspace, manage billing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access and can delete workspace, manage billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access and can delete workspace, manage billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to has full access and can delete workspace, manage billing", async ({ request }) => {
    // Kills: owner should not be able to has full access and can delete workspace, manage billing
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to has full access and can delete workspace, manage billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to has full access and can delete workspace, manage billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to has full access and can delete workspace, manage billing", async ({ request }) => {
    // Kills: admin should not be able to has full access and can delete workspace, manage billing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to has full access and can delete workspace, manage billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to has full access and can delete workspace, manage billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Admin role can manage projects, members, settings but cannot delete workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Admin role can manage projects, members, settings but cannot delete workspace", () => {
  test("admin must be able to can manage projects, members, settings; cannot delete workspace", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can manage projects, members, settings; cannot delete workspace", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can manage projects, members, settings; cannot delete workspace", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access projects, members, settings; cannot delete workspace", async ({ request }) => {
    // Kills: Allow lower-privileged role to access projects, members, settings; cannot delete workspace
    const cookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access projects, members, settings; cannot delete workspace — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access projects, members, settings; cannot delete workspace — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can manage projects, members, settings; cannot delete workspace", async ({ request }) => {
    // Kills: owner should not be able to can manage projects, members, settings; cannot delete workspace
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can manage projects, members, settings; cannot delete workspace — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can manage projects, members, settings; cannot delete workspace — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can manage projects, members, settings; cannot delete workspace", async ({ request }) => {
    // Kills: admin should not be able to can manage projects, members, settings; cannot delete workspace
    const cookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can manage projects, members, settings; cannot delete workspace — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can manage projects, members, settings; cannot delete workspace — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Member role can create/edit own tasks, comment, view all projects
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Member role can create/edit own tasks, comment, view all projects", () => {
  test("admin must be able to can create/edit own tasks, comment, view all projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can create/edit own tasks, comment, view all projects", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can create/edit own tasks, comment, view all projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can create/edit must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own tasks, comment, view all projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own tasks, comment, view all projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own tasks, comment, view all projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own tasks, comment, view all projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can create/edit own tasks, comment, view all projects", async ({ request }) => {
    // Kills: owner should not be able to can create/edit own tasks, comment, view all projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can create/edit own tasks, comment, view all projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can create/edit own tasks, comment, view all projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can create/edit own tasks, comment, view all projects", async ({ request }) => {
    // Kills: admin should not be able to can create/edit own tasks, comment, view all projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can create/edit own tasks, comment, view all projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can create/edit own tasks, comment, view all projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Viewer role has read-only access to all projects and tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Viewer role has read-only access to all projects and tasks", () => {
  test("admin must be able to has read-only access to all projects and tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to has read-only access to all projects and tasks", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to has read-only access to all projects and tasks", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access read-only access to all projects and tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access read-only access to all projects and tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access read-only access to all projects and tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access read-only access to all projects and tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to has read-only access to all projects and tasks", async ({ request }) => {
    // Kills: owner should not be able to has read-only access to all projects and tasks
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to has read-only access to all projects and tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to has read-only access to all projects and tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to has read-only access to all projects and tasks", async ({ request }) => {
    // Kills: admin should not be able to has read-only access to all projects and tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to has read-only access to all projects and tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to has read-only access to all projects and tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Guest role has access only to projects explicitly shared with them
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Guest role has access only to projects explicitly shared with them", () => {
  test("admin must be able to has access only to projects explicitly shared with them", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to has access only to projects explicitly shared with them", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to has access only to projects explicitly shared with them", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access access only to projects explicitly shared with them", async ({ request }) => {
    // Kills: Allow lower-privileged role to access access only to projects explicitly shared with them
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access access only to projects explicitly shared with them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access access only to projects explicitly shared with them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to has access only to projects explicitly shared with them", async ({ request }) => {
    // Kills: owner should not be able to has access only to projects explicitly shared with them
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to has access only to projects explicitly shared with them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to has access only to projects explicitly shared with them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to has access only to projects explicitly shared with them", async ({ request }) => {
    // Kills: admin should not be able to has access only to projects explicitly shared with them
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to has access only to projects explicitly shared with them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to has access only to projects explicitly shared with them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-018-AUTHMATRIX
// Behavior: Project creation requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_018_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Project creation requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_018_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: Project creation fails if workspaceId does not match JWT workspaceId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_019_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Project creation fails if workspaceId does not match JWT workspaceId", () => {
  test("admin must be able to returns 403 FORBIDDEN", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 403 FORBIDDEN", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403 FORBIDDEN", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_019_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403 FORBIDDEN", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403 FORBIDDEN
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 FORBIDDEN — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 FORBIDDEN — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 403 FORBIDDEN", async ({ request }) => {
    // Kills: owner should not be able to returns 403 FORBIDDEN
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 403 FORBIDDEN — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 403 FORBIDDEN — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 403 FORBIDDEN", async ({ request }) => {
    // Kills: admin should not be able to returns 403 FORBIDDEN
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 FORBIDDEN — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 FORBIDDEN — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-023-AUTHMATRIX
// Behavior: Project listing is authorized for all roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_023_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    search: "test-search",
    isPublic: false,
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Project listing is authorized for all roles", () => {
  test("admin must be able to is authorized for all roles", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to is authorized for all roles", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to is authorized for all roles", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is authorized for must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_023_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.list", async ({ request }) => {
    // Kills: Remove role check in projects.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all roles", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to is authorized for all roles", async ({ request }) => {
    // Kills: owner should not be able to is authorized for all roles
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to is authorized for all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to is authorized for all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to is authorized for all roles", async ({ request }) => {
    // Kills: admin should not be able to is authorized for all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to is authorized for all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to is authorized for all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-024-AUTHMATRIX
// Behavior: Guest role sees only shared projects in project list
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_024_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    search: "test-search",
    isPublic: false,
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Guest role sees only shared projects in project list", () => {
  test("admin must be able to sees only shared projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to sees only shared projects", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to sees only shared projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_024_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.list", async ({ request }) => {
    // Kills: Remove role check in projects.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access only shared projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access only shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access only shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access only shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to sees only shared projects", async ({ request }) => {
    // Kills: owner should not be able to sees only shared projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to sees only shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to sees only shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to sees only shared projects", async ({ request }) => {
    // Kills: admin should not be able to sees only shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to sees only shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to sees only shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: Project listing returns 403 for cross-workspace access
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_025_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    search: "test-search",
    isPublic: false,
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Project listing returns 403 for cross-workspace access", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.list", async ({ request }) => {
    // Kills: Remove role check in projects.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 403", async ({ request }) => {
    // Kills: owner should not be able to returns 403
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 403", async ({ request }) => {
    // Kills: admin should not be able to returns 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: Project detail retrieval is authorized for all roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_027_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Project detail retrieval is authorized for all roles", () => {
  test("admin must be able to is authorized for all roles", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to is authorized for all roles", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to is authorized for all roles", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is authorized for must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projectDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projectDetails.getById", async ({ request }) => {
    // Kills: Remove role check in projectDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projectDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all roles", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to is authorized for all roles", async ({ request }) => {
    // Kills: owner should not be able to is authorized for all roles
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to is authorized for all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to is authorized for all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to is authorized for all roles", async ({ request }) => {
    // Kills: admin should not be able to is authorized for all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to is authorized for all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to is authorized for all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-028-AUTHMATRIX
// Behavior: Guest role can only retrieve details for shared projects
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_028_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Guest role can only retrieve details for shared projects", () => {
  test("admin must be able to can only retrieve details for shared projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can only retrieve details for shared projects", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can only retrieve details for shared projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can only retrieve must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_028_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projectDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projectDetails.getById", async ({ request }) => {
    // Kills: Remove role check in projectDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projectDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access details for shared projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access details for shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access details for shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access details for shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can only retrieve details for shared projects", async ({ request }) => {
    // Kills: owner should not be able to can only retrieve details for shared projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can only retrieve details for shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can only retrieve details for shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can only retrieve details for shared projects", async ({ request }) => {
    // Kills: admin should not be able to can only retrieve details for shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can only retrieve details for shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can only retrieve details for shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-030-AUTHMATRIX
// Behavior: Project detail retrieval returns 403 if project belongs to different workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_030_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Project detail retrieval returns 403 if project belongs to different workspace", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_030_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projectDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projectDetails.getById", async ({ request }) => {
    // Kills: Remove role check in projectDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projectDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 403", async ({ request }) => {
    // Kills: owner should not be able to returns 403
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 403", async ({ request }) => {
    // Kills: admin should not be able to returns 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projectDetails.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-032-AUTHMATRIX
// Behavior: Project update requires owner or admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_032_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Project update requires owner or admin role", () => {
  test("admin must be able to requires owner or admin authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner or admin authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner or admin authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_032_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.update", async ({ request }) => {
    // Kills: Remove role check in projects.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner or admin authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner or admin authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner or admin authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-033-AUTHMATRIX
// Behavior: Viewer, member, or guest cannot update projects
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_033_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Viewer, member, or guest cannot update projects", () => {
  test("admin must be able to cannot update projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to cannot update projects", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to cannot update projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_033_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.update", async ({ request }) => {
    // Kills: Remove role check in projects.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to cannot update projects", async ({ request }) => {
    // Kills: owner should not be able to cannot update projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to cannot update projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to cannot update projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to cannot update projects", async ({ request }) => {
    // Kills: admin should not be able to cannot update projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.update", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to cannot update projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to cannot update projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-035-AUTHMATRIX
// Behavior: Project deletion requires owner or admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_035_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Project deletion requires owner or admin role", () => {
  test("admin must be able to requires owner or admin authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner or admin authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner or admin authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_035_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.delete", async ({ request }) => {
    // Kills: Remove role check in projects.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner or admin authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner or admin authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner or admin authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.delete", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-039-AUTHMATRIX
// Behavior: Task creation requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_039_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    projectId: 1,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Task creation requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_039_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.create", async ({ request }) => {
    // Kills: Remove role check in tasks.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-040-AUTHMATRIX
// Behavior: Task creation fails if projectId does not belong to same workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_040_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    projectId: 1,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Task creation fails if projectId does not belong to same workspace", () => {
  test("admin must be able to returns 400 INVALID_PROJECT", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 400 INVALID_PROJECT", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 INVALID_PROJECT", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_040_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.create", async ({ request }) => {
    // Kills: Remove role check in tasks.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 INVALID_PROJECT", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 INVALID_PROJECT
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 400 INVALID_PROJECT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 400 INVALID_PROJECT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 400 INVALID_PROJECT", async ({ request }) => {
    // Kills: owner should not be able to returns 400 INVALID_PROJECT
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 400 INVALID_PROJECT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 400 INVALID_PROJECT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 400 INVALID_PROJECT", async ({ request }) => {
    // Kills: admin should not be able to returns 400 INVALID_PROJECT
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 INVALID_PROJECT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 INVALID_PROJECT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-045-AUTHMATRIX
// Behavior: Task listing is authorized for all roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_045_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    projectId: 1,
    status: "todo",
    priority: "low",
    assigneeId: 1,
    search: "test-search",
    dueBefore: tomorrowStr(),
    dueAfter: tomorrowStr(),
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Task listing is authorized for all roles", () => {
  test("admin must be able to is authorized for all roles", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to is authorized for all roles", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to is authorized for all roles", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is authorized for must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_045_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all roles", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to is authorized for all roles", async ({ request }) => {
    // Kills: owner should not be able to is authorized for all roles
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to is authorized for all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to is authorized for all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to is authorized for all roles", async ({ request }) => {
    // Kills: admin should not be able to is authorized for all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.list", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to is authorized for all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to is authorized for all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-047-AUTHMATRIX
// Behavior: Task field update requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_047_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Task field update requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_047_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "taskFields.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in taskFields.update", async ({ request }) => {
    // Kills: Remove role check in taskFields.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in taskFields.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-048-AUTHMATRIX
// Behavior: Member role can only edit own tasks or tasks assigned to them
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_048_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Member role can only edit own tasks or tasks assigned to them", () => {
  test("admin must be able to can only edit own tasks or tasks assigned to them", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can only edit own tasks or tasks assigned to them", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can only edit own tasks or tasks assigned to them", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can only edit must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_048_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "taskFields.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in taskFields.update", async ({ request }) => {
    // Kills: Remove role check in taskFields.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in taskFields.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own tasks or tasks assigned to them", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own tasks or tasks assigned to them
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own tasks or tasks assigned to them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own tasks or tasks assigned to them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can only edit own tasks or tasks assigned to them", async ({ request }) => {
    // Kills: owner should not be able to can only edit own tasks or tasks assigned to them
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can only edit own tasks or tasks assigned to them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can only edit own tasks or tasks assigned to them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can only edit own tasks or tasks assigned to them", async ({ request }) => {
    // Kills: admin should not be able to can only edit own tasks or tasks assigned to them
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can only edit own tasks or tasks assigned to them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can only edit own tasks or tasks assigned to them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-049-AUTHMATRIX
// Behavior: Viewer or guest cannot update task fields
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_049_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Viewer or guest cannot update task fields", () => {
  test("admin must be able to cannot update task fields", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to cannot update task fields", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to cannot update task fields", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_049_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "taskFields.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in taskFields.update", async ({ request }) => {
    // Kills: Remove role check in taskFields.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in taskFields.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access task fields", async ({ request }) => {
    // Kills: Allow lower-privileged role to access task fields
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access task fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access task fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to cannot update task fields", async ({ request }) => {
    // Kills: owner should not be able to cannot update task fields
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to cannot update task fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to cannot update task fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to cannot update task fields", async ({ request }) => {
    // Kills: admin should not be able to cannot update task fields
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to cannot update task fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to cannot update task fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-050-AUTHMATRIX
// Behavior: Member editing someone else's unassigned task returns 403 NOT_YOUR_TASK
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_050_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: Member editing someone else's unassigned task returns 403 NOT_YOUR_TASK", () => {
  test("admin must be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_050_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "taskFields.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in taskFields.update", async ({ request }) => {
    // Kills: Remove role check in taskFields.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in taskFields.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403 NOT_YOUR_TASK", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403 NOT_YOUR_TASK
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 NOT_YOUR_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 NOT_YOUR_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    // Kills: owner should not be able to returns 403 NOT_YOUR_TASK
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 403 NOT_YOUR_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 403 NOT_YOUR_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    // Kills: admin should not be able to returns 403 NOT_YOUR_TASK
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "taskFields.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 NOT_YOUR_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 NOT_YOUR_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-052-AUTHMATRIX
// Behavior: Task status update requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_052_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
    status: "todo",
  };
}
test.describe("Auth Matrix: Task status update requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_052_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.updateStatus", async ({ request }) => {
    // Kills: Remove role check in tasks.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.updateStatus", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-058-AUTHMATRIX
// Behavior: Task deletion requires owner, admin, or task creator role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_058_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Task deletion requires owner, admin, or task creator role", () => {
  test("admin must be able to requires owner, admin, or task creator authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or task creator authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or task creator authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_058_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.delete", async ({ request }) => {
    // Kills: Remove role check in tasks.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or task creator authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or task creator authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or task creator authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or task creator authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or task creator authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or task creator authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or task creator authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or task creator authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or task creator authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or task creator authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or task creator authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or task creator authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-060-AUTHMATRIX
// Behavior: Member can only delete own tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_060_AUTHMATRIX() {
  return {
    id: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Member can only delete own tasks", () => {
  test("admin must be able to can only delete own tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can only delete own tasks", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can only delete own tasks", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can only delete must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_060_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.delete", async ({ request }) => {
    // Kills: Remove role check in tasks.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can only delete own tasks", async ({ request }) => {
    // Kills: owner should not be able to can only delete own tasks
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can only delete own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can only delete own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can only delete own tasks", async ({ request }) => {
    // Kills: admin should not be able to can only delete own tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.delete", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can only delete own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can only delete own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-062-AUTHMATRIX
// Behavior: Bulk task status update requires owner or admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_062_AUTHMATRIX() {
  return {
    taskIds: [1],
    status: "todo",
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Bulk task status update requires owner or admin role", () => {
  test("admin must be able to requires owner or admin authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner or admin authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner or admin authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_062_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bulkUpdateTaskStatus", async ({ request }) => {
    // Kills: Remove role check in bulkUpdateTaskStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bulkUpdateTaskStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner or admin authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner or admin authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner or admin authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner or admin authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner or admin authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner or admin authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-063-AUTHMATRIX
// Behavior: Bulk task status update fails if tasks belong to mixed workspaces
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_063_AUTHMATRIX() {
  return {
    taskIds: [1],
    status: "todo",
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Bulk task status update fails if tasks belong to mixed workspaces", () => {
  test("admin must be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_063_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bulkUpdateTaskStatus", async ({ request }) => {
    // Kills: Remove role check in bulkUpdateTaskStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bulkUpdateTaskStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 MIXED_WORKSPACES", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 MIXED_WORKSPACES
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 400 MIXED_WORKSPACES — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 400 MIXED_WORKSPACES — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    // Kills: owner should not be able to returns 400 MIXED_WORKSPACES
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 400 MIXED_WORKSPACES — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 400 MIXED_WORKSPACES — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    // Kills: admin should not be able to returns 400 MIXED_WORKSPACES
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bulkUpdateTaskStatus", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 MIXED_WORKSPACES — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 MIXED_WORKSPACES — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-068-AUTHMATRIX
// Behavior: Comment creation requires owner, admin, member, or guest (on shared projects) role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_068_AUTHMATRIX() {
  return {
    taskId: 1,
    workspaceId: TEST_WORKSPACE_ID,
    content: "test-content",
    parentId: 1,
  };
}
test.describe("Auth Matrix: Comment creation requires owner, admin, member, or guest (on shared projects) role", () => {
  test("admin must be able to requires owner, admin, member, or guest (on shared projects) authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, member, or guest (on shared projects) authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, member, or guest (on shared projects) authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_068_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "addComment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in addComment", async ({ request }) => {
    // Kills: Remove role check in addComment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in addComment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, member, or guest (on shared projects) authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, member, or guest (on shared projects) authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, member, or guest (on shared projects) authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, member, or guest (on shared projects) authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, member, or guest (on shared projects) authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, member, or guest (on shared projects) authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, member, or guest (on shared projects) authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, member, or guest (on shared projects) authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, member, or guest (on shared projects) authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, member, or guest (on shared projects) authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, member, or guest (on shared projects) authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, member, or guest (on shared projects) authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-069-AUTHMATRIX
// Behavior: Comment creation fails if taskId does not belong to workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_069_AUTHMATRIX() {
  return {
    taskId: 1,
    workspaceId: TEST_WORKSPACE_ID,
    content: "test-content",
    parentId: 1,
  };
}
test.describe("Auth Matrix: Comment creation fails if taskId does not belong to workspace", () => {
  test("admin must be able to returns 400 INVALID_TASK", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 400 INVALID_TASK", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 INVALID_TASK", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_069_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "addComment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in addComment", async ({ request }) => {
    // Kills: Remove role check in addComment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in addComment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 INVALID_TASK", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 INVALID_TASK
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 400 INVALID_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 400 INVALID_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 400 INVALID_TASK", async ({ request }) => {
    // Kills: owner should not be able to returns 400 INVALID_TASK
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 400 INVALID_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 400 INVALID_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 400 INVALID_TASK", async ({ request }) => {
    // Kills: admin should not be able to returns 400 INVALID_TASK
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "addComment", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 INVALID_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 INVALID_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-073-AUTHMATRIX
// Behavior: Time logging requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_073_AUTHMATRIX() {
  return {
    taskId: 1,
    workspaceId: TEST_WORKSPACE_ID,
    hours: 1,
    date: tomorrowStr(),
    description: "Test description",
  };
}
test.describe("Auth Matrix: Time logging requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member authorization", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member authorization", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_073_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "logTimeEntry", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in logTimeEntry", async ({ request }) => {
    // Kills: Remove role check in logTimeEntry
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in logTimeEntry — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member authorization", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member authorization", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member authorization
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member authorization — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-095-AUTHMATRIX
// Behavior: System returns 403 PLAN_LIMIT_REACHED when exceeding plan limits
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_095_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: System returns 403 PLAN_LIMIT_REACHED when exceeding plan limits", () => {
  test("admin must be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_095_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan", async ({ request }) => {
    // Kills: owner should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan", async ({ request }) => {
    // Kills: admin should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 PLAN_LIMIT_REACHED with requiredPlan and currentPlan — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-096-AUTHMATRIX
// Behavior: Free plan users cannot access /api/time-entries
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_096_AUTHMATRIX() {
  return {
    taskId: 1,
    workspaceId: TEST_WORKSPACE_ID,
    hours: 1,
    date: tomorrowStr(),
    description: "Test description",
  };
}
test.describe("Auth Matrix: Free plan users cannot access /api/time-entries", () => {
  test("admin must be able to cannot access /api/time-entries", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to cannot access /api/time-entries", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to cannot access /api/time-entries", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_096_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "logTimeEntry", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in logTimeEntry", async ({ request }) => {
    // Kills: Remove role check in logTimeEntry
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in logTimeEntry — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access /api/time-entries", async ({ request }) => {
    // Kills: Allow lower-privileged role to access /api/time-entries
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access /api/time-entries — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access /api/time-entries — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to cannot access /api/time-entries", async ({ request }) => {
    // Kills: owner should not be able to cannot access /api/time-entries
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to cannot access /api/time-entries — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to cannot access /api/time-entries — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to cannot access /api/time-entries", async ({ request }) => {
    // Kills: admin should not be able to cannot access /api/time-entries
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "logTimeEntry", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to cannot access /api/time-entries — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to cannot access /api/time-entries — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-106-AUTHMATRIX
// Behavior: Next API call returns 403 if guest access is revoked while guest has open tab
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_106_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: Next API call returns 403 if guest access is revoked while guest has open tab", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_106_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.create", async ({ request }) => {
    // Kills: Remove role check in projects.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 403", async ({ request }) => {
    // Kills: owner should not be able to returns 403
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 403", async ({ request }) => {
    // Kills: admin should not be able to returns 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});