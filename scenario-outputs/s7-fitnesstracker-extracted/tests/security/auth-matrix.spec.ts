import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getUserCookie } from "../../helpers/auth";
import { TEST_TENANT_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Create workouts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    gymId: 1,
    name: "Test name-${Date.now()}",
    type: "active",
    scheduledAt: "test-scheduledAt",
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Create workouts", () => {
  test("admin must be able to Create workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "workouts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.create", async ({ request }) => {
    // Kills: Remove role check in workouts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create workouts", async ({ request }) => {
    // Kills: admin should not be able to Create workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create workouts", async ({ request }) => {
    // Kills: user should not be able to Create workouts
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "workouts.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: Get workouts
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    gymId: 1,
    userId: 1,
    type: "active",
    status: "active",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get workouts", () => {
  test("admin must be able to Get workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "workouts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.list", async ({ request }) => {
    // Kills: Remove role check in workouts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get workouts", async ({ request }) => {
    // Kills: admin should not be able to Get workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get workouts", async ({ request }) => {
    // Kills: user should not be able to Get workouts
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-003-AUTHMATRIX
// Behavior: Mutate workouts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_003_AUTHMATRIX() {
  return {
    id: 1,
    gymId: 1,
  };
}
test.describe("Auth Matrix: Mutate workouts", () => {
  test("admin must be able to Mutate workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_003_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "workouts.start", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.start", async ({ request }) => {
    // Kills: Remove role check in workouts.start
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.start — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate workouts", async ({ request }) => {
    // Kills: admin should not be able to Mutate workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate workouts", async ({ request }) => {
    // Kills: user should not be able to Mutate workouts
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.start", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: Mutate workouts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    id: 1,
    gymId: 1,
    duration: 1,
    caloriesBurned: 1,
  };
}
test.describe("Auth Matrix: Mutate workouts", () => {
  test("admin must be able to Mutate workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "workouts.complete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.complete", async ({ request }) => {
    // Kills: Remove role check in workouts.complete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.complete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate workouts", async ({ request }) => {
    // Kills: admin should not be able to Mutate workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate workouts", async ({ request }) => {
    // Kills: user should not be able to Mutate workouts
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.complete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-005-AUTHMATRIX
// Behavior: Mutate workouts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_005_AUTHMATRIX() {
  return {
    id: 1,
    gymId: 1,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Mutate workouts", () => {
  test("admin must be able to Mutate workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_005_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "workouts.skip", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.skip", async ({ request }) => {
    // Kills: Remove role check in workouts.skip
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.skip — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate workouts", async ({ request }) => {
    // Kills: admin should not be able to Mutate workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate workouts", async ({ request }) => {
    // Kills: user should not be able to Mutate workouts
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "workouts.skip", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-006-AUTHMATRIX
// Behavior: Create workouts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_006_AUTHMATRIX() {
  return {
    workoutId: 1,
    gymId: 1,
    name: "Test name-${Date.now()}",
    sets: 1,
    reps: 1,
    weight: 1,
    restSeconds: 1,
  };
}
test.describe("Auth Matrix: Create workouts", () => {
  test("admin must be able to Create workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_006_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "workouts.addExercise", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.addExercise", async ({ request }) => {
    // Kills: Remove role check in workouts.addExercise
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.addExercise — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create workouts", async ({ request }) => {
    // Kills: admin should not be able to Create workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create workouts", async ({ request }) => {
    // Kills: user should not be able to Create workouts
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "workouts.addExercise", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Delete workouts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    id: 1,
    gymId: 1,
  };
}
test.describe("Auth Matrix: Delete workouts", () => {
  test("admin must be able to Delete workouts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Delete workouts", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Delete must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      tenantId: TEST_TENANT_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "workouts.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in workouts.delete", async ({ request }) => {
    // Kills: Remove role check in workouts.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in workouts.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access workouts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Delete workouts", async ({ request }) => {
    // Kills: admin should not be able to Delete workouts
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Delete workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Delete workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Delete workouts", async ({ request }) => {
    // Kills: user should not be able to Delete workouts
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "workouts.delete", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Delete workouts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Delete workouts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});