# ResearchLab API — Specification v3.0

## Overview
Multi-tenant research laboratory management platform. Each institution (`institutionId`) is isolated.
Manages research projects, equipment reservations, experiment logs, and grant budgets.

All monetary values in EUR cents (integer).

## Authentication
- POST /api/auth/login → JWT with userId, institutionId, role
- CSRF required on all mutations
- Rate limit: 5 failed attempts per 15 min → 429

## Roles & Permissions

| Permission | researcher | lab_technician | principal_investigator | grants_officer | institution_admin |
|---|---|---|---|---|---|
| Create project | ❌ | ❌ | ✅ | ❌ | ✅ |
| View projects | own/assigned | assigned lab | own + supervised | all | all |
| Reserve equipment | ✅ (approved projects only) | ✅ own lab | ✅ | ❌ | ✅ |
| Log experiment | ✅ own projects | ✅ assisted | ✅ own projects | ❌ | ✅ |
| Approve experiment | ❌ | ❌ | ✅ own projects | ❌ | ✅ |
| Submit grant application | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve grant | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage equipment | ❌ | ✅ own lab | ❌ | ❌ | ✅ |
| View budgets | own project | ❌ | own projects | all | all |
| GDPR | ❌ | ❌ | ❌ | ❌ | ✅ |

## Endpoints

### POST /api/projects
Create research project.
Input: `institutionId` (number), `title` (string, min:5, max:200), `description` (string, min:50, max:10000), `principalInvestigatorId` (number), `researchArea` (enum: BIOLOGY|CHEMISTRY|PHYSICS|COMPUTER_SCIENCE|ENGINEERING|MEDICINE), `startDate` (date, must be future), `endDate` (date, must be after startDate, max 5 years), `estimatedBudget` (number, cents)
Auth: principal_investigator, institution_admin
- institutionId must match JWT → 403 INSTITUTION_MISMATCH
- endDate must be after startDate → 400 INVALID_DATE_RANGE
- Duration > 5 years → 400 PROJECT_TOO_LONG

### GET /api/projects
List projects. Auth: role-based filtering.

### PATCH /api/projects/:id/status
Change project status. Auth: depends on transition.

### POST /api/equipment
Register equipment.
Input: `institutionId` (number), `name` (string, min:2, max:200), `labId` (number), `serialNumber` (string, unique per institution), `category` (enum: MICROSCOPE|SPECTROMETER|CENTRIFUGE|SEQUENCER|REACTOR|COMPUTING_CLUSTER|OTHER), `hourlyRate` (number, cents, min:0), `maintenanceSchedule` (enum: WEEKLY|MONTHLY|QUARTERLY|ANNUAL), `safetyLevel` (enum: STANDARD|RESTRICTED|HAZARDOUS), `certificationRequired` (boolean, default:false)
Auth: lab_technician (own lab), institution_admin
- serialNumber unique → 409 SERIAL_EXISTS

### GET /api/equipment
List equipment. Auth: all roles (lab_technician sees own lab, researcher sees available for their projects).

### POST /api/reservations
Reserve equipment.
Input: `institutionId` (number), `equipmentId` (number), `projectId` (number), `date` (date, must be future, max 60 days), `timeSlot` (object: { start: string HH:MM, end: string HH:MM }), `purpose` (string, min:10, max:1000), `assistantRequired` (boolean, default:false)
Auth: researcher (approved projects only), lab_technician, principal_investigator, institution_admin
- Equipment must be OPERATIONAL → 422 EQUIPMENT_NOT_AVAILABLE
- Time slot conflict → 409 RESERVATION_CONFLICT
- Project must be ACTIVE → 422 PROJECT_NOT_ACTIVE
- If safetyLevel=HAZARDOUS and user lacks certification → 403 CERTIFICATION_REQUIRED
- If safetyLevel=RESTRICTED and project not approved for restricted equipment → 403 RESTRICTED_ACCESS
- Concurrent reservation on same slot: one wins → RESERVATION_CONFLICT
- Max 3 active reservations per researcher per day → 422 DAILY_LIMIT
- Side-effects: equipment.status → RESERVED for that slot

### POST /api/experiments
Log experiment.
Input: `institutionId` (number), `projectId` (number), `equipmentId` (number, optional), `title` (string, min:5, max:200), `protocol` (string, min:100, max:50000), `results` (string, min:20, max:50000), `dataFiles` (array of URLs, max:20), `materialsUsed` (array of: { name: string, quantity: number, unit: string, cost: number cents }, max:50), `conclusion` (enum: SUCCESSFUL|PARTIALLY_SUCCESSFUL|FAILED|INCONCLUSIVE)
Auth: researcher (own projects), lab_technician (assisted), principal_investigator
- Project must be ACTIVE → 422 PROJECT_NOT_ACTIVE
- Sum of materialsUsed.cost must not exceed remaining project budget → 422 BUDGET_EXCEEDED
- Side-effects: project.usedBudget += totalMaterialsCost

### PATCH /api/experiments/:id/approve
Approve experiment log.
Input: `approved` (boolean), `reviewNotes` (string, min:10, max:5000)
Auth: principal_investigator (own projects), institution_admin
- Only PENDING experiments can be approved → 422 ALREADY_REVIEWED

