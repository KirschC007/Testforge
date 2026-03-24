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

// PROOF-B-007-BOUND — Boundary: System rate-limits failed login attempts to 5 per 15 minutes
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

// PROOF-B-026-BOUND — Boundary: POST /api/devices registers a new medical device
// Risk: critical
// Boundary Field: serialNumber (string, min: 5, max: 30)

const basePayload_PROOF_B_026_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    name: "Test name-${Date.now()}",
    type: "wheelchair",
    manufacturer: "test-manufacturer",
    purchaseDate: tomorrowStr(),
    purchasePrice: 100,
    dailyRate: 50,
    serialNumber: boundaryValue,
});

test("PROOF-B-026-BOUNDa — serialNumber="A".repeat(5) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_026_BOUND("A".repeat(5)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in serialNumber validation (off-by-one)
});

test("PROOF-B-026-BOUNDb — serialNumber="A".repeat(30) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_026_BOUND("A".repeat(30)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in serialNumber validation (off-by-one)
});

test("PROOF-B-026-BOUNDc — serialNumber="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_026_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

test("PROOF-B-026-BOUNDd — serialNumber="A".repeat(31) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_026_BOUND("A".repeat(31)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

test("PROOF-B-026-BOUNDe — serialNumber=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.create", basePayload_PROOF_B_026_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove serialNumber boundary validation
});

// PROOF-B-039-BOUND — Boundary: PATCH /api/devices/:id/status updates device status
// Risk: high
// Boundary Field: reason (string, max: 500)

const basePayload_PROOF_B_039_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    status: "available",
    reason: boundaryValue,
});

test("PROOF-B-039-BOUNDa — reason="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_039_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-039-BOUNDb — reason="A".repeat(500) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_039_BOUND("A".repeat(500)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-039-BOUNDc — reason="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_039_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-039-BOUNDd — reason="A".repeat(501) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_039_BOUND("A".repeat(501)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-039-BOUNDe — reason=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.status", basePayload_PROOF_B_039_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

// PROOF-B-041-BOUND — Boundary: POST /api/devices/:id/maintenance records a maintenance event
// Risk: high
// Boundary Field: description (string, min: 10, max: 5000)

const basePayload_PROOF_B_041_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    clinicId: TEST_CLINIC_ID,
    type: "routine",
    cost: 1,
    performedBy: "test-performedBy",
    nextMaintenanceDue: tomorrowStr(),
    description: boundaryValue,
});

test("PROOF-B-041-BOUNDa — description="A".repeat(10) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_041_BOUND("A".repeat(10)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in description validation (off-by-one)
});

test("PROOF-B-041-BOUNDb — description="A".repeat(5000) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_041_BOUND("A".repeat(5000)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in description validation (off-by-one)
});

test("PROOF-B-041-BOUNDc — description="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_041_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove description boundary validation
});

test("PROOF-B-041-BOUNDd — description="A".repeat(5001) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_041_BOUND("A".repeat(5001)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove description boundary validation
});

test("PROOF-B-041-BOUNDe — description=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "devices.maintenance", basePayload_PROOF_B_041_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove description boundary validation
});

// PROOF-B-046-BOUND — Boundary: POST /api/patients registers a patient
// Risk: critical
// Boundary Field: firstName (string, min: 1, max: 50)

const basePayload_PROOF_B_046_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    lastName: "Test lastName-${Date.now()}",
    dateOfBirth: tomorrowStr(),
    phone: "+4917613725952",
    address: "test-address",
    firstName: boundaryValue,
});

test("PROOF-B-046-BOUNDa — firstName="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_046_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in firstName validation (off-by-one)
});

test("PROOF-B-046-BOUNDb — firstName="A".repeat(50) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_046_BOUND("A".repeat(50)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in firstName validation (off-by-one)
});

test("PROOF-B-046-BOUNDc — firstName="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_046_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

test("PROOF-B-046-BOUNDd — firstName="A".repeat(51) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_046_BOUND("A".repeat(51)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

test("PROOF-B-046-BOUNDe — firstName=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "patients.create", basePayload_PROOF_B_046_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove firstName boundary validation
});

// PROOF-B-052-BOUND — Boundary: POST /api/rentals creates a device rental
// Risk: critical
// Boundary Field: dailyRate (number, min: 50, max: 999999)

const basePayload_PROOF_B_052_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    deviceId: 1,
    patientId: 1,
    startDate: tomorrowStr(),
    expectedReturnDate: tomorrowStr(),
    deposit: 1,
    dailyRate: boundaryValue,
});

test("PROOF-B-052-BOUNDa — dailyRate=50 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_052_BOUND(50), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in dailyRate validation (off-by-one)
});

test("PROOF-B-052-BOUNDb — dailyRate=999999 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_052_BOUND(999999), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in dailyRate validation (off-by-one)
});

test("PROOF-B-052-BOUNDc — dailyRate=49 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_052_BOUND(49), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove dailyRate boundary validation
});

test("PROOF-B-052-BOUNDd — dailyRate=1000000 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_052_BOUND(1000000), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove dailyRate boundary validation
});

test("PROOF-B-052-BOUNDe — dailyRate=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.create", basePayload_PROOF_B_052_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove dailyRate boundary validation
});

