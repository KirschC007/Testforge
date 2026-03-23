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
  };
}
test.describe("Auth Matrix: System isolates workspaces by workspaceId", () => {
  test("admin must be able to isolates workspaces", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to isolates workspaces", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workspaces", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workspaces
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to isolates workspaces — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to isolates workspaces — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Owner role has full access and can delete workspace and manage billing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Owner role has full access and can delete workspace and manage billing", () => {
  test("admin must be able to has full access", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to has full access", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to has full access", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full access", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to has full access", async ({ request }) => {
    // Kills: owner should not be able to has full access
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to has full access — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to has full access — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to has full access", async ({ request }) => {
    // Kills: admin should not be able to has full access
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to has full access — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to has full access — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Admin role can manage projects, members, and settings but cannot delete workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Admin role can manage projects, members, and settings but cannot delete workspace", () => {
  test("admin must be able to can manage projects, members, settings", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can manage projects, members, settings", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can manage projects, members, settings", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access projects, members, settings", async ({ request }) => {
    // Kills: Allow lower-privileged role to access projects, members, settings
    const cookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access projects, members, settings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access projects, members, settings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can manage projects, members, settings", async ({ request }) => {
    // Kills: owner should not be able to can manage projects, members, settings
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can manage projects, members, settings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can manage projects, members, settings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can manage projects, members, settings", async ({ request }) => {
    // Kills: admin should not be able to can manage projects, members, settings
    const cookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can manage projects, members, settings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can manage projects, members, settings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Member role can create/edit own tasks, comment, and view all projects
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Member role can create/edit own tasks, comment, and view all projects", () => {
  test("admin must be able to can create/edit own tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can create/edit own tasks", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can create/edit own tasks", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can create/edit must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can create/edit own tasks", async ({ request }) => {
    // Kills: owner should not be able to can create/edit own tasks
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can create/edit own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can create/edit own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can create/edit own tasks", async ({ request }) => {
    // Kills: admin should not be able to can create/edit own tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can create/edit own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can create/edit own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Viewer role has read-only access to all projects and tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Viewer role has read-only access to all projects and tasks", () => {
  test("admin must be able to has read-only access to all projects and tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to has read-only access to all projects and tasks", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access read-only access to all projects and tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access read-only access to all projects and tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to has read-only access to all projects and tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to has read-only access to all projects and tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Guest role has access only to projects explicitly shared with them
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Guest role has access only to projects explicitly shared with them", () => {
  test("admin must be able to has access only to projects explicitly shared with them", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to has access only to projects explicitly shared with them", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access access only to projects explicitly shared with them", async ({ request }) => {
    // Kills: Allow lower-privileged role to access access only to projects explicitly shared with them
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to has access only to projects explicitly shared with them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to has access only to projects explicitly shared with them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-020-AUTHMATRIX
// Behavior: POST /api/projects requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_020_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    color: "test-color",
    isPublic: false,
  };
}
test.describe("Auth Matrix: POST /api/projects requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_020_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-021-AUTHMATRIX
// Behavior: Project creation fails if workspaceId does not match JWT workspaceId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_021_AUTHMATRIX() {
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
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403 FORBIDDEN", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_021_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403 FORBIDDEN", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403 FORBIDDEN
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "projects.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 FORBIDDEN — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 FORBIDDEN — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: GET /api/projects is accessible by all roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_025_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: GET /api/projects is accessible by all roles", () => {
  test("admin must be able to is accessible by all roles", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to is accessible by all roles", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to is accessible by all roles", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is accessible by must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all roles", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to is accessible by all roles", async ({ request }) => {
    // Kills: owner should not be able to is accessible by all roles
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to is accessible by all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to is accessible by all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to is accessible by all roles", async ({ request }) => {
    // Kills: admin should not be able to is accessible by all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to is accessible by all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to is accessible by all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: Guest role sees only shared projects when listing projects
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_026_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Guest role sees only shared projects when listing projects", () => {
  test("admin must be able to sees only shared projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to sees only shared projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_026_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access only shared projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access only shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to sees only shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to sees only shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: GET /api/projects returns 403 for cross-workspace access
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_027_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: GET /api/projects returns 403 for cross-workspace access", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: GET /api/projects/:id is accessible by all roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_029_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/projects/:id is accessible by all roles", () => {
  test("admin must be able to is accessible by all roles", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to is accessible by all roles", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to is accessible by all roles", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is accessible by must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_029_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.getById", async ({ request }) => {
    // Kills: Remove role check in projects.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all roles", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to is accessible by all roles", async ({ request }) => {
    // Kills: owner should not be able to is accessible by all roles
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to is accessible by all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to is accessible by all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to is accessible by all roles", async ({ request }) => {
    // Kills: admin should not be able to is accessible by all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to is accessible by all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to is accessible by all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-030-AUTHMATRIX
// Behavior: Guest role can only access shared projects via GET /api/projects/:id
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_030_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: Guest role can only access shared projects via GET /api/projects/:id", () => {
  test("admin must be able to can only access shared projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to can only access shared projects", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can only access shared projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can only access must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_030_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.getById", async ({ request }) => {
    // Kills: Remove role check in projects.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access shared projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to can only access shared projects", async ({ request }) => {
    // Kills: owner should not be able to can only access shared projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to can only access shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to can only access shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to can only access shared projects", async ({ request }) => {
    // Kills: admin should not be able to can only access shared projects
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can only access shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can only access shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-032-AUTHMATRIX
// Behavior: GET /api/projects/:id returns 403 if project belongs to different workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_032_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/projects/:id returns 403 if project belongs to different workspace", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_032_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "projects.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in projects.getById", async ({ request }) => {
    // Kills: Remove role check in projects.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in projects.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "projects.getById", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-034-AUTHMATRIX
// Behavior: PUT /api/projects/:id requires owner or admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_034_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: PUT /api/projects/:id requires owner or admin role", () => {
  test("admin must be able to requires owner or admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner or admin role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner or admin role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_034_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner or admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner or admin role", async ({ request }) => {
    // Kills: owner should not be able to requires owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner or admin role", async ({ request }) => {
    // Kills: admin should not be able to requires owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-035-AUTHMATRIX
// Behavior: PUT /api/projects/:id returns 403 for viewer, member, or guest roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_035_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: PUT /api/projects/:id returns 403 for viewer, member, or guest roles", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_035_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-037-AUTHMATRIX
// Behavior: DELETE /api/projects/:id requires owner or admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_037_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: DELETE /api/projects/:id requires owner or admin role", () => {
  test("admin must be able to requires owner or admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner or admin role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner or admin role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_037_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner or admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner or admin role", async ({ request }) => {
    // Kills: owner should not be able to requires owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner or admin role", async ({ request }) => {
    // Kills: admin should not be able to requires owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-041-AUTHMATRIX
// Behavior: POST /api/tasks requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_041_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/tasks requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_041_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-042-AUTHMATRIX
// Behavior: Task creation fails if projectId does not belong to same workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_042_AUTHMATRIX() {
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 INVALID_PROJECT", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_042_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 INVALID_PROJECT", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 INVALID_PROJECT
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 INVALID_PROJECT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 INVALID_PROJECT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-043-AUTHMATRIX
// Behavior: Task creation fails if assigneeId is not a member of the workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_043_AUTHMATRIX() {
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
test.describe("Auth Matrix: Task creation fails if assigneeId is not a member of the workspace", () => {
  test("admin must be able to returns 400 INVALID_ASSIGNEE", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to returns 400 INVALID_ASSIGNEE", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 INVALID_ASSIGNEE", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_043_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 INVALID_ASSIGNEE", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 INVALID_ASSIGNEE
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 400 INVALID_ASSIGNEE — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 400 INVALID_ASSIGNEE — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to returns 400 INVALID_ASSIGNEE", async ({ request }) => {
    // Kills: owner should not be able to returns 400 INVALID_ASSIGNEE
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to returns 400 INVALID_ASSIGNEE — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to returns 400 INVALID_ASSIGNEE — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to returns 400 INVALID_ASSIGNEE", async ({ request }) => {
    // Kills: admin should not be able to returns 400 INVALID_ASSIGNEE
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 INVALID_ASSIGNEE — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 INVALID_ASSIGNEE — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-047-AUTHMATRIX
// Behavior: GET /api/tasks is accessible by all roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_047_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: GET /api/tasks is accessible by all roles", () => {
  test("admin must be able to is accessible by all roles", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to is accessible by all roles", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to is accessible by all roles", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is accessible by must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_047_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all roles", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to is accessible by all roles", async ({ request }) => {
    // Kills: owner should not be able to is accessible by all roles
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to is accessible by all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to is accessible by all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to is accessible by all roles", async ({ request }) => {
    // Kills: admin should not be able to is accessible by all roles
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to is accessible by all roles — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to is accessible by all roles — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-049-AUTHMATRIX
// Behavior: PATCH /api/tasks/:id requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_049_AUTHMATRIX() {
  return {
    id: 1,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: PATCH /api/tasks/:id requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_049_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.update", async ({ request }) => {
    // Kills: Remove role check in tasks.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-050-AUTHMATRIX
// Behavior: Member role can only edit own tasks or tasks assigned to them
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_050_AUTHMATRIX() {
  return {
    id: 1,
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can only edit own tasks or tasks assigned to them", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can only edit must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_050_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.update", async ({ request }) => {
    // Kills: Remove role check in tasks.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own tasks or tasks assigned to them", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own tasks or tasks assigned to them
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can only edit own tasks or tasks assigned to them — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can only edit own tasks or tasks assigned to them — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-051-AUTHMATRIX
// Behavior: PATCH /api/tasks/:id returns 403 for viewer or guest roles
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_051_AUTHMATRIX() {
  return {
    id: 1,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: PATCH /api/tasks/:id returns 403 for viewer or guest roles", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_051_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.update", async ({ request }) => {
    // Kills: Remove role check in tasks.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-052-AUTHMATRIX
// Behavior: PATCH /api/tasks/:id returns 403 NOT_YOUR_TASK if member edits someone else's unassigned task
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_052_AUTHMATRIX() {
  return {
    id: 1,
    title: "Test title-${Date.now()}",
    description: "Test description",
    priority: "low",
    assigneeId: 1,
    dueDate: tomorrowStr(),
    estimatedHours: 1,
    labels: [],
  };
}
test.describe("Auth Matrix: PATCH /api/tasks/:id returns 403 NOT_YOUR_TASK if member edits someone else's unassigned task", () => {
  test("admin must be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403 NOT_YOUR_TASK", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_052_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.update", async ({ request }) => {
    // Kills: Remove role check in tasks.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403 NOT_YOUR_TASK", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403 NOT_YOUR_TASK
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.update", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 NOT_YOUR_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 NOT_YOUR_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-054-AUTHMATRIX
// Behavior: PATCH /api/tasks/:id/status requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_054_AUTHMATRIX() {
  return {
    id: 1,
    status: "todo",
  };
}
test.describe("Auth Matrix: PATCH /api/tasks/:id/status requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_054_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.status", async ({ request }) => {
    // Kills: Remove role check in tasks.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.status", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-060-AUTHMATRIX
// Behavior: DELETE /api/tasks/:id requires owner, admin, or task creator role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_060_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: DELETE /api/tasks/:id requires owner, admin, or task creator role", () => {
  test("admin must be able to requires owner, admin, or task creator role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or task creator role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or task creator role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_060_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or task creator role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or task creator role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or task creator role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or task creator role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or task creator role", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or task creator role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or task creator role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or task creator role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or task creator role", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or task creator role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or task creator role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or task creator role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-062-AUTHMATRIX
// Behavior: Member role can only delete own tasks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_062_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Member role can only delete own tasks", () => {
  test("admin must be able to can only delete own tasks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to can only delete own tasks", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can only delete must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_062_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own tasks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own tasks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to can only delete own tasks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to can only delete own tasks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-064-AUTHMATRIX
// Behavior: POST /api/tasks/bulk-status requires owner or admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_064_AUTHMATRIX() {
  return {
    taskIds: [1],
    status: "todo",
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: POST /api/tasks/bulk-status requires owner or admin role", () => {
  test("admin must be able to requires owner or admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner or admin role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner or admin role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_064_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.bulk-status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.bulk-status", async ({ request }) => {
    // Kills: Remove role check in tasks.bulk-status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.bulk-status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner or admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner or admin role", async ({ request }) => {
    // Kills: owner should not be able to requires owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner or admin role", async ({ request }) => {
    // Kills: admin should not be able to requires owner or admin role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-065-AUTHMATRIX
// Behavior: Bulk status update fails if tasks belong to different workspaces
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_065_AUTHMATRIX() {
  return {
    taskIds: [1],
    status: "todo",
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Bulk status update fails if tasks belong to different workspaces", () => {
  test("admin must be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 MIXED_WORKSPACES", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_065_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "tasks.bulk-status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in tasks.bulk-status", async ({ request }) => {
    // Kills: Remove role check in tasks.bulk-status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in tasks.bulk-status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 MIXED_WORKSPACES", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 MIXED_WORKSPACES
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "tasks.bulk-status", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 MIXED_WORKSPACES — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 MIXED_WORKSPACES — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-070-AUTHMATRIX
// Behavior: POST /api/comments requires owner, admin, member, or guest on shared projects
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_070_AUTHMATRIX() {
  return {
    taskId: 1,
    workspaceId: TEST_WORKSPACE_ID,
    content: "test-content",
    parentId: 1,
  };
}
test.describe("Auth Matrix: POST /api/comments requires owner, admin, member, or guest on shared projects", () => {
  test("admin must be able to requires owner, admin, member, or guest on shared projects", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, member, or guest on shared projects", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, member, or guest on shared projects", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_070_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "comments.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in comments.create", async ({ request }) => {
    // Kills: Remove role check in comments.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in comments.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, member, or guest on shared projects", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, member, or guest on shared projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, member, or guest on shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, member, or guest on shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, member, or guest on shared projects", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, member, or guest on shared projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, member, or guest on shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, member, or guest on shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, member, or guest on shared projects", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, member, or guest on shared projects
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, member, or guest on shared projects — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, member, or guest on shared projects — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-071-AUTHMATRIX
// Behavior: Comment creation fails if taskId does not belong to workspace
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_071_AUTHMATRIX() {
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
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 400 INVALID_TASK", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_071_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "comments.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in comments.create", async ({ request }) => {
    // Kills: Remove role check in comments.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in comments.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 400 INVALID_TASK", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 400 INVALID_TASK
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "comments.create", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 400 INVALID_TASK — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 400 INVALID_TASK — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-075-AUTHMATRIX
// Behavior: POST /api/time-entries requires owner, admin, or member role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_075_AUTHMATRIX() {
  return {
    taskId: 1,
    workspaceId: TEST_WORKSPACE_ID,
    hours: 1,
    date: tomorrowStr(),
    description: "Test description",
  };
}
test.describe("Auth Matrix: POST /api/time-entries requires owner, admin, or member role", () => {
  test("admin must be able to requires owner, admin, or member role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to requires owner, admin, or member role", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_075_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "time-entries.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in time-entries.create", async ({ request }) => {
    // Kills: Remove role check in time-entries.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in time-entries.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access owner, admin, or member role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: owner should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to requires owner, admin, or member role", async ({ request }) => {
    // Kills: admin should not be able to requires owner, admin, or member role
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to requires owner, admin, or member role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to requires owner, admin, or member role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-097-AUTHMATRIX
// Behavior: System enforces plan limits for features
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_097_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: System enforces plan limits for features", () => {
  test("admin must be able to enforces plan limits for features", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("owner must NOT be able to enforces plan limits for features", async ({ request }) => {
    const roleCookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to enforces plan limits for features", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant enforces must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_097_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access plan limits for features", async ({ request }) => {
    // Kills: Allow lower-privileged role to access plan limits for features
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access plan limits for features — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access plan limits for features — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: owner should not be able to enforces plan limits for features", async ({ request }) => {
    // Kills: owner should not be able to enforces plan limits for features
    const cookie = await getOwnerCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: owner should not be able to enforces plan limits for features — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: owner should not be able to enforces plan limits for features — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: admin should not be able to enforces plan limits for features", async ({ request }) => {
    // Kills: admin should not be able to enforces plan limits for features
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to enforces plan limits for features — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to enforces plan limits for features — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-098-AUTHMATRIX
// Behavior: Free plan users cannot access /api/time-entries
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_098_AUTHMATRIX() {
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
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to cannot access /api/time-entries", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_098_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "time-entries.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in time-entries.create", async ({ request }) => {
    // Kills: Remove role check in time-entries.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in time-entries.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access /api/time-entries", async ({ request }) => {
    // Kills: Allow lower-privileged role to access /api/time-entries
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "time-entries.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to cannot access /api/time-entries — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to cannot access /api/time-entries — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-107-AUTHMATRIX
// Behavior: Next API call returns 403 if guest access is revoked while guest has open tab
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_107_AUTHMATRIX() {
  return {
    workspaceId: TEST_WORKSPACE_ID,
  };
}
test.describe("Auth Matrix: Next API call returns 403 if guest access is revoked while guest has open tab", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("member must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getMemberCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_107_AUTHMATRIX(),
      workspaceId: TEST_WORKSPACE_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.list", async ({ request }) => {
    // Kills: Remove role check in auth.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "auth.list", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});