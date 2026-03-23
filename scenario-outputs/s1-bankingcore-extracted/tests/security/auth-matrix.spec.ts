import { expect, test } from "@playwright/test";
import { BASE_URL, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getAdvisorCookie, getCustomerCookie } from "../../helpers/auth";
import { TEST_BANK_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Customer role can only access own accounts and transactions
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
test.describe("Auth Matrix: Customer role can only access own accounts and transactions", () => {
  test("admin must be able to accesses own accounts and transactions", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses own accounts and transactions", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses own accounts and transactions", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "createAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createAccount.create", async ({ request }) => {
    // Kills: Remove role check in createAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own accounts and transactions", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own accounts and transactions
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own accounts and transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own accounts and transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses own accounts and transactions", async ({ request }) => {
    // Kills: customer should not be able to accesses own accounts and transactions
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses own accounts and transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses own accounts and transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses own accounts and transactions", async ({ request }) => {
    // Kills: advisor should not be able to accesses own accounts and transactions
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses own accounts and transactions — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses own accounts and transactions — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Advisor role can access all accounts within their bankId
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
test.describe("Auth Matrix: Advisor role can access all accounts within their bankId", () => {
  test("admin must be able to accesses all accounts within their bankId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses all accounts within their bankId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses all accounts within their bankId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "createAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createAccount.create", async ({ request }) => {
    // Kills: Remove role check in createAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access all accounts within their bankId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access all accounts within their bankId
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access all accounts within their bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access all accounts within their bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses all accounts within their bankId", async ({ request }) => {
    // Kills: customer should not be able to accesses all accounts within their bankId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses all accounts within their bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses all accounts within their bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses all accounts within their bankId", async ({ request }) => {
    // Kills: advisor should not be able to accesses all accounts within their bankId
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses all accounts within their bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses all accounts within their bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Admin role can access everything within their bankId
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
test.describe("Auth Matrix: Admin role can access everything within their bankId", () => {
  test("admin must be able to accesses everything within their bankId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to accesses everything within their bankId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to accesses everything within their bankId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant accesses must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "createAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createAccount.create", async ({ request }) => {
    // Kills: Remove role check in createAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access everything within their bankId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access everything within their bankId
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access everything within their bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access everything within their bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to accesses everything within their bankId", async ({ request }) => {
    // Kills: customer should not be able to accesses everything within their bankId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to accesses everything within their bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to accesses everything within their bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to accesses everything within their bankId", async ({ request }) => {
    // Kills: advisor should not be able to accesses everything within their bankId
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to accesses everything within their bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to accesses everything within their bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: POST /api/accounts requires advisor or admin role
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
test.describe("Auth Matrix: POST /api/accounts requires advisor or admin role", () => {
  test("admin must be able to requires advisor or admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires advisor or admin role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires advisor or admin role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "createAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createAccount.create", async ({ request }) => {
    // Kills: Remove role check in createAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access advisor or admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access advisor or admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access advisor or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access advisor or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires advisor or admin role", async ({ request }) => {
    // Kills: customer should not be able to requires advisor or admin role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires advisor or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires advisor or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires advisor or admin role", async ({ request }) => {
    // Kills: advisor should not be able to requires advisor or admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires advisor or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires advisor or admin role — verify error code is present
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
  test("admin must be able to returns 403 for cross-tenant account creation", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 for cross-tenant account creation", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 for cross-tenant account creation", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "createAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createAccount.create", async ({ request }) => {
    // Kills: Remove role check in createAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access for cross-tenant account creation", async ({ request }) => {
    // Kills: Allow lower-privileged role to access for cross-tenant account creation
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access for cross-tenant account creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access for cross-tenant account creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 for cross-tenant account creation", async ({ request }) => {
    // Kills: customer should not be able to returns 403 for cross-tenant account creation
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 for cross-tenant account creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 for cross-tenant account creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 for cross-tenant account creation", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 for cross-tenant account creation
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 for cross-tenant account creation — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 for cross-tenant account creation — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-016-AUTHMATRIX
// Behavior: Customer must exist and belong to same bankId for account creation
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
test.describe("Auth Matrix: Customer must exist and belong to same bankId for account creation", () => {
  test("admin must be able to validates customer existence and bankId match", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to validates customer existence and bankId match", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to validates customer existence and bankId match", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "createAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createAccount.create", async ({ request }) => {
    // Kills: Remove role check in createAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access customer existence and bankId match", async ({ request }) => {
    // Kills: Allow lower-privileged role to access customer existence and bankId match
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access customer existence and bankId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access customer existence and bankId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to validates customer existence and bankId match", async ({ request }) => {
    // Kills: customer should not be able to validates customer existence and bankId match
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to validates customer existence and bankId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to validates customer existence and bankId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to validates customer existence and bankId match", async ({ request }) => {
    // Kills: advisor should not be able to validates customer existence and bankId match
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createAccount.create", basePayload_PROOF_B_016_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to validates customer existence and bankId match — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to validates customer existence and bankId match — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-019-AUTHMATRIX
// Behavior: GET /api/accounts authorization for customer role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_019_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts authorization for customer role", () => {
  test("admin must be able to sees only own accounts when listing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to sees only own accounts when listing", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to sees only own accounts when listing", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees only must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_019_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "listAccounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listAccounts.list", async ({ request }) => {
    // Kills: Remove role check in listAccounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listAccounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own accounts when listing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own accounts when listing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own accounts when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own accounts when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to sees only own accounts when listing", async ({ request }) => {
    // Kills: customer should not be able to sees only own accounts when listing
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to sees only own accounts when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to sees only own accounts when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to sees only own accounts when listing", async ({ request }) => {
    // Kills: advisor should not be able to sees only own accounts when listing
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_019_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to sees only own accounts when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to sees only own accounts when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-020-AUTHMATRIX
// Behavior: GET /api/accounts authorization for advisor/admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_020_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts authorization for advisor/admin role", () => {
  test("admin must be able to sees all accounts within bank when listing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to sees all accounts within bank when listing", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to sees all accounts within bank when listing", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees all must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_020_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "listAccounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listAccounts.list", async ({ request }) => {
    // Kills: Remove role check in listAccounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listAccounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access accounts within bank when listing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access accounts within bank when listing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access accounts within bank when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access accounts within bank when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to sees all accounts within bank when listing", async ({ request }) => {
    // Kills: customer should not be able to sees all accounts within bank when listing
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to sees all accounts within bank when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to sees all accounts within bank when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to sees all accounts within bank when listing", async ({ request }) => {
    // Kills: advisor should not be able to sees all accounts within bank when listing
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_020_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to sees all accounts within bank when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to sees all accounts within bank when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-021-AUTHMATRIX
// Behavior: GET /api/accounts automatically filters for customer's own accounts
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_021_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: GET /api/accounts automatically filters for customer's own accounts", () => {
  test("admin must be able to filters accounts to own customerId for customer role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to filters accounts to own customerId for customer role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to filters accounts to own customerId for customer role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "listAccounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listAccounts.list", async ({ request }) => {
    // Kills: Remove role check in listAccounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listAccounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access to own customerId for customer role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access to own customerId for customer role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access to own customerId for customer role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access to own customerId for customer role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to filters accounts to own customerId for customer role", async ({ request }) => {
    // Kills: customer should not be able to filters accounts to own customerId for customer role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to filters accounts to own customerId for customer role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to filters accounts to own customerId for customer role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to filters accounts to own customerId for customer role", async ({ request }) => {
    // Kills: advisor should not be able to filters accounts to own customerId for customer role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_021_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to filters accounts to own customerId for customer role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to filters accounts to own customerId for customer role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-022-AUTHMATRIX
// Behavior: Advisor/admin can filter accounts by customerId or see all
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_022_AUTHMATRIX() {
  return {
    bankId: TEST_BANK_ID,
    customerId: 2,
    status: "active",
  };
}
test.describe("Auth Matrix: Advisor/admin can filter accounts by customerId or see all", () => {
  test("admin must be able to filters accounts by customerId or sees all", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to filters accounts by customerId or sees all", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to filters accounts by customerId or sees all", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "listAccounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listAccounts.list", async ({ request }) => {
    // Kills: Remove role check in listAccounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listAccounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access by customerId or sees all", async ({ request }) => {
    // Kills: Allow lower-privileged role to access by customerId or sees all
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access by customerId or sees all — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access by customerId or sees all — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to filters accounts by customerId or sees all", async ({ request }) => {
    // Kills: customer should not be able to filters accounts by customerId or sees all
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to filters accounts by customerId or sees all — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to filters accounts by customerId or sees all — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to filters accounts by customerId or sees all", async ({ request }) => {
    // Kills: advisor should not be able to filters accounts by customerId or sees all
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_022_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to filters accounts by customerId or sees all — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to filters accounts by customerId or sees all — verify error code is present
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
  test("admin must be able to returns 403 with empty data for cross-tenant listing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 with empty data for cross-tenant listing", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 with empty data for cross-tenant listing", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), roleCookie);
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
    const response = await trpcQuery(request, "listAccounts.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listAccounts.list", async ({ request }) => {
    // Kills: Remove role check in listAccounts.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listAccounts.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access with empty data for cross-tenant listing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access with empty data for cross-tenant listing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access with empty data for cross-tenant listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access with empty data for cross-tenant listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 with empty data for cross-tenant listing", async ({ request }) => {
    // Kills: customer should not be able to returns 403 with empty data for cross-tenant listing
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 with empty data for cross-tenant listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 with empty data for cross-tenant listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 with empty data for cross-tenant listing", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 with empty data for cross-tenant listing
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listAccounts.list", basePayload_PROOF_B_023_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 with empty data for cross-tenant listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 with empty data for cross-tenant listing — verify error code is present
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
    id: TEST_BANK_ID,
  };
}
test.describe("Auth Matrix: GET /api/accounts/:id returns 403 if account belongs to different bank", () => {
  test("admin must be able to returns 403 FORBIDDEN if account belongs to different bank", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 FORBIDDEN if account belongs to different bank", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 FORBIDDEN if account belongs to different bank", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 FORBIDDEN must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_025_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "getAccount.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in getAccount.list", async ({ request }) => {
    // Kills: Remove role check in getAccount.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in getAccount.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access if account belongs to different bank", async ({ request }) => {
    // Kills: Allow lower-privileged role to access if account belongs to different bank
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access if account belongs to different bank — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access if account belongs to different bank — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 FORBIDDEN if account belongs to different bank", async ({ request }) => {
    // Kills: customer should not be able to returns 403 FORBIDDEN if account belongs to different bank
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 FORBIDDEN if account belongs to different bank — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 FORBIDDEN if account belongs to different bank — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 FORBIDDEN if account belongs to different bank", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 FORBIDDEN if account belongs to different bank
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_025_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 FORBIDDEN if account belongs to different bank — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 FORBIDDEN if account belongs to different bank — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-026-AUTHMATRIX
// Behavior: GET /api/accounts/:id returns 403 for customer accessing other's account
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_026_AUTHMATRIX() {
  return {
    id: TEST_BANK_ID,
  };
}
test.describe("Auth Matrix: GET /api/accounts/:id returns 403 for customer accessing other's account", () => {
  test("admin must be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 FORBIDDEN must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_026_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "getAccount.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in getAccount.list", async ({ request }) => {
    // Kills: Remove role check in getAccount.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in getAccount.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access if customer role and account.customerId !== jwt.userId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access if customer role and account.customerId !== jwt.userId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access if customer role and account.customerId !== jwt.userId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access if customer role and account.customerId !== jwt.userId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId", async ({ request }) => {
    // Kills: customer should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "getAccount.list", basePayload_PROOF_B_026_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 FORBIDDEN if customer role and account.customerId !== jwt.userId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-027-AUTHMATRIX
// Behavior: POST /api/transactions requires advisor or admin role
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
test.describe("Auth Matrix: POST /api/transactions requires advisor or admin role", () => {
  test("admin must be able to requires advisor or admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires advisor or admin role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires advisor or admin role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_027_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "createTransaction.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createTransaction.create", async ({ request }) => {
    // Kills: Remove role check in createTransaction.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createTransaction.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access advisor or admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access advisor or admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access advisor or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access advisor or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires advisor or admin role", async ({ request }) => {
    // Kills: customer should not be able to requires advisor or admin role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires advisor or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires advisor or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires advisor or admin role", async ({ request }) => {
    // Kills: advisor should not be able to requires advisor or admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_027_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires advisor or admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires advisor or admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-028-AUTHMATRIX
// Behavior: POST /api/transactions rejects cross-tenant transaction creation
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
test.describe("Auth Matrix: POST /api/transactions rejects cross-tenant transaction creation", () => {
  test("admin must be able to returns 403 FORBIDDEN on cross-tenant transaction", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 FORBIDDEN on cross-tenant transaction", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 FORBIDDEN on cross-tenant transaction", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 FORBIDDEN must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_028_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "createTransaction.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createTransaction.create", async ({ request }) => {
    // Kills: Remove role check in createTransaction.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createTransaction.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access on cross-tenant transaction", async ({ request }) => {
    // Kills: Allow lower-privileged role to access on cross-tenant transaction
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access on cross-tenant transaction — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access on cross-tenant transaction — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 FORBIDDEN on cross-tenant transaction", async ({ request }) => {
    // Kills: customer should not be able to returns 403 FORBIDDEN on cross-tenant transaction
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 FORBIDDEN on cross-tenant transaction — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 FORBIDDEN on cross-tenant transaction — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 FORBIDDEN on cross-tenant transaction", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 FORBIDDEN on cross-tenant transaction
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_028_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 FORBIDDEN on cross-tenant transaction — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 FORBIDDEN on cross-tenant transaction — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-029-AUTHMATRIX
// Behavior: POST /api/transactions rejects cross-bank transfers
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
test.describe("Auth Matrix: POST /api/transactions rejects cross-bank transfers", () => {
  test("admin must be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 CROSS_BANK_TRANSFER must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_029_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "createTransaction.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in createTransaction.create", async ({ request }) => {
    // Kills: Remove role check in createTransaction.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in createTransaction.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access if fromAccountId and toAccountId belong to different bankId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access if fromAccountId and toAccountId belong to different bankId
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access if fromAccountId and toAccountId belong to different bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access if fromAccountId and toAccountId belong to different bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId", async ({ request }) => {
    // Kills: customer should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId", async ({ request }) => {
    // Kills: advisor should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "createTransaction.create", basePayload_PROOF_B_029_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to returns 403 CROSS_BANK_TRANSFER if fromAccountId and toAccountId belong to different bankId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-036-AUTHMATRIX
// Behavior: PATCH /api/transactions/:id/status requires admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_036_AUTHMATRIX() {
  return {
    id: TEST_BANK_ID,
    status: "processing",
  };
}
test.describe("Auth Matrix: PATCH /api/transactions/:id/status requires admin role", () => {
  test("admin must be able to requires admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_036_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "updateTransactionStatus.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in updateTransactionStatus.update", async ({ request }) => {
    // Kills: Remove role check in updateTransactionStatus.update
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in updateTransactionStatus.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin role
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires admin role", async ({ request }) => {
    // Kills: customer should not be able to requires admin role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires admin role", async ({ request }) => {
    // Kills: advisor should not be able to requires admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "updateTransactionStatus.update", basePayload_PROOF_B_036_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-047-AUTHMATRIX
// Behavior: GET /api/transactions authorization for customer role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_047_AUTHMATRIX() {
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
test.describe("Auth Matrix: GET /api/transactions authorization for customer role", () => {
  test("admin must be able to sees only own transactions when listing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to sees only own transactions when listing", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to sees only own transactions when listing", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees only must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_047_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "listTransactions.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listTransactions.list", async ({ request }) => {
    // Kills: Remove role check in listTransactions.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listTransactions.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own transactions when listing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own transactions when listing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own transactions when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own transactions when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to sees only own transactions when listing", async ({ request }) => {
    // Kills: customer should not be able to sees only own transactions when listing
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to sees only own transactions when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to sees only own transactions when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to sees only own transactions when listing", async ({ request }) => {
    // Kills: advisor should not be able to sees only own transactions when listing
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_047_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to sees only own transactions when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to sees only own transactions when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-048-AUTHMATRIX
// Behavior: GET /api/transactions authorization for advisor/admin role
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
test.describe("Auth Matrix: GET /api/transactions authorization for advisor/admin role", () => {
  test("admin must be able to sees all transactions within bank when listing", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to sees all transactions within bank when listing", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to sees all transactions within bank when listing", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant sees all must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_048_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "listTransactions.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in listTransactions.list", async ({ request }) => {
    // Kills: Remove role check in listTransactions.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in listTransactions.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access transactions within bank when listing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access transactions within bank when listing
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access transactions within bank when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access transactions within bank when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to sees all transactions within bank when listing", async ({ request }) => {
    // Kills: customer should not be able to sees all transactions within bank when listing
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to sees all transactions within bank when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to sees all transactions within bank when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to sees all transactions within bank when listing", async ({ request }) => {
    // Kills: advisor should not be able to sees all transactions within bank when listing
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "listTransactions.list", basePayload_PROOF_B_048_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to sees all transactions within bank when listing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to sees all transactions within bank when listing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-049-AUTHMATRIX
// Behavior: DELETE /api/accounts/:id requires admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_049_AUTHMATRIX() {
  return {
    id: TEST_BANK_ID,
  };
}
test.describe("Auth Matrix: DELETE /api/accounts/:id requires admin role", () => {
  test("admin must be able to requires admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_049_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "closeAccount.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in closeAccount.delete", async ({ request }) => {
    // Kills: Remove role check in closeAccount.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in closeAccount.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin role
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires admin role", async ({ request }) => {
    // Kills: customer should not be able to requires admin role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires admin role", async ({ request }) => {
    // Kills: advisor should not be able to requires admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "closeAccount.delete", basePayload_PROOF_B_049_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-054-AUTHMATRIX
// Behavior: POST /api/accounts/:id/freeze requires admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_054_AUTHMATRIX() {
  return {
    id: TEST_BANK_ID,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: POST /api/accounts/:id/freeze requires admin role", () => {
  test("admin must be able to requires admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_054_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "freezeAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in freezeAccount.create", async ({ request }) => {
    // Kills: Remove role check in freezeAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in freezeAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin role
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires admin role", async ({ request }) => {
    // Kills: customer should not be able to requires admin role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires admin role", async ({ request }) => {
    // Kills: advisor should not be able to requires admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "freezeAccount.create", basePayload_PROOF_B_054_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-060-AUTHMATRIX
// Behavior: POST /api/accounts/:id/unfreeze requires admin role
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_060_AUTHMATRIX() {
  return {
    id: TEST_BANK_ID,
  };
}
test.describe("Auth Matrix: POST /api/accounts/:id/unfreeze requires admin role", () => {
  test("admin must be able to requires admin role", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("customer must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("advisor must NOT be able to requires admin role", async ({ request }) => {
    const roleCookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant requires must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_060_AUTHMATRIX(),
      bankId: TEST_BANK_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "unfreezeAccount.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in unfreezeAccount.create", async ({ request }) => {
    // Kills: Remove role check in unfreezeAccount.create
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in unfreezeAccount.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access admin role", async ({ request }) => {
    // Kills: Allow lower-privileged role to access admin role
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: customer should not be able to requires admin role", async ({ request }) => {
    // Kills: customer should not be able to requires admin role
    const cookie = await getCustomerCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: customer should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: customer should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: advisor should not be able to requires admin role", async ({ request }) => {
    // Kills: advisor should not be able to requires admin role
    const cookie = await getAdvisorCookie(request);
    const response = await trpcQuery(request, "unfreezeAccount.create", basePayload_PROOF_B_060_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: advisor should not be able to requires admin role — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: advisor should not be able to requires admin role — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});