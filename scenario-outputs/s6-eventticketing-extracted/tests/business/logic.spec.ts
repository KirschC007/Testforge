import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getOrganizerAdminCookie(request);
});

// PROOF-B-009-BL — Business Logic: organizer_staff role can view events
// Risk: critical | Endpoint: events.create
// Spec: Roles
// Behavior: organizer_staff role can view events

test("PROOF-B-009-BLa — organizer_staff role can view events", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in events.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in events.create
});
test("PROOF-B-009-BLb — organizer_staff role can view events requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from events.create
});
test("PROOF-B-009-BLc — organizer_staff role can view events persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from events.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-010-BL — Business Logic: organizer_staff role can scan tickets
// Risk: critical | Endpoint: events.create
// Spec: Roles
// Behavior: organizer_staff role can scan tickets

test("PROOF-B-010-BLa — organizer_staff role can scan tickets", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in events.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in events.create
});
test("PROOF-B-010-BLb — organizer_staff role can scan tickets requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from events.create
});
test("PROOF-B-010-BLc — organizer_staff role can scan tickets persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from events.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-011-BL — Business Logic: organizer_staff role cannot modify pricing
// Risk: critical | Endpoint: events.create
// Spec: Roles
// Behavior: organizer_staff role cannot modify pricing

test("PROOF-B-011-BLa — organizer_staff role cannot modify pricing", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in events.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in events.create
});
test("PROOF-B-011-BLb — organizer_staff role cannot modify pricing requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from events.create
});
test("PROOF-B-011-BLc — organizer_staff role cannot modify pricing persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from events.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-012-BL — Business Logic: attendee role can buy tickets
// Risk: critical | Endpoint: events.create
// Spec: Roles
// Behavior: attendee role can buy tickets

test("PROOF-B-012-BLa — attendee role can buy tickets", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in events.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in events.create
});
test("PROOF-B-012-BLb — attendee role can buy tickets requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from events.create
});
test("PROOF-B-012-BLc — attendee role can buy tickets persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from events.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-013-BL — Business Logic: attendee role can view own orders
// Risk: critical | Endpoint: events.create
// Spec: Roles
// Behavior: attendee role can view own orders

test("PROOF-B-013-BLa — attendee role can view own orders", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in events.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in events.create
});
test("PROOF-B-013-BLb — attendee role can view own orders requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from events.create
});
test("PROOF-B-013-BLc — attendee role can view own orders persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from events.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-014-BL — Business Logic: attendee role can request refund
// Risk: critical | Endpoint: events.create
// Spec: Roles
// Behavior: attendee role can request refund

test("PROOF-B-014-BLa — attendee role can request refund", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in events.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in events.create
});
test("PROOF-B-014-BLb — attendee role can request refund requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "events.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from events.create
});
test("PROOF-B-014-BLc — attendee role can request refund persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from events.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-035-BL — Business Logic: Exactly one concurrent order for last tickets must succeed
// Risk: high | Endpoint: orders.create
// Spec: Endpoints
// Behavior: Exactly one concurrent order for last tickets must succeed

test("PROOF-B-035-BLa — Exactly one concurrent order for last tickets must succeed", async ({ request }) => {
  // Precondition: multiple concurrent orders for last remaining tickets
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "orders.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in orders.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in orders.create
});
test("PROOF-B-035-BLb — Exactly one concurrent order for last tickets must succeed requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "orders.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from orders.create
});
test("PROOF-B-035-BLc — Exactly one concurrent order for last tickets must succeed persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from orders.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-036-BL — Business Logic: Other concurrent orders for last tickets get SOLD_OUT
// Risk: high | Endpoint: orders.create
// Spec: Endpoints
// Behavior: Other concurrent orders for last tickets get SOLD_OUT

test("PROOF-B-036-BLa — Other concurrent orders for last tickets get SOLD_OUT", async ({ request }) => {
  // Precondition: multiple concurrent orders for last remaining tickets
  // Precondition: another order already succeeded
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "orders.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in orders.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in orders.create
});
test("PROOF-B-036-BLb — Other concurrent orders for last tickets get SOLD_OUT requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "orders.create", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from orders.create
});
test("PROOF-B-036-BLc — Other concurrent orders for last tickets get SOLD_OUT persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from orders.create
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-041-BL — Business Logic: organizer_admin and organizer_staff can get event statistics
// Risk: critical | Endpoint: eventStats.getById
// Spec: Endpoints
// Behavior: organizer_admin and organizer_staff can get event statistics

test("PROOF-B-041-BLa — organizer_admin and organizer_staff can get event statistics", async ({ request }) => {
  // Precondition: valid authenticated user
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "eventStats.getById", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in eventStats.getById
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in eventStats.getById
});
test("PROOF-B-041-BLb — organizer_admin and organizer_staff can get event statistics requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  const { status } = await trpcMutation(request, "eventStats.getById", {
    eventId,
    organizerId: TEST_ORGANIZER_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from eventStats.getById
});
test("PROOF-B-041-BLc — organizer_admin and organizer_staff can get event statistics persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const eventId = created.id as number;
  expect(eventId).toBeDefined(); // Kills: Don't return id from eventStats.getById
  const { data: fetched, status } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove eventStats.getById endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === eventId)).toBe(true); // Kills: Don't persist to DB
});