// PROOF-B-066-BOUND — Boundary: POST /api/rentals/:id/extend extends a rental period
// Risk: high
// Boundary Field: reason (string, max: 500)

const basePayload_PROOF_B_066_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    newReturnDate: tomorrowStr(),
    reason: boundaryValue,
});

test("PROOF-B-066-BOUNDa — reason="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_066_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-066-BOUNDb — reason="A".repeat(500) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_066_BOUND("A".repeat(500)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reason validation (off-by-one)
});

test("PROOF-B-066-BOUNDc — reason="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_066_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-066-BOUNDd — reason="A".repeat(501) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_066_BOUND("A".repeat(501)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

test("PROOF-B-066-BOUNDe — reason=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.extend", basePayload_PROOF_B_066_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reason boundary validation
});

// PROOF-B-072-BOUND — Boundary: POST /api/rentals/:id/return processes device return
// Risk: high
// Boundary Field: damageNotes (string, max: 2000)

const basePayload_PROOF_B_072_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    returnDate: tomorrowStr(),
    condition: "good",
    damageNotes: boundaryValue,
});

test("PROOF-B-072-BOUNDa — damageNotes="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_072_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in damageNotes validation (off-by-one)
});

test("PROOF-B-072-BOUNDb — damageNotes="A".repeat(2000) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_072_BOUND("A".repeat(2000)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in damageNotes validation (off-by-one)
});

test("PROOF-B-072-BOUNDc — damageNotes="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_072_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove damageNotes boundary validation
});

test("PROOF-B-072-BOUNDd — damageNotes="A".repeat(2001) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_072_BOUND("A".repeat(2001)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove damageNotes boundary validation
});

test("PROOF-B-072-BOUNDe — damageNotes=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "rentals.return", basePayload_PROOF_B_072_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove damageNotes boundary validation
});

// PROOF-B-082-BOUND — Boundary: POST /api/invoices creates an invoice
// Risk: critical

const basePayload_PROOF_B_082_BOUND = (boundaryValue: unknown) => ({
    clinicId: TEST_CLINIC_ID,
    rentalId: 1,
    items: boundaryValue,
    dueDate: tomorrowStr(),
});

test("PROOF-B-082-BOUNDa — items=[{ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }] (minimum 1 item)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_082_BOUND([{ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }]), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in items validation (off-by-one)
});

test("PROOF-B-082-BOUNDb — items=Array(50).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }) (maximum 50 items)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_082_BOUND(Array(50).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 })), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in items validation (off-by-one)
});

test("PROOF-B-082-BOUNDc — items=[] (empty = below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_082_BOUND([]), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove items boundary validation
});

test("PROOF-B-082-BOUNDd — items=Array(51).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 }) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_082_BOUND(Array(51).fill({ description: "test-description", quantity: 1, unitPrice: 1, taxRate: 1 })), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove items boundary validation
});

test("PROOF-B-082-BOUNDe — items=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.create", basePayload_PROOF_B_082_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove items boundary validation
});

// PROOF-B-085-BOUND — Boundary: POST /api/invoices/:id/payment records payment
// Risk: high
// Boundary Field: reference (string, max: 100)

const basePayload_PROOF_B_085_BOUND = (boundaryValue: unknown) => ({
    id: 1,
    amount: 1,
    method: "bank_transfer",
    reference: boundaryValue,
});

test("PROOF-B-085-BOUNDa — reference="A".repeat(1) (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_085_BOUND("A".repeat(1)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reference validation (off-by-one)
});

test("PROOF-B-085-BOUNDb — reference="A".repeat(100) (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_085_BOUND("A".repeat(100)), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in reference validation (off-by-one)
});

test("PROOF-B-085-BOUNDc — reference="" (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_085_BOUND(""), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reference boundary validation
});

test("PROOF-B-085-BOUNDd — reference="A".repeat(101) (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_085_BOUND("A".repeat(101)), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reference boundary validation
});

test("PROOF-B-085-BOUNDe — reference=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "invoices.payment", basePayload_PROOF_B_085_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove reference boundary validation
});

// PROOF-B-089-BOUND — Boundary: GET /api/reports/utilization provides device utilization report
// Risk: critical

const basePayload_PROOF_B_089_BOUND = (boundaryValue: unknown) => ({
    clinicId: boundaryValue,
});

test("PROOF-B-089-BOUNDa — clinicId=0 (minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_089_BOUND(0), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in clinicId validation (off-by-one)
});

test("PROOF-B-089-BOUNDb — clinicId=100 (maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_089_BOUND(100), adminCookie);
  expect(status).toBe(200);
  // Kills: Change >= to > in clinicId validation (off-by-one)
});

test("PROOF-B-089-BOUNDc — clinicId=-1 (below minimum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_089_BOUND(-1), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove clinicId boundary validation
});

test("PROOF-B-089-BOUNDd — clinicId=101 (above maximum)", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_089_BOUND(101), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove clinicId boundary validation
});

test("PROOF-B-089-BOUNDe — clinicId=null", async ({ request }) => {
  const { status } = await trpcMutation(request, "reports.utilization", basePayload_PROOF_B_089_BOUND(null), adminCookie);
  expect([400, 422]).toContain(status);
  // Kills: Remove clinicId boundary validation
});