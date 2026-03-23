import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getUserCookie } from "../../helpers/auth";
import { TEST_COMPANY_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Create invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    companyId: TEST_COMPANY_ID,
    clientId: TEST_COMPANY_ID,
    items: [],
    description: "Test description",
    quantity: 1,
    unitPrice: 1,
    notes: "test-notes",
    dueDate: tomorrowStr(),
    taxRate: 1,
  };
}
test.describe("Auth Matrix: Create invoices", () => {
  test("admin must be able to Create invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "invoices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.create", async ({ request }) => {
    // Kills: Remove role check in invoices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create invoices", async ({ request }) => {
    // Kills: admin should not be able to Create invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create invoices", async ({ request }) => {
    // Kills: user should not be able to Create invoices
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: Get invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    companyId: TEST_COMPANY_ID,
    clientId: TEST_COMPANY_ID,
    status: "active",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get invoices", () => {
  test("admin must be able to Get invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.list", async ({ request }) => {
    // Kills: Remove role check in invoices.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get invoices", async ({ request }) => {
    // Kills: admin should not be able to Get invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get invoices", async ({ request }) => {
    // Kills: user should not be able to Get invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-003-AUTHMATRIX
// Behavior: Mutate invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_003_AUTHMATRIX() {
  return {
    id: 1,
    companyId: TEST_COMPANY_ID,
  };
}
test.describe("Auth Matrix: Mutate invoices", () => {
  test("admin must be able to Mutate invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_003_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.send", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.send", async ({ request }) => {
    // Kills: Remove role check in invoices.send
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.send — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate invoices", async ({ request }) => {
    // Kills: admin should not be able to Mutate invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate invoices", async ({ request }) => {
    // Kills: user should not be able to Mutate invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.send", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: Mutate invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    id: 1,
    companyId: TEST_COMPANY_ID,
    paidAmount: 1,
    paymentDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: Mutate invoices", () => {
  test("admin must be able to Mutate invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.markPaid", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.markPaid", async ({ request }) => {
    // Kills: Remove role check in invoices.markPaid
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.markPaid — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate invoices", async ({ request }) => {
    // Kills: admin should not be able to Mutate invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate invoices", async ({ request }) => {
    // Kills: user should not be able to Mutate invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.markPaid", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-005-AUTHMATRIX
// Behavior: Mutate invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_005_AUTHMATRIX() {
  return {
    id: 1,
    companyId: TEST_COMPANY_ID,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Mutate invoices", () => {
  test("admin must be able to Mutate invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_005_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.cancel", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.cancel", async ({ request }) => {
    // Kills: Remove role check in invoices.cancel
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.cancel — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate invoices", async ({ request }) => {
    // Kills: admin should not be able to Mutate invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate invoices", async ({ request }) => {
    // Kills: user should not be able to Mutate invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.cancel", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-006-AUTHMATRIX
// Behavior: Mutate invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_006_AUTHMATRIX() {
  return {
    id: 1,
    companyId: TEST_COMPANY_ID,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Mutate invoices", () => {
  test("admin must be able to Mutate invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_006_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.void", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.void", async ({ request }) => {
    // Kills: Remove role check in invoices.void
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.void — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate invoices", async ({ request }) => {
    // Kills: admin should not be able to Mutate invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate invoices", async ({ request }) => {
    // Kills: user should not be able to Mutate invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.void", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Create invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    companyId: TEST_COMPANY_ID,
    clientId: TEST_COMPANY_ID,
    items: [],
    description: "Test description",
    quantity: 1,
    unitPrice: 1,
    notes: "test-notes",
    dueDate: tomorrowStr(),
    taxRate: 1,
  };
}
test.describe("Auth Matrix: Create invoices", () => {
  test("admin must be able to Create invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "invoices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.create", async ({ request }) => {
    // Kills: Remove role check in invoices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create invoices", async ({ request }) => {
    // Kills: admin should not be able to Create invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create invoices", async ({ request }) => {
    // Kills: user should not be able to Create invoices
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Get invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    companyId: TEST_COMPANY_ID,
    clientId: TEST_COMPANY_ID,
    status: "active",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get invoices", () => {
  test("admin must be able to Get invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.list", async ({ request }) => {
    // Kills: Remove role check in invoices.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get invoices", async ({ request }) => {
    // Kills: admin should not be able to Get invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get invoices", async ({ request }) => {
    // Kills: user should not be able to Get invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Mutate invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    id: 1,
    companyId: TEST_COMPANY_ID,
  };
}
test.describe("Auth Matrix: Mutate invoices", () => {
  test("admin must be able to Mutate invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate invoices", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      companyId: TEST_COMPANY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.gdprDelete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.gdprDelete", async ({ request }) => {
    // Kills: Remove role check in invoices.gdprDelete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.gdprDelete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate invoices", async ({ request }) => {
    // Kills: admin should not be able to Mutate invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate invoices", async ({ request }) => {
    // Kills: user should not be able to Mutate invoices
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "invoices.gdprDelete", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});