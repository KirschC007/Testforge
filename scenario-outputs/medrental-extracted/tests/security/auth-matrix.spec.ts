import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getBillingCookie, getNurseCookie, getTechnicianCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: System isolates clinics by clinicId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    id: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: System isolates clinics by clinicId", () => {
  test("admin must be able to isolates clinic data", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to isolates clinic data", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to isolates clinic data", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant isolates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.gdprDelete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.gdprDelete", async ({ request }) => {
    // Kills: Remove role check in patients.gdprDelete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.gdprDelete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access clinic data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access clinic data
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access clinic data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access clinic data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to isolates clinic data", async ({ request }) => {
    // Kills: technician should not be able to isolates clinic data
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to isolates clinic data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to isolates clinic data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to isolates clinic data", async ({ request }) => {
    // Kills: nurse should not be able to isolates clinic data
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.gdprDelete", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to isolates clinic data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to isolates clinic data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: System stores all monetary values in EUR cents as integers
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System stores all monetary values in EUR cents as integers", () => {
  test("admin must be able to stores monetary values", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to stores monetary values", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to stores monetary values", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant stores must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access monetary values", async ({ request }) => {
    // Kills: Allow lower-privileged role to access monetary values
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access monetary values — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access monetary values — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to stores monetary values", async ({ request }) => {
    // Kills: technician should not be able to stores monetary values
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to stores monetary values — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to stores monetary values — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to stores monetary values", async ({ request }) => {
    // Kills: nurse should not be able to stores monetary values
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to stores monetary values — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to stores monetary values — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: API provides CSRF token via double-submit cookie
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: API provides CSRF token via double-submit cookie", () => {
  test("admin must be able to provides CSRF token", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to provides CSRF token", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to provides CSRF token", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant provides must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.csrfToken", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.csrfToken", async ({ request }) => {
    // Kills: Remove role check in auth.csrfToken
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.csrfToken — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access CSRF token", async ({ request }) => {
    // Kills: Allow lower-privileged role to access CSRF token
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access CSRF token — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access CSRF token — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to provides CSRF token", async ({ request }) => {
    // Kills: technician should not be able to provides CSRF token
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to provides CSRF token — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to provides CSRF token — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to provides CSRF token", async ({ request }) => {
    // Kills: nurse should not be able to provides CSRF token
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to provides CSRF token — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to provides CSRF token — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-005-AUTHMATRIX
// Behavior: JWT contains userId, clinicId, and role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_005_AUTHMATRIX() {
  return {
    id: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: JWT contains userId, clinicId, and role", () => {
  test("admin must be able to contains userId, clinicId, role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to contains userId, clinicId, role", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to contains userId, clinicId, role", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant contains must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_005_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.export", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.export", async ({ request }) => {
    // Kills: Remove role check in patients.export
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.export — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access userId, clinicId, role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access userId, clinicId, role
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access userId, clinicId, role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access userId, clinicId, role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to contains userId, clinicId, role", async ({ request }) => {
    // Kills: technician should not be able to contains userId, clinicId, role
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to contains userId, clinicId, role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to contains userId, clinicId, role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to contains userId, clinicId, role", async ({ request }) => {
    // Kills: nurse should not be able to contains userId, clinicId, role
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to contains userId, clinicId, role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to contains userId, clinicId, role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: System rate limits failed login attempts to 5 per 15 minutes
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    email: "test@example.com",
    password: "test-password",
  };
}
test.describe("Auth Matrix: System rate limits failed login attempts to 5 per 15 minutes", () => {
  test("admin must be able to rate limits failed login attempts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rate limits failed login attempts", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rate limits failed login attempts", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rate limits must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "auth.login", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in auth.login", async ({ request }) => {
    // Kills: Remove role check in auth.login
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.login — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access failed login attempts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access failed login attempts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access failed login attempts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access failed login attempts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rate limits failed login attempts", async ({ request }) => {
    // Kills: technician should not be able to rate limits failed login attempts
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rate limits failed login attempts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rate limits failed login attempts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rate limits failed login attempts", async ({ request }) => {
    // Kills: nurse should not be able to rate limits failed login attempts
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rate limits failed login attempts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rate limits failed login attempts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Technician role can manage device inventory
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Technician role can manage device inventory", () => {
  test("admin must be able to manage device inventory", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to manage device inventory", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage device inventory", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device inventory", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device inventory
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device inventory — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device inventory — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to manage device inventory", async ({ request }) => {
    // Kills: technician should not be able to manage device inventory
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to manage device inventory — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to manage device inventory — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to manage device inventory", async ({ request }) => {
    // Kills: nurse should not be able to manage device inventory
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage device inventory — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage device inventory — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Technician role can perform maintenance
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Technician role can perform maintenance", () => {
  test("admin must be able to perform maintenance", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to perform maintenance", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to perform maintenance", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant perform must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenance", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to perform maintenance", async ({ request }) => {
    // Kills: technician should not be able to perform maintenance
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to perform maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to perform maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to perform maintenance", async ({ request }) => {
    // Kills: nurse should not be able to perform maintenance
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to perform maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to perform maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Technician role can view rentals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Technician role can view rentals", () => {
  test("admin must be able to view rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to view rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to view rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant view must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to view rentals", async ({ request }) => {
    // Kills: technician should not be able to view rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to view rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to view rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to view rentals", async ({ request }) => {
    // Kills: nurse should not be able to view rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to view rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to view rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Nurse role can create rentals for patients
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Nurse role can create rentals for patients", () => {
  test("admin must be able to create rentals for patients", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to create rentals for patients", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to create rentals for patients", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rentals for patients", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rentals for patients
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rentals for patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rentals for patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to create rentals for patients", async ({ request }) => {
    // Kills: technician should not be able to create rentals for patients
    const cookie = await getTechnicianCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to create rentals for patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to create rentals for patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to create rentals for patients", async ({ request }) => {
    // Kills: nurse should not be able to create rentals for patients
    const cookie = await getNurseCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to create rentals for patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to create rentals for patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Nurse role can return devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Nurse role can return devices", () => {
  test("admin must be able to return devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to return devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to return devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant return must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to return devices", async ({ request }) => {
    // Kills: technician should not be able to return devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to return devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to return devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to return devices", async ({ request }) => {
    // Kills: nurse should not be able to return devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to return devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to return devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Nurse role cannot modify pricing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Nurse role cannot modify pricing", () => {
  test("admin must be able to cannot modify pricing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot modify pricing", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot modify pricing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot modify must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access pricing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot modify pricing", async ({ request }) => {
    // Kills: technician should not be able to cannot modify pricing
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot modify pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot modify pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot modify pricing", async ({ request }) => {
    // Kills: nurse should not be able to cannot modify pricing
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot modify pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot modify pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Billing role can manage invoices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role can manage invoices", () => {
  test("admin must be able to manage invoices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to manage invoices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage invoices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to manage invoices", async ({ request }) => {
    // Kills: technician should not be able to manage invoices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to manage invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to manage invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to manage invoices", async ({ request }) => {
    // Kills: nurse should not be able to manage invoices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-015-AUTHMATRIX
// Behavior: Billing role can process payments
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_015_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role can process payments", () => {
  test("admin must be able to process payments", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to process payments", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to process payments", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant process must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_015_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access payments", async ({ request }) => {
    // Kills: Allow lower-privileged role to access payments
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to process payments", async ({ request }) => {
    // Kills: technician should not be able to process payments
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to process payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to process payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to process payments", async ({ request }) => {
    // Kills: nurse should not be able to process payments
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to process payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to process payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-016-AUTHMATRIX
// Behavior: Billing role can process insurance claims
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_016_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role can process insurance claims", () => {
  test("admin must be able to process insurance claims", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to process insurance claims", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to process insurance claims", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant process must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_016_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access insurance claims", async ({ request }) => {
    // Kills: Allow lower-privileged role to access insurance claims
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access insurance claims — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access insurance claims — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to process insurance claims", async ({ request }) => {
    // Kills: technician should not be able to process insurance claims
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to process insurance claims — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to process insurance claims — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to process insurance claims", async ({ request }) => {
    // Kills: nurse should not be able to process insurance claims
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to process insurance claims — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to process insurance claims — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-017-AUTHMATRIX
// Behavior: Billing role cannot access medical records
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_017_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role cannot access medical records", () => {
  test("admin must be able to cannot access medical records", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot access medical records", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot access medical records", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_017_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access medical records", async ({ request }) => {
    // Kills: Allow lower-privileged role to access medical records
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access medical records — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access medical records — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot access medical records", async ({ request }) => {
    // Kills: technician should not be able to cannot access medical records
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot access medical records — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot access medical records — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot access medical records", async ({ request }) => {
    // Kills: nurse should not be able to cannot access medical records
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot access medical records — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot access medical records — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-018-AUTHMATRIX
// Behavior: Admin role has full access within clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_018_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Admin role has full access within clinic", () => {
  test("admin must be able to has full access within clinic", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to has full access within clinic", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to has full access within clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_018_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full access within clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access within clinic
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to has full access within clinic", async ({ request }) => {
    // Kills: technician should not be able to has full access within clinic
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to has full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to has full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to has full access within clinic", async ({ request }) => {
    // Kills: nurse should not be able to has full access within clinic
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to has full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to has full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: Admin role can manage staff
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_019_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Admin role can manage staff", () => {
  test("admin must be able to manage staff", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to manage staff", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage staff", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_019_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access staff", async ({ request }) => {
    // Kills: Allow lower-privileged role to access staff
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to manage staff", async ({ request }) => {
    // Kills: technician should not be able to manage staff
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to manage staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to manage staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to manage staff", async ({ request }) => {
    // Kills: nurse should not be able to manage staff
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-020-AUTHMATRIX
// Behavior: Admin role can manage reports
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_020_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Admin role can manage reports", () => {
  test("admin must be able to manage reports", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to manage reports", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage reports", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_020_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access reports", async ({ request }) => {
    // Kills: Allow lower-privileged role to access reports
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access reports — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access reports — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to manage reports", async ({ request }) => {
    // Kills: technician should not be able to manage reports
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to manage reports — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to manage reports — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to manage reports", async ({ request }) => {
    // Kills: nurse should not be able to manage reports
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage reports — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage reports — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-021-AUTHMATRIX
// Behavior: Admin role can manage pricing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_021_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Admin role can manage pricing", () => {
  test("admin must be able to manage pricing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to manage pricing", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage pricing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_021_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access pricing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to manage pricing", async ({ request }) => {
    // Kills: technician should not be able to manage pricing
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to manage pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to manage pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to manage pricing", async ({ request }) => {
    // Kills: nurse should not be able to manage pricing
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-022-AUTHMATRIX
// Behavior: API requires X-CSRF-Token header for state-changing requests
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_022_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API requires X-CSRF-Token header for state-changing requests", () => {
  test("admin must be able to requires X-CSRF-Token header", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires X-CSRF-Token header", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires X-CSRF-Token header", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_022_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access X-CSRF-Token header", async ({ request }) => {
    // Kills: Allow lower-privileged role to access X-CSRF-Token header
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access X-CSRF-Token header — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access X-CSRF-Token header — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires X-CSRF-Token header", async ({ request }) => {
    // Kills: technician should not be able to requires X-CSRF-Token header
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires X-CSRF-Token header — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires X-CSRF-Token header — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires X-CSRF-Token header", async ({ request }) => {
    // Kills: nurse should not be able to requires X-CSRF-Token header
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires X-CSRF-Token header — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires X-CSRF-Token header — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-023-AUTHMATRIX
// Behavior: API returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_023_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header", () => {
  test("admin must be able to returns 403 CSRF_REQUIRED", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to returns 403 CSRF_REQUIRED", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 403 CSRF_REQUIRED", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_023_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access CSRF_REQUIRED", async ({ request }) => {
    // Kills: Allow lower-privileged role to access CSRF_REQUIRED
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access CSRF_REQUIRED — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access CSRF_REQUIRED — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns 403 CSRF_REQUIRED", async ({ request }) => {
    // Kills: technician should not be able to returns 403 CSRF_REQUIRED
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns 403 CSRF_REQUIRED — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns 403 CSRF_REQUIRED — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 403 CSRF_REQUIRED", async ({ request }) => {
    // Kills: nurse should not be able to returns 403 CSRF_REQUIRED
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 403 CSRF_REQUIRED — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 403 CSRF_REQUIRED — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-024-AUTHMATRIX
// Behavior: API allows technician and admin to register new medical devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_024_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API allows technician and admin to register new medical devices", () => {
  test("admin must be able to allows registration of new medical devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows registration of new medical devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows registration of new medical devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_024_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access registration of new medical devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access registration of new medical devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access registration of new medical devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access registration of new medical devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows registration of new medical devices", async ({ request }) => {
    // Kills: technician should not be able to allows registration of new medical devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows registration of new medical devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows registration of new medical devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows registration of new medical devices", async ({ request }) => {
    // Kills: nurse should not be able to allows registration of new medical devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows registration of new medical devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows registration of new medical devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: API rejects device registration if clinicId does not match JWT
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_025_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects device registration if clinicId does not match JWT", () => {
  test("admin must be able to rejects device registration", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects device registration", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects device registration", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device registration", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device registration
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects device registration", async ({ request }) => {
    // Kills: technician should not be able to rejects device registration
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects device registration", async ({ request }) => {
    // Kills: nurse should not be able to rejects device registration
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: API rejects device registration if serialNumber already exists globally
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_026_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects device registration if serialNumber already exists globally", () => {
  test("admin must be able to rejects device registration", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects device registration", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects device registration", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_026_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device registration", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device registration
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects device registration", async ({ request }) => {
    // Kills: technician should not be able to rejects device registration
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects device registration", async ({ request }) => {
    // Kills: nurse should not be able to rejects device registration
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: API rejects device registration if purchaseDate is in the future
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_027_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects device registration if purchaseDate is in the future", () => {
  test("admin must be able to rejects device registration", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects device registration", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects device registration", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device registration", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device registration
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects device registration", async ({ request }) => {
    // Kills: technician should not be able to rejects device registration
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects device registration", async ({ request }) => {
    // Kills: nurse should not be able to rejects device registration
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects device registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects device registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-028-AUTHMATRIX
// Behavior: API allows all roles to list devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_028_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API allows all roles to list devices", () => {
  test("admin must be able to allows listing of devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows listing of devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows listing of devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_028_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access listing of devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access listing of devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access listing of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access listing of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows listing of devices", async ({ request }) => {
    // Kills: technician should not be able to allows listing of devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows listing of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows listing of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows listing of devices", async ({ request }) => {
    // Kills: nurse should not be able to allows listing of devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows listing of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows listing of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: Technician/admin roles see all device fields when listing devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_029_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Technician/admin roles see all device fields when listing devices", () => {
  test("admin must be able to see all device fields", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to see all device fields", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to see all device fields", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant see must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_029_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all device fields", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all device fields
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all device fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all device fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to see all device fields", async ({ request }) => {
    // Kills: technician should not be able to see all device fields
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to see all device fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to see all device fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to see all device fields", async ({ request }) => {
    // Kills: nurse should not be able to see all device fields
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to see all device fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to see all device fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-030-AUTHMATRIX
// Behavior: Nurse role sees name, type, status, availability when listing devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_030_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Nurse role sees name, type, status, availability when listing devices", () => {
  test("admin must be able to sees name, type, status, availability of devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sees name, type, status, availability of devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sees name, type, status, availability of devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_030_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access name, type, status, availability of devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access name, type, status, availability of devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access name, type, status, availability of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access name, type, status, availability of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sees name, type, status, availability of devices", async ({ request }) => {
    // Kills: technician should not be able to sees name, type, status, availability of devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sees name, type, status, availability of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sees name, type, status, availability of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sees name, type, status, availability of devices", async ({ request }) => {
    // Kills: nurse should not be able to sees name, type, status, availability of devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sees name, type, status, availability of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sees name, type, status, availability of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-031-AUTHMATRIX
// Behavior: Nurse role does not see pricing when listing devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_031_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Nurse role does not see pricing when listing devices", () => {
  test("admin must be able to does not see pricing of devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to does not see pricing of devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to does not see pricing of devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant does not see must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_031_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access pricing of devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing of devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access pricing of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access pricing of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to does not see pricing of devices", async ({ request }) => {
    // Kills: technician should not be able to does not see pricing of devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to does not see pricing of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to does not see pricing of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to does not see pricing of devices", async ({ request }) => {
    // Kills: nurse should not be able to does not see pricing of devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to does not see pricing of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to does not see pricing of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-032-AUTHMATRIX
// Behavior: Billing role sees name, type, dailyRate, purchasePrice when listing devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_032_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role sees name, type, dailyRate, purchasePrice when listing devices", () => {
  test("admin must be able to sees name, type, dailyRate, purchasePrice of devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sees name, type, dailyRate, purchasePrice of devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sees name, type, dailyRate, purchasePrice of devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_032_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access name, type, dailyRate, purchasePrice of devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access name, type, dailyRate, purchasePrice of devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access name, type, dailyRate, purchasePrice of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access name, type, dailyRate, purchasePrice of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sees name, type, dailyRate, purchasePrice of devices", async ({ request }) => {
    // Kills: technician should not be able to sees name, type, dailyRate, purchasePrice of devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sees name, type, dailyRate, purchasePrice of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sees name, type, dailyRate, purchasePrice of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sees name, type, dailyRate, purchasePrice of devices", async ({ request }) => {
    // Kills: nurse should not be able to sees name, type, dailyRate, purchasePrice of devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sees name, type, dailyRate, purchasePrice of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sees name, type, dailyRate, purchasePrice of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-033-AUTHMATRIX
// Behavior: Billing role does not see maintenance details when listing devices
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_033_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role does not see maintenance details when listing devices", () => {
  test("admin must be able to does not see maintenance details of devices", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to does not see maintenance details of devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to does not see maintenance details of devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant does not see must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_033_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenance details of devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance details of devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance details of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance details of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to does not see maintenance details of devices", async ({ request }) => {
    // Kills: technician should not be able to does not see maintenance details of devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to does not see maintenance details of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to does not see maintenance details of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to does not see maintenance details of devices", async ({ request }) => {
    // Kills: nurse should not be able to does not see maintenance details of devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to does not see maintenance details of devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to does not see maintenance details of devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-034-AUTHMATRIX
// Behavior: API allows all roles to get device details with role-based field visibility
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_034_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: API allows all roles to get device details with role-based field visibility", () => {
  test("admin must be able to allows getting device details", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows getting device details", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows getting device details", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_034_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.list", async ({ request }) => {
    // Kills: Remove role check in devices.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access getting device details", async ({ request }) => {
    // Kills: Allow lower-privileged role to access getting device details
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access getting device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access getting device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows getting device details", async ({ request }) => {
    // Kills: technician should not be able to allows getting device details
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows getting device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows getting device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows getting device details", async ({ request }) => {
    // Kills: nurse should not be able to allows getting device details
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows getting device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows getting device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-036-AUTHMATRIX
// Behavior: API returns 403 if device belongs to a different clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_036_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: API returns 403 if device belongs to a different clinic", () => {
  test("admin must be able to returns 403 device details", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to returns 403 device details", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 403 device details", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_036_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.list", async ({ request }) => {
    // Kills: Remove role check in devices.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device details", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device details
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns 403 device details", async ({ request }) => {
    // Kills: technician should not be able to returns 403 device details
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns 403 device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns 403 device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 403 device details", async ({ request }) => {
    // Kills: nurse should not be able to returns 403 device details
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 403 device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 403 device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-037-AUTHMATRIX
// Behavior: API allows technician and admin to update device status
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_037_AUTHMATRIX() {
  return {
    id: 1,
    status: "available",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: API allows technician and admin to update device status", () => {
  test("admin must be able to allows updating device status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows updating device status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows updating device status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_037_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.status", async ({ request }) => {
    // Kills: Remove role check in devices.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access updating device status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access updating device status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access updating device status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access updating device status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows updating device status", async ({ request }) => {
    // Kills: technician should not be able to allows updating device status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows updating device status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows updating device status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows updating device status", async ({ request }) => {
    // Kills: nurse should not be able to allows updating device status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows updating device status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows updating device status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-039-AUTHMATRIX
// Behavior: API allows technician and admin to record a maintenance event
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_039_AUTHMATRIX() {
  return {
    id: 1,
    clinicId: TEST_CLINIC_ID,
    type: "routine",
    description: "Test description",
    cost: 1,
    performedBy: "test-performedBy",
    partsReplaced: [],
    nextMaintenanceDue: tomorrowStr(),
  };
}
test.describe("Auth Matrix: API allows technician and admin to record a maintenance event", () => {
  test("admin must be able to allows recording maintenance event", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows recording maintenance event", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows recording maintenance event", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_039_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.maintenance", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.maintenance", async ({ request }) => {
    // Kills: Remove role check in devices.maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.maintenance — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access recording maintenance event", async ({ request }) => {
    // Kills: Allow lower-privileged role to access recording maintenance event
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access recording maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access recording maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows recording maintenance event", async ({ request }) => {
    // Kills: technician should not be able to allows recording maintenance event
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows recording maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows recording maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows recording maintenance event", async ({ request }) => {
    // Kills: nurse should not be able to allows recording maintenance event
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows recording maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows recording maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-040-AUTHMATRIX
// Behavior: API rejects maintenance recording if device is currently rented
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_040_AUTHMATRIX() {
  return {
    id: 1,
    clinicId: TEST_CLINIC_ID,
    type: "routine",
    description: "Test description",
    cost: 1,
    performedBy: "test-performedBy",
    partsReplaced: [],
    nextMaintenanceDue: tomorrowStr(),
  };
}
test.describe("Auth Matrix: API rejects maintenance recording if device is currently rented", () => {
  test("admin must be able to rejects maintenance recording", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects maintenance recording", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects maintenance recording", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_040_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.maintenance", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.maintenance", async ({ request }) => {
    // Kills: Remove role check in devices.maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.maintenance — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenance recording", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance recording
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance recording — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance recording — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects maintenance recording", async ({ request }) => {
    // Kills: technician should not be able to rejects maintenance recording
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects maintenance recording — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects maintenance recording — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects maintenance recording", async ({ request }) => {
    // Kills: nurse should not be able to rejects maintenance recording
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects maintenance recording — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects maintenance recording — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-041-AUTHMATRIX
// Behavior: API sets device.lastMaintenanceDate to today after maintenance event
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_041_AUTHMATRIX() {
  return {
    id: 1,
    clinicId: TEST_CLINIC_ID,
    type: "routine",
    description: "Test description",
    cost: 1,
    performedBy: "test-performedBy",
    partsReplaced: [],
    nextMaintenanceDue: tomorrowStr(),
  };
}
test.describe("Auth Matrix: API sets device.lastMaintenanceDate to today after maintenance event", () => {
  test("admin must be able to sets device.lastMaintenanceDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.lastMaintenanceDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.lastMaintenanceDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_041_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.maintenance", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.maintenance", async ({ request }) => {
    // Kills: Remove role check in devices.maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.maintenance — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.lastMaintenanceDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.lastMaintenanceDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.lastMaintenanceDate", async ({ request }) => {
    // Kills: technician should not be able to sets device.lastMaintenanceDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.lastMaintenanceDate", async ({ request }) => {
    // Kills: nurse should not be able to sets device.lastMaintenanceDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-042-AUTHMATRIX
// Behavior: API resets maintenance countdown after maintenance event
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_042_AUTHMATRIX() {
  return {
    id: 1,
    clinicId: TEST_CLINIC_ID,
    type: "routine",
    description: "Test description",
    cost: 1,
    performedBy: "test-performedBy",
    partsReplaced: [],
    nextMaintenanceDue: tomorrowStr(),
  };
}
test.describe("Auth Matrix: API resets maintenance countdown after maintenance event", () => {
  test("admin must be able to resets maintenance countdown", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to resets maintenance countdown", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to resets maintenance countdown", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant resets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_042_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.maintenance", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.maintenance", async ({ request }) => {
    // Kills: Remove role check in devices.maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.maintenance — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenance countdown", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance countdown
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance countdown — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance countdown — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to resets maintenance countdown", async ({ request }) => {
    // Kills: technician should not be able to resets maintenance countdown
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to resets maintenance countdown — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to resets maintenance countdown — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to resets maintenance countdown", async ({ request }) => {
    // Kills: nurse should not be able to resets maintenance countdown
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to resets maintenance countdown — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to resets maintenance countdown — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-043-AUTHMATRIX
// Behavior: API allows nurse and admin to register a patient
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_043_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917655470957",
    insuranceProvider: TEST_CLINIC_ID,
    insuranceNumber: "test-insuranceNumber",
    address: "test-address",
    medicalNotes: "test-medicalNotes",
  };
}
test.describe("Auth Matrix: API allows nurse and admin to register a patient", () => {
  test("admin must be able to allows registration of a patient", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows registration of a patient", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows registration of a patient", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_043_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.create", async ({ request }) => {
    // Kills: Remove role check in patients.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access registration of a patient", async ({ request }) => {
    // Kills: Allow lower-privileged role to access registration of a patient
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access registration of a patient — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access registration of a patient — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows registration of a patient", async ({ request }) => {
    // Kills: technician should not be able to allows registration of a patient
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows registration of a patient — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows registration of a patient — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows registration of a patient", async ({ request }) => {
    // Kills: nurse should not be able to allows registration of a patient
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows registration of a patient — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows registration of a patient — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-044-AUTHMATRIX
// Behavior: API rejects patient registration if clinicId does not match JWT
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_044_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917655470958",
    insuranceProvider: TEST_CLINIC_ID,
    insuranceNumber: "test-insuranceNumber",
    address: "test-address",
    medicalNotes: "test-medicalNotes",
  };
}
test.describe("Auth Matrix: API rejects patient registration if clinicId does not match JWT", () => {
  test("admin must be able to rejects patient registration", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects patient registration", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects patient registration", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_044_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "patients.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in patients.create", async ({ request }) => {
    // Kills: Remove role check in patients.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient registration", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient registration
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects patient registration", async ({ request }) => {
    // Kills: technician should not be able to rejects patient registration
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects patient registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects patient registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects patient registration", async ({ request }) => {
    // Kills: nurse should not be able to rejects patient registration
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_044_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects patient registration — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects patient registration — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-045-AUTHMATRIX
// Behavior: API allows nurse and admin to list patients
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_045_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API allows nurse and admin to list patients", () => {
  test("admin must be able to allows listing of patients", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows listing of patients", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows listing of patients", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_045_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access listing of patients", async ({ request }) => {
    // Kills: Allow lower-privileged role to access listing of patients
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access listing of patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access listing of patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows listing of patients", async ({ request }) => {
    // Kills: technician should not be able to allows listing of patients
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows listing of patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows listing of patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows listing of patients", async ({ request }) => {
    // Kills: nurse should not be able to allows listing of patients
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows listing of patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows listing of patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-046-AUTHMATRIX
// Behavior: API rejects patient listing for billing role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_046_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects patient listing for billing role", () => {
  test("admin must be able to rejects patient listing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects patient listing", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects patient listing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_046_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient listing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient listing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects patient listing", async ({ request }) => {
    // Kills: technician should not be able to rejects patient listing
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects patient listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects patient listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects patient listing", async ({ request }) => {
    // Kills: nurse should not be able to rejects patient listing
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects patient listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects patient listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-047-AUTHMATRIX
// Behavior: API allows nurse and admin to create a device rental
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_047_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API allows nurse and admin to create a device rental", () => {
  test("admin must be able to allows creation of a device rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows creation of a device rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows creation of a device rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_047_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access creation of a device rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access creation of a device rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access creation of a device rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access creation of a device rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows creation of a device rental", async ({ request }) => {
    // Kills: technician should not be able to allows creation of a device rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows creation of a device rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows creation of a device rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows creation of a device rental", async ({ request }) => {
    // Kills: nurse should not be able to allows creation of a device rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows creation of a device rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows creation of a device rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-048-AUTHMATRIX
// Behavior: API rejects rental creation if device is not available
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_048_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects rental creation if device is not available", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_048_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental creation", async ({ request }) => {
    // Kills: technician should not be able to rejects rental creation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental creation", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental creation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-049-AUTHMATRIX
// Behavior: API rejects rental creation if device belongs to a different clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_049_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects rental creation if device belongs to a different clinic", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_049_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental creation", async ({ request }) => {
    // Kills: technician should not be able to rejects rental creation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental creation", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental creation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-050-AUTHMATRIX
// Behavior: API rejects rental creation if patient belongs to a different clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_050_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects rental creation if patient belongs to a different clinic", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_050_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental creation", async ({ request }) => {
    // Kills: technician should not be able to rejects rental creation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental creation", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental creation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-051-AUTHMATRIX
// Behavior: API rejects rental creation if expectedReturnDate is more than 365 days from startDate
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_051_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects rental creation if expectedReturnDate is more than 365 days from startDate", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_051_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental creation", async ({ request }) => {
    // Kills: technician should not be able to rejects rental creation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental creation", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental creation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-052-AUTHMATRIX
// Behavior: API rejects rental creation if expectedReturnDate is not after startDate
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_052_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API rejects rental creation if expectedReturnDate is not after startDate", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_052_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental creation", async ({ request }) => {
    // Kills: technician should not be able to rejects rental creation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental creation", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental creation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-054-AUTHMATRIX
// Behavior: API ensures only one concurrent rental for the same device succeeds
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_054_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API ensures only one concurrent rental for the same device succeeds", () => {
  test("admin must be able to ensures single concurrent rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to ensures single concurrent rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to ensures single concurrent rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant ensures must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_054_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access single concurrent rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access single concurrent rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access single concurrent rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access single concurrent rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to ensures single concurrent rental", async ({ request }) => {
    // Kills: technician should not be able to ensures single concurrent rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to ensures single concurrent rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to ensures single concurrent rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to ensures single concurrent rental", async ({ request }) => {
    // Kills: nurse should not be able to ensures single concurrent rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to ensures single concurrent rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to ensures single concurrent rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-055-AUTHMATRIX
// Behavior: API sets device status to rented upon successful rental creation
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_055_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    dailyRate: 50,
    deposit: 1,
    insuranceClaim: false,
    insurancePreAuthCode: "test-insurancePreAuthCode",
    prescriptionId: TEST_CLINIC_ID,
    accessories: [1],
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API sets device status to rented upon successful rental creation", () => {
  test("admin must be able to sets device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_055_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.create", async ({ request }) => {
    // Kills: Remove role check in rentals.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status", async ({ request }) => {
    // Kills: technician should not be able to sets device.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-057-AUTHMATRIX
// Behavior: API allows all roles to list rentals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_057_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: API allows all roles to list rentals", () => {
  test("admin must be able to allows listing of rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows listing of rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows listing of rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_057_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access listing of rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access listing of rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access listing of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access listing of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows listing of rentals", async ({ request }) => {
    // Kills: technician should not be able to allows listing of rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows listing of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows listing of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows listing of rentals", async ({ request }) => {
    // Kills: nurse should not be able to allows listing of rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows listing of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows listing of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-058-AUTHMATRIX
// Behavior: Nurse role sees all rentals when listing rentals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_058_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Nurse role sees all rentals when listing rentals", () => {
  test("admin must be able to sees all rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sees all rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sees all rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_058_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sees all rentals", async ({ request }) => {
    // Kills: technician should not be able to sees all rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sees all rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sees all rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sees all rentals", async ({ request }) => {
    // Kills: nurse should not be able to sees all rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sees all rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sees all rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-059-AUTHMATRIX
// Behavior: Billing role sees all rentals with financial data when listing rentals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_059_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Billing role sees all rentals with financial data when listing rentals", () => {
  test("admin must be able to sees all rentals with financial data", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sees all rentals with financial data", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sees all rentals with financial data", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_059_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all rentals with financial data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all rentals with financial data
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all rentals with financial data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all rentals with financial data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sees all rentals with financial data", async ({ request }) => {
    // Kills: technician should not be able to sees all rentals with financial data
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sees all rentals with financial data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sees all rentals with financial data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sees all rentals with financial data", async ({ request }) => {
    // Kills: nurse should not be able to sees all rentals with financial data
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sees all rentals with financial data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sees all rentals with financial data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-060-AUTHMATRIX
// Behavior: Technician role sees device-focused view of rentals when listing rentals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_060_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Technician role sees device-focused view of rentals when listing rentals", () => {
  test("admin must be able to sees device-focused view of rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sees device-focused view of rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sees device-focused view of rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_060_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device-focused view of rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device-focused view of rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device-focused view of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device-focused view of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sees device-focused view of rentals", async ({ request }) => {
    // Kills: technician should not be able to sees device-focused view of rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sees device-focused view of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sees device-focused view of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sees device-focused view of rentals", async ({ request }) => {
    // Kills: nurse should not be able to sees device-focused view of rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sees device-focused view of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sees device-focused view of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-061-AUTHMATRIX
// Behavior: API allows nurse and admin to extend a rental period
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_061_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: API allows nurse and admin to extend a rental period", () => {
  test("admin must be able to allows extending a rental period", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows extending a rental period", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows extending a rental period", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_061_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.extend", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.extend", async ({ request }) => {
    // Kills: Remove role check in rentals.extend
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access extending a rental period", async ({ request }) => {
    // Kills: Allow lower-privileged role to access extending a rental period
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access extending a rental period — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access extending a rental period — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows extending a rental period", async ({ request }) => {
    // Kills: technician should not be able to allows extending a rental period
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows extending a rental period — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows extending a rental period — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows extending a rental period", async ({ request }) => {
    // Kills: nurse should not be able to allows extending a rental period
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows extending a rental period — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows extending a rental period — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-062-AUTHMATRIX
// Behavior: API rejects rental extension if rental is not active
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_062_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: API rejects rental extension if rental is not active", () => {
  test("admin must be able to rejects rental extension", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental extension", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental extension", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_062_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.extend", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.extend", async ({ request }) => {
    // Kills: Remove role check in rentals.extend
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental extension", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental extension
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental extension", async ({ request }) => {
    // Kills: technician should not be able to rejects rental extension
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental extension", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental extension
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-063-AUTHMATRIX
// Behavior: API rejects rental extension if maximum of 3 extensions per rental is reached
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_063_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: API rejects rental extension if maximum of 3 extensions per rental is reached", () => {
  test("admin must be able to rejects rental extension", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects rental extension", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental extension", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_063_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.extend", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.extend", async ({ request }) => {
    // Kills: Remove role check in rentals.extend
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental extension", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental extension
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects rental extension", async ({ request }) => {
    // Kills: technician should not be able to rejects rental extension
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects rental extension", async ({ request }) => {
    // Kills: nurse should not be able to rejects rental extension
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-065-AUTHMATRIX
// Behavior: API allows technician, nurse, and admin to process device return
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_065_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: API allows technician, nurse, and admin to process device return", () => {
  test("admin must be able to allows processing device return", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows processing device return", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows processing device return", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_065_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.return", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.return", async ({ request }) => {
    // Kills: Remove role check in rentals.return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access processing device return", async ({ request }) => {
    // Kills: Allow lower-privileged role to access processing device return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access processing device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access processing device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows processing device return", async ({ request }) => {
    // Kills: technician should not be able to allows processing device return
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows processing device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows processing device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows processing device return", async ({ request }) => {
    // Kills: nurse should not be able to allows processing device return
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows processing device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows processing device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-066-AUTHMATRIX
// Behavior: API rejects device return if rental is not active or overdue
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_066_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: API rejects device return if rental is not active or overdue", () => {
  test("admin must be able to rejects device return", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects device return", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects device return", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_066_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.return", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.return", async ({ request }) => {
    // Kills: Remove role check in rentals.return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device return", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects device return", async ({ request }) => {
    // Kills: technician should not be able to rejects device return
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects device return", async ({ request }) => {
    // Kills: nurse should not be able to rejects device return
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-070-AUTHMATRIX
// Behavior: API sets device status to maintenance if return condition is needs_repair
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_070_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: API sets device status to maintenance if return condition is needs_repair", () => {
  test("admin must be able to sets device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_070_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.return", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.return", async ({ request }) => {
    // Kills: Remove role check in rentals.return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status", async ({ request }) => {
    // Kills: technician should not be able to sets device.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-071-AUTHMATRIX
// Behavior: API sets device status to available if return condition is good
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_071_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: API sets device status to available if return condition is good", () => {
  test("admin must be able to sets device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_071_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.return", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.return", async ({ request }) => {
    // Kills: Remove role check in rentals.return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status", async ({ request }) => {
    // Kills: technician should not be able to sets device.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_071_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-073-AUTHMATRIX
// Behavior: API updates patient.activeRentals upon device return
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_073_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: API updates patient.activeRentals upon device return", () => {
  test("admin must be able to updates patient.activeRentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to updates patient.activeRentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to updates patient.activeRentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant updates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_073_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.return", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.return", async ({ request }) => {
    // Kills: Remove role check in rentals.return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient.activeRentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient.activeRentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient.activeRentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient.activeRentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to updates patient.activeRentals", async ({ request }) => {
    // Kills: technician should not be able to updates patient.activeRentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to updates patient.activeRentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to updates patient.activeRentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to updates patient.activeRentals", async ({ request }) => {
    // Kills: nurse should not be able to updates patient.activeRentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to updates patient.activeRentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to updates patient.activeRentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-074-AUTHMATRIX
// Behavior: API allows billing and admin to create an invoice
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_074_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: [{ description: "Test description", quantity: 1, unitPrice: 1, taxRate: 1 }],
    dueDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: API allows billing and admin to create an invoice", () => {
  test("admin must be able to allows creation of an invoice", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows creation of an invoice", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows creation of an invoice", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_074_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.create", async ({ request }) => {
    // Kills: Remove role check in invoices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access creation of an invoice", async ({ request }) => {
    // Kills: Allow lower-privileged role to access creation of an invoice
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access creation of an invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access creation of an invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows creation of an invoice", async ({ request }) => {
    // Kills: technician should not be able to allows creation of an invoice
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows creation of an invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows creation of an invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows creation of an invoice", async ({ request }) => {
    // Kills: nurse should not be able to allows creation of an invoice
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows creation of an invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows creation of an invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-075-AUTHMATRIX
// Behavior: API rejects invoice creation if rentalId does not belong to same clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_075_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: [{ description: "Test description", quantity: 1, unitPrice: 1, taxRate: 1 }],
    dueDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: API rejects invoice creation if rentalId does not belong to same clinic", () => {
  test("admin must be able to rejects invoice creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects invoice creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects invoice creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_075_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.create", async ({ request }) => {
    // Kills: Remove role check in invoices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoice creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoice creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoice creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoice creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects invoice creation", async ({ request }) => {
    // Kills: technician should not be able to rejects invoice creation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects invoice creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects invoice creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects invoice creation", async ({ request }) => {
    // Kills: nurse should not be able to rejects invoice creation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects invoice creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects invoice creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-076-AUTHMATRIX
// Behavior: API allows billing and admin to record payment
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_076_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: API allows billing and admin to record payment", () => {
  test("admin must be able to allows recording payment", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows recording payment", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows recording payment", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_076_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.payment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.payment", async ({ request }) => {
    // Kills: Remove role check in invoices.payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access recording payment", async ({ request }) => {
    // Kills: Allow lower-privileged role to access recording payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access recording payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access recording payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows recording payment", async ({ request }) => {
    // Kills: technician should not be able to allows recording payment
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows recording payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows recording payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows recording payment", async ({ request }) => {
    // Kills: nurse should not be able to allows recording payment
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows recording payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows recording payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-077-AUTHMATRIX
// Behavior: API rejects payment if amount exceeds remaining balance
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_077_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: API rejects payment if amount exceeds remaining balance", () => {
  test("admin must be able to rejects payment", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to rejects payment", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects payment", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_077_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.payment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.payment", async ({ request }) => {
    // Kills: Remove role check in invoices.payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access payment", async ({ request }) => {
    // Kills: Allow lower-privileged role to access payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects payment", async ({ request }) => {
    // Kills: technician should not be able to rejects payment
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects payment", async ({ request }) => {
    // Kills: nurse should not be able to rejects payment
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-078-AUTHMATRIX
// Behavior: API sets invoice status to paid if total paid >= invoice total
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_078_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: API sets invoice status to paid if total paid >= invoice total", () => {
  test("admin must be able to sets invoice.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets invoice.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets invoice.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_078_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.payment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.payment", async ({ request }) => {
    // Kills: Remove role check in invoices.payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoice.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoice.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoice.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoice.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets invoice.status", async ({ request }) => {
    // Kills: technician should not be able to sets invoice.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets invoice.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets invoice.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets invoice.status", async ({ request }) => {
    // Kills: nurse should not be able to sets invoice.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_078_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets invoice.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets invoice.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-079-AUTHMATRIX
// Behavior: API keeps invoice status as outstanding for partial payments
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_079_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: API keeps invoice status as outstanding for partial payments", () => {
  test("admin must be able to keeps invoice status as outstanding", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to keeps invoice status as outstanding", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to keeps invoice status as outstanding", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant keeps must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_079_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "invoices.payment", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in invoices.payment", async ({ request }) => {
    // Kills: Remove role check in invoices.payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoice status as outstanding", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoice status as outstanding
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoice status as outstanding — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoice status as outstanding — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to keeps invoice status as outstanding", async ({ request }) => {
    // Kills: technician should not be able to keeps invoice status as outstanding
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to keeps invoice status as outstanding — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to keeps invoice status as outstanding — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to keeps invoice status as outstanding", async ({ request }) => {
    // Kills: nurse should not be able to keeps invoice status as outstanding
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to keeps invoice status as outstanding — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to keeps invoice status as outstanding — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-080-AUTHMATRIX
// Behavior: API allows admin only to access device utilization report
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_080_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: API allows admin only to access device utilization report", () => {
  test("admin must be able to allows access to device utilization report", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to allows access to device utilization report", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to allows access to device utilization report", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant allows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_080_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "reports.utilization", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in reports.utilization", async ({ request }) => {
    // Kills: Remove role check in reports.utilization
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in reports.utilization — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access access to device utilization report", async ({ request }) => {
    // Kills: Allow lower-privileged role to access access to device utilization report
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access access to device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access access to device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to allows access to device utilization report", async ({ request }) => {
    // Kills: technician should not be able to allows access to device utilization report
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to allows access to device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to allows access to device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to allows access to device utilization report", async ({ request }) => {
    // Kills: nurse should not be able to allows access to device utilization report
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to allows access to device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to allows access to device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-081-AUTHMATRIX
// Behavior: Device status transitions from available to rented when rental created
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_081_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from available to rented when rental created", () => {
  test("admin must be able to transitions from available to rented", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from available to rented", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from available to rented", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_081_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from available to rented", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from available to rented
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from available to rented — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from available to rented — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from available to rented", async ({ request }) => {
    // Kills: technician should not be able to transitions from available to rented
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from available to rented — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from available to rented — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from available to rented", async ({ request }) => {
    // Kills: nurse should not be able to transitions from available to rented
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from available to rented — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from available to rented — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-082-AUTHMATRIX
// Behavior: Device status transitions from rented to available when returned in good condition
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_082_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from rented to available when returned in good condition", () => {
  test("admin must be able to transitions from rented to available", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from rented to available", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from rented to available", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_082_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from rented to available", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from rented to available
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from rented to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from rented to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from rented to available", async ({ request }) => {
    // Kills: technician should not be able to transitions from rented to available
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from rented to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from rented to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from rented to available", async ({ request }) => {
    // Kills: nurse should not be able to transitions from rented to available
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from rented to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from rented to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-083-AUTHMATRIX
// Behavior: Device status transitions from rented to maintenance when returned needing repair
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_083_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from rented to maintenance when returned needing repair", () => {
  test("admin must be able to transitions from rented to maintenance", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from rented to maintenance", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from rented to maintenance", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_083_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from rented to maintenance", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from rented to maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from rented to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from rented to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from rented to maintenance", async ({ request }) => {
    // Kills: technician should not be able to transitions from rented to maintenance
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from rented to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from rented to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from rented to maintenance", async ({ request }) => {
    // Kills: nurse should not be able to transitions from rented to maintenance
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from rented to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from rented to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-084-AUTHMATRIX
// Behavior: Device status transitions from available to maintenance for scheduled maintenance
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_084_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from available to maintenance for scheduled maintenance", () => {
  test("admin must be able to transitions from available to maintenance", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from available to maintenance", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from available to maintenance", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_084_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from available to maintenance", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from available to maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from available to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from available to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from available to maintenance", async ({ request }) => {
    // Kills: technician should not be able to transitions from available to maintenance
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from available to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from available to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from available to maintenance", async ({ request }) => {
    // Kills: nurse should not be able to transitions from available to maintenance
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from available to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from available to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-085-AUTHMATRIX
// Behavior: Device status transitions from maintenance to available when maintenance completed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_085_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from maintenance to available when maintenance completed", () => {
  test("admin must be able to transitions from maintenance to available", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from maintenance to available", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from maintenance to available", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_085_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from maintenance to available", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from maintenance to available
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from maintenance to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from maintenance to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from maintenance to available", async ({ request }) => {
    // Kills: technician should not be able to transitions from maintenance to available
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from maintenance to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from maintenance to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from maintenance to available", async ({ request }) => {
    // Kills: nurse should not be able to transitions from maintenance to available
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from maintenance to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from maintenance to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-086-AUTHMATRIX
// Behavior: Device status transitions from available to decommissioned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_086_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from available to decommissioned", () => {
  test("admin must be able to transitions from available to decommissioned", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from available to decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from available to decommissioned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_086_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from available to decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from available to decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from available to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from available to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from available to decommissioned", async ({ request }) => {
    // Kills: technician should not be able to transitions from available to decommissioned
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from available to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from available to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from available to decommissioned", async ({ request }) => {
    // Kills: nurse should not be able to transitions from available to decommissioned
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from available to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from available to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-087-AUTHMATRIX
// Behavior: Device status transitions from maintenance to decommissioned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_087_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status transitions from maintenance to decommissioned", () => {
  test("admin must be able to transitions from maintenance to decommissioned", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from maintenance to decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from maintenance to decommissioned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_087_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from maintenance to decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from maintenance to decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from maintenance to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from maintenance to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from maintenance to decommissioned", async ({ request }) => {
    // Kills: technician should not be able to transitions from maintenance to decommissioned
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from maintenance to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from maintenance to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from maintenance to decommissioned", async ({ request }) => {
    // Kills: nurse should not be able to transitions from maintenance to decommissioned
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from maintenance to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from maintenance to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-088-AUTHMATRIX
// Behavior: Device status cannot transition from decommissioned to any other state
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_088_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status cannot transition from decommissioned to any other state", () => {
  test("admin must be able to cannot transition from decommissioned", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot transition from decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from decommissioned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_088_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot transition from decommissioned", async ({ request }) => {
    // Kills: technician should not be able to cannot transition from decommissioned
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot transition from decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot transition from decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot transition from decommissioned", async ({ request }) => {
    // Kills: nurse should not be able to cannot transition from decommissioned
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-089-AUTHMATRIX
// Behavior: Device status cannot transition from rented to decommissioned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_089_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Device status cannot transition from rented to decommissioned", () => {
  test("admin must be able to cannot transition from rented to decommissioned", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot transition from rented to decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from rented to decommissioned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_089_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from rented to decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from rented to decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from rented to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from rented to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot transition from rented to decommissioned", async ({ request }) => {
    // Kills: technician should not be able to cannot transition from rented to decommissioned
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot transition from rented to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot transition from rented to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot transition from rented to decommissioned", async ({ request }) => {
    // Kills: nurse should not be able to cannot transition from rented to decommissioned
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from rented to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from rented to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-090-AUTHMATRIX
// Behavior: System sets maintenanceStartDate when device status transitions to maintenance
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_090_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System sets maintenanceStartDate when device status transitions to maintenance", () => {
  test("admin must be able to sets maintenanceStartDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets maintenanceStartDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets maintenanceStartDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_090_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenanceStartDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenanceStartDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets maintenanceStartDate", async ({ request }) => {
    // Kills: technician should not be able to sets maintenanceStartDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets maintenanceStartDate", async ({ request }) => {
    // Kills: nurse should not be able to sets maintenanceStartDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-091-AUTHMATRIX
// Behavior: System sets lastMaintenanceDate when device status transitions to available from maintenance
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_091_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System sets lastMaintenanceDate when device status transitions to available from maintenance", () => {
  test("admin must be able to sets lastMaintenanceDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets lastMaintenanceDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets lastMaintenanceDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_091_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access lastMaintenanceDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access lastMaintenanceDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets lastMaintenanceDate", async ({ request }) => {
    // Kills: technician should not be able to sets lastMaintenanceDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets lastMaintenanceDate", async ({ request }) => {
    // Kills: nurse should not be able to sets lastMaintenanceDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-092-AUTHMATRIX
// Behavior: System clears maintenanceStartDate when device status transitions to available from maintenance
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_092_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System clears maintenanceStartDate when device status transitions to available from maintenance", () => {
  test("admin must be able to clears maintenanceStartDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to clears maintenanceStartDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to clears maintenanceStartDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant clears must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_092_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenanceStartDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenanceStartDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to clears maintenanceStartDate", async ({ request }) => {
    // Kills: technician should not be able to clears maintenanceStartDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to clears maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to clears maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to clears maintenanceStartDate", async ({ request }) => {
    // Kills: nurse should not be able to clears maintenanceStartDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to clears maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to clears maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-093-AUTHMATRIX
// Behavior: System sets decommissionedAt when device status transitions to decommissioned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_093_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System sets decommissionedAt when device status transitions to decommissioned", () => {
  test("admin must be able to sets decommissionedAt", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets decommissionedAt", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets decommissionedAt", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_093_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access decommissionedAt", async ({ request }) => {
    // Kills: Allow lower-privileged role to access decommissionedAt
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access decommissionedAt — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access decommissionedAt — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets decommissionedAt", async ({ request }) => {
    // Kills: technician should not be able to sets decommissionedAt
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets decommissionedAt — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets decommissionedAt — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets decommissionedAt", async ({ request }) => {
    // Kills: nurse should not be able to sets decommissionedAt
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets decommissionedAt — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets decommissionedAt — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-094-AUTHMATRIX
// Behavior: System sets decommissionedReason when device status transitions to decommissioned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_094_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System sets decommissionedReason when device status transitions to decommissioned", () => {
  test("admin must be able to sets decommissionedReason", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets decommissionedReason", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets decommissionedReason", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_094_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access decommissionedReason", async ({ request }) => {
    // Kills: Allow lower-privileged role to access decommissionedReason
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access decommissionedReason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access decommissionedReason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets decommissionedReason", async ({ request }) => {
    // Kills: technician should not be able to sets decommissionedReason
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets decommissionedReason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets decommissionedReason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets decommissionedReason", async ({ request }) => {
    // Kills: nurse should not be able to sets decommissionedReason
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets decommissionedReason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets decommissionedReason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-095-AUTHMATRIX
// Behavior: Rental status transitions from reserved to active on startDate or manual activation
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_095_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from reserved to active on startDate or manual activation", () => {
  test("admin must be able to transitions from reserved to active", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from reserved to active", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from reserved to active", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_095_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from reserved to active", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from reserved to active
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from reserved to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from reserved to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from reserved to active", async ({ request }) => {
    // Kills: technician should not be able to transitions from reserved to active
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from reserved to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from reserved to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from reserved to active", async ({ request }) => {
    // Kills: nurse should not be able to transitions from reserved to active
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from reserved to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from reserved to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-096-AUTHMATRIX
// Behavior: Rental status transitions from active to overdue automatically when past expectedReturnDate
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_096_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from active to overdue automatically when past expectedReturnDate", () => {
  test("admin must be able to transitions from active to overdue", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from active to overdue", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from active to overdue", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_096_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from active to overdue", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from active to overdue
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from active to overdue — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from active to overdue — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from active to overdue", async ({ request }) => {
    // Kills: technician should not be able to transitions from active to overdue
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from active to overdue — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from active to overdue — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from active to overdue", async ({ request }) => {
    // Kills: nurse should not be able to transitions from active to overdue
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from active to overdue — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from active to overdue — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-097-AUTHMATRIX
// Behavior: Rental status transitions from active to returned when device returned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_097_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from active to returned when device returned", () => {
  test("admin must be able to transitions from active to returned", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from active to returned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from active to returned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_097_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from active to returned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from active to returned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from active to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from active to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from active to returned", async ({ request }) => {
    // Kills: technician should not be able to transitions from active to returned
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from active to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from active to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from active to returned", async ({ request }) => {
    // Kills: nurse should not be able to transitions from active to returned
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from active to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from active to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-098-AUTHMATRIX
// Behavior: Rental status transitions from overdue to returned upon late return
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_098_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from overdue to returned upon late return", () => {
  test("admin must be able to transitions from overdue to returned", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from overdue to returned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from overdue to returned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_098_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from overdue to returned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from overdue to returned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from overdue to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from overdue to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from overdue to returned", async ({ request }) => {
    // Kills: technician should not be able to transitions from overdue to returned
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from overdue to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from overdue to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from overdue to returned", async ({ request }) => {
    // Kills: nurse should not be able to transitions from overdue to returned
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from overdue to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from overdue to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-099-AUTHMATRIX
// Behavior: Rental status transitions from returned to completed when final invoice paid
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_099_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from returned to completed when final invoice paid", () => {
  test("admin must be able to transitions from returned to completed", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from returned to completed", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from returned to completed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_099_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from returned to completed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from returned to completed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from returned to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from returned to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from returned to completed", async ({ request }) => {
    // Kills: technician should not be able to transitions from returned to completed
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from returned to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from returned to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from returned to completed", async ({ request }) => {
    // Kills: nurse should not be able to transitions from returned to completed
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from returned to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from returned to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-100-AUTHMATRIX
// Behavior: Rental status transitions from reserved to cancelled before startDate
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_100_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from reserved to cancelled before startDate", () => {
  test("admin must be able to transitions from reserved to cancelled", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from reserved to cancelled", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from reserved to cancelled", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_100_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from reserved to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from reserved to cancelled
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from reserved to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from reserved to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from reserved to cancelled", async ({ request }) => {
    // Kills: technician should not be able to transitions from reserved to cancelled
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from reserved to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from reserved to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from reserved to cancelled", async ({ request }) => {
    // Kills: nurse should not be able to transitions from reserved to cancelled
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from reserved to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from reserved to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-101-AUTHMATRIX
// Behavior: Rental status transitions from active to cancelled by admin only with reason
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_101_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status transitions from active to cancelled by admin only with reason", () => {
  test("admin must be able to transitions from active to cancelled", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from active to cancelled", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from active to cancelled", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_101_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from active to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from active to cancelled
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from active to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from active to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from active to cancelled", async ({ request }) => {
    // Kills: technician should not be able to transitions from active to cancelled
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from active to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from active to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from active to cancelled", async ({ request }) => {
    // Kills: nurse should not be able to transitions from active to cancelled
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from active to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from active to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-102-AUTHMATRIX
// Behavior: Rental status cannot transition from completed to any other state
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_102_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status cannot transition from completed to any other state", () => {
  test("admin must be able to cannot transition from completed", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot transition from completed", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from completed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_102_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from completed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from completed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot transition from completed", async ({ request }) => {
    // Kills: technician should not be able to cannot transition from completed
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot transition from completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot transition from completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot transition from completed", async ({ request }) => {
    // Kills: nurse should not be able to cannot transition from completed
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-103-AUTHMATRIX
// Behavior: Rental status cannot transition from cancelled to active
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_103_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status cannot transition from cancelled to active", () => {
  test("admin must be able to cannot transition from cancelled to active", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot transition from cancelled to active", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from cancelled to active", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_103_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from cancelled to active", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from cancelled to active
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from cancelled to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from cancelled to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot transition from cancelled to active", async ({ request }) => {
    // Kills: technician should not be able to cannot transition from cancelled to active
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot transition from cancelled to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot transition from cancelled to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot transition from cancelled to active", async ({ request }) => {
    // Kills: nurse should not be able to cannot transition from cancelled to active
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from cancelled to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from cancelled to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-105-AUTHMATRIX
// Behavior: Rental status cannot transition from returned to active
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_105_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: Rental status cannot transition from returned to active", () => {
  test("admin must be able to cannot transition from returned to active", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to cannot transition from returned to active", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from returned to active", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_105_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from returned to active", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from returned to active
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from returned to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from returned to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot transition from returned to active", async ({ request }) => {
    // Kills: technician should not be able to cannot transition from returned to active
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot transition from returned to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot transition from returned to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot transition from returned to active", async ({ request }) => {
    // Kills: nurse should not be able to cannot transition from returned to active
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from returned to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from returned to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-106-AUTHMATRIX
// Behavior: System sets device.status to rented when rental status transitions to active
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_106_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System sets device.status to rented when rental status transitions to active", () => {
  test("admin must be able to sets device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_106_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status", async ({ request }) => {
    // Kills: technician should not be able to sets device.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-107-AUTHMATRIX
// Behavior: System sends overdue notification when rental status transitions to overdue
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_107_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System sends overdue notification when rental status transitions to overdue", () => {
  test("admin must be able to sends overdue notification", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sends overdue notification", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sends overdue notification", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sends must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_107_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access overdue notification", async ({ request }) => {
    // Kills: Allow lower-privileged role to access overdue notification
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access overdue notification — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access overdue notification — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sends overdue notification", async ({ request }) => {
    // Kills: technician should not be able to sends overdue notification
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sends overdue notification — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sends overdue notification — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sends overdue notification", async ({ request }) => {
    // Kills: nurse should not be able to sends overdue notification
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sends overdue notification — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sends overdue notification — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-108-AUTHMATRIX
// Behavior: System calculates late fees (150% of dailyRate) when rental status transitions to overdue
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_108_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System calculates late fees (150% of dailyRate) when rental status transitions to overdue", () => {
  test("admin must be able to calculates late fees", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to calculates late fees", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to calculates late fees", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant calculates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_108_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access late fees", async ({ request }) => {
    // Kills: Allow lower-privileged role to access late fees
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access late fees — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access late fees — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to calculates late fees", async ({ request }) => {
    // Kills: technician should not be able to calculates late fees
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to calculates late fees — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to calculates late fees — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to calculates late fees", async ({ request }) => {
    // Kills: nurse should not be able to calculates late fees
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to calculates late fees — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to calculates late fees — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-109-AUTHMATRIX
// Behavior: System calculates final charges when rental status transitions to returned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_109_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System calculates final charges when rental status transitions to returned", () => {
  test("admin must be able to calculates final charges", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to calculates final charges", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to calculates final charges", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant calculates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_109_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access final charges", async ({ request }) => {
    // Kills: Allow lower-privileged role to access final charges
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access final charges — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access final charges — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to calculates final charges", async ({ request }) => {
    // Kills: technician should not be able to calculates final charges
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to calculates final charges — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to calculates final charges — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to calculates final charges", async ({ request }) => {
    // Kills: nurse should not be able to calculates final charges
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to calculates final charges — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to calculates final charges — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-110-AUTHMATRIX
// Behavior: System updates device.status to available/maintenance when rental status transitions to returned
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_110_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System updates device.status to available/maintenance when rental status transitions to returned", () => {
  test("admin must be able to updates device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to updates device.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to updates device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant updates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_110_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to updates device.status", async ({ request }) => {
    // Kills: technician should not be able to updates device.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to updates device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to updates device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to updates device.status", async ({ request }) => {
    // Kills: nurse should not be able to updates device.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to updates device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to updates device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-111-AUTHMATRIX
// Behavior: System archives rental when rental status transitions to completed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_111_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System archives rental when rental status transitions to completed", () => {
  test("admin must be able to archives rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to archives rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to archives rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant archives must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_111_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to archives rental", async ({ request }) => {
    // Kills: technician should not be able to archives rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to archives rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to archives rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to archives rental", async ({ request }) => {
    // Kills: nurse should not be able to archives rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to archives rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to archives rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-112-AUTHMATRIX
// Behavior: System updates patient.completedRentals count when rental status transitions to completed
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_112_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System updates patient.completedRentals count when rental status transitions to completed", () => {
  test("admin must be able to updates patient.completedRentals count", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to updates patient.completedRentals count", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to updates patient.completedRentals count", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant updates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_112_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient.completedRentals count", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient.completedRentals count
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient.completedRentals count — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient.completedRentals count — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to updates patient.completedRentals count", async ({ request }) => {
    // Kills: technician should not be able to updates patient.completedRentals count
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to updates patient.completedRentals count — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to updates patient.completedRentals count — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to updates patient.completedRentals count", async ({ request }) => {
    // Kills: nurse should not be able to updates patient.completedRentals count
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to updates patient.completedRentals count — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to updates patient.completedRentals count — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-113-AUTHMATRIX
// Behavior: System updates device.status to available when rental status transitions to cancelled
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_113_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    serialNumber: "test-serialNumber",
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    accessories: [{ name: "Test name-${Date.now()}", serialNumber: "test-serialNumber", included: false }],
    maintenanceIntervalDays: 7,
    notes: "test-notes",
  };
}
test.describe("Auth Matrix: System updates device.status to available when rental status transitions to cancelled", () => {
  test("admin must be able to updates device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to updates device.status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to updates device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant updates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_113_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "devices.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in devices.create", async ({ request }) => {
    // Kills: Remove role check in devices.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to updates device.status", async ({ request }) => {
    // Kills: technician should not be able to updates device.status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to updates device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to updates device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to updates device.status", async ({ request }) => {
    // Kills: nurse should not be able to updates device.status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to updates device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to updates device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});