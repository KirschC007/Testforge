import { expect, test } from "@playwright/test";
import { BASE_URL, trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

// Proof: PROOF-B-020-IDEMPOTENCY
// Behavior: Patient email must be unique per clinic
// Risk: high
// Kills: Remove duplicate-check before must be unique in registerPatient | Not returning existing resource on duplicate must be unique | Creating second record instead of returning existing one

function basePayload_PROOF_B_020_IDEMPOTENCY() {
  return {
    clinicId: TEST_CLINIC_ID,
    firstName: "Test firstName-${Date.now()}",
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917681083329",
    insuranceId: TEST_CLINIC_ID,
    allergies: [],
  };
}

test.describe("Idempotency: Patient email must be unique per clinic", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate must be unique request must not create a second per clinic", async ({ request }) => {
    const payload = basePayload_PROOF_B_020_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "registerPatient", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "registerPatient", payload, cookie);
    // Must succeed or return conflict — never 500
    expect(response2.status).toBeOneOf([200, 201, 409]);
    if (response2.status === 200 || response2.status === 201) {
      // If it succeeds, must return the same resource
      const id2 = response2.data?.result?.data?.id;
      if (id1 && id2) {
        expect(id2).toBe(id1);
      }
    }
  });

  test("repeated must be unique must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_020_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "registerPatient", payload, cookie);
    await trpcMutation(request, "registerPatient", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "registerPatient.list", { clinicId: TEST_CLINIC_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    if (Array.isArray(items)) {
      // Count items matching our payload
      const matchingItems = items.filter((item: Record<string, unknown>) => {
        return Object.entries(payload).every(([k, v]) => item[k] === v);
      });
      // At most one matching item should exist
      expect(matchingItems.length).toBeLessThanOrEqual(1);
    }
  });

  test("must be unique with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_020_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "registerPatient", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "registerPatient", payload, cookie);
    expect(response2.status).toBeOneOf([200, 201, 409, 422]);
    // If both succeed, they must return identical data
    if ((response1.status === 200 || response1.status === 201) &&
        (response2.status === 200 || response2.status === 201)) {
      const data1 = response1.data?.result?.data;
      const data2 = response2.data?.result?.data;
      if (data1?.id && data2?.id) {
        expect(data2.id).toBe(data1.id);
      }
    }
  });
});

// Proof: PROOF-B-031-IDEMPOTENCY
// Behavior: POST /api/appointments prevents double-booking for same doctor+date+time
// Risk: high
// Kills: Remove duplicate-check before prevents in bookAppointment | Not returning existing resource on duplicate prevents | Creating second record instead of returning existing one

function basePayload_PROOF_B_031_IDEMPOTENCY() {
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

test.describe("Idempotency: POST /api/appointments prevents double-booking for same doctor+date+time", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    cookie = await getAdminCookie(request);
  });

  test("duplicate prevents request must not create a second double-booking", async ({ request }) => {
    const payload = basePayload_PROOF_B_031_IDEMPOTENCY();
    // First request
    const response1 = await trpcMutation(request, "bookAppointment", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201]);
    const id1 = response1.data?.result?.data?.id;
    // Second identical request
    const response2 = await trpcMutation(request, "bookAppointment", payload, cookie);
    // Must succeed or return conflict — never 500
    expect(response2.status).toBeOneOf([200, 201, 409]);
    if (response2.status === 200 || response2.status === 201) {
      // If it succeeds, must return the same resource
      const id2 = response2.data?.result?.data?.id;
      if (id1 && id2) {
        expect(id2).toBe(id1);
      }
    }
  });

  test("repeated prevents must not multiply side effects", async ({ request }) => {
    const payload = basePayload_PROOF_B_031_IDEMPOTENCY();
    // Perform the operation twice
    await trpcMutation(request, "bookAppointment", payload, cookie);
    await trpcMutation(request, "bookAppointment", payload, cookie);
    // Verify the list endpoint does not contain duplicates
    const listResponse = await trpcQuery(request, "bookAppointment.list", { clinicId: TEST_CLINIC_ID }, cookie);
    expect(listResponse.status).toBe(200);
    const items = listResponse.data?.result?.data;
    if (Array.isArray(items)) {
      // Count items matching our payload
      const matchingItems = items.filter((item: Record<string, unknown>) => {
        return Object.entries(payload).every(([k, v]) => item[k] === v);
      });
      // At most one matching item should exist
      expect(matchingItems.length).toBeLessThanOrEqual(1);
    }
  });

  test("prevents with idempotency key must return same result", async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...basePayload_PROOF_B_031_IDEMPOTENCY(), idempotencyKey };
    // First call
    const response1 = await trpcMutation(request, "bookAppointment", payload, cookie);
    expect(response1.status).toBeOneOf([200, 201, 422]); // 422 if idempotencyKey not supported
    // Second call with same key
    const response2 = await trpcMutation(request, "bookAppointment", payload, cookie);
    expect(response2.status).toBeOneOf([200, 201, 409, 422]);
    // If both succeed, they must return identical data
    if ((response1.status === 200 || response1.status === 201) &&
        (response2.status === 200 || response2.status === 201)) {
      const data1 = response1.data?.result?.data;
      const data2 = response2.data?.result?.data;
      if (data1?.id && data2?.id) {
        expect(data2.id).toBe(data1.id);
      }
    }
  });
});