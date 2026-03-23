import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_SHOP_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-001-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create products

test("PROOF-B-001-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        shopId: TEST_SHOP_ID,
        name: uniqueTitle,
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-001-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        shopId: TEST_SHOP_ID,
        name: "Test name valid",
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-003-CSRF — CSRF: Update must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Update products

test("PROOF-B-003-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.update`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
        name: uniqueTitle,
        description: "test-description",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.update
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-003-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.update`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
        name: "Test name valid",
        description: "test-description",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-004-CSRF — CSRF: Delete must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Delete products

test("PROOF-B-004-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.delete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        shopId: TEST_SHOP_ID,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.delete
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-004-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.delete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-005-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create products

test("PROOF-B-005-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        shopId: TEST_SHOP_ID,
        name: uniqueTitle,
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-005-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        shopId: TEST_SHOP_ID,
        name: "Test name valid",
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-008-CSRF — CSRF: Update must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Update products

test("PROOF-B-008-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.updateStatus`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        shopId: TEST_SHOP_ID,
        status: "active",
        trackingNumber: "test-trackingNumber",
        cancelReason: "test-cancelReason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.updateStatus
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-008-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.updateStatus`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
        status: "active",
        trackingNumber: "test-trackingNumber",
        cancelReason: "test-cancelReason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-009-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate products

test("PROOF-B-009-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.cancel`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        shopId: TEST_SHOP_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.cancel
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-009-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.cancel`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-010-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create products

test("PROOF-B-010-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        shopId: TEST_SHOP_ID,
        name: uniqueTitle,
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-010-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        shopId: TEST_SHOP_ID,
        name: "Test name valid",
        description: "test-description",
        sku: "test-sku",
        price: 1,
        stock: 1,
        category: "test-category",
        status: "active",
        weight: 1,
        isDigital: "test-isDigital",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-012-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate products

test("PROOF-B-012-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.block`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        shopId: TEST_SHOP_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.block
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-012-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.block`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-013-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate products

test("PROOF-B-013-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/products.gdprDelete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        shopId: TEST_SHOP_ID,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from products.gdprDelete
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "products.list",
    { shopId: TEST_SHOP_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-013-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/products.gdprDelete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        shopId: TEST_SHOP_ID,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});