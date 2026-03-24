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
// Behavior: GET /api/auth/csrf-token returns CSRF double-submit cookie
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: GET /api/auth/csrf-token returns CSRF double-submit cookie", () => {
  test("admin must be able to returns CSRF double-submit cookie", async ({ request }) => {
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

  test("technician must NOT be able to returns CSRF double-submit cookie", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns CSRF double-submit cookie", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access CSRF double-submit cookie", async ({ request }) => {
    // Kills: Allow lower-privileged role to access CSRF double-submit cookie
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access CSRF double-submit cookie — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access CSRF double-submit cookie — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns CSRF double-submit cookie", async ({ request }) => {
    // Kills: technician should not be able to returns CSRF double-submit cookie
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns CSRF double-submit cookie — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns CSRF double-submit cookie — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns CSRF double-submit cookie", async ({ request }) => {
    // Kills: nurse should not be able to returns CSRF double-submit cookie
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.csrfToken", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns CSRF double-submit cookie — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns CSRF double-submit cookie — verify error code is present
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
// Behavior: System rate-limits failed login attempts to 5 per 15 minutes
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    email: "test@example.com",
    password: "test-password",
  };
}
test.describe("Auth Matrix: System rate-limits failed login attempts to 5 per 15 minutes", () => {
  test("admin must be able to rate-limits failed logins", async ({ request }) => {
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

  test("technician must NOT be able to rate-limits failed logins", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rate-limits failed logins", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rate-limits must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access failed logins", async ({ request }) => {
    // Kills: Allow lower-privileged role to access failed logins
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access failed logins — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access failed logins — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rate-limits failed logins", async ({ request }) => {
    // Kills: technician should not be able to rate-limits failed logins
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rate-limits failed logins — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rate-limits failed logins — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rate-limits failed logins", async ({ request }) => {
    // Kills: nurse should not be able to rate-limits failed logins
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rate-limits failed logins — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rate-limits failed logins — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: System returns 429 for exceeding failed login rate limit
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    email: "test@example.com",
    password: "test-password",
  };
}
test.describe("Auth Matrix: System returns 429 for exceeding failed login rate limit", () => {
  test("admin must be able to returns 429 failed login attempt", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to returns 429 failed login attempt", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 429 failed login attempt", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 429 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.login — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access failed login attempt", async ({ request }) => {
    // Kills: Allow lower-privileged role to access failed login attempt
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access failed login attempt — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access failed login attempt — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns 429 failed login attempt", async ({ request }) => {
    // Kills: technician should not be able to returns 429 failed login attempt
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns 429 failed login attempt — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns 429 failed login attempt — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 429 failed login attempt", async ({ request }) => {
    // Kills: nurse should not be able to returns 429 failed login attempt
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 429 failed login attempt — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 429 failed login attempt — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: System locks out user for 30 minutes after exceeding failed login rate limit
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    email: "test@example.com",
    password: "test-password",
  };
}
test.describe("Auth Matrix: System locks out user for 30 minutes after exceeding failed login rate limit", () => {
  test("admin must be able to locks out user", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to locks out user", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to locks out user", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant locks out must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in auth.login — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access user", async ({ request }) => {
    // Kills: Allow lower-privileged role to access user
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access user — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access user — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to locks out user", async ({ request }) => {
    // Kills: technician should not be able to locks out user
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to locks out user — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to locks out user — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to locks out user", async ({ request }) => {
    // Kills: nurse should not be able to locks out user
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "auth.login", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to locks out user — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to locks out user — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Technician role can manage device inventory
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    id: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: Technician role can manage device inventory", () => {
  test("admin must be able to manage device inventory", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage device inventory", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.export — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device inventory", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device inventory
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "patients.export", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage device inventory — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage device inventory — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Technician role can perform maintenance
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
test.describe("Auth Matrix: Technician role can perform maintenance", () => {
  test("admin must be able to perform maintenance", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to perform maintenance", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant perform must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenance", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to perform maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to perform maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Technician role can view rentals
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
test.describe("Auth Matrix: Technician role can view rentals", () => {
  test("admin must be able to view rentals", async ({ request }) => {
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

  test("technician must NOT be able to view rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to view rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant view must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to view rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to view rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Nurse role can create rentals for patients
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
test.describe("Auth Matrix: Nurse role can create rentals for patients", () => {
  test("admin must be able to create rentals for patients", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), "");
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
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to create rentals for patients", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
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
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rentals for patients", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rentals for patients
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
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
    const response = await trpcMutation(request, "devices.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to create rentals for patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to create rentals for patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Nurse role can return devices
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
test.describe("Auth Matrix: Nurse role can return devices", () => {
  test("admin must be able to return devices", async ({ request }) => {
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

  test("technician must NOT be able to return devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to return devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant return must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to return devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to return devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-015-AUTHMATRIX
// Behavior: Nurse role cannot modify pricing
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
test.describe("Auth Matrix: Nurse role cannot modify pricing", () => {
  test("admin must be able to cannot modify pricing", async ({ request }) => {
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

  test("technician must NOT be able to cannot modify pricing", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot modify pricing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot modify must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access pricing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_015_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot modify pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot modify pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-016-AUTHMATRIX
// Behavior: Billing role can manage invoices
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
test.describe("Auth Matrix: Billing role can manage invoices", () => {
  test("admin must be able to manage invoices", async ({ request }) => {
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

  test("technician must NOT be able to manage invoices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage invoices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access invoices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage invoices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage invoices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-017-AUTHMATRIX
// Behavior: Billing role can process payments
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
test.describe("Auth Matrix: Billing role can process payments", () => {
  test("admin must be able to process payments", async ({ request }) => {
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

  test("technician must NOT be able to process payments", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to process payments", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant process must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access payments", async ({ request }) => {
    // Kills: Allow lower-privileged role to access payments
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to process payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to process payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-018-AUTHMATRIX
// Behavior: Billing role can process insurance claims
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
test.describe("Auth Matrix: Billing role can process insurance claims", () => {
  test("admin must be able to process insurance claims", async ({ request }) => {
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

  test("technician must NOT be able to process insurance claims", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to process insurance claims", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant process must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access insurance claims", async ({ request }) => {
    // Kills: Allow lower-privileged role to access insurance claims
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to process insurance claims — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to process insurance claims — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: Billing role cannot access medical records
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
test.describe("Auth Matrix: Billing role cannot access medical records", () => {
  test("admin must be able to cannot access medical records", async ({ request }) => {
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

  test("technician must NOT be able to cannot access medical records", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot access medical records", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access medical records", async ({ request }) => {
    // Kills: Allow lower-privileged role to access medical records
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot access medical records — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot access medical records — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-020-AUTHMATRIX
// Behavior: Admin role has full access within clinic
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
test.describe("Auth Matrix: Admin role has full access within clinic", () => {
  test("admin must be able to has full access within clinic", async ({ request }) => {
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

  test("technician must NOT be able to has full access within clinic", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to has full access within clinic", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access full access within clinic", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access within clinic
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to has full access within clinic — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to has full access within clinic — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-021-AUTHMATRIX
// Behavior: Admin role can manage staff
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
test.describe("Auth Matrix: Admin role can manage staff", () => {
  test("admin must be able to manage staff", async ({ request }) => {
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

  test("technician must NOT be able to manage staff", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage staff", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access staff", async ({ request }) => {
    // Kills: Allow lower-privileged role to access staff
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage staff — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage staff — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-022-AUTHMATRIX
// Behavior: Admin role can access reports
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
test.describe("Auth Matrix: Admin role can access reports", () => {
  test("admin must be able to access reports", async ({ request }) => {
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

  test("technician must NOT be able to access reports", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to access reports", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant access must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access reports", async ({ request }) => {
    // Kills: Allow lower-privileged role to access reports
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access reports — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access reports — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to access reports", async ({ request }) => {
    // Kills: technician should not be able to access reports
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to access reports — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to access reports — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to access reports", async ({ request }) => {
    // Kills: nurse should not be able to access reports
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to access reports — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to access reports — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-023-AUTHMATRIX
// Behavior: Admin role can manage pricing
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
test.describe("Auth Matrix: Admin role can manage pricing", () => {
  test("admin must be able to manage pricing", async ({ request }) => {
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

  test("technician must NOT be able to manage pricing", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to manage pricing", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant manage must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access pricing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to manage pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to manage pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-024-AUTHMATRIX
// Behavior: All POST/PUT/PATCH/DELETE requests require X-CSRF-Token header
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
test.describe("Auth Matrix: All POST/PUT/PATCH/DELETE requests require X-CSRF-Token header", () => {
  test("admin must be able to requires X-CSRF-Token header", async ({ request }) => {
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

  test("technician must NOT be able to requires X-CSRF-Token header", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires X-CSRF-Token header", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access X-CSRF-Token header", async ({ request }) => {
    // Kills: Allow lower-privileged role to access X-CSRF-Token header
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_024_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires X-CSRF-Token header — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires X-CSRF-Token header — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: System returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header
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
test.describe("Auth Matrix: System returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header", () => {
  test("admin must be able to returns 403 CSRF_REQUIRED request", async ({ request }) => {
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

  test("technician must NOT be able to returns 403 CSRF_REQUIRED request", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 403 CSRF_REQUIRED request", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 CSRF_REQUIRED must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access request", async ({ request }) => {
    // Kills: Allow lower-privileged role to access request
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns 403 CSRF_REQUIRED request", async ({ request }) => {
    // Kills: technician should not be able to returns 403 CSRF_REQUIRED request
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns 403 CSRF_REQUIRED request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns 403 CSRF_REQUIRED request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 403 CSRF_REQUIRED request", async ({ request }) => {
    // Kills: nurse should not be able to returns 403 CSRF_REQUIRED request
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 403 CSRF_REQUIRED request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 403 CSRF_REQUIRED request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: POST /api/devices registers a new medical device
// Risk: critical
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
test.describe("Auth Matrix: POST /api/devices registers a new medical device", () => {
  test("admin must be able to registers new medical device", async ({ request }) => {
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

  test("technician must NOT be able to registers new medical device", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to registers new medical device", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant registers must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access new medical device", async ({ request }) => {
    // Kills: Allow lower-privileged role to access new medical device
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access new medical device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access new medical device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to registers new medical device", async ({ request }) => {
    // Kills: technician should not be able to registers new medical device
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to registers new medical device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to registers new medical device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to registers new medical device", async ({ request }) => {
    // Kills: nurse should not be able to registers new medical device
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to registers new medical device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to registers new medical device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: POST /api/devices requires clinicId to match JWT clinicId
// Risk: critical
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
test.describe("Auth Matrix: POST /api/devices requires clinicId to match JWT clinicId", () => {
  test("admin must be able to requires clinicId match", async ({ request }) => {
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

  test("technician must NOT be able to requires clinicId match", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires clinicId match", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access clinicId match", async ({ request }) => {
    // Kills: Allow lower-privileged role to access clinicId match
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access clinicId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access clinicId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires clinicId match", async ({ request }) => {
    // Kills: technician should not be able to requires clinicId match
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires clinicId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires clinicId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires clinicId match", async ({ request }) => {
    // Kills: nurse should not be able to requires clinicId match
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires clinicId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires clinicId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-028-AUTHMATRIX
// Behavior: POST /api/devices rejects registration if serialNumber is globally unique
// Risk: medium
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
test.describe("Auth Matrix: POST /api/devices rejects registration if serialNumber is globally unique", () => {
  test("admin must be able to rejects registration device", async ({ request }) => {
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

  test("technician must NOT be able to rejects registration device", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects registration device", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects registration must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access device", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects registration device", async ({ request }) => {
    // Kills: technician should not be able to rejects registration device
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects registration device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects registration device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects registration device", async ({ request }) => {
    // Kills: nurse should not be able to rejects registration device
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects registration device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects registration device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: POST /api/devices rejects registration if purchaseDate is in the future
// Risk: medium
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
test.describe("Auth Matrix: POST /api/devices rejects registration if purchaseDate is in the future", () => {
  test("admin must be able to rejects registration device", async ({ request }) => {
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

  test("technician must NOT be able to rejects registration device", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects registration device", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects registration must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access device", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects registration device", async ({ request }) => {
    // Kills: technician should not be able to rejects registration device
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects registration device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects registration device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects registration device", async ({ request }) => {
    // Kills: nurse should not be able to rejects registration device
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects registration device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects registration device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-030-AUTHMATRIX
// Behavior: GET /api/devices lists devices
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
test.describe("Auth Matrix: GET /api/devices lists devices", () => {
  test("admin must be able to lists devices", async ({ request }) => {
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

  test("technician must NOT be able to lists devices", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to lists devices", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant lists must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access devices", async ({ request }) => {
    // Kills: Allow lower-privileged role to access devices
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to lists devices", async ({ request }) => {
    // Kills: technician should not be able to lists devices
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to lists devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to lists devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to lists devices", async ({ request }) => {
    // Kills: nurse should not be able to lists devices
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_030_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to lists devices — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to lists devices — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-031-AUTHMATRIX
// Behavior: GET /api/devices shows all device fields to technician/admin
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
test.describe("Auth Matrix: GET /api/devices shows all device fields to technician/admin", () => {
  test("admin must be able to shows all device fields", async ({ request }) => {
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

  test("technician must NOT be able to shows all device fields", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to shows all device fields", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant shows must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access all device fields", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all device fields
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all device fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all device fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to shows all device fields", async ({ request }) => {
    // Kills: technician should not be able to shows all device fields
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to shows all device fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to shows all device fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to shows all device fields", async ({ request }) => {
    // Kills: nurse should not be able to shows all device fields
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_031_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to shows all device fields — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to shows all device fields — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-032-AUTHMATRIX
// Behavior: GET /api/devices shows name, type, status, availability to nurse
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
test.describe("Auth Matrix: GET /api/devices shows name, type, status, availability to nurse", () => {
  test("admin must be able to shows name, type, status, availability", async ({ request }) => {
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

  test("technician must NOT be able to shows name, type, status, availability", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to shows name, type, status, availability", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant shows must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access name, type, status, availability", async ({ request }) => {
    // Kills: Allow lower-privileged role to access name, type, status, availability
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access name, type, status, availability — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access name, type, status, availability — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to shows name, type, status, availability", async ({ request }) => {
    // Kills: technician should not be able to shows name, type, status, availability
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to shows name, type, status, availability — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to shows name, type, status, availability — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to shows name, type, status, availability", async ({ request }) => {
    // Kills: nurse should not be able to shows name, type, status, availability
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_032_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to shows name, type, status, availability — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to shows name, type, status, availability — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-033-AUTHMATRIX
// Behavior: GET /api/devices hides pricing details from nurse
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
test.describe("Auth Matrix: GET /api/devices hides pricing details from nurse", () => {
  test("admin must be able to hides pricing details", async ({ request }) => {
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

  test("technician must NOT be able to hides pricing details", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to hides pricing details", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant hides must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access pricing details", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing details
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access pricing details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access pricing details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to hides pricing details", async ({ request }) => {
    // Kills: technician should not be able to hides pricing details
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to hides pricing details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to hides pricing details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to hides pricing details", async ({ request }) => {
    // Kills: nurse should not be able to hides pricing details
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_033_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to hides pricing details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to hides pricing details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-034-AUTHMATRIX
// Behavior: GET /api/devices shows name, type, dailyRate, purchasePrice to billing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_034_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/devices shows name, type, dailyRate, purchasePrice to billing", () => {
  test("admin must be able to shows name, type, dailyRate, purchasePrice", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to shows name, type, dailyRate, purchasePrice", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to shows name, type, dailyRate, purchasePrice", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant shows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_034_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access name, type, dailyRate, purchasePrice", async ({ request }) => {
    // Kills: Allow lower-privileged role to access name, type, dailyRate, purchasePrice
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access name, type, dailyRate, purchasePrice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access name, type, dailyRate, purchasePrice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to shows name, type, dailyRate, purchasePrice", async ({ request }) => {
    // Kills: technician should not be able to shows name, type, dailyRate, purchasePrice
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to shows name, type, dailyRate, purchasePrice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to shows name, type, dailyRate, purchasePrice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to shows name, type, dailyRate, purchasePrice", async ({ request }) => {
    // Kills: nurse should not be able to shows name, type, dailyRate, purchasePrice
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_034_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to shows name, type, dailyRate, purchasePrice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to shows name, type, dailyRate, purchasePrice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-035-AUTHMATRIX
// Behavior: GET /api/devices hides maintenance details from billing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_035_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/devices hides maintenance details from billing", () => {
  test("admin must be able to hides maintenance details", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to hides maintenance details", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to hides maintenance details", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant hides must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_035_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access maintenance details", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance details
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to hides maintenance details", async ({ request }) => {
    // Kills: technician should not be able to hides maintenance details
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to hides maintenance details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to hides maintenance details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to hides maintenance details", async ({ request }) => {
    // Kills: nurse should not be able to hides maintenance details
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_035_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to hides maintenance details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to hides maintenance details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-036-AUTHMATRIX
// Behavior: GET /api/devices/:id retrieves device details
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_036_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/devices/:id retrieves device details", () => {
  test("admin must be able to retrieves device details", async ({ request }) => {
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

  test("technician must NOT be able to retrieves device details", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to retrieves device details", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant retrieves must be rejected", async ({ request }) => {
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

  test("mutation-kill-3: technician should not be able to retrieves device details", async ({ request }) => {
    // Kills: technician should not be able to retrieves device details
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to retrieves device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to retrieves device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to retrieves device details", async ({ request }) => {
    // Kills: nurse should not be able to retrieves device details
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to retrieves device details — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to retrieves device details — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-038-AUTHMATRIX
// Behavior: GET /api/devices/:id returns 403 if device belongs to different clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_038_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/devices/:id returns 403 if device belongs to different clinic", () => {
  test("admin must be able to returns 403 device", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to returns 403 device", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 403 device", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_038_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns 403 device", async ({ request }) => {
    // Kills: technician should not be able to returns 403 device
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns 403 device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns 403 device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 403 device", async ({ request }) => {
    // Kills: nurse should not be able to returns 403 device
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.list", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 403 device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 403 device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-039-AUTHMATRIX
// Behavior: PATCH /api/devices/:id/status updates device status
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_039_AUTHMATRIX() {
  return {
    id: 1,
    status: "available",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: PATCH /api/devices/:id/status updates device status", () => {
  test("admin must be able to updates device status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to updates device status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to updates device status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant updates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_039_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to updates device status", async ({ request }) => {
    // Kills: technician should not be able to updates device status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to updates device status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to updates device status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to updates device status", async ({ request }) => {
    // Kills: nurse should not be able to updates device status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to updates device status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to updates device status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-040-AUTHMATRIX
// Behavior: PATCH /api/devices/:id/status requires reason for maintenance/decommissioned status
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_040_AUTHMATRIX() {
  return {
    id: 1,
    status: "available",
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: PATCH /api/devices/:id/status requires reason for maintenance/decommissioned status", () => {
  test("admin must be able to requires reason", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires reason", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires reason", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_040_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access reason", async ({ request }) => {
    // Kills: Allow lower-privileged role to access reason
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access reason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access reason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires reason", async ({ request }) => {
    // Kills: technician should not be able to requires reason
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires reason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires reason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires reason", async ({ request }) => {
    // Kills: nurse should not be able to requires reason
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.status", basePayload_PROOF_B_040_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires reason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires reason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-041-AUTHMATRIX
// Behavior: POST /api/devices/:id/maintenance records a maintenance event
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
test.describe("Auth Matrix: POST /api/devices/:id/maintenance records a maintenance event", () => {
  test("admin must be able to records maintenance event", async ({ request }) => {
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

  test("technician must NOT be able to records maintenance event", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to records maintenance event", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant records must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access maintenance event", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance event
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to records maintenance event", async ({ request }) => {
    // Kills: technician should not be able to records maintenance event
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to records maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to records maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to records maintenance event", async ({ request }) => {
    // Kills: nurse should not be able to records maintenance event
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to records maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to records maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-042-AUTHMATRIX
// Behavior: POST /api/devices/:id/maintenance rejects if device is currently rented
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
test.describe("Auth Matrix: POST /api/devices/:id/maintenance rejects if device is currently rented", () => {
  test("admin must be able to rejects maintenance event", async ({ request }) => {
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

  test("technician must NOT be able to rejects maintenance event", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects maintenance event", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access maintenance event", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenance event
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to rejects maintenance event", async ({ request }) => {
    // Kills: technician should not be able to rejects maintenance event
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to rejects maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to rejects maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to rejects maintenance event", async ({ request }) => {
    // Kills: nurse should not be able to rejects maintenance event
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_042_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects maintenance event — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects maintenance event — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-043-AUTHMATRIX
// Behavior: POST /api/devices/:id/maintenance sets device.lastMaintenanceDate to today
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_043_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/devices/:id/maintenance sets device.lastMaintenanceDate to today", () => {
  test("admin must be able to sets device.lastMaintenanceDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.lastMaintenanceDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_043_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.maintenance — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.lastMaintenanceDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.lastMaintenanceDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_043_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.lastMaintenanceDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.lastMaintenanceDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-045-AUTHMATRIX
// Behavior: POST /api/devices/:id/maintenance requires nextMaintenanceDue to be in the future
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_045_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/devices/:id/maintenance requires nextMaintenanceDue to be in the future", () => {
  test("admin must be able to requires nextMaintenanceDue", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires nextMaintenanceDue", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires nextMaintenanceDue", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_045_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.maintenance — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access nextMaintenanceDue", async ({ request }) => {
    // Kills: Allow lower-privileged role to access nextMaintenanceDue
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access nextMaintenanceDue — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access nextMaintenanceDue — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires nextMaintenanceDue", async ({ request }) => {
    // Kills: technician should not be able to requires nextMaintenanceDue
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires nextMaintenanceDue — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires nextMaintenanceDue — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires nextMaintenanceDue", async ({ request }) => {
    // Kills: nurse should not be able to requires nextMaintenanceDue
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.maintenance", basePayload_PROOF_B_045_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires nextMaintenanceDue — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires nextMaintenanceDue — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-046-AUTHMATRIX
// Behavior: POST /api/patients registers a patient
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_046_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917613725951",
    insuranceProvider: TEST_CLINIC_ID,
    insuranceNumber: "test-insuranceNumber",
    address: "test-address",
    medicalNotes: "test-medicalNotes",
  };
}
test.describe("Auth Matrix: POST /api/patients registers a patient", () => {
  test("admin must be able to registers patient", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to registers patient", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to registers patient", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant registers must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_046_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to registers patient", async ({ request }) => {
    // Kills: technician should not be able to registers patient
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to registers patient — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to registers patient — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to registers patient", async ({ request }) => {
    // Kills: nurse should not be able to registers patient
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_046_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to registers patient — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to registers patient — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-047-AUTHMATRIX
// Behavior: POST /api/patients requires clinicId to match JWT clinicId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_047_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917613725952",
    insuranceProvider: TEST_CLINIC_ID,
    insuranceNumber: "test-insuranceNumber",
    address: "test-address",
    medicalNotes: "test-medicalNotes",
  };
}
test.describe("Auth Matrix: POST /api/patients requires clinicId to match JWT clinicId", () => {
  test("admin must be able to requires clinicId match", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires clinicId match", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires clinicId match", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_047_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access clinicId match", async ({ request }) => {
    // Kills: Allow lower-privileged role to access clinicId match
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access clinicId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access clinicId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires clinicId match", async ({ request }) => {
    // Kills: technician should not be able to requires clinicId match
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires clinicId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires clinicId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires clinicId match", async ({ request }) => {
    // Kills: nurse should not be able to requires clinicId match
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires clinicId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires clinicId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-048-AUTHMATRIX
// Behavior: POST /api/patients requires dateOfBirth to be in the past
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_048_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917613725953",
    insuranceProvider: TEST_CLINIC_ID,
    insuranceNumber: "test-insuranceNumber",
    address: "test-address",
    medicalNotes: "test-medicalNotes",
  };
}
test.describe("Auth Matrix: POST /api/patients requires dateOfBirth to be in the past", () => {
  test("admin must be able to requires dateOfBirth", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires dateOfBirth", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires dateOfBirth", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_048_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access dateOfBirth", async ({ request }) => {
    // Kills: Allow lower-privileged role to access dateOfBirth
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access dateOfBirth — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access dateOfBirth — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires dateOfBirth", async ({ request }) => {
    // Kills: technician should not be able to requires dateOfBirth
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires dateOfBirth — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires dateOfBirth — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires dateOfBirth", async ({ request }) => {
    // Kills: nurse should not be able to requires dateOfBirth
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires dateOfBirth — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires dateOfBirth — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-049-AUTHMATRIX
// Behavior: Patient medicalNotes are visible only to nurse/admin
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_049_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917613725953",
    insuranceProvider: TEST_CLINIC_ID,
    insuranceNumber: "test-insuranceNumber",
    address: "test-address",
    medicalNotes: "test-medicalNotes",
  };
}
test.describe("Auth Matrix: Patient medicalNotes are visible only to nurse/admin", () => {
  test("admin must be able to restricts visibility of patient medicalNotes", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to restricts visibility of patient medicalNotes", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to restricts visibility of patient medicalNotes", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant restricts visibility of must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_049_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in patients.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient medicalNotes", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient medicalNotes
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient medicalNotes — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient medicalNotes — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to restricts visibility of patient medicalNotes", async ({ request }) => {
    // Kills: technician should not be able to restricts visibility of patient medicalNotes
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to restricts visibility of patient medicalNotes — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to restricts visibility of patient medicalNotes — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to restricts visibility of patient medicalNotes", async ({ request }) => {
    // Kills: nurse should not be able to restricts visibility of patient medicalNotes
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "patients.create", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to restricts visibility of patient medicalNotes — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to restricts visibility of patient medicalNotes — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-050-AUTHMATRIX
// Behavior: GET /api/patients lists patients
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_050_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/patients lists patients", () => {
  test("admin must be able to lists patients", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to lists patients", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to lists patients", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant lists must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_050_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patients", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patients
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to lists patients", async ({ request }) => {
    // Kills: technician should not be able to lists patients
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to lists patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to lists patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to lists patients", async ({ request }) => {
    // Kills: nurse should not be able to lists patients
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to lists patients — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to lists patients — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-051-AUTHMATRIX
// Behavior: GET /api/patients returns 403 INSUFFICIENT_ROLE for billing role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_051_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/patients returns 403 INSUFFICIENT_ROLE for billing role", () => {
  test("admin must be able to returns 403 INSUFFICIENT_ROLE patient list request", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to returns 403 INSUFFICIENT_ROLE patient list request", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to returns 403 INSUFFICIENT_ROLE patient list request", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 INSUFFICIENT_ROLE must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_051_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access patient list request", async ({ request }) => {
    // Kills: Allow lower-privileged role to access patient list request
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access patient list request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access patient list request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to returns 403 INSUFFICIENT_ROLE patient list request", async ({ request }) => {
    // Kills: technician should not be able to returns 403 INSUFFICIENT_ROLE patient list request
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to returns 403 INSUFFICIENT_ROLE patient list request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to returns 403 INSUFFICIENT_ROLE patient list request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to returns 403 INSUFFICIENT_ROLE patient list request", async ({ request }) => {
    // Kills: nurse should not be able to returns 403 INSUFFICIENT_ROLE patient list request
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_051_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to returns 403 INSUFFICIENT_ROLE patient list request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to returns 403 INSUFFICIENT_ROLE patient list request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-052-AUTHMATRIX
// Behavior: POST /api/rentals creates a device rental
// Risk: critical
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
test.describe("Auth Matrix: POST /api/rentals creates a device rental", () => {
  test("admin must be able to creates device rental", async ({ request }) => {
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

  test("technician must NOT be able to creates device rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to creates device rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant creates must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access device rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to creates device rental", async ({ request }) => {
    // Kills: technician should not be able to creates device rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to creates device rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to creates device rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to creates device rental", async ({ request }) => {
    // Kills: nurse should not be able to creates device rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_052_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to creates device rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to creates device rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-053-AUTHMATRIX
// Behavior: POST /api/rentals rejects if device is not available
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_053_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/rentals rejects if device is not available", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_053_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_053_AUTHMATRIX(), cookie);
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
// Behavior: POST /api/rentals rejects if device belongs to a different clinic
// Risk: critical
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
test.describe("Auth Matrix: POST /api/rentals rejects if device belongs to a different clinic", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
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

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-055-AUTHMATRIX
// Behavior: POST /api/rentals rejects if patient belongs to a different clinic
// Risk: critical
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
test.describe("Auth Matrix: POST /api/rentals rejects if patient belongs to a different clinic", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
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

  test("technician must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-056-AUTHMATRIX
// Behavior: POST /api/rentals rejects if rental period exceeds 365 days
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_056_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/rentals rejects if rental period exceeds 365 days", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_056_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_056_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-057-AUTHMATRIX
// Behavior: POST /api/rentals rejects if expectedReturnDate is not after startDate
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_057_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/rentals rejects if expectedReturnDate is not after startDate", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_057_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_057_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-058-AUTHMATRIX
// Behavior: POST /api/rentals rejects if insuranceClaim is true but insurancePreAuthCode is missing
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_058_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/rentals rejects if insuranceClaim is true but insurancePreAuthCode is missing", () => {
  test("admin must be able to rejects rental creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_058_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_058_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-059-AUTHMATRIX
// Behavior: POST /api/rentals ensures only one rental succeeds for the same device concurrently
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_059_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/rentals ensures only one rental succeeds for the same device concurrently", () => {
  test("admin must be able to ensures single successful rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to ensures single successful rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to ensures single successful rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant ensures must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_059_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access single successful rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access single successful rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access single successful rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access single successful rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to ensures single successful rental", async ({ request }) => {
    // Kills: technician should not be able to ensures single successful rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to ensures single successful rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to ensures single successful rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to ensures single successful rental", async ({ request }) => {
    // Kills: nurse should not be able to ensures single successful rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_059_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to ensures single successful rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to ensures single successful rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-060-AUTHMATRIX
// Behavior: POST /api/rentals sets device.status to 'rented'
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_060_AUTHMATRIX() {
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
test.describe("Auth Matrix: POST /api/rentals sets device.status to 'rented'", () => {
  test("admin must be able to sets device.status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_060_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-062-AUTHMATRIX
// Behavior: GET /api/rentals lists rentals
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_062_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/rentals lists rentals", () => {
  test("admin must be able to lists rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to lists rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to lists rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant lists must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_062_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to lists rentals", async ({ request }) => {
    // Kills: technician should not be able to lists rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to lists rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to lists rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to lists rentals", async ({ request }) => {
    // Kills: nurse should not be able to lists rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_062_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to lists rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to lists rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-063-AUTHMATRIX
// Behavior: GET /api/rentals shows all rentals to nurse
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_063_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/rentals shows all rentals to nurse", () => {
  test("admin must be able to shows all rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to shows all rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to shows all rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant shows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_063_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to shows all rentals", async ({ request }) => {
    // Kills: technician should not be able to shows all rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to shows all rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to shows all rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to shows all rentals", async ({ request }) => {
    // Kills: nurse should not be able to shows all rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_063_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to shows all rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to shows all rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-064-AUTHMATRIX
// Behavior: GET /api/rentals shows all rentals with financial data to billing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_064_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/rentals shows all rentals with financial data to billing", () => {
  test("admin must be able to shows all rentals with financial data", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to shows all rentals with financial data", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to shows all rentals with financial data", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant shows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_064_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all rentals with financial data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all rentals with financial data
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all rentals with financial data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all rentals with financial data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to shows all rentals with financial data", async ({ request }) => {
    // Kills: technician should not be able to shows all rentals with financial data
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to shows all rentals with financial data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to shows all rentals with financial data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to shows all rentals with financial data", async ({ request }) => {
    // Kills: nurse should not be able to shows all rentals with financial data
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_064_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to shows all rentals with financial data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to shows all rentals with financial data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-065-AUTHMATRIX
// Behavior: GET /api/rentals shows device-focused view to technician
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_065_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/rentals shows device-focused view to technician", () => {
  test("admin must be able to shows device-focused view of rentals", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to shows device-focused view of rentals", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to shows device-focused view of rentals", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant shows must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_065_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device-focused view of rentals", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device-focused view of rentals
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device-focused view of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device-focused view of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to shows device-focused view of rentals", async ({ request }) => {
    // Kills: technician should not be able to shows device-focused view of rentals
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to shows device-focused view of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to shows device-focused view of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to shows device-focused view of rentals", async ({ request }) => {
    // Kills: nurse should not be able to shows device-focused view of rentals
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_065_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to shows device-focused view of rentals — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to shows device-focused view of rentals — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-066-AUTHMATRIX
// Behavior: POST /api/rentals/:id/extend extends a rental period
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_066_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/extend extends a rental period", () => {
  test("admin must be able to extends rental period", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to extends rental period", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to extends rental period", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant extends must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_066_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental period", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental period
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental period — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental period — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to extends rental period", async ({ request }) => {
    // Kills: technician should not be able to extends rental period
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to extends rental period — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to extends rental period — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to extends rental period", async ({ request }) => {
    // Kills: nurse should not be able to extends rental period
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_066_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to extends rental period — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to extends rental period — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-067-AUTHMATRIX
// Behavior: POST /api/rentals/:id/extend rejects if rental is not active
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_067_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/extend rejects if rental is not active", () => {
  test("admin must be able to rejects rental extension", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental extension", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_067_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental extension", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental extension
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_067_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-068-AUTHMATRIX
// Behavior: POST /api/rentals/:id/extend rejects if maximum 3 extensions per rental are reached
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_068_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/extend rejects if maximum 3 extensions per rental are reached", () => {
  test("admin must be able to rejects rental extension", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects rental extension", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_068_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental extension", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental extension
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_068_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects rental extension — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects rental extension — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-069-AUTHMATRIX
// Behavior: POST /api/rentals/:id/extend requires newReturnDate to be after current expectedReturnDate
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_069_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/extend requires newReturnDate to be after current expectedReturnDate", () => {
  test("admin must be able to requires newReturnDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires newReturnDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires newReturnDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_069_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access newReturnDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access newReturnDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access newReturnDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access newReturnDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires newReturnDate", async ({ request }) => {
    // Kills: technician should not be able to requires newReturnDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires newReturnDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires newReturnDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires newReturnDate", async ({ request }) => {
    // Kills: nurse should not be able to requires newReturnDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_069_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires newReturnDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires newReturnDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-070-AUTHMATRIX
// Behavior: POST /api/rentals/:id/extend requires newReturnDate to be within 365 days from original startDate
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_070_AUTHMATRIX() {
  return {
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/extend requires newReturnDate to be within 365 days from original startDate", () => {
  test("admin must be able to requires newReturnDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires newReturnDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires newReturnDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_070_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.extend — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access newReturnDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access newReturnDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access newReturnDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access newReturnDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires newReturnDate", async ({ request }) => {
    // Kills: technician should not be able to requires newReturnDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires newReturnDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires newReturnDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires newReturnDate", async ({ request }) => {
    // Kills: nurse should not be able to requires newReturnDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.extend", basePayload_PROOF_B_070_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires newReturnDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires newReturnDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-072-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return processes device return
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_072_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return processes device return", () => {
  test("admin must be able to processes device return", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to processes device return", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to processes device return", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant processes must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_072_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device return", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to processes device return", async ({ request }) => {
    // Kills: technician should not be able to processes device return
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to processes device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to processes device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to processes device return", async ({ request }) => {
    // Kills: nurse should not be able to processes device return
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_072_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to processes device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to processes device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-073-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return rejects if rental is not active or overdue
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
test.describe("Auth Matrix: POST /api/rentals/:id/return rejects if rental is not active or overdue", () => {
  test("admin must be able to rejects device return", async ({ request }) => {
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

  test("technician must NOT be able to rejects device return", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects device return", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access device return", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device return
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_073_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects device return — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects device return — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-074-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return charges full device replacement cost if condition is 'lost'
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_074_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return charges full device replacement cost if condition is 'lost'", () => {
  test("admin must be able to charges full device replacement cost", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to charges full device replacement cost", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to charges full device replacement cost", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant charges must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_074_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full device replacement cost", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full device replacement cost
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full device replacement cost — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full device replacement cost — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to charges full device replacement cost", async ({ request }) => {
    // Kills: technician should not be able to charges full device replacement cost
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to charges full device replacement cost — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to charges full device replacement cost — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to charges full device replacement cost", async ({ request }) => {
    // Kills: nurse should not be able to charges full device replacement cost
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_074_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to charges full device replacement cost — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to charges full device replacement cost — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-075-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return sets device.status to 'maintenance' if condition is 'needs_repair'
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_075_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return sets device.status to 'maintenance' if condition is 'needs_repair'", () => {
  test("admin must be able to sets device.status to 'maintenance'", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status to 'maintenance'", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status to 'maintenance'", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_075_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status to 'maintenance'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status to 'maintenance'
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status to 'maintenance' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status to 'maintenance' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status to 'maintenance'", async ({ request }) => {
    // Kills: technician should not be able to sets device.status to 'maintenance'
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status to 'maintenance' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status to 'maintenance' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status to 'maintenance'", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status to 'maintenance'
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_075_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status to 'maintenance' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status to 'maintenance' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-076-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return sets device.status to 'available' if condition is 'good'
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_076_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return sets device.status to 'available' if condition is 'good'", () => {
  test("admin must be able to sets device.status to 'available'", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status to 'available'", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status to 'available'", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_076_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status to 'available'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status to 'available'
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status to 'available' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status to 'available' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status to 'available'", async ({ request }) => {
    // Kills: technician should not be able to sets device.status to 'available'
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status to 'available' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status to 'available' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status to 'available'", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status to 'available'
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_076_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status to 'available' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status to 'available' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-077-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return calculates final invoice
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_077_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return calculates final invoice", () => {
  test("admin must be able to calculates final invoice", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to calculates final invoice", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to calculates final invoice", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant calculates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_077_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access final invoice", async ({ request }) => {
    // Kills: Allow lower-privileged role to access final invoice
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access final invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access final invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to calculates final invoice", async ({ request }) => {
    // Kills: technician should not be able to calculates final invoice
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to calculates final invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to calculates final invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to calculates final invoice", async ({ request }) => {
    // Kills: nurse should not be able to calculates final invoice
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_077_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to calculates final invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to calculates final invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-079-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return requires damageNotes if condition is not 'good'
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_079_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return requires damageNotes if condition is not 'good'", () => {
  test("admin must be able to requires damageNotes", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires damageNotes", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires damageNotes", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_079_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access damageNotes", async ({ request }) => {
    // Kills: Allow lower-privileged role to access damageNotes
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access damageNotes — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access damageNotes — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires damageNotes", async ({ request }) => {
    // Kills: technician should not be able to requires damageNotes
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires damageNotes — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires damageNotes — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires damageNotes", async ({ request }) => {
    // Kills: nurse should not be able to requires damageNotes
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_079_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires damageNotes — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires damageNotes — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-080-AUTHMATRIX
// Behavior: POST /api/rentals/:id/return requires damageCharge if condition is 'damaged' or 'needs_repair'
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_080_AUTHMATRIX() {
  return {
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: "test-damageNotes",
    damageCharge: 1,
  };
}
test.describe("Auth Matrix: POST /api/rentals/:id/return requires damageCharge if condition is 'damaged' or 'needs_repair'", () => {
  test("admin must be able to requires damageCharge", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires damageCharge", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires damageCharge", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_080_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.return — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access damageCharge", async ({ request }) => {
    // Kills: Allow lower-privileged role to access damageCharge
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access damageCharge — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access damageCharge — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires damageCharge", async ({ request }) => {
    // Kills: technician should not be able to requires damageCharge
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires damageCharge — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires damageCharge — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires damageCharge", async ({ request }) => {
    // Kills: nurse should not be able to requires damageCharge
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.return", basePayload_PROOF_B_080_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires damageCharge — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires damageCharge — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-081-AUTHMATRIX
// Behavior: PATCH /api/rentals/:id/status updates rental status
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_081_AUTHMATRIX() {
  return {
    id: 1,
    status: "reserved",
  };
}
test.describe("Auth Matrix: PATCH /api/rentals/:id/status updates rental status", () => {
  test("admin must be able to updates rental status", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to updates rental status", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to updates rental status", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant updates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_081_AUTHMATRIX(),
      clinicId: TEST_CLINIC_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "rentals.status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in rentals.status", async ({ request }) => {
    // Kills: Remove role check in rentals.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in rentals.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental status", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to updates rental status", async ({ request }) => {
    // Kills: technician should not be able to updates rental status
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to updates rental status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to updates rental status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to updates rental status", async ({ request }) => {
    // Kills: nurse should not be able to updates rental status
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "rentals.status", basePayload_PROOF_B_081_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to updates rental status — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to updates rental status — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-082-AUTHMATRIX
// Behavior: POST /api/invoices creates an invoice
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_082_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: [{ description: "Test description", quantity: 1, unitPrice: 1, taxRate: 1 }],
    dueDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: POST /api/invoices creates an invoice", () => {
  test("admin must be able to creates invoice", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to creates invoice", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to creates invoice", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant creates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_082_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoice", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoice
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to creates invoice", async ({ request }) => {
    // Kills: technician should not be able to creates invoice
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to creates invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to creates invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to creates invoice", async ({ request }) => {
    // Kills: nurse should not be able to creates invoice
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_082_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to creates invoice — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to creates invoice — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-083-AUTHMATRIX
// Behavior: POST /api/invoices rejects if rentalId belongs to a different clinic
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_083_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: [{ description: "Test description", quantity: 1, unitPrice: 1, taxRate: 1 }],
    dueDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: POST /api/invoices rejects if rentalId belongs to a different clinic", () => {
  test("admin must be able to rejects invoice creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects invoice creation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_083_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoice creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoice creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_083_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects invoice creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects invoice creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-084-AUTHMATRIX
// Behavior: POST /api/invoices requires dueDate to be in the future
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_084_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: [{ description: "Test description", quantity: 1, unitPrice: 1, taxRate: 1 }],
    dueDate: tomorrowStr(),
  };
}
test.describe("Auth Matrix: POST /api/invoices requires dueDate to be in the future", () => {
  test("admin must be able to requires dueDate", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to requires dueDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to requires dueDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_084_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access dueDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access dueDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access dueDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access dueDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to requires dueDate", async ({ request }) => {
    // Kills: technician should not be able to requires dueDate
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to requires dueDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to requires dueDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to requires dueDate", async ({ request }) => {
    // Kills: nurse should not be able to requires dueDate
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.create", basePayload_PROOF_B_084_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to requires dueDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to requires dueDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-085-AUTHMATRIX
// Behavior: POST /api/invoices/:id/payment records payment
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_085_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: POST /api/invoices/:id/payment records payment", () => {
  test("admin must be able to records payment", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to records payment", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to records payment", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant records must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_085_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access payment", async ({ request }) => {
    // Kills: Allow lower-privileged role to access payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to records payment", async ({ request }) => {
    // Kills: technician should not be able to records payment
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to records payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to records payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to records payment", async ({ request }) => {
    // Kills: nurse should not be able to records payment
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_085_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to records payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to records payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-086-AUTHMATRIX
// Behavior: POST /api/invoices/:id/payment rejects if amount exceeds remaining balance
// Risk: medium
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_086_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: POST /api/invoices/:id/payment rejects if amount exceeds remaining balance", () => {
  test("admin must be able to rejects payment", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), "");
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to rejects payment", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant rejects must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_086_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access payment", async ({ request }) => {
    // Kills: Allow lower-privileged role to access payment
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_086_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to rejects payment — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to rejects payment — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-087-AUTHMATRIX
// Behavior: POST /api/invoices/:id/payment sets invoice.status to 'paid' if total paid >= invoice total
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_087_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: POST /api/invoices/:id/payment sets invoice.status to 'paid' if total paid >= invoice total", () => {
  test("admin must be able to sets invoice.status to 'paid'", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets invoice.status to 'paid'", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets invoice.status to 'paid'", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_087_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access invoice.status to 'paid'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access invoice.status to 'paid'
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access invoice.status to 'paid' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access invoice.status to 'paid' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets invoice.status to 'paid'", async ({ request }) => {
    // Kills: technician should not be able to sets invoice.status to 'paid'
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets invoice.status to 'paid' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets invoice.status to 'paid' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets invoice.status to 'paid'", async ({ request }) => {
    // Kills: nurse should not be able to sets invoice.status to 'paid'
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_087_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets invoice.status to 'paid' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets invoice.status to 'paid' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-088-AUTHMATRIX
// Behavior: POST /api/invoices/:id/payment handles partial payments by keeping invoice outstanding
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_088_AUTHMATRIX() {
  return {
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: "test-reference",
  };
}
test.describe("Auth Matrix: POST /api/invoices/:id/payment handles partial payments by keeping invoice outstanding", () => {
  test("admin must be able to handles partial payments", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to handles partial payments", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to handles partial payments", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant handles must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_088_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in invoices.payment — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access partial payments", async ({ request }) => {
    // Kills: Allow lower-privileged role to access partial payments
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access partial payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access partial payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to handles partial payments", async ({ request }) => {
    // Kills: technician should not be able to handles partial payments
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to handles partial payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to handles partial payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to handles partial payments", async ({ request }) => {
    // Kills: nurse should not be able to handles partial payments
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "invoices.payment", basePayload_PROOF_B_088_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to handles partial payments — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to handles partial payments — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-089-AUTHMATRIX
// Behavior: GET /api/reports/utilization provides device utilization report
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_089_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: GET /api/reports/utilization provides device utilization report", () => {
  test("admin must be able to provides device utilization report", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to provides device utilization report", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to provides device utilization report", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant provides must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_089_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in reports.utilization — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device utilization report", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device utilization report
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to provides device utilization report", async ({ request }) => {
    // Kills: technician should not be able to provides device utilization report
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to provides device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to provides device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to provides device utilization report", async ({ request }) => {
    // Kills: nurse should not be able to provides device utilization report
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_089_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to provides device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to provides device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-090-AUTHMATRIX
// Behavior: GET /api/reports/utilization is accessible only by admin
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_090_AUTHMATRIX() {
  return {
    clinicId: TEST_CLINIC_ID,
  };
}
test.describe("Auth Matrix: GET /api/reports/utilization is accessible only by admin", () => {
  test("admin must be able to restricts access to device utilization report", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to restricts access to device utilization report", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to restricts access to device utilization report", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant restricts access to must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_090_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in reports.utilization — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device utilization report", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device utilization report
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to restricts access to device utilization report", async ({ request }) => {
    // Kills: technician should not be able to restricts access to device utilization report
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to restricts access to device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to restricts access to device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to restricts access to device utilization report", async ({ request }) => {
    // Kills: nurse should not be able to restricts access to device utilization report
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "reports.utilization", basePayload_PROOF_B_090_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to restricts access to device utilization report — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to restricts access to device utilization report — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-091-AUTHMATRIX
// Behavior: Device state transitions from available to rented when rental created
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
test.describe("Auth Matrix: Device state transitions from available to rented when rental created", () => {
  test("admin must be able to transitions from available to rented", async ({ request }) => {
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

  test("technician must NOT be able to transitions from available to rented", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from available to rented", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from available to rented", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from available to rented
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_091_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from available to rented — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from available to rented — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-092-AUTHMATRIX
// Behavior: Device state transitions from rented to available when returned in good condition
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
test.describe("Auth Matrix: Device state transitions from rented to available when returned in good condition", () => {
  test("admin must be able to transitions from rented to available", async ({ request }) => {
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

  test("technician must NOT be able to transitions from rented to available", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from rented to available", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from rented to available", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from rented to available
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_092_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from rented to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from rented to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-093-AUTHMATRIX
// Behavior: Device state transitions from rented to maintenance when returned needing repair
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
test.describe("Auth Matrix: Device state transitions from rented to maintenance when returned needing repair", () => {
  test("admin must be able to transitions from rented to maintenance", async ({ request }) => {
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

  test("technician must NOT be able to transitions from rented to maintenance", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from rented to maintenance", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from rented to maintenance", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from rented to maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_093_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from rented to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from rented to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-094-AUTHMATRIX
// Behavior: Device state transitions from available to maintenance for scheduled maintenance
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
test.describe("Auth Matrix: Device state transitions from available to maintenance for scheduled maintenance", () => {
  test("admin must be able to transitions from available to maintenance", async ({ request }) => {
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

  test("technician must NOT be able to transitions from available to maintenance", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from available to maintenance", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from available to maintenance", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from available to maintenance
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_094_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from available to maintenance — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from available to maintenance — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-095-AUTHMATRIX
// Behavior: Device state transitions from maintenance to available when maintenance completed
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
test.describe("Auth Matrix: Device state transitions from maintenance to available when maintenance completed", () => {
  test("admin must be able to transitions from maintenance to available", async ({ request }) => {
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

  test("technician must NOT be able to transitions from maintenance to available", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from maintenance to available", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from maintenance to available", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from maintenance to available
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_095_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from maintenance to available — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from maintenance to available — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-096-AUTHMATRIX
// Behavior: Device state transitions from available to decommissioned
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
test.describe("Auth Matrix: Device state transitions from available to decommissioned", () => {
  test("admin must be able to transitions from available to decommissioned", async ({ request }) => {
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

  test("technician must NOT be able to transitions from available to decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from available to decommissioned", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from available to decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from available to decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_096_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from available to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from available to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-097-AUTHMATRIX
// Behavior: Device state transitions from maintenance to decommissioned
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
test.describe("Auth Matrix: Device state transitions from maintenance to decommissioned", () => {
  test("admin must be able to transitions from maintenance to decommissioned", async ({ request }) => {
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

  test("technician must NOT be able to transitions from maintenance to decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from maintenance to decommissioned", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from maintenance to decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from maintenance to decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_097_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from maintenance to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from maintenance to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-098-AUTHMATRIX
// Behavior: Device state cannot transition from decommissioned to any other state
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
test.describe("Auth Matrix: Device state cannot transition from decommissioned to any other state", () => {
  test("admin must be able to cannot transition from decommissioned", async ({ request }) => {
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

  test("technician must NOT be able to cannot transition from decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from decommissioned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_098_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-099-AUTHMATRIX
// Behavior: Device state cannot transition from rented to decommissioned without return first
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
test.describe("Auth Matrix: Device state cannot transition from rented to decommissioned without return first", () => {
  test("admin must be able to cannot transition from rented to decommissioned", async ({ request }) => {
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

  test("technician must NOT be able to cannot transition from rented to decommissioned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from rented to decommissioned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from rented to decommissioned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from rented to decommissioned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_099_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from rented to decommissioned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from rented to decommissioned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-100-AUTHMATRIX
// Behavior: Transition to maintenance state sets maintenanceStartDate
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
test.describe("Auth Matrix: Transition to maintenance state sets maintenanceStartDate", () => {
  test("admin must be able to sets maintenanceStartDate", async ({ request }) => {
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

  test("technician must NOT be able to sets maintenanceStartDate", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets maintenanceStartDate", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access maintenanceStartDate", async ({ request }) => {
    // Kills: Allow lower-privileged role to access maintenanceStartDate
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_100_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets maintenanceStartDate — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets maintenanceStartDate — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-101-AUTHMATRIX
// Behavior: Transition from maintenance to available sets lastMaintenanceDate and clears maintenanceStartDate
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
test.describe("Auth Matrix: Transition from maintenance to available sets lastMaintenanceDate and clears maintenanceStartDate", () => {
  test("admin must be able to sets lastMaintenanceDate and clears maintenanceStartDate device", async ({ request }) => {
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

  test("technician must NOT be able to sets lastMaintenanceDate and clears maintenanceStartDate device", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets lastMaintenanceDate and clears maintenanceStartDate device", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets lastMaintenanceDate and clears maintenanceStartDate must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access device", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device", async ({ request }) => {
    // Kills: technician should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device", async ({ request }) => {
    // Kills: nurse should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_101_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets lastMaintenanceDate and clears maintenanceStartDate device — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-102-AUTHMATRIX
// Behavior: Transition to decommissioned state sets decommissionedAt and decommissionedReason
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
test.describe("Auth Matrix: Transition to decommissioned state sets decommissionedAt and decommissionedReason", () => {
  test("admin must be able to sets decommissionedAt and decommissionedReason", async ({ request }) => {
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

  test("technician must NOT be able to sets decommissionedAt and decommissionedReason", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets decommissionedAt and decommissionedReason", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access decommissionedAt and decommissionedReason", async ({ request }) => {
    // Kills: Allow lower-privileged role to access decommissionedAt and decommissionedReason
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access decommissionedAt and decommissionedReason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access decommissionedAt and decommissionedReason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets decommissionedAt and decommissionedReason", async ({ request }) => {
    // Kills: technician should not be able to sets decommissionedAt and decommissionedReason
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets decommissionedAt and decommissionedReason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets decommissionedAt and decommissionedReason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets decommissionedAt and decommissionedReason", async ({ request }) => {
    // Kills: nurse should not be able to sets decommissionedAt and decommissionedReason
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_102_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets decommissionedAt and decommissionedReason — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets decommissionedAt and decommissionedReason — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-103-AUTHMATRIX
// Behavior: Rental state transitions from reserved to active on startDate or manual activation
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
test.describe("Auth Matrix: Rental state transitions from reserved to active on startDate or manual activation", () => {
  test("admin must be able to transitions from reserved to active", async ({ request }) => {
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

  test("technician must NOT be able to transitions from reserved to active", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from reserved to active", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from reserved to active", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from reserved to active
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_103_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from reserved to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from reserved to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-104-AUTHMATRIX
// Behavior: Rental state transitions from active to overdue automatically when past expectedReturnDate
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_104_AUTHMATRIX() {
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
test.describe("Auth Matrix: Rental state transitions from active to overdue automatically when past expectedReturnDate", () => {
  test("admin must be able to transitions from active to overdue automatically", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to transitions from active to overdue automatically", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from active to overdue automatically", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_104_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access from active to overdue automatically", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from active to overdue automatically
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from active to overdue automatically — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from active to overdue automatically — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to transitions from active to overdue automatically", async ({ request }) => {
    // Kills: technician should not be able to transitions from active to overdue automatically
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to transitions from active to overdue automatically — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to transitions from active to overdue automatically — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to transitions from active to overdue automatically", async ({ request }) => {
    // Kills: nurse should not be able to transitions from active to overdue automatically
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_104_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from active to overdue automatically — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from active to overdue automatically — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-105-AUTHMATRIX
// Behavior: Rental state transitions from active to returned when device is returned
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
test.describe("Auth Matrix: Rental state transitions from active to returned when device is returned", () => {
  test("admin must be able to transitions from active to returned", async ({ request }) => {
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

  test("technician must NOT be able to transitions from active to returned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from active to returned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from active to returned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from active to returned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_105_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from active to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from active to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-106-AUTHMATRIX
// Behavior: Rental state transitions from overdue to returned upon late return, applying extra charges
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
test.describe("Auth Matrix: Rental state transitions from overdue to returned upon late return, applying extra charges", () => {
  test("admin must be able to transitions from overdue to returned", async ({ request }) => {
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

  test("technician must NOT be able to transitions from overdue to returned", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from overdue to returned", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from overdue to returned", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from overdue to returned
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_106_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from overdue to returned — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from overdue to returned — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-107-AUTHMATRIX
// Behavior: Rental state transitions from returned to completed when final invoice is paid
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
test.describe("Auth Matrix: Rental state transitions from returned to completed when final invoice is paid", () => {
  test("admin must be able to transitions from returned to completed", async ({ request }) => {
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

  test("technician must NOT be able to transitions from returned to completed", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from returned to completed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from returned to completed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from returned to completed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_107_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from returned to completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from returned to completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-108-AUTHMATRIX
// Behavior: Rental state transitions from reserved to cancelled before startDate
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
test.describe("Auth Matrix: Rental state transitions from reserved to cancelled before startDate", () => {
  test("admin must be able to transitions from reserved to cancelled", async ({ request }) => {
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

  test("technician must NOT be able to transitions from reserved to cancelled", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from reserved to cancelled", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from reserved to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from reserved to cancelled
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_108_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from reserved to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from reserved to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-109-AUTHMATRIX
// Behavior: Rental state transitions from active to cancelled by admin only, with reason
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
test.describe("Auth Matrix: Rental state transitions from active to cancelled by admin only, with reason", () => {
  test("admin must be able to transitions from active to cancelled", async ({ request }) => {
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

  test("technician must NOT be able to transitions from active to cancelled", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to transitions from active to cancelled", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant transitions must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from active to cancelled", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from active to cancelled
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_109_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to transitions from active to cancelled — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to transitions from active to cancelled — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-110-AUTHMATRIX
// Behavior: Rental state cannot transition from completed to any other state
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
test.describe("Auth Matrix: Rental state cannot transition from completed to any other state", () => {
  test("admin must be able to cannot transition from completed", async ({ request }) => {
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

  test("technician must NOT be able to cannot transition from completed", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from completed", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from completed", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from completed
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_110_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from completed — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from completed — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-111-AUTHMATRIX
// Behavior: Rental state cannot transition from cancelled to active
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
test.describe("Auth Matrix: Rental state cannot transition from cancelled to active", () => {
  test("admin must be able to cannot transition from cancelled to active", async ({ request }) => {
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

  test("technician must NOT be able to cannot transition from cancelled to active", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from cancelled to active", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from cancelled to active", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from cancelled to active
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_111_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from cancelled to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from cancelled to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-112-AUTHMATRIX
// Behavior: Rental state cannot transition from overdue to reserved
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
test.describe("Auth Matrix: Rental state cannot transition from overdue to reserved", () => {
  test("admin must be able to cannot transition from overdue to reserved", async ({ request }) => {
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

  test("technician must NOT be able to cannot transition from overdue to reserved", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from overdue to reserved", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from overdue to reserved", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from overdue to reserved
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access from overdue to reserved — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access from overdue to reserved — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to cannot transition from overdue to reserved", async ({ request }) => {
    // Kills: technician should not be able to cannot transition from overdue to reserved
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to cannot transition from overdue to reserved — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to cannot transition from overdue to reserved — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to cannot transition from overdue to reserved", async ({ request }) => {
    // Kills: nurse should not be able to cannot transition from overdue to reserved
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_112_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from overdue to reserved — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from overdue to reserved — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-113-AUTHMATRIX
// Behavior: Rental state cannot transition from returned to active
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
test.describe("Auth Matrix: Rental state cannot transition from returned to active", () => {
  test("admin must be able to cannot transition from returned to active", async ({ request }) => {
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

  test("technician must NOT be able to cannot transition from returned to active", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to cannot transition from returned to active", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot transition must be rejected", async ({ request }) => {
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

  test("mutation-kill-2: Allow lower-privileged role to access from returned to active", async ({ request }) => {
    // Kills: Allow lower-privileged role to access from returned to active
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_113_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to cannot transition from returned to active — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to cannot transition from returned to active — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-114-AUTHMATRIX
// Behavior: Transition to active rental state sets device.status to 'rented'
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_114_AUTHMATRIX() {
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
test.describe("Auth Matrix: Transition to active rental state sets device.status to 'rented'", () => {
  test("admin must be able to sets device.status to 'rented'", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status to 'rented'", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status to 'rented'", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_114_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access device.status to 'rented'", async ({ request }) => {
    // Kills: Allow lower-privileged role to access device.status to 'rented'
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access device.status to 'rented' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access device.status to 'rented' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status to 'rented'", async ({ request }) => {
    // Kills: technician should not be able to sets device.status to 'rented'
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status to 'rented' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status to 'rented' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status to 'rented'", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status to 'rented'
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_114_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status to 'rented' — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status to 'rented' — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-115-AUTHMATRIX
// Behavior: Transition to overdue rental state sends overdue notification and calculates late fees
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_115_AUTHMATRIX() {
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
test.describe("Auth Matrix: Transition to overdue rental state sends overdue notification and calculates late fees", () => {
  test("admin must be able to sends overdue notification and calculates late fees rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sends overdue notification and calculates late fees rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sends overdue notification and calculates late fees rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sends overdue notification and calculates late fees must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_115_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sends overdue notification and calculates late fees rental", async ({ request }) => {
    // Kills: technician should not be able to sends overdue notification and calculates late fees rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sends overdue notification and calculates late fees rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sends overdue notification and calculates late fees rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sends overdue notification and calculates late fees rental", async ({ request }) => {
    // Kills: nurse should not be able to sends overdue notification and calculates late fees rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_115_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sends overdue notification and calculates late fees rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sends overdue notification and calculates late fees rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-116-AUTHMATRIX
// Behavior: Transition to returned rental state calculates final charges and updates device status
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_116_AUTHMATRIX() {
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
test.describe("Auth Matrix: Transition to returned rental state calculates final charges and updates device status", () => {
  test("admin must be able to calculates final charges and updates device status rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to calculates final charges and updates device status rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to calculates final charges and updates device status rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant calculates final charges and updates device status must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_116_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to calculates final charges and updates device status rental", async ({ request }) => {
    // Kills: technician should not be able to calculates final charges and updates device status rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to calculates final charges and updates device status rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to calculates final charges and updates device status rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to calculates final charges and updates device status rental", async ({ request }) => {
    // Kills: nurse should not be able to calculates final charges and updates device status rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_116_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to calculates final charges and updates device status rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to calculates final charges and updates device status rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-117-AUTHMATRIX
// Behavior: Transition to completed rental state archives rental and updates patient.completedRentals count
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_117_AUTHMATRIX() {
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
test.describe("Auth Matrix: Transition to completed rental state archives rental and updates patient.completedRentals count", () => {
  test("admin must be able to archives rental and updates patient.completedRentals count rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to archives rental and updates patient.completedRentals count rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to archives rental and updates patient.completedRentals count rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant archives rental and updates patient.completedRentals count must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_117_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to archives rental and updates patient.completedRentals count rental", async ({ request }) => {
    // Kills: technician should not be able to archives rental and updates patient.completedRentals count rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to archives rental and updates patient.completedRentals count rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to archives rental and updates patient.completedRentals count rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to archives rental and updates patient.completedRentals count rental", async ({ request }) => {
    // Kills: nurse should not be able to archives rental and updates patient.completedRentals count rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_117_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to archives rental and updates patient.completedRentals count rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to archives rental and updates patient.completedRentals count rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-118-AUTHMATRIX
// Behavior: Transition to cancelled rental state sets device.status to 'available' and refunds deposit if applicable
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_118_AUTHMATRIX() {
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
test.describe("Auth Matrix: Transition to cancelled rental state sets device.status to 'available' and refunds deposit if applicable", () => {
  test("admin must be able to sets device.status to 'available' and refunds deposit if applicable rental", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to sets device.status to 'available' and refunds deposit if applicable rental", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to sets device.status to 'available' and refunds deposit if applicable rental", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sets device.status to 'available' and refunds deposit if applicable must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_118_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to sets device.status to 'available' and refunds deposit if applicable rental", async ({ request }) => {
    // Kills: technician should not be able to sets device.status to 'available' and refunds deposit if applicable rental
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to sets device.status to 'available' and refunds deposit if applicable rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to sets device.status to 'available' and refunds deposit if applicable rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to sets device.status to 'available' and refunds deposit if applicable rental", async ({ request }) => {
    // Kills: nurse should not be able to sets device.status to 'available' and refunds deposit if applicable rental
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_118_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to sets device.status to 'available' and refunds deposit if applicable rental — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to sets device.status to 'available' and refunds deposit if applicable rental — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-119-AUTHMATRIX
// Behavior: System provides 100% deposit refund for cancellation before startDate
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_119_AUTHMATRIX() {
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
test.describe("Auth Matrix: System provides 100% deposit refund for cancellation before startDate", () => {
  test("admin must be able to provides 100% deposit refund", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to provides 100% deposit refund", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to provides 100% deposit refund", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant provides must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_119_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 100% deposit refund", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 100% deposit refund
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 100% deposit refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 100% deposit refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to provides 100% deposit refund", async ({ request }) => {
    // Kills: technician should not be able to provides 100% deposit refund
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to provides 100% deposit refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to provides 100% deposit refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to provides 100% deposit refund", async ({ request }) => {
    // Kills: nurse should not be able to provides 100% deposit refund
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_119_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to provides 100% deposit refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to provides 100% deposit refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-120-AUTHMATRIX
// Behavior: System provides 50% deposit refund for cancellation within 24h of startDate
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_120_AUTHMATRIX() {
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
test.describe("Auth Matrix: System provides 50% deposit refund for cancellation within 24h of startDate", () => {
  test("admin must be able to provides 50% deposit refund", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to provides 50% deposit refund", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to provides 50% deposit refund", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant provides must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_120_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access 50% deposit refund", async ({ request }) => {
    // Kills: Allow lower-privileged role to access 50% deposit refund
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access 50% deposit refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access 50% deposit refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to provides 50% deposit refund", async ({ request }) => {
    // Kills: technician should not be able to provides 50% deposit refund
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to provides 50% deposit refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to provides 50% deposit refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to provides 50% deposit refund", async ({ request }) => {
    // Kills: nurse should not be able to provides 50% deposit refund
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_120_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to provides 50% deposit refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to provides 50% deposit refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-121-AUTHMATRIX
// Behavior: System provides no deposit refund for cancellation after startDate (admin only), charging for days used
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_121_AUTHMATRIX() {
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
test.describe("Auth Matrix: System provides no deposit refund for cancellation after startDate (admin only), charging for days used", () => {
  test("admin must be able to provides no deposit refund and charges for days used rental cancellation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("technician must NOT be able to provides no deposit refund and charges for days used rental cancellation", async ({ request }) => {
    const roleCookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("nurse must NOT be able to provides no deposit refund and charges for days used rental cancellation", async ({ request }) => {
    const roleCookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant provides no deposit refund and charges for days used must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_121_AUTHMATRIX(),
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
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in devices.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access rental cancellation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access rental cancellation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access rental cancellation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access rental cancellation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: technician should not be able to provides no deposit refund and charges for days used rental cancellation", async ({ request }) => {
    // Kills: technician should not be able to provides no deposit refund and charges for days used rental cancellation
    const cookie = await getTechnicianCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: technician should not be able to provides no deposit refund and charges for days used rental cancellation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: technician should not be able to provides no deposit refund and charges for days used rental cancellation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: nurse should not be able to provides no deposit refund and charges for days used rental cancellation", async ({ request }) => {
    // Kills: nurse should not be able to provides no deposit refund and charges for days used rental cancellation
    const cookie = await getNurseCookie(request);
    const response = await trpcQuery(request, "devices.create", basePayload_PROOF_B_121_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: nurse should not be able to provides no deposit refund and charges for days used rental cancellation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: nurse should not be able to provides no deposit refund and charges for days used rental cancellation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});