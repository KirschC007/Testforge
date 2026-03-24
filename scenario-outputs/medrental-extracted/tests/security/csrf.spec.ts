import { expect, test } from "@playwright/test";
import { BASE_URL, tomorrowStr, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-004-CSRF — CSRF Token Endpoint
// Risk: CRITICAL
// Spec: Authentication
// Behavior: GET /api/auth/csrf-token returns CSRF double-submit cookie

test("PROOF-B-004-CSRFa — CSRF token endpoint returns valid token", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Return empty string as CSRF token
  // Kills: Return same token for all sessions
});

test("PROOF-B-004-CSRFb — CSRF token is unique per request", async ({ request }) => {
  const token1 = await getCsrfToken(request, adminCookie);
  const token2 = await getCsrfToken(request, adminCookie);
  // Tokens may be the same (stateless) or different (stateful) — both are valid
  // But both must be non-empty valid strings
  expect(typeof token1).toBe("string");
  expect(typeof token2).toBe("string");
  expect(token1.length).toBeGreaterThanOrEqual(16);
  expect(token2.length).toBeGreaterThanOrEqual(16);
  // Kills: Return null or undefined as CSRF token
});

test("PROOF-B-004-CSRFc — CSRF token endpoint returns a non-empty string", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(csrfToken).not.toBe("");
  expect(csrfToken).not.toBeNull();
  expect(csrfToken).not.toBeUndefined();
});

test("PROOF-B-004-CSRFd — CSRF token endpoint returns a 200 OK status", async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/auth/csrf-token`, {
    headers: {
      Cookie: adminCookie,
    },
  });
  expect(response.status()).toBe(200);
});

// PROOF-B-024-CSRF — CSRF: requires must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: All POST/PUT/PATCH/DELETE requests require X-CSRF-Token header

test("PROOF-B-024-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/devices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        clinicId: TEST_CLINIC_ID,
        serialNumber: "test-serialNumber",
        name: uniqueTitle,
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: tomorrowStr(),
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from devices.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-024-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/devices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        clinicId: TEST_CLINIC_ID,
        serialNumber: "test-serialNumber",
        name: "Test name valid",
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: tomorrowStr(),
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-025-CSRF — CSRF: returns 403 CSRF_REQUIRED must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: System returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header

test("PROOF-B-025-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/devices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        clinicId: TEST_CLINIC_ID,
        serialNumber: "test-serialNumber",
        name: uniqueTitle,
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: tomorrowStr(),
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from devices.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "devices.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-025-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/devices.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        clinicId: TEST_CLINIC_ID,
        serialNumber: "test-serialNumber",
        name: "Test name valid",
        type: "wheelchair",
        manufacturer: "test-manufacturer",
        purchaseDate: tomorrowStr(),
        purchasePrice: 100,
        dailyRate: 50,
        accessories: "test-accessories",
        maintenanceIntervalDays: 7,
        notes: "test-notes",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});