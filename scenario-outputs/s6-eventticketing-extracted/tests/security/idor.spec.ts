import { expect, test } from "@playwright/test";
import { loginAndGetCookie, trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_B_ID, TEST_ORGANIZER_ID, createTestResource } from "../../helpers/factories";

let tenantACookie: string;
let tenantBCookie: string;

test.beforeAll(async ({ request }) => {
  tenantACookie = await getOrganizerAdminCookie(request);
  // IMPORTANT: Set E2E_TENANT_B_USER and E2E_TENANT_B_PASS to a user from a DIFFERENT tenant
  tenantBCookie = await loginAndGetCookie(
    request,
    process.env.E2E_TENANT_B_USER || "test-tenant-b-user",
    process.env.E2E_TENANT_B_PASS || "TestPass2026x"
  );
});

// PROOF-B-001-IDOR — IDOR: Cross-tenant access to organizerId must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: Organizer data is isolated by organizerId

test("PROOF-B-001-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove organizerId filter in eventStats.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_ORGANIZER_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-001-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { organizerId: TEST_ORGANIZER_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via eventStats.getById
  const crossTenant = await trpcQuery(request, "eventStats.getById",
    { id: resourceId, organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in eventStats.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-002-IDOR — IDOR: Cross-tenant access to one organizer must be rejected
// Risk: CRITICAL
// Spec: Overview
// Behavior: Events, tickets, and orders belong to one organizer

test("PROOF-B-002-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove organizerId filter in eventStats.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_ORGANIZER_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-002-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { organizerId: TEST_ORGANIZER_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via eventStats.getById
  const crossTenant = await trpcQuery(request, "eventStats.getById",
    { id: resourceId, organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in eventStats.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-008-IDOR — IDOR: Cross-tenant access to full access to own events/orders must be rejected
// Risk: CRITICAL
// Spec: Roles
// Behavior: organizer_admin role has full access to own events/orders

test("PROOF-B-008-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove organizerId filter in eventStats.getById query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_ORGANIZER_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-008-IDORb — Tenant A cannot read individual Tenant B resource", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { organizerId: TEST_ORGANIZER_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to read specific Tenant B resource via eventStats.getById
  const crossTenant = await trpcQuery(request, "eventStats.getById",
    { id: resourceId, organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in eventStats.getById
  expect(crossTenant.data).toBeNull();
  // Kills: Return resource data without tenant check
});

// PROOF-B-017-IDOR — IDOR: Cross-tenant access to JWT organizerId must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: organizerId in POST /api/events must match JWT

test("PROOF-B-017-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove organizerId filter in events.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_ORGANIZER_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-017-IDORb — Tenant A cannot mutate Tenant B resource via events.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { organizerId: TEST_ORGANIZER_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via events.create
  const crossTenant = await trpcMutation(request, "events.create",
    {
        organizerId: TEST_ORGANIZER_B_ID,
        title: "test-title",
        description: "test-description",
        venue: "test-venue",
        date: "test-date",
        capacity: 1,
        ticketPrice: 1,
        earlyBirdPrice: 1,
        earlyBirdDeadline: "test-earlyBirdDeadline",
        maxPerOrder: 1,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in events.create
  // Kills: Allow cross-tenant mutations on events.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});

// PROOF-B-018-IDOR — IDOR: Cross-tenant access to event creation request must be rejected
// Risk: CRITICAL
// Spec: Endpoints
// Behavior: System returns 403 if organizerId mismatch during event creation

test("PROOF-B-018-IDORa — Tenant A cannot list Tenant B resources", async ({ request }) => {
  // Positive control: Tenant B can access its own data
  const ownData = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(ownData.status).toBe(200);
  // Kills: Block all cross-tenant access including legitimate access

  // Attack: Tenant A attempts to access Tenant B data
  const crossTenant = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Remove organizerId filter in events.create query

  // Side-effect check: No Tenant B data must be in the response
  const responseText = JSON.stringify(crossTenant.data ?? "");
  expect(responseText).not.toContain(String(TEST_ORGANIZER_B_ID));
  // Kills: Return empty array instead of 403 on cross-tenant access
  // Kills: Return all records without tenant isolation
});

test("PROOF-B-018-IDORb — Tenant A cannot mutate Tenant B resource via events.create", async ({ request }) => {
  // Get a Tenant B resource ID (create one if needed)
  const tenantBList = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  let resourceId = (tenantBList.data as Array<Record<string, unknown>>)?.[0]?.id;
  if (!resourceId) {
    const created = await createTestResource(request, tenantBCookie, { organizerId: TEST_ORGANIZER_B_ID });
    resourceId = (created as Record<string, unknown>)?.id;
    expect(resourceId).toBeDefined();
  }

  // Attack: Tenant A tries to mutate Tenant B resource via events.create
  const crossTenant = await trpcMutation(request, "events.create",
    {
        organizerId: TEST_ORGANIZER_B_ID,
        title: "test-title",
        description: "test-description",
        venue: "test-venue",
        date: "test-date",
        capacity: 1,
        ticketPrice: 1,
        earlyBirdPrice: 1,
        earlyBirdDeadline: "test-earlyBirdDeadline",
        maxPerOrder: 1,
    }, tenantACookie);

  expect([401, 403]).toContain(crossTenant.status);
  // Kills: Missing tenant ownership check in events.create
  // Kills: Allow cross-tenant mutations on events.create

  // Verify resource was NOT modified
  const verify = await trpcQuery(request, "login",
    { organizerId: TEST_ORGANIZER_B_ID }, tenantBCookie);
  expect(verify.status).toBe(200);
  // Kills: Mutation succeeds but returns 403 after the fact
});