# BankCore API — System Specification v2.1

## 1. Überblick

BankCore ist eine mandantenfähige Banking-API für Finanzinstitute. Sie verwaltet Konten, Transaktionen, Überweisungen und Compliance-Daten für mehrere Banken (Tenants) gleichzeitig. Jede Bank hat eigene Kunden, Konten und Mitarbeiter.

**Tenant-Modell:** Jede Ressource gehört zu einer `bankId`. Alle Queries MÜSSEN durch `bankId` gefiltert werden. Cross-Tenant-Zugriff ist ein kritischer Sicherheitsfehler.

**Rollen:**
- `super_admin` — plattformweiter Admin, kann alle Banken verwalten
- `bank_admin` — Admin einer einzelnen Bank (bankId-gebunden)
- `teller` — Kassierer, kann Transaktionen erstellen und Konten einsehen
- `auditor` — Nur-Lese-Zugriff auf alle Daten der eigenen Bank
- `customer` — Endkunde, sieht nur eigene Konten und Transaktionen

---

## 2. Authentifizierung & Session-Management

### 2.1 Login
- `POST /api/trpc/auth.login` — Credentials: `{ email, password, bankId }`
- Bei Erfolg: JWT-Cookie (httpOnly, secure, sameSite=strict), Ablauf 8h
- Bei 5 Fehlversuchen innerhalb 10 Minuten: Account für 30 Minuten sperren (Lockout)
- Lockout-Status MUSS in DB persistiert werden (nicht nur in-memory)
- Passwort-Policy: min. 12 Zeichen, mind. 1 Großbuchstabe, 1 Zahl, 1 Sonderzeichen
- CSRF-Token MUSS bei jedem State-ändernden Request mitgesendet werden

### 2.2 Logout
- `POST /api/trpc/auth.logout` — invalidiert Session-Cookie und DB-Session
- Alle aktiven Sessions eines Users können via `auth.logoutAll` beendet werden

### 2.3 CSRF-Schutz
- `GET /api/trpc/auth.csrfToken` — gibt CSRF-Token zurück
- Alle POST/PUT/DELETE-Requests MÜSSEN `X-CSRF-Token` Header enthalten
- Token ist an Session gebunden, Rotation nach jedem Login

---

## 3. Konten-Management

### 3.1 Konto erstellen
- `POST /api/trpc/accounts.create`
- Felder: `{ bankId, customerId, accountType, currency, initialDeposit? }`
- `accountType`: enum `["checking", "savings", "business", "escrow"]`
- `currency`: ISO 4217, enum `["EUR", "USD", "GBP", "CHF"]`
- `initialDeposit`: optional, min 0.01, max 1_000_000.00, 2 Dezimalstellen
- Nur `bank_admin` und `teller` dürfen Konten erstellen
- `customer` darf keine Konten erstellen
- `bankId` im Body MUSS mit `bankId` aus JWT übereinstimmen (IDOR-Schutz)

### 3.2 Konto abrufen
- `GET /api/trpc/accounts.get?input={"json":{"accountId":"..."}}`
- Nur eigene Konten für `customer`; alle Konten der Bank für `teller`/`bank_admin`
- Gibt zurück: `{ id, bankId, customerId, accountType, currency, balance, status, createdAt }`
- `status`: enum `["active", "frozen", "closed", "pending_review"]`

### 3.3 Konto-Liste
- `GET /api/trpc/accounts.list?input={"json":{"bankId":"...","page":1,"pageSize":20}}`
- Pagination: max pageSize 100
- Filter: `status`, `accountType`, `customerId`
- `auditor` und `bank_admin` sehen alle Konten der Bank
- `customer` sieht nur eigene Konten — bankId-Filter MUSS serverseitig erzwungen werden

---

## 4. Transaktionen

### 4.1 Transaktion erstellen
- `POST /api/trpc/transactions.create`
- Felder: `{ bankId, fromAccountId, toAccountId, amount, currency, reference?, metadata? }`
- `amount`: positiv, min 0.01, max 10_000_000.00
- `reference`: optional, max 140 Zeichen, nur alphanumerisch + Leerzeichen + Bindestriche
- `metadata`: optional JSON-Objekt, max 1KB
- Validierungen:
  - `fromAccountId` MUSS zur `bankId` des Requesters gehören
  - `fromAccount.status` MUSS `active` sein (frozen/closed → 403)
  - `fromAccount.balance >= amount` (Überziehungsschutz)
  - Atomare Buchung: Debit + Credit in einer DB-Transaktion
  - Bei Fehler: vollständiger Rollback, kein Partial-Debit
- Idempotenz: `X-Idempotency-Key` Header (UUID), doppelte Requests innerhalb 24h werden dedupliziert
- Side-Effects nach erfolgreicher Buchung:
  - `fromAccount.balance` dekrementieren
  - `toAccount.balance` inkrementieren
  - Audit-Log-Eintrag erstellen (`audit_logs` Tabelle)
  - Notification an Kunden senden (async, non-blocking)

### 4.2 Transaktion abrufen
- `GET /api/trpc/transactions.get`
- `customer` sieht nur Transaktionen eigener Konten
- `auditor`/`teller`/`bank_admin` sehen alle Transaktionen der Bank

