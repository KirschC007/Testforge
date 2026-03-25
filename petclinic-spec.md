# PetClinic API — v1.0

## Overview
Online-Terminbuchung für Tierarztpraxen. Jede Praxis (`clinicId`) ist ein isolierter Tenant.
Zwei Rollen: `vet` (Tierarzt, voller Zugriff) und `pet_owner` (Tierbesitzer, eigene Tiere/Termine).

## Authentication
- POST /api/auth/login → JWT + Cookie
- JWT enthält: userId, clinicId, role

## Endpoints

### POST /api/pets
Tier registrieren.
Input: `clinicId` (number), `name` (string, min:1, max:50), `species` (enum: dog|cat|bird|rabbit|reptile), `breed` (string, max:100, optional), `birthDate` (date, must be past), `weight` (number, min:0.1, max:500, kg), `ownerNotes` (string, max:2000, optional)
Auth: pet_owner (eigene), vet
- clinicId muss mit JWT übereinstimmen → 403

### GET /api/pets
Tiere auflisten.
Auth: vet (alle in Praxis), pet_owner (nur eigene)

### POST /api/appointments
Termin buchen.
Input: `clinicId` (number), `petId` (number), `vetId` (number, optional), `dateTime` (datetime, must be future, max 90 days), `reason` (string, min:5, max:500), `urgency` (enum: routine|urgent|emergency)
Auth: pet_owner, vet
- dateTime in der Vergangenheit → 400 PAST_DATE
- dateTime > 90 Tage → 400 TOO_FAR_AHEAD
- Slot bereits gebucht → 409 SLOT_TAKEN
- Pet muss dem Owner gehören → 403 NOT_YOUR_PET
- Concurrent Buchung auf gleichen Slot: eine gewinnt, andere bekommt SLOT_TAKEN

### GET /api/appointments
Termine auflisten.
Auth: vet (alle), pet_owner (eigene)

### PATCH /api/appointments/:id/status
Termin-Status ändern.
Input: `status` (enum), `notes` (string, max:2000, optional)
Auth: vet (alle Transitions), pet_owner (nur cancel)

### DELETE /api/pet-owners/:id/gdpr
DSGVO-Löschung.
Auth: vet only
- ownerName → "[GELÖSCHT]", email → null, phone → null, address → null
- Tiere bleiben erhalten (medizinische Dokumentation)
- Termine bleiben mit anonymisierter Referenz

## Status Machine: appointments
REQUESTED → CONFIRMED → IN_PROGRESS → COMPLETED
REQUESTED → CANCELLED (pet_owner oder vet)
CONFIRMED → CANCELLED (pet_owner: min 24h vorher, vet: jederzeit)
Forbidden: COMPLETED → any (terminal), CANCELLED → CONFIRMED, IN_PROGRESS → REQUESTED

Side-effects:
- → CONFIRMED: confirmationSMS an pet_owner
- → IN_PROGRESS: startedAt = NOW()
- → COMPLETED: completedAt = NOW(), invoice auto-generated
- → CANCELLED: cancelledAt = NOW(), slot wird freigegeben
