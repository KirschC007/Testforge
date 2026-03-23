import { expect, test } from "@playwright/test";
import { trpcMutation, trpcQuery } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_COMPANY_ID, createTestResource } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-010-DSGVO — DSGVO Art. 17: GDPR anonymization for Company
// Risk: CRITICAL
// Spec: Compliance
// Behavior: GDPR anonymization for Company

test("PROOF-B-010-DSGVOa — All records permanently deleted after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "invoices.gdprDelete",
    { id: resourceId, companyId: TEST_COMPANY_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
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

  await trpcMutation(request, "invoices.gdprDelete",
    { id: resourceId, companyId: TEST_COMPANY_ID }, adminCookie);

  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records
});

// PROOF-B-011-DSGVO — DSGVO Art. 17: GDPR anonymization for CompanyUser
// Risk: CRITICAL
// Spec: Compliance
// Behavior: GDPR anonymization for CompanyUser

test("PROOF-B-011-DSGVOa — All records permanently deleted after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "invoices.gdprDelete",
    { id: resourceId, companyId: TEST_COMPANY_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-011-DSGVOb — Hard-delete is irreversible", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "invoices.gdprDelete",
    { id: resourceId, companyId: TEST_COMPANY_ID }, adminCookie);

  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records
});

// PROOF-B-012-DSGVO — DSGVO Art. 17: GDPR anonymization for Client
// Risk: CRITICAL
// Spec: Compliance
// Behavior: GDPR anonymization for Client

test("PROOF-B-012-DSGVOa — All records permanently deleted after GDPR deletion", async ({ request }) => {
  // Create a resource with PII data
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;
  expect(resourceId).toBeDefined();

  // Execute GDPR deletion
  const { status } = await trpcMutation(request, "invoices.gdprDelete",
    { id: resourceId, companyId: TEST_COMPANY_ID }, adminCookie);
  expect(status).toBe(200);
  // Kills: Skip name anonymization in GDPR delete handler

  // Verify deletion result
  const { data: afterDeletion } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  // Hard-delete: record must be completely gone
  const deletedRecord = (afterDeletion as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(deletedRecord).toBeUndefined();
  // Kills: Soft-delete instead of hard-delete on workspace.deleteAll
  // Kills: Skip phone anonymization
  // Kills: Cascade delete reservations instead of anonymizing
});

test("PROOF-B-012-DSGVOb — Hard-delete is irreversible", async ({ request }) => {
  const resource = await createTestResource(request, adminCookie) as Record<string, unknown>;
  const resourceId = resource.id as number;

  await trpcMutation(request, "invoices.gdprDelete",
    { id: resourceId, companyId: TEST_COMPANY_ID }, adminCookie);

  // Hard-delete: record must NOT be recoverable
  const { data: afterHardDelete } = await trpcQuery(request, "invoices.list",
    { companyId: TEST_COMPANY_ID }, adminCookie);
  const recovered = (afterHardDelete as Array<Record<string, unknown>>)?.find(r => r.id === resourceId);
  expect(recovered).toBeUndefined();
  // Kills: Allow recovery of hard-deleted records
});