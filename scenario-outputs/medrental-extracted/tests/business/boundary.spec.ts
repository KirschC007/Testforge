import { expect, test } from "@playwright/test";
import { tomorrowStr, trpcMutation, yesterdayStr } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";
import { TEST_CLINIC_ID } from "../../helpers/factories";

let adminCookie: string;

test.beforeAll(async ({ request }) => {
  adminCookie = await getAdminCookie(request);
});

// PROOF-B-002-BOUND — Boundary: System stores all monetary values in EUR cents as integers
// Risk: medium
// Boundary Field: serialNumber (string, min: 5, max: 30)

const basePayload_PROOF_B_002_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    serialNumber: boundaryValue,
});

test("PROOF-B-002-BOUNDa — serialNumber="A".repeat(5) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_002_BOUND("A".repeat(5)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in serialNumber validation (off-by-one)
});

test("PROOF-B-002-BOUNDb — serialNumber="A".repeat(30) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_002_BOUND("A".repeat(30)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in serialNumber validation (off-by-one)
});

test("PROOF-B-002-BOUNDc — serialNumber="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_002_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

test("PROOF-B-002-BOUNDd — serialNumber="A".repeat(31) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_002_BOUND("A".repeat(31)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

test("PROOF-B-002-BOUNDe — serialNumber=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_002_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

// PROOF-B-007-BOUND — Boundary: System rate limits failed login attempts to 5 per 15 minutes
// Risk: medium

const basePayload_PROOF_B_007_BOUND = (boundaryValue: unknown) => ({
    email: boundaryValue,
    password: "test-password",
});

test("PROOF-B-007-BOUNDa — email="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "auth.login", basePayload_PROOF_B_007_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in email validation (off-by-one)
});

test("PROOF-B-007-BOUNDb — email="A".repeat(200) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "auth.login", basePayload_PROOF_B_007_BOUND("A".repeat(200)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in email validation (off-by-one)
});

test("PROOF-B-007-BOUNDc — email="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "auth.login", basePayload_PROOF_B_007_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove email boundary validation
});

test("PROOF-B-007-BOUNDd — email="A".repeat(201) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "auth.login", basePayload_PROOF_B_007_BOUND("A".repeat(201)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove email boundary validation
});

test("PROOF-B-007-BOUNDe — email=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "auth.login", basePayload_PROOF_B_007_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove email boundary validation
});

// PROOF-B-024-BOUND — Boundary: API allows technician and admin to register new medical devices
// Risk: critical
// Boundary Field: serialNumber (string, min: 5, max: 30)

const basePayload_PROOF_B_024_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    serialNumber: boundaryValue,
});

test("PROOF-B-024-BOUNDa — serialNumber="A".repeat(5) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_024_BOUND("A".repeat(5)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in serialNumber validation (off-by-one)
});

test("PROOF-B-024-BOUNDb — serialNumber="A".repeat(30) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_024_BOUND("A".repeat(30)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in serialNumber validation (off-by-one)
});

test("PROOF-B-024-BOUNDc — serialNumber="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_024_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

test("PROOF-B-024-BOUNDd — serialNumber="A".repeat(31) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_024_BOUND("A".repeat(31)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

test("PROOF-B-024-BOUNDe — serialNumber=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_024_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

// PROOF-B-037-BOUND — Boundary: API allows technician and admin to update device status
// Risk: high
// Boundary Field: reason (string, max: 500)

const basePayload_PROOF_B_037_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    status: "available",
    reason: boundaryValue,
});

test("PROOF-B-037-BOUNDa — reason="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_037_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-037-BOUNDb — reason="A".repeat(500) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_037_BOUND("A".repeat(500)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-037-BOUNDc — reason="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_037_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-037-BOUNDd — reason="A".repeat(501) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_037_BOUND("A".repeat(501)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-037-BOUNDe — reason=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_037_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

// PROOF-B-039-BOUND — Boundary: API allows technician and admin to record a maintenance event
// Risk: critical
// Boundary Field: description (string, min: 10, max: 5000)

const basePayload_PROOF_B_039_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    clinicId: TEST_CLINIC_ID,
    type: "routine",
    cost: 1,
    performedBy: "test-performedBy",
    nextMaintenanceDue: tomorrowStr(),
    description: boundaryValue,
});

test("PROOF-B-039-BOUNDa — description="A".repeat(10) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_039_BOUND("A".repeat(10)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in description validation (off-by-one)
});

test("PROOF-B-039-BOUNDb — description="A".repeat(5000) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_039_BOUND("A".repeat(5000)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in description validation (off-by-one)
});

test("PROOF-B-039-BOUNDc — description="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_039_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove description boundary validation
});

test("PROOF-B-039-BOUNDd — description="A".repeat(5001) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_039_BOUND("A".repeat(5001)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove description boundary validation
});

test("PROOF-B-039-BOUNDe — description=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_039_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove description boundary validation
});

// PROOF-B-043-BOUND — Boundary: API allows nurse and admin to register a patient
// Risk: critical
// Boundary Field: firstName (string, min: 1, max: 50)

const basePayload_PROOF_B_043_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    phone: "+4917655470957",
    address: "test-address",
    firstName: boundaryValue,
});

test("PROOF-B-043-BOUNDa — firstName="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_043_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in firstName validation (off-by-one)
});

