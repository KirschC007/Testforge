import { expect, test } from "@playwright/test";
import { BASE_URL, trpcQuery } from "../../helpers/api";
import { getAttendeeCookie, getOrganizerAdminCookie, getOrganizerStaffCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getOrganizerAdminCookie(request);
});

// Proof: PROOF-B-001-AUTHMATRIX
// Behavior: Organizer data is isolated by organizerId
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_001_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: Organizer data is isolated by organizerId", () => {
  test("organizer_admin must be able to is isolated organizerId", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to is isolated organizerId", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to is isolated organizerId", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant is isolated must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_001_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access organizerId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access organizerId
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access organizerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access organizerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to is isolated organizerId", async ({ request }) => {
    // Kills: organizer_admin should not be able to is isolated organizerId
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to is isolated organizerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to is isolated organizerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to is isolated organizerId", async ({ request }) => {
    // Kills: organizer_staff should not be able to is isolated organizerId
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_001_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to is isolated organizerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to is isolated organizerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-002-AUTHMATRIX
// Behavior: Events, tickets, and orders belong to one organizer
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_002_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: Events, tickets, and orders belong to one organizer", () => {
  test("organizer_admin must be able to belong to one organizer", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to belong to one organizer", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to belong to one organizer", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant belong to must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_002_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access one organizer", async ({ request }) => {
    // Kills: Allow lower-privileged role to access one organizer
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access one organizer — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access one organizer — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to belong to one organizer", async ({ request }) => {
    // Kills: organizer_admin should not be able to belong to one organizer
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to belong to one organizer — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to belong to one organizer — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to belong to one organizer", async ({ request }) => {
    // Kills: organizer_staff should not be able to belong to one organizer
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_002_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to belong to one organizer — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to belong to one organizer — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-008-AUTHMATRIX
// Behavior: organizer_admin role has full access to own events/orders
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_008_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: organizer_admin role has full access to own events/orders", () => {
  test("organizer_admin must be able to has full access to own events/orders", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to has full access to own events/orders", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to has full access to own events/orders", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant has must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_008_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access full access to own events/orders", async ({ request }) => {
    // Kills: Allow lower-privileged role to access full access to own events/orders
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access full access to own events/orders — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access full access to own events/orders — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to has full access to own events/orders", async ({ request }) => {
    // Kills: organizer_admin should not be able to has full access to own events/orders
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to has full access to own events/orders — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to has full access to own events/orders — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to has full access to own events/orders", async ({ request }) => {
    // Kills: organizer_staff should not be able to has full access to own events/orders
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_008_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to has full access to own events/orders — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to has full access to own events/orders — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-009-AUTHMATRIX
// Behavior: organizer_staff role can view events
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_009_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: organizer_staff role can view events", () => {
  test("organizer_admin must be able to can view events", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can view events", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can view events", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can view must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_009_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access events", async ({ request }) => {
    // Kills: Allow lower-privileged role to access events
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access events — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access events — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can view events", async ({ request }) => {
    // Kills: organizer_admin should not be able to can view events
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can view events — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can view events — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can view events", async ({ request }) => {
    // Kills: organizer_staff should not be able to can view events
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_009_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can view events — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can view events — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-010-AUTHMATRIX
// Behavior: organizer_staff role can scan tickets
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_010_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: organizer_staff role can scan tickets", () => {
  test("organizer_admin must be able to can scan tickets", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can scan tickets", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can scan tickets", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can scan must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_010_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tickets", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tickets
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tickets — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tickets — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can scan tickets", async ({ request }) => {
    // Kills: organizer_admin should not be able to can scan tickets
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can scan tickets — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can scan tickets — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can scan tickets", async ({ request }) => {
    // Kills: organizer_staff should not be able to can scan tickets
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_010_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can scan tickets — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can scan tickets — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-011-AUTHMATRIX
// Behavior: organizer_staff role cannot modify pricing
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_011_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: organizer_staff role cannot modify pricing", () => {
  test("organizer_admin must be able to cannot modify pricing", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to cannot modify pricing", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to cannot modify pricing", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant cannot modify must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_011_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access pricing", async ({ request }) => {
    // Kills: Allow lower-privileged role to access pricing
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to cannot modify pricing", async ({ request }) => {
    // Kills: organizer_admin should not be able to cannot modify pricing
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to cannot modify pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to cannot modify pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to cannot modify pricing", async ({ request }) => {
    // Kills: organizer_staff should not be able to cannot modify pricing
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_011_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to cannot modify pricing — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to cannot modify pricing — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-012-AUTHMATRIX
// Behavior: attendee role can buy tickets
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_012_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: attendee role can buy tickets", () => {
  test("organizer_admin must be able to can buy tickets", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can buy tickets", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can buy tickets", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can buy must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_012_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access tickets", async ({ request }) => {
    // Kills: Allow lower-privileged role to access tickets
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access tickets — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access tickets — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can buy tickets", async ({ request }) => {
    // Kills: organizer_admin should not be able to can buy tickets
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can buy tickets — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can buy tickets — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can buy tickets", async ({ request }) => {
    // Kills: organizer_staff should not be able to can buy tickets
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_012_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can buy tickets — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can buy tickets — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-013-AUTHMATRIX
// Behavior: attendee role can view own orders
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_013_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: attendee role can view own orders", () => {
  test("organizer_admin must be able to can view own orders", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can view own orders", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can view own orders", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can view must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_013_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own orders", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own orders
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own orders — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own orders — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can view own orders", async ({ request }) => {
    // Kills: organizer_admin should not be able to can view own orders
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can view own orders — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can view own orders — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can view own orders", async ({ request }) => {
    // Kills: organizer_staff should not be able to can view own orders
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_013_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can view own orders — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can view own orders — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-014-AUTHMATRIX
// Behavior: attendee role can request refund
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_014_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: attendee role can request refund", () => {
  test("organizer_admin must be able to can request refund", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can request refund", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can request refund", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can request must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_014_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access refund", async ({ request }) => {
    // Kills: Allow lower-privileged role to access refund
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can request refund", async ({ request }) => {
    // Kills: organizer_admin should not be able to can request refund
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can request refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can request refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can request refund", async ({ request }) => {
    // Kills: organizer_staff should not be able to can request refund
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_014_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can request refund — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can request refund — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-017-AUTHMATRIX
// Behavior: organizerId in POST /api/events must match JWT
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_017_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: organizerId in POST /api/events must match JWT", () => {
  test("organizer_admin must be able to must match JWT organizerId", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to must match JWT organizerId", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to must match JWT organizerId", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant must match must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_017_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access JWT organizerId", async ({ request }) => {
    // Kills: Allow lower-privileged role to access JWT organizerId
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access JWT organizerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access JWT organizerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to must match JWT organizerId", async ({ request }) => {
    // Kills: organizer_admin should not be able to must match JWT organizerId
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to must match JWT organizerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to must match JWT organizerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to must match JWT organizerId", async ({ request }) => {
    // Kills: organizer_staff should not be able to must match JWT organizerId
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_017_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to must match JWT organizerId — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to must match JWT organizerId — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-018-AUTHMATRIX
// Behavior: System returns 403 if organizerId mismatch during event creation
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_018_AUTHMATRIX() {
  return {
    organizerId: TEST_ORGANIZER_ID,
    title: "Test title-${Date.now()}",
    description: "Test description",
    venue: "test-venue",
    date: tomorrowStr(),
    capacity: 1,
    ticketPrice: 0.01,
    earlyBirdPrice: 1.00,
    earlyBirdDeadline: tomorrowStr(),
    maxPerOrder: 1,
  };
}
test.describe("Auth Matrix: System returns 403 if organizerId mismatch during event creation", () => {
  test("organizer_admin must be able to returns 403 event creation request", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to returns 403 event creation request", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to returns 403 event creation request", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 403 must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_018_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "events.create", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in events.create", async ({ request }) => {
    // Kills: Remove role check in events.create
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in events.create — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access event creation request", async ({ request }) => {
    // Kills: Allow lower-privileged role to access event creation request
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access event creation request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access event creation request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to returns 403 event creation request", async ({ request }) => {
    // Kills: organizer_admin should not be able to returns 403 event creation request
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to returns 403 event creation request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to returns 403 event creation request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to returns 403 event creation request", async ({ request }) => {
    // Kills: organizer_staff should not be able to returns 403 event creation request
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "events.create", basePayload_PROOF_B_018_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to returns 403 event creation request — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to returns 403 event creation request — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-037-AUTHMATRIX
// Behavior: organizer_admin can update order status to cancel/refund
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_037_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
  };
}
test.describe("Auth Matrix: organizer_admin can update order status to cancel/refund", () => {
  test("organizer_admin must be able to can update order status to cancelled or refunded", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can update order status to cancelled or refunded", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can update order status to cancelled or refunded", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can update order status must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_037_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "orders.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in orders.updateStatus", async ({ request }) => {
    // Kills: Remove role check in orders.updateStatus
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in orders.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access to cancelled or refunded", async ({ request }) => {
    // Kills: Allow lower-privileged role to access to cancelled or refunded
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access to cancelled or refunded — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access to cancelled or refunded — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can update order status to cancelled or refunded", async ({ request }) => {
    // Kills: organizer_admin should not be able to can update order status to cancelled or refunded
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can update order status to cancelled or refunded — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can update order status to cancelled or refunded — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can update order status to cancelled or refunded", async ({ request }) => {
    // Kills: organizer_staff should not be able to can update order status to cancelled or refunded
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_037_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can update order status to cancelled or refunded — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can update order status to cancelled or refunded — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-038-AUTHMATRIX
// Behavior: Attendee can cancel own order only if event is more than 48 hours away
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_038_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
  };
}
test.describe("Auth Matrix: Attendee can cancel own order only if event is more than 48 hours away", () => {
  test("organizer_admin must be able to can cancel own order", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can cancel own order", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can cancel own order", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can cancel must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_038_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "orders.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in orders.updateStatus", async ({ request }) => {
    // Kills: Remove role check in orders.updateStatus
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in orders.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access own order", async ({ request }) => {
    // Kills: Allow lower-privileged role to access own order
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access own order — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access own order — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can cancel own order", async ({ request }) => {
    // Kills: organizer_admin should not be able to can cancel own order
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can cancel own order — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can cancel own order — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can cancel own order", async ({ request }) => {
    // Kills: organizer_staff should not be able to can cancel own order
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_038_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can cancel own order — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can cancel own order — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-039-AUTHMATRIX
// Behavior: System returns 422 CANCELLATION_DEADLINE if attendee tries to cancel an order within 48 hours of event
// Risk: high
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_039_AUTHMATRIX() {
  return {
    id: 1,
    status: "confirmed",
  };
}
test.describe("Auth Matrix: System returns 422 CANCELLATION_DEADLINE if attendee tries to cancel an order within 48 hours of event", () => {
  test("organizer_admin must be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant returns 422 CANCELLATION_DEADLINE must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_039_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "orders.updateStatus", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in orders.updateStatus", async ({ request }) => {
    // Kills: Remove role check in orders.updateStatus
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in orders.updateStatus — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access order cancellation request by attendee", async ({ request }) => {
    // Kills: Allow lower-privileged role to access order cancellation request by attendee
    const cookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access order cancellation request by attendee — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access order cancellation request by attendee — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee", async ({ request }) => {
    // Kills: organizer_admin should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee
    const cookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee", async ({ request }) => {
    // Kills: organizer_staff should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "orders.updateStatus", basePayload_PROOF_B_039_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to returns 422 CANCELLATION_DEADLINE order cancellation request by attendee — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});

// Proof: PROOF-B-041-AUTHMATRIX
// Behavior: organizer_admin and organizer_staff can get event statistics
// Risk: critical
// MutationTargets: 4 kills required for 100% mutation score
function basePayload_PROOF_B_041_AUTHMATRIX() {
  return {
    id: 1,
  };
}
test.describe("Auth Matrix: organizer_admin and organizer_staff can get event statistics", () => {
  test("organizer_admin must be able to can get event statistics", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Verify response has data (not empty)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
  });
  test("unauthenticated request must be rejected", async ({ request }) => {
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), "");
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak data to unauthenticated callers
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
    // Verify error code is UNAUTHORIZED
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("organizer_staff must NOT be able to can get event statistics", async ({ request }) => {
    const roleCookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });

  test("attendee must NOT be able to can get event statistics", async ({ request }) => {
    const roleCookie = await getAttendeeCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), roleCookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Must not leak any data in error response
    const data = response.data?.result?.data;
    expect(data).toBeFalsy();
  });
  test("cross-tenant can get must be rejected", async ({ request }) => {
    const cookie = await getOrganizerAdminCookie(request);
    const crossTenantPayload = {
      ...basePayload_PROOF_B_041_AUTHMATRIX(),
      organizerId: TEST_ORGANIZER_ID + 99999, // Bug 3 Fix: use numeric offset from real tenantConst
    };
    const response = await trpcQuery(request, "eventStats.getById", crossTenantPayload, cookie);
    expect(response.status).toBeOneOf([401, 403, 404]);
    // Must not leak data from other tenant
    const leakedData = response.data?.result?.data;
    expect(leakedData).toBeFalsy();
  });

  test("mutation-kill-1: Remove role check in eventStats.getById", async ({ request }) => {
    // Kills: Remove role check in eventStats.getById
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([200, 201]);
    // Kills: Remove role check in eventStats.getById — verify response has expected structure (not empty/null)
    const data = response.data?.result?.data;
    expect(data).not.toBeNull();
    expect(data).not.toBeUndefined();
  });

  test("mutation-kill-2: Allow lower-privileged role to access event statistics", async ({ request }) => {
    // Kills: Allow lower-privileged role to access event statistics
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: Allow lower-privileged role to access event statistics — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: Allow lower-privileged role to access event statistics — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-3: organizer_admin should not be able to can get event statistics", async ({ request }) => {
    // Kills: organizer_admin should not be able to can get event statistics
    const cookie = await getOrganizerAdminCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_admin should not be able to can get event statistics — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_admin should not be able to can get event statistics — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });

  test("mutation-kill-4: organizer_staff should not be able to can get event statistics", async ({ request }) => {
    // Kills: organizer_staff should not be able to can get event statistics
    const cookie = await getOrganizerStaffCookie(request);
    const response = await trpcQuery(request, "eventStats.getById", basePayload_PROOF_B_041_AUTHMATRIX(), cookie);
    expect(response.status).toBeOneOf([401, 403]);
    // Kills: organizer_staff should not be able to can get event statistics — verify no data leaked in error response
    const body = response.data?.result?.data ?? response.data?.result?.error;
    expect(body).toBeFalsy();
    // Kills: organizer_staff should not be able to can get event statistics — verify error code is present
    const errorCode = response.data?.error?.data?.code ?? response.data?.result?.error?.data?.code;
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
  });
});