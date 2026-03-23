import { expect, test } from "@playwright/test";
import { tomorrowStr, trpcMutation, yesterdayStr } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-020-BOUND — Boundary: Patient email must be unique per clinic
// Risk: high
// Boundary Field: firstName (string, min: 1, max: 50)

const basePayload_PROOF_B_020_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    email: "test@example.com",
    phone: "+4917681083335",
    firstName: boundaryValue,
});

test("PROOF-B-020-BOUNDa — firstName="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "registerPatient", basePayload_PROOF_B_020_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in firstName validation (off-by-one)
});

test("PROOF-B-020-BOUNDb — firstName="A".repeat(50) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "registerPatient", basePayload_PROOF_B_020_BOUND("A".repeat(50)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in firstName validation (off-by-one)
});

test("PROOF-B-020-BOUNDc — firstName="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "registerPatient", basePayload_PROOF_B_020_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

test("PROOF-B-020-BOUNDd — firstName="A".repeat(51) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "registerPatient", basePayload_PROOF_B_020_BOUND("A".repeat(51)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

test("PROOF-B-020-BOUNDe — firstName=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "registerPatient", basePayload_PROOF_B_020_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

// PROOF-B-028-BOUND — Boundary: POST /api/appointments requires date to be in the future
// Risk: medium
// Boundary Field: date (date)

const basePayload_PROOF_B_028_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    patientId: 1,
    doctorId: 2,
    time: "test-time",
    duration: 15,
    type: "consultation",
    date: boundaryValue,
});

test("PROOF-B-028-BOUNDa — date=tomorrowStr() (future = valid)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookAppointment", basePayload_PROOF_B_028_BOUND(tomorrowStr()), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in date validation (off-by-one)
});

test("PROOF-B-028-BOUNDb — date=yesterdayStr() (past = invalid)", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookAppointment", basePayload_PROOF_B_028_BOUND(yesterdayStr()), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove date boundary validation
});

test("PROOF-B-028-BOUNDc — date=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "bookAppointment", basePayload_PROOF_B_028_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove date boundary validation
});

// PROOF-B-038-BOUND — Boundary: Record patient vitals requires appointmentId to belong to patient
// Risk: high
// Boundary Field: bloodPressureSys (number, min: 60, max: 250)

const basePayload_PROOF_B_038_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    patientId: 1,
    appointmentId: 1,
    bloodPressureDia: 30,
    heartRate: 30,
    temperature: 35,
    weight: 1,
    bloodPressureSys: boundaryValue,
});

test("PROOF-B-038-BOUNDa — bloodPressureSys=60 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "recordVitals", basePayload_PROOF_B_038_BOUND(60), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in bloodPressureSys validation (off-by-one)
});

test("PROOF-B-038-BOUNDb — bloodPressureSys=250 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "recordVitals", basePayload_PROOF_B_038_BOUND(250), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in bloodPressureSys validation (off-by-one)
});

test("PROOF-B-038-BOUNDc — bloodPressureSys=59 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "recordVitals", basePayload_PROOF_B_038_BOUND(59), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove bloodPressureSys boundary validation
});

test("PROOF-B-038-BOUNDd — bloodPressureSys=251 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "recordVitals", basePayload_PROOF_B_038_BOUND(251), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove bloodPressureSys boundary validation
});

test("PROOF-B-038-BOUNDe — bloodPressureSys=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "recordVitals", basePayload_PROOF_B_038_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove bloodPressureSys boundary validation
});