test("PROOF-B-043-BOUNDb — firstName="A".repeat(50) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_043_BOUND("A".repeat(50)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in firstName validation (off-by-one)
});

test("PROOF-B-043-BOUNDc — firstName="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_043_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

test("PROOF-B-043-BOUNDd — firstName="A".repeat(51) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_043_BOUND("A".repeat(51)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

test("PROOF-B-043-BOUNDe — firstName=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_043_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

// PROOF-B-047-BOUND — Boundary: API allows nurse and admin to create a device rental
// Risk: critical
// Boundary Field: dailyRate (number, min: 50, max: 999999)

const basePayload_PROOF_B_047_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    deposit: 1,
    dailyRate: boundaryValue,
});

test("PROOF-B-047-BOUNDa — dailyRate=50 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_047_BOUND(50), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in dailyRate validation (off-by-one)
});

test("PROOF-B-047-BOUNDb — dailyRate=999999 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_047_BOUND(999999), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in dailyRate validation (off-by-one)
});

test("PROOF-B-047-BOUNDc — dailyRate=49 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_047_BOUND(49), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove dailyRate boundary validation
});

test("PROOF-B-047-BOUNDd — dailyRate=1000000 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_047_BOUND(1000000), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove dailyRate boundary validation
});

test("PROOF-B-047-BOUNDe — dailyRate=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_047_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove dailyRate boundary validation
});

// PROOF-B-061-BOUND — Boundary: API allows nurse and admin to extend a rental period
// Risk: critical
// Boundary Field: reason (string, max: 500)

const basePayload_PROOF_B_061_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: boundaryValue,
});

test("PROOF-B-061-BOUNDa — reason="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_061_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-061-BOUNDb — reason="A".repeat(500) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_061_BOUND("A".repeat(500)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-061-BOUNDc — reason="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_061_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-061-BOUNDd — reason="A".repeat(501) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_061_BOUND("A".repeat(501)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-061-BOUNDe — reason=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_061_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

// PROOF-B-065-BOUND — Boundary: API allows technician, nurse, and admin to process device return
// Risk: critical
// Boundary Field: damageNotes (string, max: 2000)

const basePayload_PROOF_B_065_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: boundaryValue,
});

test("PROOF-B-065-BOUNDa — damageNotes="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_065_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in damageNotes validation (off-by-one)
});

test("PROOF-B-065-BOUNDb — damageNotes="A".repeat(2000) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_065_BOUND("A".repeat(2000)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in damageNotes validation (off-by-one)
});

test("PROOF-B-065-BOUNDc — damageNotes="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_065_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove damageNotes boundary validation
});

test("PROOF-B-065-BOUNDd — damageNotes="A".repeat(2001) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_065_BOUND("A".repeat(2001)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove damageNotes boundary validation
});

test("PROOF-B-065-BOUNDe — damageNotes=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_065_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove damageNotes boundary validation
});

// PROOF-B-074-BOUND — Boundary: API allows billing and admin to create an invoice
// Risk: critical

const basePayload_PROOF_B_074_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: boundaryValue,
    dueDate: tomorrowStr(),
});

test("PROOF-B-074-BOUNDa — items=[{ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }] (minimum 1 item)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_074_BOUND([{ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }]), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in items validation (off-by-one)
});

test("PROOF-B-074-BOUNDb — items=Array(50).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }) (maximum 50 items)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_074_BOUND(Array(50).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 })), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in items validation (off-by-one)
});

test("PROOF-B-074-BOUNDc — items=[] (empty = below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_074_BOUND([]), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove items boundary validation
});

test("PROOF-B-074-BOUNDd — items=Array(51).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_074_BOUND(Array(51).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 })), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove items boundary validation
});

test("PROOF-B-074-BOUNDe — items=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_074_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove items boundary validation
});

// PROOF-B-076-BOUND — Boundary: API allows billing and admin to record payment
// Risk: critical
// Boundary Field: reference (string, max: 100)

const basePayload_PROOF_B_076_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: boundaryValue,
});

test("PROOF-B-076-BOUNDa — reference="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_076_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reference validation (off-by-one)
});

test("PROOF-B-076-BOUNDb — reference="A".repeat(100) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_076_BOUND("A".repeat(100)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reference validation (off-by-one)
});

test("PROOF-B-076-BOUNDc — reference="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_076_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reference boundary validation
});

test("PROOF-B-076-BOUNDd — reference="A".repeat(101) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_076_BOUND("A".repeat(101)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reference boundary validation
});

test("PROOF-B-076-BOUNDe — reference=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_076_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reference boundary validation
});

// PROOF-B-080-BOUND — Boundary: API allows admin only to access device utilization report
// Risk: critical

const basePayload_PROOF_B_080_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    type: boundaryValue,
});

test("PROOF-B-080-BOUNDa — type=1 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_080_BOUND(1), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in type validation (off-by-one)
});

test("PROOF-B-080-BOUNDb — type=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_080_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in type validation (off-by-one)
});

test("PROOF-B-080-BOUNDc — type=0 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_080_BOUND(0), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove type boundary validation
});

test("PROOF-B-080-BOUNDd — type=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_080_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove type boundary validation
});

test("PROOF-B-080-BOUNDe — type=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_080_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove type boundary validation
});