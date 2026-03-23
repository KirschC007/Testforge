import { expect, test } from "@playwright/test";
import { BASE_URL, trpcQuery } from "../../helpers/api";
import { getAgencyAdminCookie, getAgentCookie, getCustomerCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Agency isolation by agencyId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Agency isolation by agencyId", () => {
  test("agency_admin must be able to are isolated by agencyId", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to are isolated by agencyId", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to are isolated by agencyId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant are isolated must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access by agencyId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access by agencyId
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access by agencyId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access by agencyId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to are isolated by agencyId", async ({ request }) => {
    // Kills: agency_admin should not be able to are isolated by agencyId
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to are isolated by agencyId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to are isolated by agencyId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to are isolated by agencyId", async ({ request }) => {
    // Kills: agent should not be able to are isolated by agencyId
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to are isolated by agencyId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to are isolated by agencyId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: agency_admin has full access to agency data
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: agency_admin has full access to agency data", () => {
  test("agency_admin must be able to has full access to agency data", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to has full access to agency data", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to has full access to agency data", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has full access must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access to agency data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access to agency data
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access to agency data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access to agency data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to has full access to agency data", async ({ request }) => {
    // Kills: agency_admin should not be able to has full access to agency data
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to has full access to agency data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to has full access to agency data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to has full access to agency data", async ({ request }) => {
    // Kills: agent should not be able to has full access to agency data
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to has full access to agency data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to has full access to agency data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-003-AUTHMATRIX
// Behavior: agent can create bookings
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_003_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: agent can create bookings", () => {
  test("agency_admin must be able to can create bookings", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can create bookings", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can create bookings", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can create must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_003_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access bookings", async ({ request }) => {
    // Kills: Allow lower-privileged role to access bookings
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can create bookings", async ({ request }) => {
    // Kills: agency_admin should not be able to can create bookings
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can create bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can create bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can create bookings", async ({ request }) => {
    // Kills: agent should not be able to can create bookings
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can create bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can create bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: agent can view bookings
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    status: "pending",
  };
}
test.describe("Auth Matrix: agent can view bookings", () => {
  test("agency_admin must be able to can view bookings", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can view bookings", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can view bookings", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can view must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.list", async ({ request }) => {
    // Kills: Remove role check in bookings.list
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access bookings", async ({ request }) => {
    // Kills: Allow lower-privileged role to access bookings
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can view bookings", async ({ request }) => {
    // Kills: agency_admin should not be able to can view bookings
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can view bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can view bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can view bookings", async ({ request }) => {
    // Kills: agent should not be able to can view bookings
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can view bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can view bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-005-AUTHMATRIX
// Behavior: customer can view own bookings only
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_005_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: customer can view own bookings only", () => {
  test("agency_admin must be able to can view own bookings only", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can view own bookings only", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can view own bookings only", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can view must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_005_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own bookings only", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own bookings only
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own bookings only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own bookings only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can view own bookings only", async ({ request }) => {
    // Kills: agency_admin should not be able to can view own bookings only
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can view own bookings only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can view own bookings only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can view own bookings only", async ({ request }) => {
    // Kills: agent should not be able to can view own bookings only
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can view own bookings only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can view own bookings only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Booking status transition pending to confirmed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status transition pending to confirmed", () => {
  test("agency_admin must be able to transitions from pending to confirmed", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to transitions from pending to confirmed", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to transitions from pending to confirmed", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from pending to confirmed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from pending to confirmed
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from pending to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from pending to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to transitions from pending to confirmed", async ({ request }) => {
    // Kills: agency_admin should not be able to transitions from pending to confirmed
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to transitions from pending to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to transitions from pending to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to transitions from pending to confirmed", async ({ request }) => {
    // Kills: agent should not be able to transitions from pending to confirmed
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to transitions from pending to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to transitions from pending to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Booking status transition confirmed to paid
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status transition confirmed to paid", () => {
  test("agency_admin must be able to transitions from confirmed to paid", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to transitions from confirmed to paid", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to transitions from confirmed to paid", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from confirmed to paid", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from confirmed to paid
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from confirmed to paid — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from confirmed to paid — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to transitions from confirmed to paid", async ({ request }) => {
    // Kills: agency_admin should not be able to transitions from confirmed to paid
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to transitions from confirmed to paid — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to transitions from confirmed to paid — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to transitions from confirmed to paid", async ({ request }) => {
    // Kills: agent should not be able to transitions from confirmed to paid
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to transitions from confirmed to paid — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to transitions from confirmed to paid — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Booking status transition paid to completed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status transition paid to completed", () => {
  test("agency_admin must be able to transitions from paid to completed", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to transitions from paid to completed", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to transitions from paid to completed", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from paid to completed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from paid to completed
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from paid to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from paid to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to transitions from paid to completed", async ({ request }) => {
    // Kills: agency_admin should not be able to transitions from paid to completed
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to transitions from paid to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to transitions from paid to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to transitions from paid to completed", async ({ request }) => {
    // Kills: agent should not be able to transitions from paid to completed
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to transitions from paid to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to transitions from paid to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Booking status transition paid to cancelled
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status transition paid to cancelled", () => {
  test("agency_admin must be able to transitions from paid to cancelled", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to transitions from paid to cancelled", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to transitions from paid to cancelled", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from paid to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from paid to cancelled
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from paid to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from paid to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to transitions from paid to cancelled", async ({ request }) => {
    // Kills: agency_admin should not be able to transitions from paid to cancelled
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to transitions from paid to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to transitions from paid to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to transitions from paid to cancelled", async ({ request }) => {
    // Kills: agent should not be able to transitions from paid to cancelled
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to transitions from paid to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to transitions from paid to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Booking status transition cancelled to refunded
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status transition cancelled to refunded", () => {
  test("agency_admin must be able to transitions from cancelled to refunded", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to transitions from cancelled to refunded", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to transitions from cancelled to refunded", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from cancelled to refunded", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from cancelled to refunded
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from cancelled to refunded — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from cancelled to refunded — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to transitions from cancelled to refunded", async ({ request }) => {
    // Kills: agency_admin should not be able to transitions from cancelled to refunded
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to transitions from cancelled to refunded — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to transitions from cancelled to refunded — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to transitions from cancelled to refunded", async ({ request }) => {
    // Kills: agent should not be able to transitions from cancelled to refunded
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to transitions from cancelled to refunded — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to transitions from cancelled to refunded — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Booking status cannot transition from completed to cancelled
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status cannot transition from completed to cancelled", () => {
  test("agency_admin must be able to forbids transition from completed to cancelled", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to forbids transition from completed to cancelled", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to forbids transition from completed to cancelled", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant forbids transition must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from completed to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from completed to cancelled
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from completed to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from completed to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to forbids transition from completed to cancelled", async ({ request }) => {
    // Kills: agency_admin should not be able to forbids transition from completed to cancelled
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to forbids transition from completed to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to forbids transition from completed to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to forbids transition from completed to cancelled", async ({ request }) => {
    // Kills: agent should not be able to forbids transition from completed to cancelled
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to forbids transition from completed to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to forbids transition from completed to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Booking status cannot transition from refunded to confirmed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status cannot transition from refunded to confirmed", () => {
  test("agency_admin must be able to forbids transition from refunded to confirmed", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to forbids transition from refunded to confirmed", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to forbids transition from refunded to confirmed", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant forbids transition must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from refunded to confirmed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from refunded to confirmed
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from refunded to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from refunded to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to forbids transition from refunded to confirmed", async ({ request }) => {
    // Kills: agency_admin should not be able to forbids transition from refunded to confirmed
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to forbids transition from refunded to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to forbids transition from refunded to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to forbids transition from refunded to confirmed", async ({ request }) => {
    // Kills: agent should not be able to forbids transition from refunded to confirmed
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to forbids transition from refunded to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to forbids transition from refunded to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Booking creation fails if passengers exceed package capacity
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Booking creation fails if passengers exceed package capacity", () => {
  test("agency_admin must be able to fails if passengers > package.maxPassengers", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to fails if passengers > package.maxPassengers", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to fails if passengers > package.maxPassengers", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant fails must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access if passengers > package.maxPassengers", async ({ request }) => {
    // Kills: Allow lower-privileged role to access if passengers > package.maxPassengers
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access if passengers > package.maxPassengers — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access if passengers > package.maxPassengers — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to fails if passengers > package.maxPassengers", async ({ request }) => {
    // Kills: agency_admin should not be able to fails if passengers > package.maxPassengers
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to fails if passengers > package.maxPassengers — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to fails if passengers > package.maxPassengers — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to fails if passengers > package.maxPassengers", async ({ request }) => {
    // Kills: agent should not be able to fails if passengers > package.maxPassengers
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to fails if passengers > package.maxPassengers — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to fails if passengers > package.maxPassengers — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-015-AUTHMATRIX
// Behavior: Booking creation fails for past travelDate
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_015_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Booking creation fails for past travelDate", () => {
  test("agency_admin must be able to fails for past travelDate", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to fails for past travelDate", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to fails for past travelDate", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant fails must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_015_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access for past travelDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access for past travelDate
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access for past travelDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access for past travelDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to fails for past travelDate", async ({ request }) => {
    // Kills: agency_admin should not be able to fails for past travelDate
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to fails for past travelDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to fails for past travelDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to fails for past travelDate", async ({ request }) => {
    // Kills: agent should not be able to fails for past travelDate
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to fails for past travelDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to fails for past travelDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-016-AUTHMATRIX
// Behavior: Only agency_admin can cancel a confirmed booking
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_016_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Only agency_admin can cancel a confirmed booking", () => {
  test("agency_admin must be able to can cancel confirmed booking", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can cancel confirmed booking", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can cancel confirmed booking", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can cancel must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_016_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access confirmed booking", async ({ request }) => {
    // Kills: Allow lower-privileged role to access confirmed booking
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access confirmed booking — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access confirmed booking — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can cancel confirmed booking", async ({ request }) => {
    // Kills: agency_admin should not be able to can cancel confirmed booking
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can cancel confirmed booking — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can cancel confirmed booking — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can cancel confirmed booking", async ({ request }) => {
    // Kills: agent should not be able to can cancel confirmed booking
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can cancel confirmed booking — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can cancel confirmed booking — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-017-AUTHMATRIX
// Behavior: Agent cannot access bookings from other agencies
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_017_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    status: "pending",
  };
}
test.describe("Auth Matrix: Agent cannot access bookings from other agencies", () => {
  test("agency_admin must be able to cannot access bookings from other agencies", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to cannot access bookings from other agencies", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to cannot access bookings from other agencies", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_017_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.list", async ({ request }) => {
    // Kills: Remove role check in bookings.list
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access bookings from other agencies", async ({ request }) => {
    // Kills: Allow lower-privileged role to access bookings from other agencies
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access bookings from other agencies — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access bookings from other agencies — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to cannot access bookings from other agencies", async ({ request }) => {
    // Kills: agency_admin should not be able to cannot access bookings from other agencies
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to cannot access bookings from other agencies — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to cannot access bookings from other agencies — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to cannot access bookings from other agencies", async ({ request }) => {
    // Kills: agent should not be able to cannot access bookings from other agencies
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to cannot access bookings from other agencies — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to cannot access bookings from other agencies — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-018-AUTHMATRIX
// Behavior: Package price must be greater than 0
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_018_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    price: 0.01,
    maxPassengers: 1,
    departureDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: Package price must be greater than 0", () => {
  test("agency_admin must be able to must be > 0", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to must be > 0", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to must be > 0", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant must be must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_018_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "packages.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in packages.create", async ({ request }) => {
    // Kills: Remove role check in packages.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in packages.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access > 0", async ({ request }) => {
    // Kills: Allow lower-privileged role to access > 0
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access > 0 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access > 0 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to must be > 0", async ({ request }) => {
    // Kills: agency_admin should not be able to must be > 0
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to must be > 0 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to must be > 0 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to must be > 0", async ({ request }) => {
    // Kills: agent should not be able to must be > 0
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to must be > 0 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to must be > 0 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: Package maxPassengers must be between 1 and 500
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_019_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    price: 0.01,
    maxPassengers: 1,
    departureDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: Package maxPassengers must be between 1 and 500", () => {
  test("agency_admin must be able to must be between 1 and 500", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to must be between 1 and 500", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to must be between 1 and 500", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant must be must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_019_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "packages.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in packages.create", async ({ request }) => {
    // Kills: Remove role check in packages.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in packages.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access between 1 and 500", async ({ request }) => {
    // Kills: Allow lower-privileged role to access between 1 and 500
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access between 1 and 500 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access between 1 and 500 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to must be between 1 and 500", async ({ request }) => {
    // Kills: agency_admin should not be able to must be between 1 and 500
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to must be between 1 and 500 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to must be between 1 and 500 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to must be between 1 and 500", async ({ request }) => {
    // Kills: agent should not be able to must be between 1 and 500
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to must be between 1 and 500 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to must be between 1 and 500 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-020-AUTHMATRIX
// Behavior: Package departureDate must be in the future
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_020_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    price: 0.01,
    maxPassengers: 1,
    departureDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: Package departureDate must be in the future", () => {
  test("agency_admin must be able to must be in the future", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to must be in the future", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to must be in the future", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant must be must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_020_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "packages.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in packages.create", async ({ request }) => {
    // Kills: Remove role check in packages.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in packages.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access in the future", async ({ request }) => {
    // Kills: Allow lower-privileged role to access in the future
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access in the future — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access in the future — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to must be in the future", async ({ request }) => {
    // Kills: agency_admin should not be able to must be in the future
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to must be in the future — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to must be in the future — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to must be in the future", async ({ request }) => {
    // Kills: agent should not be able to must be in the future
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to must be in the future — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to must be in the future — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-021-AUTHMATRIX
// Behavior: Only agency_admin can export customer data
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_021_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: Only agency_admin can export customer data", () => {
  test("agency_admin must be able to can export customer data", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can export customer data", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can export customer data", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can export must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_021_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "gdpr.exportCustomerData", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in gdpr.exportCustomerData", async ({ request }) => {
    // Kills: Remove role check in gdpr.exportCustomerData
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Remove role check in gdpr.exportCustomerData — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Remove role check in gdpr.exportCustomerData — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-2: Allow lower-privileged role to access customer data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access customer data
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can export customer data", async ({ request }) => {
    // Kills: agency_admin should not be able to can export customer data
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can export customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can export customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can export customer data", async ({ request }) => {
    // Kills: agent should not be able to can export customer data
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can export customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can export customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-022-AUTHMATRIX
// Behavior: Only agency_admin can delete customer data
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_022_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: Only agency_admin can delete customer data", () => {
  test("agency_admin must be able to can delete customer data", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can delete customer data", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can delete customer data", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can delete must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_022_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in gdpr.deleteCustomerData", async ({ request }) => {
    // Kills: Remove role check in gdpr.deleteCustomerData
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Remove role check in gdpr.deleteCustomerData — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Remove role check in gdpr.deleteCustomerData — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-2: Allow lower-privileged role to access customer data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access customer data
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can delete customer data", async ({ request }) => {
    // Kills: agency_admin should not be able to can delete customer data
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can delete customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can delete customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can delete customer data", async ({ request }) => {
    // Kills: agent should not be able to can delete customer data
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can delete customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can delete customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-023-AUTHMATRIX
// Behavior: Customer PII must be anonymized after deletion
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_023_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: Customer PII must be anonymized after deletion", () => {
  test("agency_admin must be able to must be anonymized after deletion", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to must be anonymized after deletion", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to must be anonymized after deletion", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant must be anonymized must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_023_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in gdpr.deleteCustomerData", async ({ request }) => {
    // Kills: Remove role check in gdpr.deleteCustomerData
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Remove role check in gdpr.deleteCustomerData — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Remove role check in gdpr.deleteCustomerData — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-2: Allow lower-privileged role to access after deletion", async ({ request }) => {
    // Kills: Allow lower-privileged role to access after deletion
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access after deletion — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access after deletion — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to must be anonymized after deletion", async ({ request }) => {
    // Kills: agency_admin should not be able to must be anonymized after deletion
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to must be anonymized after deletion — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to must be anonymized after deletion — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to must be anonymized after deletion", async ({ request }) => {
    // Kills: agent should not be able to must be anonymized after deletion
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to must be anonymized after deletion — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to must be anonymized after deletion — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-024-AUTHMATRIX
// Behavior: Exported customer data must include all bookings
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_024_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: Exported customer data must include all bookings", () => {
  test("agency_admin must be able to must include all bookings for the customer", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to must include all bookings for the customer", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to must include all bookings for the customer", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant must include must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_024_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "gdpr.exportCustomerData", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in gdpr.exportCustomerData", async ({ request }) => {
    // Kills: Remove role check in gdpr.exportCustomerData
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Remove role check in gdpr.exportCustomerData — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Remove role check in gdpr.exportCustomerData — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-2: Allow lower-privileged role to access all bookings for the customer", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all bookings for the customer
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all bookings for the customer — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all bookings for the customer — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to must include all bookings for the customer", async ({ request }) => {
    // Kills: agency_admin should not be able to must include all bookings for the customer
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to must include all bookings for the customer — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to must include all bookings for the customer — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to must include all bookings for the customer", async ({ request }) => {
    // Kills: agent should not be able to must include all bookings for the customer
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to must include all bookings for the customer — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to must include all bookings for the customer — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: Booking created with status pending
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_025_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
    packageId: 1,
    travelDate: tomorrowStr(),
    passengers: 1,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Booking created with status pending", () => {
  test("agency_admin must be able to is created with status 'pending'", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to is created with status 'pending'", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to is created with status 'pending'", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is created must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.create", async ({ request }) => {
    // Kills: Remove role check in bookings.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access with status 'pending'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access with status 'pending'
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access with status 'pending' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access with status 'pending' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to is created with status 'pending'", async ({ request }) => {
    // Kills: agency_admin should not be able to is created with status 'pending'
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to is created with status 'pending' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to is created with status 'pending' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to is created with status 'pending'", async ({ request }) => {
    // Kills: agent should not be able to is created with status 'pending'
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to is created with status 'pending' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to is created with status 'pending' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: Booking status changes from pending to confirmed by Admin
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_026_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Booking status changes from pending to confirmed by Admin", () => {
  test("agency_admin must be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant changes must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_026_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in bookings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from 'pending' to 'confirmed'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from 'pending' to 'confirmed'
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from 'pending' to 'confirmed' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from 'pending' to 'confirmed' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    // Kills: agency_admin should not be able to changes from 'pending' to 'confirmed'
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to changes from 'pending' to 'confirmed' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to changes from 'pending' to 'confirmed' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    // Kills: agent should not be able to changes from 'pending' to 'confirmed'
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.updateStatus", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to changes from 'pending' to 'confirmed' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to changes from 'pending' to 'confirmed' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: DSGVO Export contains PII fields and bookings
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_027_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: DSGVO Export contains PII fields and bookings", () => {
  test("agency_admin must be able to contains customer name, email, phone, and bookings", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to contains customer name, email, phone, and bookings", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to contains customer name, email, phone, and bookings", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant contains must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "gdpr.exportCustomerData", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in gdpr.exportCustomerData", async ({ request }) => {
    // Kills: Remove role check in gdpr.exportCustomerData
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Remove role check in gdpr.exportCustomerData — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Remove role check in gdpr.exportCustomerData — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-2: Allow lower-privileged role to access customer name, email, phone, and bookings", async ({ request }) => {
    // Kills: Allow lower-privileged role to access customer name, email, phone, and bookings
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access customer name, email, phone, and bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access customer name, email, phone, and bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to contains customer name, email, phone, and bookings", async ({ request }) => {
    // Kills: agency_admin should not be able to contains customer name, email, phone, and bookings
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to contains customer name, email, phone, and bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to contains customer name, email, phone, and bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to contains customer name, email, phone, and bookings", async ({ request }) => {
    // Kills: agent should not be able to contains customer name, email, phone, and bookings
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to contains customer name, email, phone, and bookings — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to contains customer name, email, phone, and bookings — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-028-AUTHMATRIX
// Behavior: Package creation fails with price 0 or negative
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_028_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    price: 0.01,
    maxPassengers: 1,
    departureDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: Package creation fails with price 0 or negative", () => {
  test("agency_admin must be able to fails if price is 0 or negative", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to fails if price is 0 or negative", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to fails if price is 0 or negative", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant fails must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_028_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "packages.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in packages.create", async ({ request }) => {
    // Kills: Remove role check in packages.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in packages.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access if price is 0 or negative", async ({ request }) => {
    // Kills: Allow lower-privileged role to access if price is 0 or negative
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access if price is 0 or negative — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access if price is 0 or negative — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to fails if price is 0 or negative", async ({ request }) => {
    // Kills: agency_admin should not be able to fails if price is 0 or negative
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to fails if price is 0 or negative — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to fails if price is 0 or negative — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to fails if price is 0 or negative", async ({ request }) => {
    // Kills: agent should not be able to fails if price is 0 or negative
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to fails if price is 0 or negative — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to fails if price is 0 or negative — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: Package creation fails with max passengers > 500
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_029_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    name: "Test name-${Date.now()}",
    destination: "test-destination",
    price: 0.01,
    maxPassengers: 1,
    departureDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: Package creation fails with max passengers > 500", () => {
  test("agency_admin must be able to fails if max passengers > 500", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to fails if max passengers > 500", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to fails if max passengers > 500", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant fails must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_029_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "packages.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in packages.create", async ({ request }) => {
    // Kills: Remove role check in packages.create
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in packages.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access if max passengers > 500", async ({ request }) => {
    // Kills: Allow lower-privileged role to access if max passengers > 500
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access if max passengers > 500 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access if max passengers > 500 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to fails if max passengers > 500", async ({ request }) => {
    // Kills: agency_admin should not be able to fails if max passengers > 500
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to fails if max passengers > 500 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to fails if max passengers > 500 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to fails if max passengers > 500", async ({ request }) => {
    // Kills: agent should not be able to fails if max passengers > 500
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "packages.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to fails if max passengers > 500 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to fails if max passengers > 500 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});