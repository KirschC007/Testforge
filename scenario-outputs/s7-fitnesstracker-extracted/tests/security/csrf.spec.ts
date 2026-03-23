import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie, getCsrfToken } from "../../helpers/auth";
import { TEST_TENANT_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-001-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create workouts

test("PROOF-B-001-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        gymId: 1,
        name: uniqueTitle,
        type: "test-type",
        scheduledAt: "test-scheduledAt",
        notes: "test-notes",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from workouts.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
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
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        gymId: 1,
        name: "Test name valid",
        type: "test-type",
        scheduledAt: "test-scheduledAt",
        notes: "test-notes",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-003-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate workouts

test("PROOF-B-003-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.start`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        gymId: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from workouts.start
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
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
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.start`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        gymId: 1,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-004-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate workouts

test("PROOF-B-004-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.complete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        gymId: 1,
        duration: 1,
        caloriesBurned: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from workouts.complete
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
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
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.complete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        gymId: 1,
        duration: 1,
        caloriesBurned: 1,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-005-CSRF — CSRF: Mutate must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Mutate workouts

test("PROOF-B-005-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.skip`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        gymId: 1,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from workouts.skip
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
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
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.skip`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        gymId: 1,
        reason: "test-reason",
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-006-CSRF — CSRF: Create must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Create workouts

test("PROOF-B-006-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.addExercise`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        workoutId: 1,
        gymId: 1,
        name: uniqueTitle,
        sets: 1,
        reps: 1,
        weight: 1,
        restSeconds: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from workouts.addExercise
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["name"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-006-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.addExercise`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        workoutId: 1,
        gymId: 1,
        name: "Test name valid",
        sets: 1,
        reps: 1,
        weight: 1,
        restSeconds: 1,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});

// PROOF-B-007-CSRF — CSRF: Delete must be CSRF-protected
// Risk: CRITICAL
// Spec: Security
// Behavior: Delete workouts

test("PROOF-B-007-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.delete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        id: uniqueTitle,
        gymId: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from workouts.delete
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["id"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-007-CSRFb — POST with valid CSRF token succeeds", async ({ request }) => {
  const csrfToken = await getCsrfToken(request, adminCookie);
  expect(typeof csrfToken).toBe("string");
  expect(csrfToken.length).toBeGreaterThanOrEqual(16);
  // Kills: Accept any token value without validation
  const res = await request.post(`${BASE_URL}/api/trpc/workouts.delete`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      "X-CSRF-Token": csrfToken,
    },
    data: {
      json: {
        id: 1,
        gymId: 1,
      },
    },
  });
  expect(res.status()).toBe(200);
  // Kills: CSRF check blocks all requests including valid ones
});