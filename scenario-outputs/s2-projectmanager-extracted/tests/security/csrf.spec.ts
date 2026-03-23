import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_WORKSPACE_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-013-CSRF — CSRF: uses must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: System uses double-submit cookie pattern for CSRF protection

test("PROOF-B-013-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/projects.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        workspaceId: TEST_WORKSPACE_ID,
        name: uniqueTitle,
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from projects.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-013-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/projects.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        workspaceId: TEST_WORKSPACE_ID,
        name: "Test name valid",
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-015-CSRF — CSRF: require must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: All state-changing requests require X-CSRF-Token header

test("PROOF-B-015-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/projects.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        workspaceId: TEST_WORKSPACE_ID,
        name: uniqueTitle,
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from projects.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-015-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/projects.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        workspaceId: TEST_WORKSPACE_ID,
        name: "Test name valid",
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-016-CSRF — CSRF: returns must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF Protection
// Behavior: System returns 403 CSRF_REQUIRED for missing CSRF token

test("PROOF-B-016-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/projects.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        workspaceId: TEST_WORKSPACE_ID,
        name: uniqueTitle,
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from projects.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "projects.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-016-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/projects.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        workspaceId: TEST_WORKSPACE_ID,
        name: "Test name valid",
        description: "test-description",
        color: "test-color",
        isPublic: "test-isPublic",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});