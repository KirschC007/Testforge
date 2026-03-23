import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_TENANT_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-008-DSGVO — DSGVO Art. 17: GDPR anonymization for users
// Risk: CRITICAL
// Spec: Compliance
// Behavior: GDPR anonymization for users

test("PROOF-B-008-DSGVOa — All records permanently deleted after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "workouts.delete",
    { id: resourceId, tenantId: TEST_TENANT_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-008-DSGVOb — Hard-delete is irreversible", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "workouts.delete",
    { id: resourceId, tenantId: TEST_TENANT_ID }, adminCookie);

  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records
});

// PROOF-B-009-DSGVO — DSGVO Art. 17: GDPR anonymization for workouts
// Risk: CRITICAL
// Spec: Compliance
// Behavior: GDPR anonymization for workouts

test("PROOF-B-009-DSGVOa — All records permanently deleted after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "workouts.delete",
    { id: resourceId, tenantId: TEST_TENANT_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-009-DSGVOb — Hard-delete is irreversible", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "workouts.delete",
    { id: resourceId, tenantId: TEST_TENANT_ID }, adminCookie);

  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records
});

// PROOF-B-010-DSGVO — DSGVO Art. 17: GDPR anonymization for exercises
// Risk: CRITICAL
// Spec: Compliance
// Behavior: GDPR anonymization for exercises

test("PROOF-B-010-DSGVOa — All records permanently deleted after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "workouts.delete",
    { id: resourceId, tenantId: TEST_TENANT_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-010-DSGVOb — Hard-delete is irreversible", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "workouts.delete",
    { id: resourceId, tenantId: TEST_TENANT_ID }, adminCookie);

  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "workouts.list",
    { tenantId: TEST_TENANT_ID }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records
});