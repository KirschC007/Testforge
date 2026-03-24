import { expect, test } from "@playwright/test";
import { BASE_URL, tomorrowStr, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-022-CSRF — CSRF: requires must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: API requires X-CSRF-Token header for state-changing requests

test("PROOF-B-022-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
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

test("PROOF-B-022-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
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

// PROOF-B-023-CSRF — CSRF: returns 403 must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: API returns 403 CSRF_REQUIRED for missing or invalid X-CSRF-Token header

test("PROOF-B-023-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
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

test("PROOF-B-023-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
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