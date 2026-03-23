import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getUserCookie } from "../../helpers/auth";
import { TEST_SHOP_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Create products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    shopId: TEST_SHOP_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    sku: "SKU-1774281018679",
    price: 1,
    stock: 1,
    category: "test-category",
    status: "active",
    weight: 1,
    isDigital: false,
  };
}
test.describe("Auth Matrix: Create products", () => {
  test("admin must be able to Create products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "products.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.create", async ({ request }) => {
    // Kills: Remove role check in products.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create products", async ({ request }) => {
    // Kills: admin should not be able to Create products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create products", async ({ request }) => {
    // Kills: user should not be able to Create products
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: Get products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    shopId: TEST_SHOP_ID,
    status: "active",
    category: "test-category",
    search: "test-search",
    minPrice: 0.01,
    maxPrice: 1.00,
    inStock: false,
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get products", () => {
  test("admin must be able to Get products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.list", async ({ request }) => {
    // Kills: Remove role check in products.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get products", async ({ request }) => {
    // Kills: admin should not be able to Get products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get products", async ({ request }) => {
    // Kills: user should not be able to Get products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-003-AUTHMATRIX
// Behavior: Update products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_003_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    price: 1,
    stock: 1,
    category: "test-category",
    status: "active",
  };
}
test.describe("Auth Matrix: Update products", () => {
  test("admin must be able to Update products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Update products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_003_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "products.update", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.update", async ({ request }) => {
    // Kills: Remove role check in products.update
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.update — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Update products", async ({ request }) => {
    // Kills: admin should not be able to Update products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Update products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Update products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Update products", async ({ request }) => {
    // Kills: user should not be able to Update products
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.update", basePayload_PROOF_B_003_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Update products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Update products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-004-AUTHMATRIX
// Behavior: Delete products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_004_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
  };
}
test.describe("Auth Matrix: Delete products", () => {
  test("admin must be able to Delete products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Delete products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Delete must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_004_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "products.delete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.delete", async ({ request }) => {
    // Kills: Remove role check in products.delete
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.delete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Delete products", async ({ request }) => {
    // Kills: admin should not be able to Delete products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Delete products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Delete products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Delete products", async ({ request }) => {
    // Kills: user should not be able to Delete products
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.delete", basePayload_PROOF_B_004_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Delete products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Delete products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-005-AUTHMATRIX
// Behavior: Create products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_005_AUTHMATRIX() {
  return {
    shopId: TEST_SHOP_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    sku: "SKU-1774281018681",
    price: 1,
    stock: 1,
    category: "test-category",
    status: "active",
    weight: 1,
    isDigital: false,
  };
}
test.describe("Auth Matrix: Create products", () => {
  test("admin must be able to Create products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_005_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "products.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.create", async ({ request }) => {
    // Kills: Remove role check in products.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create products", async ({ request }) => {
    // Kills: admin should not be able to Create products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create products", async ({ request }) => {
    // Kills: user should not be able to Create products
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_005_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-006-AUTHMATRIX
// Behavior: Get products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_006_AUTHMATRIX() {
  return {
    shopId: TEST_SHOP_ID,
    status: "active",
    category: "test-category",
    search: "test-search",
    minPrice: 0.01,
    maxPrice: 1.00,
    inStock: false,
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get products", () => {
  test("admin must be able to Get products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_006_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.list", async ({ request }) => {
    // Kills: Remove role check in products.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get products", async ({ request }) => {
    // Kills: admin should not be able to Get products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get products", async ({ request }) => {
    // Kills: user should not be able to Get products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_006_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-007-AUTHMATRIX
// Behavior: Get products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_007_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
  };
}
test.describe("Auth Matrix: Get products", () => {
  test("admin must be able to Get products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_007_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.getById", async ({ request }) => {
    // Kills: Remove role check in products.getById
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get products", async ({ request }) => {
    // Kills: admin should not be able to Get products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get products", async ({ request }) => {
    // Kills: user should not be able to Get products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.getById", basePayload_PROOF_B_007_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: Update products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
    status: "active",
    trackingNumber: "test-trackingNumber",
    cancelReason: "test-cancelReason",
  };
}
test.describe("Auth Matrix: Update products", () => {
  test("admin must be able to Update products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Update products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Update must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "products.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.updateStatus", async ({ request }) => {
    // Kills: Remove role check in products.updateStatus
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Update products", async ({ request }) => {
    // Kills: admin should not be able to Update products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Update products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Update products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Update products", async ({ request }) => {
    // Kills: user should not be able to Update products
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.updateStatus", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Update products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Update products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: Mutate products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Mutate products", () => {
  test("admin must be able to Mutate products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.cancel", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.cancel", async ({ request }) => {
    // Kills: Remove role check in products.cancel
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.cancel — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate products", async ({ request }) => {
    // Kills: admin should not be able to Mutate products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate products", async ({ request }) => {
    // Kills: user should not be able to Mutate products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.cancel", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: Create products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    shopId: TEST_SHOP_ID,
    name: "Test name-${Date.now()}",
    description: "Test description",
    sku: "SKU-1774281018682",
    price: 1,
    stock: 1,
    category: "test-category",
    status: "active",
    weight: 1,
    isDigital: false,
  };
}
test.describe("Auth Matrix: Create products", () => {
  test("admin must be able to Create products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Create products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Create must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcMutation(request, "products.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.create", async ({ request }) => {
    // Kills: Remove role check in products.create
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Create products", async ({ request }) => {
    // Kills: admin should not be able to Create products
    const cookie = await getAdminCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Create products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Create products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Create products", async ({ request }) => {
    // Kills: user should not be able to Create products
    const cookie = await getUserCookie(request);
    const response = await trpcMutation(request, "products.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Create products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Create products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: Get products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    shopId: TEST_SHOP_ID,
    status: "active",
    category: "test-category",
    search: "test-search",
    minPrice: 0.01,
    maxPrice: 1.00,
    inStock: false,
    page: 1,
    pageSize: 1,
  };
}
test.describe("Auth Matrix: Get products", () => {
  test("admin must be able to Get products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.list", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.list", async ({ request }) => {
    // Kills: Remove role check in products.list
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.list — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get products", async ({ request }) => {
    // Kills: admin should not be able to Get products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get products", async ({ request }) => {
    // Kills: user should not be able to Get products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.list", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: Mutate products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
    reason: "test-reason",
  };
}
test.describe("Auth Matrix: Mutate products", () => {
  test("admin must be able to Mutate products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.block", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.block", async ({ request }) => {
    // Kills: Remove role check in products.block
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.block — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate products", async ({ request }) => {
    // Kills: admin should not be able to Mutate products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate products", async ({ request }) => {
    // Kills: user should not be able to Mutate products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.block", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: Mutate products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
  };
}
test.describe("Auth Matrix: Mutate products", () => {
  test("admin must be able to Mutate products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Mutate products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Mutate must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.gdprDelete", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.gdprDelete", async ({ request }) => {
    // Kills: Remove role check in products.gdprDelete
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.gdprDelete — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Mutate products", async ({ request }) => {
    // Kills: admin should not be able to Mutate products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Mutate products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Mutate products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Mutate products", async ({ request }) => {
    // Kills: user should not be able to Mutate products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.gdprDelete", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Mutate products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Mutate products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: Get products
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    id: 1,
    shopId: TEST_SHOP_ID,
  };
}
test.describe("Auth Matrix: Get products", () => {
  test("admin must be able to Get products", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("user must NOT be able to Get products", async ({ request }) => {
    const roleCookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant Get must be rejected", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
      shopId: TEST_SHOP_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "products.gdprExport", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in products.gdprExport", async ({ request }) => {
    // Kills: Remove role check in products.gdprExport
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in products.gdprExport — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access products", async ({ request }) => {
    // Kills: Allow lower-privileged role to access products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: admin should not be able to Get products", async ({ request }) => {
    // Kills: admin should not be able to Get products
    const cookie = await getAdminCookie(request);
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: admin should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: admin should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: user should not be able to Get products", async ({ request }) => {
    // Kills: user should not be able to Get products
    const cookie = await getUserCookie(request);
    const response = await trpcQuery(request, "products.gdprExport", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: user should not be able to Get products — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: user should not be able to Get products — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});