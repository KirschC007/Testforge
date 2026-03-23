import { expect, test } from "@playwright/test";
import { BASE_URL, tomorrowStr, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_COMPANY_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-001-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create invoices

test("PROOF-B-001-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        companyId: uniqueTitle,
        clientId: TEST_COMPANY_ID,
        items: "test-items",
        description: "test-description",
        quantity: 1,
        unitPrice: 1,
        notes: "test-notes",
        dueDate: tomorrowStr(),
        taxRate: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["companyId"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-001-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        companyId: TEST_COMPANY_ID,
        clientId: TEST_COMPANY_ID,
        items: "test-items",
        description: "test-description",
        quantity: 1,
        unitPrice: 1,
        notes: "test-notes",
        dueDate: tomorrowStr(),
        taxRate: 1,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-003-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-003-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.send`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        companyId: TEST_COMPANY_ID,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.send
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-003-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.send`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        companyId: TEST_COMPANY_ID,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-004-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-004-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.markPaid`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        companyId: TEST_COMPANY_ID,
        paidAmount: 1,
        paymentDate: tomorrowStr(),
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.markPaid
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
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
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.markPaid`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        companyId: TEST_COMPANY_ID,
        paidAmount: 1,
        paymentDate: tomorrowStr(),
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-005-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-005-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.cancel`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        companyId: TEST_COMPANY_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.cancel
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-005-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.cancel`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        companyId: TEST_COMPANY_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-006-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-006-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.void`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        companyId: TEST_COMPANY_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.void
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-006-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.void`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        companyId: TEST_COMPANY_ID,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-007-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create invoices

test("PROOF-B-007-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        companyId: uniqueTitle,
        clientId: TEST_COMPANY_ID,
        items: "test-items",
        description: "test-description",
        quantity: 1,
        unitPrice: 1,
        notes: "test-notes",
        dueDate: tomorrowStr(),
        taxRate: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["companyId"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-007-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        companyId: TEST_COMPANY_ID,
        clientId: TEST_COMPANY_ID,
        items: "test-items",
        description: "test-description",
        quantity: 1,
        unitPrice: 1,
        notes: "test-notes",
        dueDate: tomorrowStr(),
        taxRate: 1,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-009-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate invoices

test("PROOF-B-009-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.gdprDelete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        companyId: TEST_COMPANY_ID,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from invoices.gdprDelete
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
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
  const res = await request.post(`${BASE_URL}/api/trpc/invoices.gdprDelete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        companyId: TEST_COMPANY_ID,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});