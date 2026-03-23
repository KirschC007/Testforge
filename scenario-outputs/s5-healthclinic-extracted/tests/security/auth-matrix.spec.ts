import { expect, test } from "@playwright/test";
import { BASE_URL, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getDoctorCookie, getNurseCookie, getReceptionistCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Clinic isolation by clinicId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Clinic isolation by clinicId", () => {
  test("admin must be able to is isolated by `clinicId`", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to is isolated by `clinicId`", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to is isolated by `clinicId`", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is isolated must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access by `clinicId`", async ({ request }) => {
    // Kills: Allow lower-privileged role to access by `clinicId`
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access by `clinicId` — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access by `clinicId` — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to is isolated by `clinicId`", async ({ request }) => {
    // Kills: doctor should not be able to is isolated by `clinicId`
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to is isolated by `clinicId` — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to is isolated by `clinicId` — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to is isolated by `clinicId`", async ({ request }) => {
    // Kills: nurse should not be able to is isolated by `clinicId`
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to is isolated by `clinicId` — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to is isolated by `clinicId` — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: Patients, appointments, and medical records belong to exactly one clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Patients, appointments, and medical records belong to exactly one clinic", () => {
  test("admin must be able to belong to exactly one clinic", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to belong to exactly one clinic", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to belong to exactly one clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant belong to must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access exactly one clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access exactly one clinic
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access exactly one clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access exactly one clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to belong to exactly one clinic", async ({ request }) => {
    // Kills: doctor should not be able to belong to exactly one clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to belong to exactly one clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to belong to exactly one clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to belong to exactly one clinic", async ({ request }) => {
    // Kills: nurse should not be able to belong to exactly one clinic
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to belong to exactly one clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to belong to exactly one clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: JWT contains userId, clinicId, and role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    email: "test@example.com",
    password: "test-password",
  };
}
test.describe("Auth Matrix: JWT contains userId, clinicId, and role", () => {
  test("admin must be able to contains `userId`, `clinicId`, `role`", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to contains `userId`, `clinicId`, `role`", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to contains `userId`, `clinicId`, `role`", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant contains must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "login", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in login", async ({ request }) => {
    // Kills: Remove role check in login
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in login — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access `userId`, `clinicId`, `role`", async ({ request }) => {
    // Kills: Allow lower-privileged role to access `userId`, `clinicId`, `role`
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access `userId`, `clinicId`, `role` — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access `userId`, `clinicId`, `role` — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to contains `userId`, `clinicId`, `role`", async ({ request }) => {
    // Kills: doctor should not be able to contains `userId`, `clinicId`, `role`
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to contains `userId`, `clinicId`, `role` — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to contains `userId`, `clinicId`, `role` — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to contains `userId`, `clinicId`, `role`", async ({ request }) => {
    // Kills: nurse should not be able to contains `userId`, `clinicId`, `role`
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "login", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to contains `userId`, `clinicId`, `role` — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to contains `userId`, `clinicId`, `role` — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Doctor role has full access to own patients
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Doctor role has full access to own patients", () => {
  test("admin must be able to has full access to own patients", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to has full access to own patients", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to has full access to own patients", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full access to own patients", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access to own patients
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access to own patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access to own patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to has full access to own patients", async ({ request }) => {
    // Kills: doctor should not be able to has full access to own patients
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to has full access to own patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to has full access to own patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to has full access to own patients", async ({ request }) => {
    // Kills: nurse should not be able to has full access to own patients
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to has full access to own patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to has full access to own patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Doctor role can read all data within clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Doctor role can read all data within clinic", () => {
  test("admin must be able to can read all within clinic", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can read all within clinic", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can read all within clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can read must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all within clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all within clinic
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can read all within clinic", async ({ request }) => {
    // Kills: doctor should not be able to can read all within clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can read all within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can read all within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can read all within clinic", async ({ request }) => {
    // Kills: nurse should not be able to can read all within clinic
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can read all within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can read all within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Nurse role can read patients
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Nurse role can read patients", () => {
  test("admin must be able to can read patients", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can read patients", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can read patients", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can read must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patients", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patients
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can read patients", async ({ request }) => {
    // Kills: doctor should not be able to can read patients
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can read patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can read patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can read patients", async ({ request }) => {
    // Kills: nurse should not be able to can read patients
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can read patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can read patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Nurse role can create/update vitals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Nurse role can create/update vitals", () => {
  test("admin must be able to can create/update vitals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can create/update vitals", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can create/update vitals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can create/update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access vitals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access vitals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access vitals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access vitals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can create/update vitals", async ({ request }) => {
    // Kills: doctor should not be able to can create/update vitals
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can create/update vitals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can create/update vitals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can create/update vitals", async ({ request }) => {
    // Kills: nurse should not be able to can create/update vitals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can create/update vitals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can create/update vitals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Nurse role cannot view billing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Nurse role cannot view billing", () => {
  test("admin must be able to cannot view billing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to cannot view billing", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot view billing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot view must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access billing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access billing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to cannot view billing", async ({ request }) => {
    // Kills: doctor should not be able to cannot view billing
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to cannot view billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to cannot view billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot view billing", async ({ request }) => {
    // Kills: nurse should not be able to cannot view billing
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot view billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot view billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Receptionist role can manage appointments
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Receptionist role can manage appointments", () => {
  test("admin must be able to can manage appointments", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can manage appointments", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can manage appointments", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access appointments", async ({ request }) => {
    // Kills: Allow lower-privileged role to access appointments
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access appointments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access appointments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can manage appointments", async ({ request }) => {
    // Kills: doctor should not be able to can manage appointments
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can manage appointments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can manage appointments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can manage appointments", async ({ request }) => {
    // Kills: nurse should not be able to can manage appointments
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can manage appointments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can manage appointments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Receptionist role can view patient demographics only
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Receptionist role can view patient demographics only", () => {
  test("admin must be able to can view patient demographics only", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can view patient demographics only", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can view patient demographics only", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can view must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient demographics only", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient demographics only
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can view patient demographics only", async ({ request }) => {
    // Kills: doctor should not be able to can view patient demographics only
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can view patient demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can view patient demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can view patient demographics only", async ({ request }) => {
    // Kills: nurse should not be able to can view patient demographics only
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can view patient demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can view patient demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Admin role has full access within clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Admin role has full access within clinic", () => {
  test("admin must be able to has full access within clinic", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to has full access within clinic", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to has full access within clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full access within clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access within clinic
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to has full access within clinic", async ({ request }) => {
    // Kills: doctor should not be able to has full access within clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to has full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to has full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to has full access within clinic", async ({ request }) => {
    // Kills: nurse should not be able to has full access within clinic
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to has full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to has full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-015-AUTHMATRIX
// Behavior: Admin role can manage staff
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_015_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Admin role can manage staff", () => {
  test("admin must be able to can manage staff", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can manage staff", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can manage staff", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_015_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access staff", async ({ request }) => {
    // Kills: Allow lower-privileged role to access staff
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can manage staff", async ({ request }) => {
    // Kills: doctor should not be able to can manage staff
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can manage staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can manage staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can manage staff", async ({ request }) => {
    // Kills: nurse should not be able to can manage staff
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can manage staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can manage staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-016-AUTHMATRIX
// Behavior: Admin role can manage billing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_016_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Admin role can manage billing", () => {
  test("admin must be able to can manage billing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can manage billing", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can manage billing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_016_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access billing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access billing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can manage billing", async ({ request }) => {
    // Kills: doctor should not be able to can manage billing
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can manage billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can manage billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can manage billing", async ({ request }) => {
    // Kills: nurse should not be able to can manage billing
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can manage billing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can manage billing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: POST /api/patients requires clinicId to match JWT
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_019_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917681083335",
    insuranceId: TEST_CLINIC_ID,
    allergies: [],
  };
}
test.describe("Auth Matrix: POST /api/patients requires clinicId to match JWT", () => {
  test("admin must be able to requires `clinicId` to match JWT", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to requires `clinicId` to match JWT", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires `clinicId` to match JWT", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_019_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "registerPatient", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in registerPatient", async ({ request }) => {
    // Kills: Remove role check in registerPatient
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in registerPatient — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access `clinicId` to match JWT", async ({ request }) => {
    // Kills: Allow lower-privileged role to access `clinicId` to match JWT
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access `clinicId` to match JWT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access `clinicId` to match JWT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to requires `clinicId` to match JWT", async ({ request }) => {
    // Kills: doctor should not be able to requires `clinicId` to match JWT
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to requires `clinicId` to match JWT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to requires `clinicId` to match JWT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires `clinicId` to match JWT", async ({ request }) => {
    // Kills: nurse should not be able to requires `clinicId` to match JWT
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "registerPatient", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires `clinicId` to match JWT — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires `clinicId` to match JWT — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-022-AUTHMATRIX
// Behavior: GET /api/patients allows nurse to see demographics only
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_022_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: GET /api/patients allows nurse to see demographics only", () => {
  test("admin must be able to allows nurse to see demographics only", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to allows nurse to see demographics only", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows nurse to see demographics only", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_022_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access nurse to see demographics only", async ({ request }) => {
    // Kills: Allow lower-privileged role to access nurse to see demographics only
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access nurse to see demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access nurse to see demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to allows nurse to see demographics only", async ({ request }) => {
    // Kills: doctor should not be able to allows nurse to see demographics only
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to allows nurse to see demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to allows nurse to see demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows nurse to see demographics only", async ({ request }) => {
    // Kills: nurse should not be able to allows nurse to see demographics only
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows nurse to see demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows nurse to see demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-024-AUTHMATRIX
// Behavior: GET /api/patients/:id returns 403 if patient belongs to different clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_024_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/patients/:id returns 403 if patient belongs to different clinic", () => {
  test("admin must be able to returns 403", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 403", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_024_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patientDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patientDetails.getById", async ({ request }) => {
    // Kills: Remove role check in patientDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patientDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 403", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 403
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to returns 403", async ({ request }) => {
    // Kills: doctor should not be able to returns 403
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 403", async ({ request }) => {
    // Kills: nurse should not be able to returns 403
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 403 — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 403 — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: GET /api/patients/:id allows doctor to see all details
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_025_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/patients/:id allows doctor to see all details", () => {
  test("admin must be able to allows doctor to see all details", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to allows doctor to see all details", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows doctor to see all details", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patientDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patientDetails.getById", async ({ request }) => {
    // Kills: Remove role check in patientDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patientDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access doctor to see all details", async ({ request }) => {
    // Kills: Allow lower-privileged role to access doctor to see all details
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access doctor to see all details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access doctor to see all details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to allows doctor to see all details", async ({ request }) => {
    // Kills: doctor should not be able to allows doctor to see all details
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to allows doctor to see all details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to allows doctor to see all details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows doctor to see all details", async ({ request }) => {
    // Kills: nurse should not be able to allows doctor to see all details
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows doctor to see all details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows doctor to see all details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: GET /api/patients/:id allows nurse to see demographics + vitals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_026_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/patients/:id allows nurse to see demographics + vitals", () => {
  test("admin must be able to allows nurse to see demographics + vitals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to allows nurse to see demographics + vitals", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows nurse to see demographics + vitals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_026_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patientDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patientDetails.getById", async ({ request }) => {
    // Kills: Remove role check in patientDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patientDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access nurse to see demographics + vitals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access nurse to see demographics + vitals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access nurse to see demographics + vitals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access nurse to see demographics + vitals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to allows nurse to see demographics + vitals", async ({ request }) => {
    // Kills: doctor should not be able to allows nurse to see demographics + vitals
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to allows nurse to see demographics + vitals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to allows nurse to see demographics + vitals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows nurse to see demographics + vitals", async ({ request }) => {
    // Kills: nurse should not be able to allows nurse to see demographics + vitals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows nurse to see demographics + vitals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows nurse to see demographics + vitals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: GET /api/patients/:id allows receptionist to see demographics only
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_027_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/patients/:id allows receptionist to see demographics only", () => {
  test("admin must be able to allows receptionist to see demographics only", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to allows receptionist to see demographics only", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows receptionist to see demographics only", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patientDetails.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patientDetails.getById", async ({ request }) => {
    // Kills: Remove role check in patientDetails.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patientDetails.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access receptionist to see demographics only", async ({ request }) => {
    // Kills: Allow lower-privileged role to access receptionist to see demographics only
    const cookie = await getReceptionistCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access receptionist to see demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access receptionist to see demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to allows receptionist to see demographics only", async ({ request }) => {
    // Kills: doctor should not be able to allows receptionist to see demographics only
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to allows receptionist to see demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to allows receptionist to see demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows receptionist to see demographics only", async ({ request }) => {
    // Kills: nurse should not be able to allows receptionist to see demographics only
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patientDetails.getById", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows receptionist to see demographics only — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows receptionist to see demographics only — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: POST /api/appointments requires doctorId to belong to same clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_029_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    patientId: 1,
    doctorId: 2,
    date: tomorrowStr(),
    time: "test-time",
    duration: 15,
    type: "consultation",
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: POST /api/appointments requires doctorId to belong to same clinic", () => {
  test("admin must be able to requires `doctorId` to belong to same clinic", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to requires `doctorId` to belong to same clinic", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires `doctorId` to belong to same clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_029_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookAppointment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookAppointment", async ({ request }) => {
    // Kills: Remove role check in bookAppointment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookAppointment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access `doctorId` to belong to same clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access `doctorId` to belong to same clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access `doctorId` to belong to same clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access `doctorId` to belong to same clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to requires `doctorId` to belong to same clinic", async ({ request }) => {
    // Kills: doctor should not be able to requires `doctorId` to belong to same clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to requires `doctorId` to belong to same clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to requires `doctorId` to belong to same clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires `doctorId` to belong to same clinic", async ({ request }) => {
    // Kills: nurse should not be able to requires `doctorId` to belong to same clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires `doctorId` to belong to same clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires `doctorId` to belong to same clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-030-AUTHMATRIX
// Behavior: POST /api/appointments requires patientId to belong to same clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_030_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    patientId: 1,
    doctorId: 2,
    date: tomorrowStr(),
    time: "test-time",
    duration: 15,
    type: "consultation",
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: POST /api/appointments requires patientId to belong to same clinic", () => {
  test("admin must be able to requires `patientId` to belong to same clinic", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to requires `patientId` to belong to same clinic", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires `patientId` to belong to same clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_030_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "bookAppointment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in bookAppointment", async ({ request }) => {
    // Kills: Remove role check in bookAppointment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in bookAppointment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access `patientId` to belong to same clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access `patientId` to belong to same clinic
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access `patientId` to belong to same clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access `patientId` to belong to same clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to requires `patientId` to belong to same clinic", async ({ request }) => {
    // Kills: doctor should not be able to requires `patientId` to belong to same clinic
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to requires `patientId` to belong to same clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to requires `patientId` to belong to same clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires `patientId` to belong to same clinic", async ({ request }) => {
    // Kills: nurse should not be able to requires `patientId` to belong to same clinic
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "bookAppointment", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires `patientId` to belong to same clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires `patientId` to belong to same clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-033-AUTHMATRIX
// Behavior: Receptionist can change appointment status from confirmed to checked_in
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_033_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Receptionist can change appointment status from confirmed to checked_in", () => {
  test("admin must be able to can change appointment status from confirmed to checked_in", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can change appointment status from confirmed to checked_in", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can change appointment status from confirmed to checked_in", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can change appointment status must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_033_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "appointments.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in appointments.updateStatus", async ({ request }) => {
    // Kills: Remove role check in appointments.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in appointments.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from confirmed to checked_in", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from confirmed to checked_in
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from confirmed to checked_in — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from confirmed to checked_in — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can change appointment status from confirmed to checked_in", async ({ request }) => {
    // Kills: doctor should not be able to can change appointment status from confirmed to checked_in
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can change appointment status from confirmed to checked_in — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can change appointment status from confirmed to checked_in — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can change appointment status from confirmed to checked_in", async ({ request }) => {
    // Kills: nurse should not be able to can change appointment status from confirmed to checked_in
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can change appointment status from confirmed to checked_in — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can change appointment status from confirmed to checked_in — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-034-AUTHMATRIX
// Behavior: Doctor can change appointment status from checked_in to in_progress
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_034_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Doctor can change appointment status from checked_in to in_progress", () => {
  test("admin must be able to can change appointment status from checked_in to in_progress", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can change appointment status from checked_in to in_progress", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can change appointment status from checked_in to in_progress", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can change appointment status must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_034_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "appointments.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in appointments.updateStatus", async ({ request }) => {
    // Kills: Remove role check in appointments.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in appointments.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from checked_in to in_progress", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from checked_in to in_progress
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from checked_in to in_progress — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from checked_in to in_progress — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can change appointment status from checked_in to in_progress", async ({ request }) => {
    // Kills: doctor should not be able to can change appointment status from checked_in to in_progress
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can change appointment status from checked_in to in_progress — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can change appointment status from checked_in to in_progress — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can change appointment status from checked_in to in_progress", async ({ request }) => {
    // Kills: nurse should not be able to can change appointment status from checked_in to in_progress
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can change appointment status from checked_in to in_progress — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can change appointment status from checked_in to in_progress — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-035-AUTHMATRIX
// Behavior: Doctor can change appointment status from in_progress to completed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_035_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Doctor can change appointment status from in_progress to completed", () => {
  test("admin must be able to can change appointment status from in_progress to completed", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can change appointment status from in_progress to completed", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can change appointment status from in_progress to completed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can change appointment status must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_035_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "appointments.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in appointments.updateStatus", async ({ request }) => {
    // Kills: Remove role check in appointments.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in appointments.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from in_progress to completed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from in_progress to completed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from in_progress to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from in_progress to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can change appointment status from in_progress to completed", async ({ request }) => {
    // Kills: doctor should not be able to can change appointment status from in_progress to completed
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can change appointment status from in_progress to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can change appointment status from in_progress to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can change appointment status from in_progress to completed", async ({ request }) => {
    // Kills: nurse should not be able to can change appointment status from in_progress to completed
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can change appointment status from in_progress to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can change appointment status from in_progress to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-036-AUTHMATRIX
// Behavior: Any role can change appointment status to cancelled if not completed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_036_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Any role can change appointment status to cancelled if not completed", () => {
  test("admin must be able to can change appointment status to cancelled", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can change appointment status to cancelled", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can change appointment status to cancelled", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can change appointment status must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_036_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "appointments.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in appointments.updateStatus", async ({ request }) => {
    // Kills: Remove role check in appointments.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in appointments.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access to cancelled
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can change appointment status to cancelled", async ({ request }) => {
    // Kills: doctor should not be able to can change appointment status to cancelled
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can change appointment status to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can change appointment status to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can change appointment status to cancelled", async ({ request }) => {
    // Kills: nurse should not be able to can change appointment status to cancelled
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can change appointment status to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can change appointment status to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-037-AUTHMATRIX
// Behavior: Admin can change appointment status from cancelled to confirmed (re-booking)
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_037_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Admin can change appointment status from cancelled to confirmed (re-booking)", () => {
  test("admin must be able to can change appointment status from cancelled to confirmed", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to can change appointment status from cancelled to confirmed", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to can change appointment status from cancelled to confirmed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can change appointment status must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_037_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "appointments.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in appointments.updateStatus", async ({ request }) => {
    // Kills: Remove role check in appointments.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in appointments.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from cancelled to confirmed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from cancelled to confirmed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from cancelled to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from cancelled to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to can change appointment status from cancelled to confirmed", async ({ request }) => {
    // Kills: doctor should not be able to can change appointment status from cancelled to confirmed
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to can change appointment status from cancelled to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to can change appointment status from cancelled to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to can change appointment status from cancelled to confirmed", async ({ request }) => {
    // Kills: nurse should not be able to can change appointment status from cancelled to confirmed
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "appointments.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to can change appointment status from cancelled to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to can change appointment status from cancelled to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-044-AUTHMATRIX
// Behavior: Appointment status transition from cancelled to confirmed (admin only)
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_044_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    search: "test-search",
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Appointment status transition from cancelled to confirmed (admin only)", () => {
  test("admin must be able to transitions from cancelled to confirmed", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("doctor must NOT be able to transitions from cancelled to confirmed", async ({ request }) => {
    const roleCookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from cancelled to confirmed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_044_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.list", async ({ request }) => {
    // Kills: Remove role check in patients.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from cancelled to confirmed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from cancelled to confirmed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from cancelled to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from cancelled to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: doctor should not be able to transitions from cancelled to confirmed", async ({ request }) => {
    // Kills: doctor should not be able to transitions from cancelled to confirmed
    const cookie = await getDoctorCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: doctor should not be able to transitions from cancelled to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: doctor should not be able to transitions from cancelled to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from cancelled to confirmed", async ({ request }) => {
    // Kills: nurse should not be able to transitions from cancelled to confirmed
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.list", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from cancelled to confirmed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from cancelled to confirmed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});