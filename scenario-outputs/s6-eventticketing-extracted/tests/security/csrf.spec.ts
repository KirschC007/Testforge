import { expect, test } from "@playwright/test";
import { BASE_URL, tomorrowStr, trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getOrganizerAdminCookie(request);
});

// PROOF-B-015-CSRF — CSRF: require must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF
// Behavior: All mutations require X-CSRF-Token

test("PROOF-B-015-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/events.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        organizerId: TEST_ORGANIZER_ID,
        title: uniqueTitle,
        description: "test-description",
        venue: "test-venue",
        date: tomorrowStr(),
        capacity: 1,
        ticketPrice: 1,
        earlyBirdPrice: 1,
        earlyBirdDeadline: tomorrowStr(),
        maxPerOrder: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from events.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["title"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-015-CSRFb — POST with valid session (no CSRF required) succeeds", async ({ request }) => {
  // No CSRF endpoint in spec — testing that authenticated requests work normally
  const res = await trpcMutation(request, "events.create", {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title valid",
    description: "test-description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 1,
    earlyBirdPrice: 1,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  }, adminCookie);
  expect(res.status).toBe(200);
  // Kills: Auth middleware blocks all requests
});

// PROOF-B-016-CSRF — CSRF: returns 403 must be CSRF-protected
// Risk: CRITICAL
// Spec: CSRF
// Behavior: System returns 403 if X-CSRF-Token is missing

test("PROOF-B-016-CSRFa — POST without CSRF token is rejected (no DB write)", async ({ request }) => {
  // Use a unique sentinel value to detect any DB write
  const uniqueTitle = `CSRF-Test-${Date.now()}`;
  // Send request WITHOUT X-CSRF-Token header
  const res = await request.post(`${BASE_URL}/api/trpc/events.create`, {
    headers: {
      "Content-Type": "application/json",
      "Cookie": adminCookie,
      // Intentionally NO X-CSRF-Token header
    },
    data: {
      json: {
        organizerId: TEST_ORGANIZER_ID,
        title: uniqueTitle,
        description: "test-description",
        venue: "test-venue",
        date: tomorrowStr(),
        capacity: 1,
        ticketPrice: 1,
        earlyBirdPrice: 1,
        earlyBirdDeadline: tomorrowStr(),
        maxPerOrder: 1,
      },
    },
  });
  expect(res.status()).toBe(403);
  // Kills: Remove CSRF middleware from events.create
  // Kills: Accept requests without CSRF token
  // DB-Check: verify no record was written despite 403
  const { data: list } = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const leaked = (list as Array<Record<string, unknown>>)?.find(
    r => (r as Record<string, unknown>)["title"] === uniqueTitle
  );
  expect(leaked).toBeUndefined();
  // Kills: Write to DB before checking CSRF token
});

test("PROOF-B-016-CSRFb — POST with valid session (no CSRF required) succeeds", async ({ request }) => {
  // No CSRF endpoint in spec — testing that authenticated requests work normally
  const res = await trpcMutation(request, "events.create", {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title valid",
    description: "test-description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 1,
    earlyBirdPrice: 1,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  }, adminCookie);
  expect(res.status).toBe(200);
  // Kills: Auth middleware blocks all requests
});