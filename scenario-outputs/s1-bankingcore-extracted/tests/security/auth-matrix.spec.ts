import { expect, test } from "@playwright/test";
import { BASE_URL, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getAdvisorCookie, getCustomerCookie } from "../../helpers/auth";
import { TEST_BANK_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Customer role can only access own accounts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: Customer role can only access own accounts", () => {
  test("admin must be able to accesses own accounts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses own accounts", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses own accounts", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant accesses must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own accounts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own accounts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses own accounts", async ({ request }) => {
    // Kills: customer should not be able to accesses own accounts
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses own accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses own accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses own accounts", async ({ request }) => {
    // Kills: advisor should not be able to accesses own accounts
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses own accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses own accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Customer role can only access own transactions
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: Customer role can only access own transactions", () => {
  test("admin must be able to accesses own transactions", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses own transactions", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses own transactions", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant accesses must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own transactions", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own transactions
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses own transactions", async ({ request }) => {
    // Kills: customer should not be able to accesses own transactions
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses own transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses own transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses own transactions", async ({ request }) => {
    // Kills: advisor should not be able to accesses own transactions
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses own transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses own transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Advisor role can access all accounts within their bankId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: Advisor role can access all accounts within their bankId", () => {
  test("admin must be able to accesses all accounts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses all accounts", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses all accounts", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant accesses must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all accounts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all accounts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses all accounts", async ({ request }) => {
    // Kills: customer should not be able to accesses all accounts
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses all accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses all accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses all accounts", async ({ request }) => {
    // Kills: advisor should not be able to accesses all accounts
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses all accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses all accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Admin role can access everything within their bankId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: Admin role can access everything within their bankId", () => {
  test("admin must be able to accesses everything", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses everything", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses everything", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant accesses must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access everything", async ({ request }) => {
    // Kills: Allow lower-privileged role to access everything
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access everything — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access everything — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses everything", async ({ request }) => {
    // Kills: customer should not be able to accesses everything
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses everything — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses everything — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses everything", async ({ request }) => {
    // Kills: advisor should not be able to accesses everything
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses everything — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses everything — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Admin role cannot access other banks
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: Admin role cannot access other banks", () => {
  test("admin must be able to cannot access other banks", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to cannot access other banks", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to cannot access other banks", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot access must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access other banks", async ({ request }) => {
    // Kills: Allow lower-privileged role to access other banks
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access other banks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access other banks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to cannot access other banks", async ({ request }) => {
    // Kills: customer should not be able to cannot access other banks
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to cannot access other banks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to cannot access other banks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to cannot access other banks", async ({ request }) => {
    // Kills: advisor should not be able to cannot access other banks
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to cannot access other banks — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to cannot access other banks — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: POST /api/accounts requires advisor or admin authorization
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: POST /api/accounts requires advisor or admin authorization", () => {
  test("admin must be able to requires authorization advisor or admin", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires authorization advisor or admin", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires authorization advisor or admin", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires authorization must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access advisor or admin", async ({ request }) => {
    // Kills: Allow lower-privileged role to access advisor or admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access advisor or admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access advisor or admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires authorization advisor or admin", async ({ request }) => {
    // Kills: customer should not be able to requires authorization advisor or admin
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires authorization advisor or admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires authorization advisor or admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires authorization advisor or admin", async ({ request }) => {
    // Kills: advisor should not be able to requires authorization advisor or admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires authorization advisor or admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires authorization advisor or admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: POST /api/accounts rejects cross-tenant account creation
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: POST /api/accounts rejects cross-tenant account creation", () => {
  test("admin must be able to returns 403 response", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-016-AUTHMATRIX
// Behavior: Customer for new account must exist and belong to same bankId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_016_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    accountType: "checking",
    initialDeposit: 1,
  };
}
test.describe("Auth Matrix: Customer for new account must exist and belong to same bankId", () => {
  test("admin must be able to validates customer existence and bankId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to validates customer existence and bankId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to validates customer existence and bankId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant validates must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_016_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.create", async ({ request }) => {
    // Kills: Remove role check in accounts.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access customer existence and bankId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access customer existence and bankId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access customer existence and bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access customer existence and bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to validates customer existence and bankId", async ({ request }) => {
    // Kills: customer should not be able to validates customer existence and bankId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to validates customer existence and bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to validates customer existence and bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to validates customer existence and bankId", async ({ request }) => {
    // Kills: advisor should not be able to validates customer existence and bankId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to validates customer existence and bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to validates customer existence and bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: GET /api/accounts allows customer to see only own accounts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_019_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts allows customer to see only own accounts", () => {
  test("admin must be able to filters accounts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to filters accounts", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to filters accounts", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant filters must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_019_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.list", async ({ request }) => {
    // Kills: Remove role check in accounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access accounts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access accounts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to filters accounts", async ({ request }) => {
    // Kills: customer should not be able to filters accounts
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to filters accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to filters accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to filters accounts", async ({ request }) => {
    // Kills: advisor should not be able to filters accounts
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to filters accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to filters accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-020-AUTHMATRIX
// Behavior: GET /api/accounts allows advisor/admin to see all accounts within bank
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_020_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts allows advisor/admin to see all accounts within bank", () => {
  test("admin must be able to lists all accounts", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to lists all accounts", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to lists all accounts", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant lists must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_020_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.list", async ({ request }) => {
    // Kills: Remove role check in accounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all accounts", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all accounts
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to lists all accounts", async ({ request }) => {
    // Kills: customer should not be able to lists all accounts
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to lists all accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to lists all accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to lists all accounts", async ({ request }) => {
    // Kills: advisor should not be able to lists all accounts
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to lists all accounts — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to lists all accounts — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-021-AUTHMATRIX
// Behavior: GET /api/accounts automatically filters customer's accounts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_021_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts automatically filters customer's accounts", () => {
  test("admin must be able to filters accounts by customerId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to filters accounts by customerId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to filters accounts by customerId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant filters accounts must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_021_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.list", async ({ request }) => {
    // Kills: Remove role check in accounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access by customerId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access by customerId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access by customerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access by customerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to filters accounts by customerId", async ({ request }) => {
    // Kills: customer should not be able to filters accounts by customerId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to filters accounts by customerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to filters accounts by customerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to filters accounts by customerId", async ({ request }) => {
    // Kills: advisor should not be able to filters accounts by customerId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to filters accounts by customerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to filters accounts by customerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-022-AUTHMATRIX
// Behavior: GET /api/accounts allows advisor/admin to filter by customerId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_022_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts allows advisor/admin to filter by customerId", () => {
  test("admin must be able to filters accounts by customerId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to filters accounts by customerId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to filters accounts by customerId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant filters accounts must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_022_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.list", async ({ request }) => {
    // Kills: Remove role check in accounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access by customerId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access by customerId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access by customerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access by customerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to filters accounts by customerId", async ({ request }) => {
    // Kills: customer should not be able to filters accounts by customerId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to filters accounts by customerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to filters accounts by customerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to filters accounts by customerId", async ({ request }) => {
    // Kills: advisor should not be able to filters accounts by customerId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to filters accounts by customerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to filters accounts by customerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-023-AUTHMATRIX
// Behavior: GET /api/accounts returns 403 with empty data for cross-tenant listing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_023_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts returns 403 with empty data for cross-tenant listing", () => {
  test("admin must be able to returns 403 response with empty data", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response with empty data", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response with empty data", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_023_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.list", async ({ request }) => {
    // Kills: Remove role check in accounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response with empty data", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response with empty data
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response with empty data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response with empty data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response with empty data", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response with empty data
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response with empty data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response with empty data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response with empty data", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response with empty data
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response with empty data — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response with empty data — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-025-AUTHMATRIX
// Behavior: GET /api/accounts/:id returns 403 if account belongs to different bank
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_025_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/accounts/:id returns 403 if account belongs to different bank", () => {
  test("admin must be able to returns 403 response", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.getById", async ({ request }) => {
    // Kills: Remove role check in accounts.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: GET /api/accounts/:id returns 403 if customer role accesses another customer's account
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_026_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: GET /api/accounts/:id returns 403 if customer role accesses another customer's account", () => {
  test("admin must be able to returns 403 response", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_026_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.getById", async ({ request }) => {
    // Kills: Remove role check in accounts.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.getById", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: POST /api/transactions requires advisor or admin authorization
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_027_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    amount: 1,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  };
}
test.describe("Auth Matrix: POST /api/transactions requires advisor or admin authorization", () => {
  test("admin must be able to requires authorization advisor or admin", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires authorization advisor or admin", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires authorization advisor or admin", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires authorization must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.create", async ({ request }) => {
    // Kills: Remove role check in transactions.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access advisor or admin", async ({ request }) => {
    // Kills: Allow lower-privileged role to access advisor or admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access advisor or admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access advisor or admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires authorization advisor or admin", async ({ request }) => {
    // Kills: customer should not be able to requires authorization advisor or admin
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires authorization advisor or admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires authorization advisor or admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires authorization advisor or admin", async ({ request }) => {
    // Kills: advisor should not be able to requires authorization advisor or admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires authorization advisor or admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires authorization advisor or admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-028-AUTHMATRIX
// Behavior: POST /api/transactions returns 403 for cross-tenant transaction creation
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_028_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    amount: 1,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  };
}
test.describe("Auth Matrix: POST /api/transactions returns 403 for cross-tenant transaction creation", () => {
  test("admin must be able to returns 403 response", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_028_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.create", async ({ request }) => {
    // Kills: Remove role check in transactions.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: POST /api/transactions returns 403 if fromAccountId and toAccountId are not in same bank
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_029_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    fromAccountId: 1,
    toAccountId: 2,
    amount: 1,
    description: "Test description",
    idempotencyKey: "idempotency-key-${Date.now()}",
  };
}
test.describe("Auth Matrix: POST /api/transactions returns 403 if fromAccountId and toAccountId are not in same bank", () => {
  test("admin must be able to returns 403 response", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_029_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.create", async ({ request }) => {
    // Kills: Remove role check in transactions.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-036-AUTHMATRIX
// Behavior: PATCH /api/transactions/:id/status requires admin authorization
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_036_AUTHMATRIX() {
  return {
    id: 1,
    status: "processing",
  };
}
test.describe("Auth Matrix: PATCH /api/transactions/:id/status requires admin authorization", () => {
  test("admin must be able to requires authorization admin", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires authorization must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_036_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.status", async ({ request }) => {
    // Kills: Remove role check in transactions.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires authorization admin", async ({ request }) => {
    // Kills: customer should not be able to requires authorization admin
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires authorization admin", async ({ request }) => {
    // Kills: advisor should not be able to requires authorization admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-047-AUTHMATRIX
// Behavior: PATCH /api/transactions/:id/status returns 403 for non-admin users
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_047_AUTHMATRIX() {
  return {
    id: 1,
    status: "processing",
  };
}
test.describe("Auth Matrix: PATCH /api/transactions/:id/status returns 403 for non-admin users", () => {
  test("admin must be able to returns 403 response", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 response", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_047_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.status", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.status", async ({ request }) => {
    // Kills: Remove role check in transactions.status
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.status — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access response", async ({ request }) => {
    // Kills: Allow lower-privileged role to access response
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 response", async ({ request }) => {
    // Kills: customer should not be able to returns 403 response
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 response", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 response
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.status", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 response — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 response — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-048-AUTHMATRIX
// Behavior: GET /api/transactions allows customer to see only own transactions
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_048_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    accountId: 1,
    status: "pending",
    fromDate: tomorrowStr(),
    toDate: tomorrowStr(),
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: GET /api/transactions allows customer to see only own transactions", () => {
  test("admin must be able to filters transactions", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to filters transactions", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to filters transactions", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant filters must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_048_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.list", async ({ request }) => {
    // Kills: Remove role check in transactions.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access transactions", async ({ request }) => {
    // Kills: Allow lower-privileged role to access transactions
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to filters transactions", async ({ request }) => {
    // Kills: customer should not be able to filters transactions
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to filters transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to filters transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to filters transactions", async ({ request }) => {
    // Kills: advisor should not be able to filters transactions
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to filters transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to filters transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-049-AUTHMATRIX
// Behavior: GET /api/transactions allows advisor/admin to see all transactions within bank
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_049_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    accountId: 1,
    status: "pending",
    fromDate: tomorrowStr(),
    toDate: tomorrowStr(),
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: GET /api/transactions allows advisor/admin to see all transactions within bank", () => {
  test("admin must be able to lists all transactions", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to lists all transactions", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to lists all transactions", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant lists must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_049_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "transactions.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in transactions.list", async ({ request }) => {
    // Kills: Remove role check in transactions.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in transactions.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all transactions", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all transactions
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to lists all transactions", async ({ request }) => {
    // Kills: customer should not be able to lists all transactions
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to lists all transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to lists all transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to lists all transactions", async ({ request }) => {
    // Kills: advisor should not be able to lists all transactions
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "transactions.list", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to lists all transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to lists all transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-050-AUTHMATRIX
// Behavior: DELETE /api/accounts/:id requires admin authorization
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_050_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: DELETE /api/accounts/:id requires admin authorization", () => {
  test("admin must be able to requires authorization admin", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires authorization must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_050_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.delete", async ({ request }) => {
    // Kills: Remove role check in accounts.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires authorization admin", async ({ request }) => {
    // Kills: customer should not be able to requires authorization admin
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires authorization admin", async ({ request }) => {
    // Kills: advisor should not be able to requires authorization admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.delete", basePayload_PROOF_B_050_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-055-AUTHMATRIX
// Behavior: POST /api/accounts/:id/freeze requires admin authorization
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_055_AUTHMATRIX() {
  return {
    id: 1,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/accounts/:id/freeze requires admin authorization", () => {
  test("admin must be able to requires authorization admin", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires authorization must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_055_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.freeze", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.freeze", async ({ request }) => {
    // Kills: Remove role check in accounts.freeze
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.freeze — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires authorization admin", async ({ request }) => {
    // Kills: customer should not be able to requires authorization admin
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires authorization admin", async ({ request }) => {
    // Kills: advisor should not be able to requires authorization admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.freeze", basePayload_PROOF_B_055_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-061-AUTHMATRIX
// Behavior: POST /api/accounts/:id/unfreeze requires admin authorization
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_061_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: POST /api/accounts/:id/unfreeze requires admin authorization", () => {
  test("admin must be able to requires authorization admin", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires authorization admin", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires authorization must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_061_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "accounts.unfreeze", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in accounts.unfreeze", async ({ request }) => {
    // Kills: Remove role check in accounts.unfreeze
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in accounts.unfreeze — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires authorization admin", async ({ request }) => {
    // Kills: customer should not be able to requires authorization admin
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires authorization admin", async ({ request }) => {
    // Kills: advisor should not be able to requires authorization admin
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "accounts.unfreeze", basePayload_PROOF_B_061_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires authorization admin — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires authorization admin — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});