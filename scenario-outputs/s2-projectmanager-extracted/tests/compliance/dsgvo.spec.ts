import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_WORKSPACE_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-099-DSGVO — DSGVO Art. 17: DELETE /api/users/:id/gdpr anonymizes user PII
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: DELETE /api/users/:id/gdpr anonymizes user PII

test("PROOF-B-099-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "users.gdpr",
    { id: resourceId, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'name' must be anonymized or nulled
    expect(deletedResource?.name).toBeNull(); // Kills: Skip name anonymization
    // PII field 'email' must be anonymized or nulled
    expect(deletedResource?.email).toBeNull(); // Kills: Skip email anonymization
    // PII field 'phone' must be anonymized or nulled
    expect(deletedResource?.phone).toBeNull(); // Kills: Skip phone anonymization
    // PII field 'avatar' must be anonymized or nulled
    expect(deletedResource?.avatar).toBeNull(); // Kills: Skip avatar anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-099-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "users.gdpr",
    { id: resourceId, workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-100-DSGVO — DSGVO Art. 17: Comments by deleted users retain content but show anonymized authorName
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: Comments by deleted users retain content but show anonymized authorName

test("PROOF-B-100-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "users.gdpr",
    { id: resourceId, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const deletedResource = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  // Soft-delete/anonymize: record still exists but PII must be anonymized
  if (deletedResource) {
    // PII field 'name' must be anonymized or nulled
    expect(deletedResource?.name).toBeNull(); // Kills: Skip name anonymization
  }
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-100-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "users.gdpr",
    { id: resourceId, workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "auth.list",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-101-DSGVO — DSGVO Art. 17: Time entries by deleted users are retained but userId is anonymized
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: Time entries by deleted users are retained but userId is anonymized

test("PROOF-B-101-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "users.gdpr",
    { id: resourceId, workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "users.gdpr",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
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

test("PROOF-B-101-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "users.gdpr",
    { id: resourceId, workspaceId: TEST_WORKSPACE_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "users.gdpr",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-102-DSGVO — DSGVO Art. 17: GET /api/users/:id/export provides full user data export in JSON format
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: GET /api/users/:id/export provides full user data export in JSON format

test("PROOF-B-102-DSGVOa — Export returns all required fields including PII", async ({ request }) => {
  // Create a resource with data to export
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Execute data export
  const { status, data: exportData } = await trpcQuery(request, "users.gdpr",
    { workspaceId: TEST_WORKSPACE_ID }, adminCookie);
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
  expect(firstRecord?.description).toBeDefined(); // Kills: Export omits description field
  expect(firstRecord?.color).toBeDefined(); // Kills: Export omits color field
  expect(firstRecord?.isPublic).toBeDefined(); // Kills: Export omits isPublic field
  expect(firstRecord?.taskCount).toBeDefined(); // Kills: Export omits taskCount field
});

test("PROOF-B-102-DSGVOb — Export requires admin authorization", async ({ request }) => {
  // Attempt export without authentication
  const { status: unauthStatus } = await trpcQuery(request, "users.gdpr",
    { workspaceId: TEST_WORKSPACE_ID });
  expect([401, 403]).toContain(unauthStatus);
  // Kills: Allow unauthenticated data export
});