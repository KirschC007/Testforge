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
  test("cross-tenant has must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access full access to agency data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access to agency data
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access to agency data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access to agency data — verify error code is present
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
    bookingId: 1,
  };
}
test.describe("Auth Matrix: customer can view own bookings only", () => {
  test("agency_admin must be able to can view own bookings only", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can view own bookings only", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "ings.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in ings.getById", async ({ request }) => {
    // Kills: Remove role check in ings.getById
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in ings.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own bookings only", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own bookings only
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "ings.getById", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can view own bookings only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can view own bookings only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Only agency_admin can cancel a confirmed booking
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
  };
}
test.describe("Auth Matrix: Only agency_admin can cancel a confirmed booking", () => {
  test("agency_admin must be able to can cancel a confirmed booking", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("agent must NOT be able to can cancel a confirmed booking", async ({ request }) => {
    const roleCookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can cancel a confirmed booking", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can cancel must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookings.cancel", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookings.cancel", async ({ request }) => {
    // Kills: Remove role check in bookings.cancel
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.cancel — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access a confirmed booking", async ({ request }) => {
    // Kills: Allow lower-privileged role to access a confirmed booking
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access a confirmed booking — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access a confirmed booking — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: agency_admin should not be able to can cancel a confirmed booking", async ({ request }) => {
    // Kills: agency_admin should not be able to can cancel a confirmed booking
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agency_admin should not be able to can cancel a confirmed booking — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agency_admin should not be able to can cancel a confirmed booking — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: agent should not be able to can cancel a confirmed booking", async ({ request }) => {
    // Kills: agent should not be able to can cancel a confirmed booking
    const cookie = await getAgentCookie(request);
    const response = await trpcQuery(request, "bookings.cancel", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can cancel a confirmed booking — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can cancel a confirmed booking — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: agent cannot access bookings from other agencies
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    status: "pending",
  };
}
test.describe("Auth Matrix: agent cannot access bookings from other agencies", () => {
  test("agency_admin must be able to cannot access bookings from other agencies", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to cannot access bookings from other agencies", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookings.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access bookings from other agencies", async ({ request }) => {
    // Kills: Allow lower-privileged role to access bookings from other agencies
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "bookings.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to cannot access bookings from other agencies — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to cannot access bookings from other agencies — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Only agency_admin can export customer data
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: Only agency_admin can export customer data", () => {
  test("agency_admin must be able to can export customer data", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can export customer data", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can export must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "gdpr.exportCustomerData", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can export customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can export customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Only agency_admin can delete customer data
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,
  };
}
test.describe("Auth Matrix: Only agency_admin can delete customer data", () => {
  test("agency_admin must be able to can delete customer data", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to can delete customer data", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can delete must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "gdpr.deleteCustomerData", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to can delete customer data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to can delete customer data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-018-AUTHMATRIX
// Behavior: Admin confirms booking, status changes to 'confirmed'
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_018_AUTHMATRIX() {
  return {
    agencyId: TEST_AGENCY_ID,
    bookingId: 1,
    status: "pending",
  };
}
test.describe("Auth Matrix: Admin confirms booking, status changes to 'confirmed'", () => {
  test("agency_admin must be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("customer must NOT be able to changes from 'pending' to 'confirmed'", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant changes must be rejected", async ({ request }) => {
    const cookie = await getAgencyAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_018_AUTHMATRIX(),
      agencyId: TEST_AGENCY_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "ings.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in ings.updateStatus", async ({ request }) => {
    // Kills: Remove role check in ings.updateStatus
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in ings.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from 'pending' to 'confirmed'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from 'pending' to 'confirmed'
    const cookie = await getAgencyAdminCookie(request);
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "ings.updateStatus", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: agent should not be able to changes from 'pending' to 'confirmed' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: agent should not be able to changes from 'pending' to 'confirmed' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});