### 4.3 Transaktions-Liste
- `GET /api/trpc/transactions.list`
- Filter: `fromAccountId`, `toAccountId`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`
- Pagination: max pageSize 500
- Sortierung: `createdAt` DESC default

---

## 5. Überweisungen (Wire Transfers)

### 5.1 Überweisung initiieren
- `POST /api/trpc/transfers.initiate`
- Felder: `{ bankId, fromAccountId, toBankId, toIban, amount, currency, purpose }`
- `purpose`: SEPA-Verwendungszweck, max 140 Zeichen
- `toIban`: IBAN-Validierung (Checksum-Prüfung)
- Status-Flow: `pending` → `processing` → `completed` | `failed` | `rejected`
- Nur `teller` und `bank_admin` dürfen Überweisungen initiieren
- Betragslimit: `teller` max 50_000 EUR pro Überweisung; `bank_admin` max 500_000 EUR
- Überweisungen über 10_000 EUR: automatische AML-Flag (Anti-Money-Laundering)
- AML-Flag: Status bleibt `pending`, `auditor` muss manuell freigeben

### 5.2 Überweisung freigeben (AML-Review)
- `POST /api/trpc/transfers.approve`
- Nur `auditor` und `bank_admin` dürfen freigeben
- `teller` darf NICHT freigeben (auch nicht eigene Überweisungen)
- Freigabe setzt Status auf `processing`, triggert externe Zahlung

### 5.3 Überweisung ablehnen
- `POST /api/trpc/transfers.reject`
- `reason`: Pflichtfeld, min 10 Zeichen
- Ablehnung setzt Status auf `rejected`, Betrag wird zurückgebucht

---

## 6. Compliance & DSGVO

### 6.1 Audit-Log
- Jede State-ändernde Operation MUSS in `audit_logs` protokolliert werden
- Felder: `{ id, bankId, userId, action, resourceType, resourceId, oldValue, newValue, ip, userAgent, createdAt }`
- Audit-Logs sind immutable (kein Update/Delete)
- Retention: 10 Jahre

### 6.2 DSGVO-Export
- `GET /api/trpc/compliance.gdprExport`
- Nur `bank_admin` und `super_admin`
- Exportiert alle personenbezogenen Daten eines Kunden als JSON
- Antwortzeit max 30 Sekunden (async Job bei großen Datensätzen)

### 6.3 DSGVO-Löschung
- `POST /api/trpc/compliance.gdprDelete`
- Anonymisiert PII-Felder: `name`, `email`, `phone`, `address`, `dateOfBirth`
- Transaktionsdaten bleiben erhalten (Compliance), aber ohne PII-Referenz
- Nur `bank_admin` und `super_admin`

### 6.4 PII-Felder
- `customers`: `name`, `email`, `phone`, `address`, `dateOfBirth`, `taxId`
- `accounts`: kein PII direkt, aber Referenz auf `customerId`

---

## 7. Rate Limiting & DoS-Schutz

- Login: max 5 Requests/Minute pro IP
- Alle anderen Endpoints: max 100 Requests/Minute pro User
- Überschreitung: HTTP 429, `Retry-After` Header
- Rate-Limit-Counter MUSS in Redis/DB persistiert werden (nicht in-memory)

---

## 8. Fehler-Codes

| Code | Bedeutung |
|---|---|
| `UNAUTHORIZED` | Kein gültiger JWT |
| `FORBIDDEN` | Keine Berechtigung für diese Ressource |
| `NOT_FOUND` | Ressource existiert nicht oder gehört anderer Bank |
| `VALIDATION_ERROR` | Eingabe-Validierung fehlgeschlagen |
| `INSUFFICIENT_FUNDS` | Kontostand zu niedrig |
| `ACCOUNT_FROZEN` | Konto ist eingefroren |
| `DUPLICATE_IDEMPOTENCY_KEY` | Idempotenz-Duplikat erkannt |
| `AML_HOLD` | Überweisung wegen AML-Flag gesperrt |
| `RATE_LIMIT_EXCEEDED` | Rate Limit überschritten |
| `LOCKOUT` | Account gesperrt nach zu vielen Fehlversuchen |

---

## 9. Invarianten (systemweite Regeln)

1. `account.balance` darf NIEMALS negativ werden
2. Jede Buchung MUSS atomar sein (Debit + Credit in einer Transaktion)
3. Jede State-Änderung MUSS einen Audit-Log-Eintrag erzeugen
4. Cross-Tenant-Zugriff ist unter allen Umständen verboten
5. `frozen` oder `closed` Konten dürfen keine Transaktionen empfangen oder senden
6. AML-Flagged Überweisungen dürfen nicht automatisch verarbeitet werden
7. Idempotenz-Keys verhindern Doppelbuchungen bei Netzwerk-Retries
8. Passwort-Hashes MÜSSEN bcrypt/argon2 sein (kein MD5/SHA1)
9. Alle Datenbankzugriffe MÜSSEN parametrisierte Queries verwenden (kein String-Concatenation)
10. JWT-Secrets dürfen nicht im Code hardcoded sein
