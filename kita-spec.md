# KiTa-Portal — API-Spezifikation v1.0

## Systemzweck

Online-Verwaltung für Kindertagesstätten. Jede KiTa hat eine eigene `kitaId`.
Alle Daten einer KiTa sind strikt getrennt von anderen KiTas.

## Benutzer

Es gibt vier Benutzerrollen im System:

In Kapitel 3 (Kinder) ist beschrieben, dass `kita_leitung` volle Rechte hat.
In Kapitel 4 (Gruppen) steht, dass `erzieher` nur eigene Gruppe sehen darf.
In Kapitel 5 (Anwesenheit) wird `elternteil` erwähnt — sieht nur eigenes Kind.
In Kapitel 7 (Verwaltung) gibt es `verwaltung` — Abrechnungen und Berichte.

## Kapitel 3: Kinder

### POST /api/kinder
Kind anlegen.
Input: `kitaId` (number), `vorname` (string, min:1, max:50), `nachname` (string, min:1, max:50), `geburtsdatum` (date, muss in der Vergangenheit liegen), `gruppeId` (number), `allergien` (string, max:2000, optional), `besonderheiten` (string, max:2000, optional), `notfallkontakt` (string, min:5, max:200), `abholberechtigt` (array of strings, min:1, max:10)
Auth: kita_leitung, verwaltung

### GET /api/kinder
Kinder auflisten.
Auth: kita_leitung (alle), erzieher (nur eigene Gruppe), elternteil (nur eigenes Kind)

### GET /api/kinder/:id
Kind-Details.
Auth: kita_leitung, erzieher (eigene Gruppe), elternteil (eigenes Kind)
- Allergien und Besonderheiten nur für kita_leitung und erzieher sichtbar
- elternteil sieht keine medizinischen Daten anderer Kinder

## Kapitel 4: Gruppen

### POST /api/gruppen
Gruppe erstellen.
Input: `kitaId` (number), `name` (string, min:2, max:100), `maxKinder` (number, min:5, max:30), `betreuer` (array of number — erzieher-IDs, min:1, max:5)
Auth: kita_leitung
- maxKinder darf 30 nicht überschreiten (gesetzliche Vorgabe) → 422 MAX_KINDER_UEBERSCHRITTEN

### GET /api/gruppen
Gruppen auflisten.
Auth: kita_leitung (alle), erzieher (eigene), verwaltung (alle ohne Kinder-Details)

## Kapitel 5: Anwesenheit

### POST /api/anwesenheit
Anwesenheit erfassen.
Input: `kitaId` (number), `kindId` (number), `datum` (date, heute oder Vergangenheit, max 7 Tage zurück), `status` (enum: anwesend|abwesend_entschuldigt|abwesend_unentschuldigt|krank), `ankunft` (time, optional), `abholung` (time, optional), `abholer` (string, max:100, optional), `notizen` (string, max:500, optional)
Auth: erzieher (eigene Gruppe), kita_leitung
- Doppelter Eintrag pro Kind+Tag → 409 BEREITS_ERFASST
- Kind muss zur Gruppe des Erziehers gehören → 403 NICHT_IHRE_GRUPPE

### GET /api/anwesenheit
Anwesenheitsliste.
Auth: kita_leitung (alle), erzieher (eigene Gruppe), elternteil (eigenes Kind)

## Kapitel 6: Buchungs-Status

Ein Betreuungsplatz durchläuft diese Zustände:

angefragt → vorgemerkt → bestätigt → aktiv → gekündigt
angefragt → abgelehnt

Erlaubte Übergänge:
- angefragt → vorgemerkt (kita_leitung prüft Unterlagen)
- angefragt → abgelehnt (kita_leitung, Begründung Pflicht)
- vorgemerkt → bestätigt (kita_leitung bestätigt Platz)
- bestätigt → aktiv (Kind beginnt Betreuung, automatisch am Startdatum)
- aktiv → gekündigt (elternteil oder kita_leitung, Kündigungsfrist 4 Wochen)

Verbotene Übergänge:
- abgelehnt → bestätigt (muss neu anfragen)
- gekündigt → aktiv (muss neu anfragen)
- aktiv → angefragt (kein Zurücksetzen)

Nebeneffekte:
- → vorgemerkt: vormerkungsDatum = JETZT
- → bestätigt: bestaetigtAm = JETZT, Platzanzahl der Gruppe wird reduziert
- → aktiv: betreuungsBeginn = Startdatum
- → gekündigt: kuendigungsDatum = JETZT, Platz wird nach Frist freigegeben

## Kapitel 7: Verwaltung & Abrechnung

### POST /api/abrechnungen
Monatsabrechnung erstellen.
Input: `kitaId` (number), `monat` (string, Format: YYYY-MM), `kindId` (number), `betrag` (number, Cent, min:0, max:99999), `typ` (enum: betreuung|verpflegung|sonderbeitrag), `notiz` (string, max:500, optional)
Auth: verwaltung, kita_leitung
- Doppelte Abrechnung pro Kind+Monat+Typ → 409 BEREITS_ABGERECHNET

### GET /api/abrechnungen
Abrechnungen einsehen.
Auth: verwaltung (alle), kita_leitung (alle), elternteil (eigene)

### GET /api/berichte/auslastung
Auslastungsbericht.
Output: pro Gruppe: aktuell/maxKinder, Warteliste, Krankenquote
Auth: kita_leitung, verwaltung

## DSGVO

### DELETE /api/kinder/:id/dsgvo
DSGVO-Löschung.
Auth: kita_leitung
- vorname → "[GELÖSCHT]", nachname → "[GELÖSCHT]", geburtsdatum → null, allergien → null, besonderheiten → null, notfallkontakt → "[GELÖSCHT]", abholberechtigt → []
- Anwesenheitsdaten bleiben (statistische Auswertung)
- Abrechnungen bleiben (Aufbewahrungspflicht 10 Jahre)

### GET /api/kinder/:id/dsgvo-export
DSGVO-Datenexport.
Auth: kita_leitung, elternteil (nur eigenes Kind)