### POST /api/grants
Submit grant application.
Input: `institutionId` (number), `projectId` (number), `grantBody` (string, min:5, max:200), `requestedAmount` (number, cents, min:100000, max:99999999999), `justification` (string, min:200, max:20000), `timeline` (string, min:50, max:5000)
Auth: principal_investigator, institution_admin
- Project must be APPROVED or ACTIVE → 422 PROJECT_NOT_ELIGIBLE
- Max 1 pending grant per project → 409 GRANT_ALREADY_PENDING

### PATCH /api/grants/:id/decision
Grant decision.
Input: `decision` (enum: APPROVED|PARTIALLY_APPROVED|REJECTED), `approvedAmount` (number, required if APPROVED/PARTIALLY_APPROVED), `conditions` (string, max:5000, optional), `reviewNotes` (string, min:10, max:5000)
Auth: grants_officer, institution_admin
- Grant must be SUBMITTED → 422 GRANT_NOT_SUBMITTED
- approvedAmount > requestedAmount → 400 AMOUNT_EXCEEDS_REQUEST
- Side-effects: if APPROVED → project.budget += approvedAmount

### GET /api/reports/budget
Budget report per project.
Output: totalBudget, usedBudget, grantsFunded, remainingBudget, burnRate
Auth: principal_investigator (own), grants_officer (all), institution_admin (all)

### DELETE /api/researchers/:id/gdpr
GDPR erasure.
Auth: institution_admin
- researcherName → "[REDACTED]", email → null, phone → null, orcidId → "[REDACTED]"
- Experiment logs retained (scientific record)
- Active projects prevent deletion → 422 ACTIVE_PROJECTS_EXIST

## Status Machine: projects
PROPOSED → APPROVED → ACTIVE → COMPLETED
PROPOSED → REJECTED
ACTIVE → SUSPENDED (admin, funding issue)
SUSPENDED → ACTIVE (funding restored)
ACTIVE → COMPLETED (all experiments done)
Forbidden: COMPLETED → any, REJECTED → APPROVED, SUSPENDED → COMPLETED

Side-effects:
- → APPROVED: approvedAt, approvedBy, budget allocated
- → ACTIVE: startedAt
- → SUSPENDED: suspendedAt, suspensionReason
- → COMPLETED: completedAt, final report required

## Status Machine: reservations
REQUESTED → CONFIRMED → IN_USE → COMPLETED
REQUESTED → REJECTED (lab_technician, equipment issue)
CONFIRMED → CANCELLED (researcher, min 4h before)
Forbidden: COMPLETED → any, CANCELLED → CONFIRMED, IN_USE → REQUESTED

Side-effects:
- → CONFIRMED: slot locked
- → IN_USE: startedAt, equipment.status → IN_USE
- → COMPLETED: endedAt, equipment.status → OPERATIONAL
- → CANCELLED: slot freed

## Status Machine: grants
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/PARTIALLY_APPROVED/REJECTED
UNDER_REVIEW → ADDITIONAL_INFO_REQUESTED → UNDER_REVIEW
Forbidden: APPROVED → REJECTED, REJECTED → APPROVED

Side-effects:
- → SUBMITTED: submittedAt
- → UNDER_REVIEW: reviewStartedAt, assignedReviewer
- → APPROVED: approvedAt, project.budget += approvedAmount
- → REJECTED: rejectedAt, rejectionReason

## Business Rules
- Equipment maintenance: if days since lastMaintenance > schedule threshold → equipment.status = MAINTENANCE_DUE, cannot be reserved
- Budget burn rate alert: if usedBudget/totalBudget > 80% → notify principal_investigator
- Experiment approval SLA: principal_investigator must approve within 14 days → auto-escalate to institution_admin

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| INSTITUTION_MISMATCH | 403 | Cross-tenant access |
| INVALID_DATE_RANGE | 400 | End before start |
| PROJECT_TOO_LONG | 400 | > 5 years |
| SERIAL_EXISTS | 409 | Duplicate serial number |
| EQUIPMENT_NOT_AVAILABLE | 422 | Equipment not operational |
| RESERVATION_CONFLICT | 409 | Time slot taken |
| PROJECT_NOT_ACTIVE | 422 | Project not in ACTIVE state |
| CERTIFICATION_REQUIRED | 403 | Hazardous equipment without cert |
| RESTRICTED_ACCESS | 403 | Restricted equipment, project not approved |
| DAILY_LIMIT | 422 | Max 3 reservations per day |
| BUDGET_EXCEEDED | 422 | Materials cost > remaining budget |
| ALREADY_REVIEWED | 422 | Experiment already approved/rejected |
| PROJECT_NOT_ELIGIBLE | 422 | Project not APPROVED/ACTIVE for grant |
| GRANT_ALREADY_PENDING | 409 | One pending grant per project |
| GRANT_NOT_SUBMITTED | 422 | Decision on non-submitted grant |
| AMOUNT_EXCEEDS_REQUEST | 400 | Approved > requested |
| ACTIVE_PROJECTS_EXIST | 422 | GDPR delete with active projects |
| INVALID_TRANSITION | 422 | Invalid status transition |

## GDPR
- DELETE /api/researchers/:id/gdpr — 4 PII fields
- GET /api/researchers/:id/export — full data export
