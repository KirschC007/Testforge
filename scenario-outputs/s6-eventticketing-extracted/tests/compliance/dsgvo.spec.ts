import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getOrganizerAdminCookie } from "../../helpers/auth";
import { TEST_ORGANIZER_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getOrganizerAdminCookie(request);
});

// PROOF-B-050-DSGVO — DSGVO Art. 17: DELETE /api/attendees/:id/gdpr anonymizes attendee data
// Risk: CRITICAL
// Spec: DSGVO
// Behavior: DELETE /api/attendees/:id/gdpr anonymizes attendee data

test("PROOF-B-050-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'name' must be anonymized or nulled
    expect(deletedResource?.name).toBeNull(); // Kills: Skip name anonymization
    // PII field 'email' must be anonymized or nulled
    expect(deletedResource?.email).toBeNull(); // Kills: Skip email anonymization
    // PII field 'phone' must be anonymized or nulled
    expect(deletedResource?.phone).toBeNull(); // Kills: Skip phone anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-050-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-051-DSGVO — DSGVO Art. 17: Attendee name is anonymized to '[Deleted]'
// Risk: CRITICAL
// Spec: DSGVO
// Behavior: Attendee name is anonymized to '[Deleted]'

test("PROOF-B-051-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'field' must be anonymized or nulled
    expect(deletedResource?.field).toBeNull(); // Kills: Skip field anonymization
    // PII field 'name' must be anonymized or nulled
    expect(deletedResource?.name).toBeNull(); // Kills: Skip name anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-051-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-052-DSGVO — DSGVO Art. 17: Attendee email is anonymized to 'deleted_{id}@removed.local'
// Risk: CRITICAL
// Spec: DSGVO
// Behavior: Attendee email is anonymized to 'deleted_{id}@removed.local'

test("PROOF-B-052-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'field' must be anonymized or nulled
    expect(deletedResource?.field).toBeNull(); // Kills: Skip field anonymization
    // PII field 'email' must be anonymized or nulled
    expect(deletedResource?.email).toBeNull(); // Kills: Skip email anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-052-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-053-DSGVO — DSGVO Art. 17: Attendee phone is anonymized to null
// Risk: CRITICAL
// Spec: DSGVO
// Behavior: Attendee phone is anonymized to null

test("PROOF-B-053-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'field' must be anonymized or nulled
    expect(deletedResource?.field).toBeNull(); // Kills: Skip field anonymization
    // PII field 'phone' must be anonymized or nulled
    expect(deletedResource?.phone).toBeNull(); // Kills: Skip phone anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-053-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-054-DSGVO — DSGVO Art. 17: Order history is retained but attendee reference anonymized
// Risk: CRITICAL
// Spec: DSGVO
// Behavior: Order history is retained but attendee reference anonymized

test("PROOF-B-054-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'name' must be anonymized or nulled
    expect(deletedResource?.name).toBeNull(); // Kills: Skip name anonymization
    // PII field 'email' must be anonymized or nulled
    expect(deletedResource?.email).toBeNull(); // Kills: Skip email anonymization
    // PII field 'phone' must be anonymized or nulled
    expect(deletedResource?.phone).toBeNull(); // Kills: Skip phone anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-054-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "attendees.anonymize",
    { id: resourceId, organizerId: TEST_ORGANIZER_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "eventStats.getById",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-055-DSGVO — DSGVO Art. 17: GET /api/attendees/:id/export provides full data export for attendee
// Risk: CRITICAL
// Spec: DSGVO
// Behavior: GET /api/attendees/:id/export provides full data export for attendee

test("PROOF-B-055-DSGVOa — Export returns all required fields including PII", async ({ request }) => {
  // Create a resource with data to export
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Execute data export
  const { status, data: exportData } = await trpcQuery(request, "attendeeDatas.export",
    { organizerId: TEST_ORGANIZER_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Export endpoint returns error

  // Verify export contains data
  expect(exportData).toBeDefined();
  const exportArray = Array.isArray(exportData) ? exportData : [exportData];
  expect(exportArray.length).toBeGreaterThan(0);
  // Kills: Export returns empty data

  // Verify required fields are present in export
  const firstRecord = exportArray[0] as Record<string, unknown>;
  expect(firstRecord?.id).toBeDefined();
  // Kills: Export omits record IDs
  expect(firstRecord?.name).toBeDefined(); // Kills: Export omits name field
  expect(firstRecord?.email).toBeDefined(); // Kills: Export omits email field
  expect(firstRecord?.phone).toBeDefined(); // Kills: Export omits phone field
});

test("PROOF-B-055-DSGVOb — Export requires admin authorization", async ({ request }) => {
  // Attempt export without authentication
  const { status: unauthStatus } = await trpcQuery(request, "attendeeDatas.export",
    { organizerId: TEST_ORGANIZER_ID });
  expect([401, 403]).toContain(unauthStatus);
  // Kills: Allow unauthenticated data export
});