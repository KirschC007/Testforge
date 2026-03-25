# MediTrack — Arztpraxis-Verwaltung API v3.2

## Überblick

Webbasierte Verwaltung für Arztpraxen mit Terminbuchung, Patientenakte, Rezeptverwaltung und Abrechnung.
Jede Praxis hat eine eigene `praxisId`. Alle Daten einer Praxis sind strikt getrennt.

Geldbeträge in EUR-Cent (Integer). Gewichte in Milligramm (Integer).

## Authentifizierung

- POST /api/auth/login → JWT + httpOnly Cookie
- GET /api/auth/csrf-token → CSRF Double-Submit-Cookie
- JWT enthält: userId, praxisId, rolle
- Rate-Limit: 5 Fehlversuche → 15 Minuten Sperre, danach eskalierend

## Rollen

Die Benutzerrollen sind über verschiedene Kapitel verteilt beschrieben:

In Kapitel 3 wird erwähnt dass `arzt` volle medizinische Rechte hat und Rezepte ausstellen darf.
In Kapitel 4 steht, dass `mfa` (Medizinische Fachangestellte) Termine verwaltet und Patienten aufnimmt.
In Kapitel 6 wird `praxis_admin` beschrieben — verwaltet Mitarbeiter, Abrechnungen, DSGVO.
Kapitel 7 erwähnt `patient` — sieht eigene Termine und Befunde über das Patientenportal.

## Kapitel 3: Patienten & Medizin

### POST /api/patienten
Patient anlegen.
Input: `praxisId` (number), `vorname` (string, min:1, max:50), `nachname` (string, min:1, max:50), `geburtsdatum` (date, muss in Vergangenheit liegen), `versicherungsnummer` (string, exakt 10 Zeichen, unique pro Praxis), `versicherungsart` (enum: gesetzlich|privat|selbstzahler), `geschlecht` (enum: männlich|weiblich|divers), `telefon` (string, max:20), `email` (string, optional), `adresse` (object: { straße: string, plz: string 5 Zeichen, ort: string }), `allergien` (array of strings, optional), `vorerkrankungen` (string, max:5000, optional), `notfallkontakt` (object: { name: string, telefon: string, beziehung: string })
Auth: mfa, arzt, praxis_admin
- versicherungsnummer muss pro Praxis eindeutig sein → 409 VERSICHERUNGSNUMMER_EXISTIERT
- praxisId muss mit JWT übereinstimmen → 403 PRAXIS_MISMATCH

### GET /api/patienten
Patienten auflisten.
Auth: arzt (alle in Praxis), mfa (alle in Praxis), patient (nur eigener Datensatz), praxis_admin (alle)

### GET /api/patienten/:id
Patientendetails.
Auth: arzt, mfa, patient (nur eigener), praxis_admin
- patient darf NICHT sehen: `vorerkrankungen` und interne Notizen (→ Feld wird aus Response entfernt)
- arzt sieht alles

### POST /api/termine
Termin buchen.
Input: `praxisId` (number), `patientId` (number), `arztId` (number), `datum` (date, must be future, max 180 Tage), `uhrzeit` (string, HH:MM, muss in Sprechstundenzeit 08:00-18:00 liegen), `dauer` (number, Minuten, enum: 15|30|45|60), `terminart` (enum: erstgespräch|kontrolltermin|akuttermin|vorsorge|impfung), `beschreibung` (string, max:1000, optional)
Auth: mfa, arzt, patient (nur für sich selbst)
- Slot bereits belegt → 409 TERMIN_BELEGT
- Arzt hat an dem Tag frei (Urlaubskalender) → 422 ARZT_NICHT_VERFÜGBAR
- Patient darf max 3 offene Termine gleichzeitig haben → 422 TERMINLIMIT_ERREICHT
- Concurrent Buchung auf gleichen Slot: eine gewinnt → TERMIN_BELEGT
- Akuttermin überspringt Warteliste aber kostet doppelt für Selbstzahler

### PATCH /api/termine/:id/status
Terminstatus ändern.
Input: `status` (enum), `notiz` (string, max:2000, optional, Pflicht bei absage_praxis)
Auth: arzt (alle Transitions), mfa (bestätigen, absagen), patient (nur eigene absage, min 24h vorher)

### POST /api/rezepte
Rezept ausstellen.
Input: `praxisId` (number), `patientId` (number), `medikament` (string, min:3, max:200), `wirkstoff` (string, min:3, max:200), `dosierung` (string, min:3, max:100, z.B. "500mg 1-0-1"), `menge` (number, min:1, max:10), `packungsgroesse` (enum: N1|N2|N3), `btm` (boolean, default:false — Betäubungsmittel), `wiederholung` (number, min:0, max:3, default:0)
Auth: NUR arzt (mfa darf NICHT)
- btm=true → doppelte Dokumentationspflicht, maximal 7 Tage Verschreibung
- Patient muss Allergie-Check bestehen → 422 ALLERGIE_WARNUNG (wenn Wirkstoff in Allergie-Liste)
- Max 3 BTM-Rezepte pro Patient pro Monat → 422 BTM_LIMIT
- Rezept generiert automatisch eine Rezept-ID im Format: RZ-{YYYY}-{laufendeNummer}

### GET /api/rezepte
Rezepte auflisten.
Auth: arzt (alle), mfa (alle in Praxis, ohne Wirkstoff-Details bei BTM), patient (eigene, ohne BTM-Details)

