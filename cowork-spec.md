# CoworkSpace API — v2.0

## Overview
Multi-tenant coworking space management. Each operator (`operatorId`) runs multiple locations.
Members book desks, meeting rooms, and event spaces across locations.

All prices in EUR cents (integer).

## Authentication
- POST /api/auth/login → JWT containing userId, operatorId, role, locationId (nullable)
- CSRF: X-CSRF-Token required on all mutations

## Roles & Permissions

| Permission | member | community_manager | location_admin | operator_admin |
|---|---|---|---|---|
| Book desk | ✅ any location | ✅ | ✅ own location | ✅ |
| Book meeting room | ✅ any location | ✅ | ✅ own location | ✅ |
| Cancel booking | ✅ own | ✅ any at assigned location | ✅ own location | ✅ |
| View bookings | own | assigned location | own location | all |
| Manage rooms | ❌ | ❌ | ✅ own location | ✅ |
| View members | ❌ | assigned location | own location | all |
| Set pricing | ❌ | ❌ | ❌ | ✅ |
| View revenue | ❌ | ❌ | own location | all |
| GDPR export/delete | ❌ | ❌ | ❌ | ✅ |

## Endpoints

### POST /api/bookings
Book a resource.
Input: `operatorId` (number), `locationId` (number), `resourceType` (enum: desk|meeting_room|event_space), `resourceId` (number), `date` (date, must be future, max 30 days), `timeSlot` (object: { start: string HH:MM, end: string HH:MM }), `attendees` (number, min:1, max:200, required for meeting_room/event_space), `notes` (string, max:500, optional), `recurring` (object optional: { frequency: enum weekly|biweekly|monthly, until: date max 90 days })
Auth: member, community_manager, location_admin, operator_admin
- operatorId must match JWT → 403 OPERATOR_MISMATCH
- Resource must exist at location → 404 RESOURCE_NOT_FOUND
- Time slot conflict → 409 SLOT_CONFLICT
- Booking outside business hours (08:00-22:00) → 422 AUSSERHALB_GESCHAEFTSZEITEN
- attendees > room capacity → 422 KAPAZITAET_UEBERSCHRITTEN
- Max 5 active bookings per member per day → 422 TAGESLIMIT_ERREICHT
- Concurrent booking on same slot: one wins → SLOT_CONFLICT

### GET /api/bookings
List bookings.
Input: `operatorId`, `locationId` (optional for operator_admin), `date` (optional), `resourceType` (optional), `memberId` (optional)
Auth: role-based filtering (see table)

### PATCH /api/bookings/:id/cancel
Cancel booking.
Input: `reason` (string, min:5, max:500)
Auth: member (own, min 2h before), community_manager (assigned location), location_admin (own location), operator_admin (any)
- Already cancelled → 422 BEREITS_STORNIERT
- Member cancelling < 2h before → 422 KURZFRISTIGE_STORNIERUNG (50% Gebühr)
- No-show after booking time → automatic status change to NO_SHOW

### POST /api/rooms
Create or update room.
Input: `operatorId` (number), `locationId` (number), `name` (string, min:2, max:100), `type` (enum: desk|meeting_room|event_space), `capacity` (number, min:1, max:500), `hourlyRate` (number, cents, min:0, max:9999999), `amenities` (array of strings, max:20), `isActive` (boolean, default:true)
Auth: location_admin (own location), operator_admin

### GET /api/rooms
List rooms.
Input: `operatorId`, `locationId`, `type` (optional), `available` (boolean, optional — check against date+timeSlot), `minCapacity` (number, optional)
Auth: all roles (member sees only active rooms)

### GET /api/members
List members.
Auth: community_manager (assigned location), location_admin (own location), operator_admin (all)
- member → 403 INSUFFICIENT_ROLE

### POST /api/invoices
Generate monthly invoice for member.
Input: `operatorId` (number), `memberId` (number), `month` (string, YYYY-MM), `lineItems` (array of: { description: string, amount: number cents, taxRate: number 0-100 default:19 })
Auth: operator_admin
- Duplicate invoice per member+month → 409 DUPLICATE_INVOICE

### GET /api/reports/revenue
Revenue report.
Output: per location per month: totalBookings, revenue, occupancyRate, topResources
Auth: location_admin (own location), operator_admin (all)

### DELETE /api/members/:id/gdpr
GDPR erasure.
Auth: operator_admin
- memberName → "[REDACTED]", email → null, phone → null, company → null
- Bookings retained with anonymized reference
- Active bookings prevent deletion → 422 ACTIVE_BOOKINGS_EXIST

## Status Machine: bookings

booked → confirmed → checked_in → completed
booked → cancelled
confirmed → cancelled (min 2h before)
confirmed → no_show (automatic after 30 min no check-in)

Forbidden:
- completed → any (terminal)
- cancelled → booked (must rebook)
- no_show → checked_in

Side-effects:
- → confirmed: confirmation email sent
- → checked_in: checkedInAt = NOW()
- → completed: duration calculated, billing updated
- → cancelled: slot freed, refund if applicable
- → no_show: noShowAt = NOW(), member.noShowCount++, if noShowCount >= 3 → member suspended for 7 days
