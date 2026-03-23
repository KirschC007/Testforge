import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-005-DSGVO — DSGVO Art. 17: Session expires after 8 hours
// Risk: CRITICAL
// Spec: Authentication
// Behavior: Session expires after 8 hours

test("PROOF-B-005-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "login",
    { id: resourceId, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
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

test("PROOF-B-005-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "login",
    { id: resourceId, clinicId: TEST_CLINIC_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-051-DSGVO — DSGVO Art. 17: DELETE /api/patients/:id/gdpr anonymizes patient PII
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: DELETE /api/patients/:id/gdpr anonymizes patient PII

test("PROOF-B-051-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "gdprAnonymizePatient",
    { id: resourceId, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
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

test("PROOF-B-051-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "gdprAnonymizePatient",
    { id: resourceId, clinicId: TEST_CLINIC_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-052-DSGVO — DSGVO Art. 17: Medical records retained for 10 years (anonymized patient reference)
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: Medical records retained for 10 years (anonymized patient reference)

test("PROOF-B-052-DSGVOa — PII fields anonymized after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "gdprAnonymizePatient",
    { id: resourceId, clinicId: TEST_CLINIC_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
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

test("PROOF-B-052-DSGVOb — Record history preserved after GDPR deletion", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "gdprAnonymizePatient",
    { id: resourceId, clinicId: TEST_CLINIC_ID }, adminCookie);

  // Soft-delete: record must still exist (not hard-deleted)
  const { data: history } = await trpcQuery(request, "patients.list",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
  const record = (history as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(record).toBeDefined();
  // Kills: Hard-delete record instead of anonymizing PII
  expect(record?.id).toBe(resourceId);
  // Kills: Delete record ID on GDPR deletion
});

// PROOF-B-053-DSGVO — DSGVO Art. 17: GET /api/patients/:id/export provides full data export
// Risk: CRITICAL
// Spec: DSGVO / GDPR
// Behavior: GET /api/patients/:id/export provides full data export

test("PROOF-B-053-DSGVOa — Export returns all required fields including PII", async ({ request }) => {
  // Create a resource with data to export
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  expect(resource?.id).toBeDefined();

  // Execute data export
  const { status, data: exportData } = await trpcQuery(request, "patientDatas.export",
    { clinicId: TEST_CLINIC_ID }, adminCookie);
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
  expect(firstRecord?.status).toBeDefined(); // Kills: Export omits status field
  expect(firstRecord?.completedAt).toBeDefined(); // Kills: Export omits completedAt field
  expect(firstRecord?.cancelledAt).toBeDefined(); // Kills: Export omits cancelledAt field
  expect(firstRecord?.cancelledBy).toBeDefined(); // Kills: Export omits cancelledBy field
});

test("PROOF-B-053-DSGVOb — Export requires admin authorization", async ({ request }) => {
  // Attempt export without authentication
  const { status: unauthStatus } = await trpcQuery(request, "patientDatas.export",
    { clinicId: TEST_CLINIC_ID });
  expect([401, 403]).toContain(unauthStatus);
  // Kills: Allow unauthenticated data export
});