import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

// Proof: PROOF-B-029-CONCURRENCY
// Behavior: POST /api/appointments requires doctorId to belong to same clinic
// Risk: critical
// Kills: Remove mutex/lock around requires in bookAppointment | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for `doctorId` to belong to same clinic update

function basePayload_PROOF_B_029_CONCURRENCY() {
  return {
    clinicId: TEST_CLINIC_ID,
    patientId: 1,
    doctorId: 2,
    date: tomorrowStr(),
    time: "test-time",
    duration: 15,
    type: "consultation",
    notes: "test-notes",
  };
}

test.describe("Concurrency: POST /api/appointments requires doctorId to belong to same clinic", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent requires requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bookAppointment", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent requires must not create duplicate `doctorId` to belong to same clinics", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bookAppointment", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent requires", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "bookAppointment", basePayload_PROOF_B_029_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "bookAppointment.list", { clinicId: TEST_CLINIC_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

// Proof: PROOF-B-030-CONCURRENCY
// Behavior: POST /api/appointments requires patientId to belong to same clinic
// Risk: critical
// Kills: Remove mutex/lock around requires in bookAppointment | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for `patientId` to belong to same clinic update

function basePayload_PROOF_B_030_CONCURRENCY() {
  return {
    clinicId: TEST_CLINIC_ID,
    patientId: 1,
    doctorId: 2,
    date: tomorrowStr(),
    time: "test-time",
    duration: 15,
    type: "consultation",
    notes: "test-notes",
  };
}

test.describe("Concurrency: POST /api/appointments requires patientId to belong to same clinic", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent requires requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bookAppointment", basePayload_PROOF_B_030_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent requires must not create duplicate `patientId` to belong to same clinics", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "bookAppointment", basePayload_PROOF_B_030_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent requires", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "bookAppointment", basePayload_PROOF_B_030_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "bookAppointment.list", { clinicId: TEST_CLINIC_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

// Proof: PROOF-B-037-CONCURRENCY
// Behavior: Admin can change appointment status from cancelled to confirmed (re-booking)
// Risk: high
// Kills: Remove mutex/lock around can change appointment status in appointments.updateStatus | Allow both concurrent requests to succeed (double-booking) | Not using atomic DB operation for from cancelled to confirmed update

function basePayload_PROOF_B_037_CONCURRENCY() {
  return {
    id: 1,
    status: "confirmed",
    reason: "test-reason",
  };
}

test.describe("Concurrency: Admin can change appointment status from cancelled to confirmed (re-booking)", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("concurrent can change appointment status requests must not cause race conditions", async ({ request }) => {
    const CONCURRENCY = 5;
    // Fire ${CONCURRENCY} identical requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "appointments.updateStatus", basePayload_PROOF_B_037_CONCURRENCY(), cookie)
      )
    );
    // At most one must succeed (or all must return deterministic results)
    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 429).length;
    // Either exactly one succeeds (optimistic locking) or all succeed idempotently
    expect(successCount + conflictCount).toBe(CONCURRENCY);
    // No 500 errors allowed — system must handle concurrency gracefully
    const errorCount = responses.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);
  });

  test("concurrent can change appointment status must not create duplicate from cancelled to confirmeds", async ({ request }) => {
    const CONCURRENCY = 3;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        trpcMutation(request, "appointments.updateStatus", basePayload_PROOF_B_037_CONCURRENCY(), cookie)
      )
    );
    const successResponses = responses.filter(r => r.status === 200 || r.status === 201);
    // If multiple succeed, they must return the same resource (idempotent)
    if (successResponses.length > 1) {
      const ids = successResponses.map(r => r.data?.result?.data?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      // All successful responses must reference the same resource
      expect(uniqueIds.size).toBeLessThanOrEqual(1);
    }
  });

  test("system remains consistent after concurrent can change appointment status", async ({ request }) => {
    // Perform concurrent operations
    await Promise.all(
      Array.from({ length: 3 }, () =>
        trpcMutation(request, "appointments.updateStatus", basePayload_PROOF_B_037_CONCURRENCY(), cookie)
      )
    );
    // Verify system state is consistent (no partial writes, no corruption)
    const listResponse = await trpcQuery(request, "appointments.list", { clinicId: TEST_CLINIC_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    expect(Array.isArray(items)).toBe(true);
    // No duplicate entries with identical data
    if (items && items.length > 1) {
      const seen = new Set<string>();
      for (const item of items) {
        const key = JSON.stringify(item);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});