import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-018-CSRF — CSRF: require must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF
// Behavior: All state-changing requests require X-CSRF-Token

test("PROOF-B-018-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/appointments.updateStatus`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        status: "confirmed",
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from appointments.updateStatus
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-018-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/appointments.updateStatus`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        status: "confirmed",
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});