### POST /api/befunde
Befund anlegen.
Input: `praxisId` (number), `patientId` (number), `terminId` (number, optional), `typ` (enum: labor|bildgebung|untersuchung|überweisung), `titel` (string, min:5, max:200), `inhalt` (string, min:20, max:50000), `icd10` (string, optional, max:10, ICD-10-Code), `vertraulich` (boolean, default:false)
Auth: arzt, praxis_admin
- vertraulich=true → nur der ausstellende Arzt und praxis_admin können lesen
- patient darf Befunde erst nach Freigabe durch Arzt sehen (befund.freigegeben=true)

## Kapitel 4: Termine

### Status-Machine: termine

angefragt → bestätigt → patient_da → in_behandlung → abgeschlossen
angefragt → absage_patient (patient, min 24h vorher)
angefragt → absage_praxis (arzt/mfa, notiz Pflicht)
bestätigt → absage_patient (min 24h vorher)
bestätigt → absage_praxis
bestätigt → patient_da (mfa checkt Patient ein)
patient_da → in_behandlung (arzt startet Behandlung)
in_behandlung → abgeschlossen (arzt beendet)
bestätigt → nicht_erschienen (automatisch 30 Min nach Terminzeit)

Verbotene Übergänge:
- abgeschlossen → jeder Status (terminal)
- absage_patient → bestätigt (muss neu buchen)
- absage_praxis → bestätigt (muss neu buchen)
- nicht_erschienen → patient_da
- in_behandlung → angefragt (kein Zurücksetzen)

Nebeneffekte:
- → bestätigt: bestaetigtAm = JETZT, Bestätigungs-SMS an Patient
- → patient_da: eincheckZeit = JETZT
- → in_behandlung: behandlungStart = JETZT
- → abgeschlossen: behandlungEnde = JETZT, Dauer berechnet, Abrechnungsposten erstellt
- → absage_patient: absageZeit = JETZT, Slot freigegeben
- → absage_praxis: absageZeit = JETZT, absageGrund = notiz, Slot freigegeben
- → nicht_erschienen: nichtErschienen = true, noShowCount++, wenn noShowCount >= 3 → Patient gesperrt für 30 Tage

## Kapitel 5: Abrechnung

### POST /api/abrechnungen
Abrechnungsposten erstellen.
Input: `praxisId` (number), `patientId` (number), `terminId` (number), `leistungen` (array min:1 max:20 of: { `goaeNr` (string, GOÄ-Nummer), `faktor` (number, min:1.0, max:3.5, default:2.3), `anzahl` (number, min:1, max:10) }), `diagnose` (string, min:5, max:500)
Auth: arzt, praxis_admin
- Termin muss Status "abgeschlossen" haben → 422 TERMIN_NICHT_ABGESCHLOSSEN
- Doppelte Abrechnung pro Termin → 409 BEREITS_ABGERECHNET
- Gesamtbetrag = Summe(goaeNr.basispreis × faktor × anzahl)

### GET /api/abrechnungen
Abrechnungen einsehen.
Auth: arzt (alle), praxis_admin (alle), patient (eigene, mit Gesamtbetrag aber ohne GOÄ-Details)

### GET /api/berichte/umsatz
Umsatzbericht pro Monat.
Output: Gesamtumsatz, nach Versicherungsart aufgeschlüsselt, Top-10-Leistungen, Durchschnitt pro Patient
Auth: praxis_admin

## Kapitel 6: DSGVO

### DELETE /api/patienten/:id/dsgvo
DSGVO-Löschung.
Auth: praxis_admin
- vorname → "[GELÖSCHT]", nachname → "[GELÖSCHT]", geburtsdatum → null
- versicherungsnummer → "[REDACTED]", telefon → null, email → null
- adresse → null, allergien → [], notfallkontakt → null
- Befunde bleiben (ärztliche Aufbewahrungspflicht 10 Jahre)
- Abrechnungen bleiben (steuerliche Aufbewahrungspflicht 10 Jahre)
- Offene Termine verhindern Löschung → 422 OFFENE_TERMINE_VORHANDEN

### GET /api/patienten/:id/dsgvo-export
DSGVO-Datenexport (alle Daten des Patienten als JSON).
Auth: praxis_admin, patient (nur eigene Daten)

## Fehler-Codes

| Code | HTTP | Bedeutung |
|---|---|---|
| PRAXIS_MISMATCH | 403 | Cross-Tenant-Zugriff |
| VERSICHERUNGSNUMMER_EXISTIERT | 409 | Doppelte Versicherungsnummer |
| TERMIN_BELEGT | 409 | Slot bereits gebucht |
| ARZT_NICHT_VERFÜGBAR | 422 | Arzt hat frei/Urlaub |
| TERMINLIMIT_ERREICHT | 422 | Max 3 offene Termine |
| ALLERGIE_WARNUNG | 422 | Wirkstoff in Allergie-Liste |
| BTM_LIMIT | 422 | Max 3 BTM-Rezepte/Monat |
| TERMIN_NICHT_ABGESCHLOSSEN | 422 | Abrechnung für offenen Termin |
| BEREITS_ABGERECHNET | 409 | Doppelte Abrechnung |
| OFFENE_TERMINE_VORHANDEN | 422 | DSGVO-Löschung bei offenen Terminen |

## UI Pages

- /login — Login-Seite
- /dashboard — Tagesübersicht: heutige Termine, offene Befunde
- /patienten — Patientenliste
- /patienten/neu — Patient anlegen
- /patienten/:id — Patientenakte
- /termine — Terminkalender
- /termine/neu — Termin buchen
- /rezepte — Rezeptübersicht
- /rezepte/neu — Rezept ausstellen
- /abrechnung — Abrechnungsübersicht
- /berichte — Umsatzberichte
