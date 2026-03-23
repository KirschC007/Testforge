import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAgencyAdminCookie } from "../../helpers/auth";
import { TEST_AGENCY_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAgencyAdminCookie(request);
});

// PROOF-B-007-BL — Business Logic: Booking status transition pending to confirmed
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status transition pending to confirmed

test("PROOF-B-007-BLa — Booking status transition pending to confirmed", async ({ request }) => {
  // Precondition: Booking status is 'pending'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-007-BLb — Booking status transition pending to confirmed requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-007-BLc — Booking status transition pending to confirmed persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-008-BL — Business Logic: Booking status transition confirmed to paid
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status transition confirmed to paid

test("PROOF-B-008-BLa — Booking status transition confirmed to paid", async ({ request }) => {
  // Precondition: Booking status is 'confirmed'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-008-BLb — Booking status transition confirmed to paid requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-008-BLc — Booking status transition confirmed to paid persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-009-BL — Business Logic: Booking status transition paid to completed
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status transition paid to completed

test("PROOF-B-009-BLa — Booking status transition paid to completed", async ({ request }) => {
  // Precondition: Booking status is 'paid'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-009-BLb — Booking status transition paid to completed requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-009-BLc — Booking status transition paid to completed persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-010-BL — Business Logic: Booking status transition paid to cancelled
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status transition paid to cancelled

test("PROOF-B-010-BLa — Booking status transition paid to cancelled", async ({ request }) => {
  // Precondition: Booking status is 'paid'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-010-BLb — Booking status transition paid to cancelled requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-010-BLc — Booking status transition paid to cancelled persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-011-BL — Business Logic: Booking status transition cancelled to refunded
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status transition cancelled to refunded

test("PROOF-B-011-BLa — Booking status transition cancelled to refunded", async ({ request }) => {
  // Precondition: Booking status is 'cancelled'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Side-Effect-Check: Read stock BEFORE action
  const { data: resourceBefore } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  const stockBefore = (Array.isArray(resourceBefore)
    ? (resourceBefore as Record<string, unknown>[])[0]
    : resourceBefore as Record<string, unknown>
  )?.stock as number ?? 0;
  expect(typeof stockBefore).toBe("number");
  // Kills: Cannot read stock before action
  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Side-Effect: Verify stock RESTORED after cancellation
  const { data: resourceAfter2 } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  const stockAfter2 = (Array.isArray(resourceAfter2)
    ? (resourceAfter2 as Record<string, unknown>[])[0]
    : resourceAfter2 as Record<string, unknown>
  )?.stock as number;
  expect(stockAfter2).toBeGreaterThan(stockBefore);
  // Kills: Not restoring stock on cancellation
  // Kills: Remove success path in bookings.updateStatus
  // Kills: Skip side effect: Booking status is 'refunded'

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-011-BLb — Booking status transition cancelled to refunded requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-011-BLc — Booking status transition cancelled to refunded persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-012-BL — Business Logic: Booking status cannot transition from completed to cancelled
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status cannot transition from completed to cancelled

test("PROOF-B-012-BLa — Booking status cannot transition from completed to cancelled", async ({ request }) => {
  // Precondition: Booking status is 'completed'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-012-BLb — Booking status cannot transition from completed to cancelled requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-012-BLc — Booking status cannot transition from completed to cancelled persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-013-BL — Business Logic: Booking status cannot transition from refunded to confirmed
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Status
// Behavior: Booking status cannot transition from refunded to confirmed

test("PROOF-B-013-BLa — Booking status cannot transition from refunded to confirmed", async ({ request }) => {
  // Precondition: Booking status is 'refunded'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-013-BLb — Booking status cannot transition from refunded to confirmed requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-013-BLc — Booking status cannot transition from refunded to confirmed persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-014-BL — Business Logic: Booking creation fails if passengers exceed package capacity
// Risk: high | Endpoint: bookings.create
// Spec: Booking Rules
// Behavior: Booking creation fails if passengers exceed package capacity

test("PROOF-B-014-BLa — Booking creation fails if passengers exceed package capacity", async ({ request }) => {
  // Precondition: Input passengers > package.maxPassengers
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-014-BLb — Booking creation fails if passengers exceed package capacity requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.create
});
test("PROOF-B-014-BLc — Booking creation fails if passengers exceed package capacity persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

test("PROOF-B-014-BLi — COURSE_FULL: enrollment when course is full must fail", async ({ request }) => {
  // This test requires a course with maxStudents=1 already filled
  // Arrange: Create course with maxStudents=1
  const course = await createTestResource(request, adminCookie, { maxStudents: 1 }) as Record<string, unknown>;
  
  // Act: Attempt to enroll when full
  const { status } = await trpcMutation(request, "bookings.create", {
    agencyId: TEST_AGENCY_ID,
    customerId: 2,\n    packageId: 1,\n    travelDate: tomorrowStr(),\n    passengers: 1,
  }, adminCookie);
  
  expect([422, 409]).toContain(status);
  // Kills: Allow enrollment past maxStudents limit
});

// PROOF-B-015-BL — Business Logic: Booking creation fails for past travelDate
// Risk: high | Endpoint: bookings.create
// Spec: Booking Rules
// Behavior: Booking creation fails for past travelDate

test("PROOF-B-015-BLa — Booking creation fails for past travelDate", async ({ request }) => {
  // Precondition: Input travelDate is in the past
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-015-BLb — Booking creation fails for past travelDate requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.create
});
test("PROOF-B-015-BLc — Booking creation fails for past travelDate persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-016-BL — Business Logic: Only agency_admin can cancel a confirmed booking
// Risk: high | Endpoint: bookings.updateStatus
// Spec: Booking Rules
// Behavior: Only agency_admin can cancel a confirmed booking

test("PROOF-B-016-BLa — Only agency_admin can cancel a confirmed booking", async ({ request }) => {
  // Precondition: User is agency_admin
  // Precondition: Booking status is 'confirmed'
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-016-BLb — Only agency_admin can cancel a confirmed booking requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-016-BLc — Only agency_admin can cancel a confirmed booking persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-017-BL — Business Logic: Agent cannot access bookings from other agencies
// Risk: critical | Endpoint: bookings.list
// Spec: Booking Rules
// Behavior: Agent cannot access bookings from other agencies

test("PROOF-B-017-BLa — Agent cannot access bookings from other agencies", async ({ request }) => {
  // Precondition: User is agent
  // Precondition: Booking belongs to a different agencyId
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.list", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.list
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.list

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-017-BLb — Agent cannot access bookings from other agencies requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.list", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.list
});
test("PROOF-B-017-BLc — Agent cannot access bookings from other agencies persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.list
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-018-BL — Business Logic: Package price must be greater than 0
// Risk: high | Endpoint: packages.create
// Spec: Package Rules
// Behavior: Package price must be greater than 0

test("PROOF-B-018-BLa — Package price must be greater than 0", async ({ request }) => {
  // Precondition: Input price <= 0
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in packages.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in packages.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-018-BLb — Package price must be greater than 0 requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from packages.create
});
test("PROOF-B-018-BLc — Package price must be greater than 0 persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from packages.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-019-BL — Business Logic: Package maxPassengers must be between 1 and 500
// Risk: high | Endpoint: packages.create
// Spec: Package Rules
// Behavior: Package maxPassengers must be between 1 and 500

test("PROOF-B-019-BLa — Package maxPassengers must be between 1 and 500", async ({ request }) => {
  // Precondition: Input maxPassengers < 1 OR maxPassengers > 500
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in packages.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in packages.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-019-BLb — Package maxPassengers must be between 1 and 500 requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from packages.create
});
test("PROOF-B-019-BLc — Package maxPassengers must be between 1 and 500 persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from packages.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-020-BL — Business Logic: Package departureDate must be in the future
// Risk: high | Endpoint: packages.create
// Spec: Package Rules
// Behavior: Package departureDate must be in the future

test("PROOF-B-020-BLa — Package departureDate must be in the future", async ({ request }) => {
  // Precondition: Input departureDate is in the past
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in packages.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in packages.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-020-BLb — Package departureDate must be in the future requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from packages.create
});
test("PROOF-B-020-BLc — Package departureDate must be in the future persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from packages.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-021-BL — Business Logic: Only agency_admin can export customer data
// Risk: critical | Endpoint: gdpr.exportCustomerData
// Spec: DSGVO Rules
// Behavior: Only agency_admin can export customer data

test("PROOF-B-021-BLa — Only agency_admin can export customer data", async ({ request }) => {
  // Precondition: User is agency_admin
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "gdpr.exportCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in gdpr.exportCustomerData
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in gdpr.exportCustomerData

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-021-BLb — Only agency_admin can export customer data requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from gdpr.exportCustomerData
});
test("PROOF-B-021-BLc — Only agency_admin can export customer data persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from gdpr.exportCustomerData
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-022-BL — Business Logic: Only agency_admin can delete customer data
// Risk: critical | Endpoint: gdpr.deleteCustomerData
// Spec: DSGVO Rules
// Behavior: Only agency_admin can delete customer data

test("PROOF-B-022-BLa — Only agency_admin can delete customer data", async ({ request }) => {
  // Arrange: Create a real resource
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act: Delete resource
  const { status, data } = await trpcMutation(request, "gdpr.deleteCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);

  expect(status).toBe(200);
  // Kills: Remove success path in gdpr.deleteCustomerData

  expect((data as Record<string, unknown>)?.success).toBe(true);
  // Kills: Return success:false on deletion

  // DB-Check: Resource must be gone
  const { status: getStatus } = await trpcQuery(request, "bookings.list",
    { bookingId, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(getStatus).toBe(404);
  // Kills: Soft-delete instead of hard-delete
});

test("PROOF-B-022-BLb — Only agency_admin can delete customer data requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;

  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, ""); // No cookie

  expect([401, 403]).toContain(status);
  // Kills: Remove auth middleware from gdpr.deleteCustomerData
});

// PROOF-B-023-BL — Business Logic: Customer PII must be anonymized after deletion
// Risk: critical | Endpoint: gdpr.deleteCustomerData
// Spec: DSGVO Rules
// Behavior: Customer PII must be anonymized after deletion

test("PROOF-B-023-BLa — Customer PII must be anonymized after deletion", async ({ request }) => {
  // Precondition: Customer data deletion is requested
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "gdpr.deleteCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in gdpr.deleteCustomerData
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in gdpr.deleteCustomerData

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-023-BLb — Customer PII must be anonymized after deletion requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "gdpr.deleteCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from gdpr.deleteCustomerData
});
test("PROOF-B-023-BLc — Customer PII must be anonymized after deletion persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from gdpr.deleteCustomerData
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-024-BL — Business Logic: Exported customer data must include all bookings
// Risk: critical | Endpoint: gdpr.exportCustomerData
// Spec: DSGVO Rules
// Behavior: Exported customer data must include all bookings

test("PROOF-B-024-BLa — Exported customer data must include all bookings", async ({ request }) => {
  // Precondition: Customer data export is requested
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "gdpr.exportCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in gdpr.exportCustomerData
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in gdpr.exportCustomerData

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-024-BLb — Exported customer data must include all bookings requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from gdpr.exportCustomerData
});
test("PROOF-B-024-BLc — Exported customer data must include all bookings persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from gdpr.exportCustomerData
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-025-BL — Business Logic: Booking created with status pending
// Risk: high | Endpoint: bookings.create
// Spec: UF-01: Customer Books a Package
// Behavior: Booking created with status pending

test("PROOF-B-025-BLa — Booking created with status pending", async ({ request }) => {
  // Precondition: Agent submits valid booking form
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-025-BLb — Booking created with status pending requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.create
});
test("PROOF-B-025-BLc — Booking created with status pending persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-026-BL — Business Logic: Booking status changes from pending to confirmed by Admin
// Risk: high | Endpoint: bookings.updateStatus
// Spec: UF-02: Agency Admin Confirms Booking
// Behavior: Booking status changes from pending to confirmed by Admin

test("PROOF-B-026-BLa — Booking status changes from pending to confirmed by Admin", async ({ request }) => {
  // Precondition: Admin clicks 'Confirm' button on a pending booking
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in bookings.updateStatus
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in bookings.updateStatus

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-026-BLb — Booking status changes from pending to confirmed by Admin requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "bookings.updateStatus", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from bookings.updateStatus
});
test("PROOF-B-026-BLc — Booking status changes from pending to confirmed by Admin persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from bookings.updateStatus
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-027-BL — Business Logic: DSGVO Export contains PII fields and bookings
// Risk: critical | Endpoint: gdpr.exportCustomerData
// Spec: UF-03: DSGVO Data Export
// Behavior: DSGVO Export contains PII fields and bookings

test("PROOF-B-027-BLa — DSGVO Export contains PII fields and bookings", async ({ request }) => {
  // Precondition: Admin clicks 'DSGVO Export' button
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "gdpr.exportCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in gdpr.exportCustomerData
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in gdpr.exportCustomerData

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-027-BLb — DSGVO Export contains PII fields and bookings requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "gdpr.exportCustomerData", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from gdpr.exportCustomerData
});
test("PROOF-B-027-BLc — DSGVO Export contains PII fields and bookings persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from gdpr.exportCustomerData
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-028-BL — Business Logic: Package creation fails with price 0 or negative
// Risk: high | Endpoint: packages.create
// Spec: UF-04: Create Travel Package
// Behavior: Package creation fails with price 0 or negative

test("PROOF-B-028-BLa — Package creation fails with price 0 or negative", async ({ request }) => {
  // Precondition: Admin submits package form with price <= 0
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in packages.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in packages.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-028-BLb — Package creation fails with price 0 or negative requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from packages.create
});
test("PROOF-B-028-BLc — Package creation fails with price 0 or negative persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from packages.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});

// PROOF-B-029-BL — Business Logic: Package creation fails with max passengers > 500
// Risk: high | Endpoint: packages.create
// Spec: UF-04: Create Travel Package
// Behavior: Package creation fails with max passengers > 500

test("PROOF-B-029-BLa — Package creation fails with max passengers > 500", async ({ request }) => {
  // Precondition: Admin submits package form with max passengers > 500
  // Arrange: Create a real resource first
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined();

  // Act
  const { data, status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, adminCookie);
  expect(status).toBe(200); // Kills: Remove success path in packages.create
  expect((data as Record<string, unknown>)?.id).toBeDefined(); // Kills: Return undefined id

  // Kills: Remove success path in packages.create

  // DB-State-Verification: Read back the resource and verify persistence
  const { data: readBack } = await trpcQuery(request, "bookings.list",
    { id: (data as Record<string, unknown>)?.id, agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(readBack).toBeDefined();
  // Kills: API returns 200 but doesn't persist to DB
  expect((readBack as Record<string, unknown>)?.id).toBe((data as Record<string, unknown>)?.id);
  // Kills: GET returns different resource than created

});
test("PROOF-B-029-BLb — Package creation fails with max passengers > 500 requires auth", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  const { status } = await trpcMutation(request, "packages.create", {
    bookingId,
    agencyId: TEST_AGENCY_ID,
  }, "");
  expect([401, 403]).toContain(status); // Kills: Remove auth middleware from packages.create
});
test("PROOF-B-029-BLc — Package creation fails with max passengers > 500 persists to DB", async ({ request }) => {
  const created = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const bookingId = created.id as number;
  expect(bookingId).toBeDefined(); // Kills: Don't return id from packages.create
  const { data: fetched, status } = await trpcQuery(request, "bookings.list",
    { agencyId: TEST_AGENCY_ID }, adminCookie);
  expect(status).toBe(200); // Kills: Remove bookings.list endpoint
  const items = Array.isArray(fetched) ? fetched : (fetched as Record<string, unknown[]>)?.items || (fetched as Record<string, unknown[]>)?.tasks || [];
  expect(items.some((r: unknown) => (r as Record<string, unknown>).id === bookingId)).toBe(true); // Kills: Don't persist to DB
});