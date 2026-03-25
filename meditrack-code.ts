// MediTrack — server/routes.ts
// Express + Drizzle ORM + PostgreSQL
// 12 intentional security bugs hidden in production-quality code

import express from "express";
import { db } from "./db";
import { eq, and, sql, gte, lte, count } from "drizzle-orm";
import {
  patienten, termine, rezepte, befunde, abrechnungen, users
} from "./schema";
import { requireAuth, requireRole } from "./middleware/auth";
import { csrfProtection } from "./middleware/csrf";

const router = express.Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.select().from(users).where(eq(users.username, username)).then(r => r[0]);
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    // BUG 1: ❌ Login-Fehler wird NICHT gezählt → kein Rate-Limiting / kein Lockout
    // Spec sagt: "5 Fehlversuche → 15 Minuten Sperre, danach eskalierend"
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  const token = signJWT({ userId: user.id, praxisId: user.praxisId, rolle: user.rolle });
  res.cookie("session", token, { httpOnly: true, secure: true, sameSite: "strict" });
  res.json({ ok: true, rolle: user.rolle });
});

router.get("/api/auth/csrf-token", requireAuth, (req, res) => {
  const token = generateCSRFToken();
  res.cookie("csrf-token", token, { httpOnly: false, sameSite: "strict" });
  res.json({ csrfToken: token });
});

// ─── Patienten ────────────────────────────────────────────────────────────────

router.post("/api/patienten", requireAuth, csrfProtection, async (req, res) => {
  const { praxisId, vorname, nachname, geburtsdatum, versicherungsnummer, 
          versicherungsart, geschlecht, telefon, email, adresse, 
          allergien, vorerkrankungen, notfallkontakt } = req.body;

  // BUG 2: ❌ Keine praxisId-Prüfung gegen JWT
  // Spec sagt: "praxisId muss mit JWT übereinstimmen → 403 PRAXIS_MISMATCH"
  // Fehlt komplett → Cross-Tenant-Zugriff möglich!

  // Unique check
  const existing = await db.select().from(patienten)
    .where(and(
      eq(patienten.versicherungsnummer, versicherungsnummer),
      eq(patienten.praxisId, praxisId)
    )).then(r => r[0]);
  if (existing) return res.status(409).json({ error: "VERSICHERUNGSNUMMER_EXISTIERT" });

  const [patient] = await db.insert(patienten).values({
    praxisId, vorname, nachname, geburtsdatum: new Date(geburtsdatum),
    versicherungsnummer, versicherungsart, geschlecht, telefon, email,
    adresse, allergien: allergien || [], vorerkrankungen, notfallkontakt,
  }).returning();

  res.status(201).json(patient);
});

router.get("/api/patienten", requireAuth, async (req, res) => {
  const user = req.user!;
  
  // BUG 3: ❌ Patient-Rolle sieht ALLE Patienten der Praxis statt nur eigenen
  // Spec sagt: "patient (nur eigener Datensatz)"
  // Hier fehlt die Filterung auf patientId für Rolle "patient"
  const rows = await db.select().from(patienten)
    .where(eq(patienten.praxisId, user.praxisId));
  
  res.json(rows);
});

router.get("/api/patienten/:id", requireAuth, async (req, res) => {
  const user = req.user!;
  const patient = await db.select().from(patienten)
    .where(and(
      eq(patienten.id, parseInt(req.params.id)),
      eq(patienten.praxisId, user.praxisId)
    )).then(r => r[0]);

  if (!patient) return res.status(404).json({ error: "NOT_FOUND" });

  // BUG 4: ❌ Vorerkrankungen werden auch an Patienten-Rolle gesendet
  // Spec sagt: "patient darf NICHT sehen: vorerkrankungen und interne Notizen"
  // Kein Field-Filtering für Rolle "patient"
  res.json(patient);
});

// ─── Termine ──────────────────────────────────────────────────────────────────

router.post("/api/termine", requireAuth, csrfProtection, async (req, res) => {
  const user = req.user!;
  const { praxisId, patientId, arztId, datum, uhrzeit, dauer, terminart, beschreibung } = req.body;

  if (user.praxisId !== praxisId) {
    return res.status(403).json({ error: "PRAXIS_MISMATCH" });
  }

  // Check: Slot frei?
  const conflict = await db.select().from(termine)
    .where(and(
      eq(termine.arztId, arztId),
      eq(termine.datum, datum),
      eq(termine.uhrzeit, uhrzeit),
      sql`${termine.status} NOT IN ('absage_patient', 'absage_praxis', 'nicht_erschienen')`
    )).then(r => r[0]);
  if (conflict) return res.status(409).json({ error: "TERMIN_BELEGT" });

  // BUG 5: ❌ Terminlimit wird NICHT geprüft
  // Spec sagt: "Patient darf max 3 offene Termine gleichzeitig haben → 422 TERMINLIMIT_ERREICHT"
  // Check fehlt komplett

  // BUG 6: ❌ Patient darf Termine für ANDERE Patienten buchen
  // Spec sagt: "patient (nur für sich selbst)"
  // Keine Prüfung ob user.rolle === "patient" && patientId !== user.patientId
  
  const [termin] = await db.insert(termine).values({
    praxisId, patientId, arztId, datum, uhrzeit, dauer, terminart,
    beschreibung, status: "angefragt", erstelltVon: user.id,
  }).returning();

  res.status(201).json(termin);
});

router.patch("/api/termine/:id/status", requireAuth, csrfProtection, async (req, res) => {
  const user = req.user!;
  const { status, notiz } = req.body;

  const termin = await db.select().from(termine)
    .where(and(
      eq(termine.id, parseInt(req.params.id)),
      eq(termine.praxisId, user.praxisId)
    )).then(r => r[0]);

  if (!termin) return res.status(404).json({ error: "NOT_FOUND" });

  // BUG 7: ❌ Keine Transition-Validierung
  // Spec definiert erlaubte und verbotene Übergänge, z.B.:
  // - abgeschlossen → jeder Status (terminal) ist VERBOTEN
  // - absage_patient → bestätigt ist VERBOTEN
  // Hier wird JEDER Statusübergang akzeptiert!
  
  // BUG 8: ❌ absage_praxis OHNE Pflicht-Notiz akzeptiert
  // Spec sagt: "notiz Pflicht bei absage_praxis"
  // Keine Validierung ob notiz gesetzt ist

  const updates: Record<string, unknown> = { status };
  
  if (status === "patient_da") updates.eincheckZeit = new Date();
  if (status === "in_behandlung") updates.behandlungStart = new Date();
  if (status === "abgeschlossen") {
    updates.behandlungEnde = new Date();
  }
  if (status === "absage_patient" || status === "absage_praxis") {
    updates.absageZeit = new Date();
    if (notiz) updates.absageGrund = notiz;
  }

  await db.update(termine)
    .set(updates)
    .where(eq(termine.id, termin.id));

  // BUG 9: ❌ noShowCount wird bei "nicht_erschienen" NICHT erhöht
  // Spec sagt: "noShowCount++, wenn noShowCount >= 3 → Patient gesperrt für 30 Tage"
  // Side-Effect fehlt komplett

  res.json({ ...termin, ...updates });
});

// ─── Rezepte ──────────────────────────────────────────────────────────────────

router.post("/api/rezepte", requireAuth, csrfProtection, async (req, res) => {
  const user = req.user!;
  const { praxisId, patientId, medikament, wirkstoff, dosierung, menge, 
          packungsgroesse, btm, wiederholung } = req.body;

  if (user.praxisId !== praxisId) {
    return res.status(403).json({ error: "PRAXIS_MISMATCH" });
  }

  // BUG 10: ❌ MFA kann Rezepte ausstellen
  // Spec sagt: "Auth: NUR arzt (mfa darf NICHT)"
  // requireAuth prüft nur ob eingeloggt, nicht die Rolle
  // requireRole("arzt") fehlt hier

  // Allergie-Check
  const patient = await db.select().from(patienten)
    .where(eq(patienten.id, patientId)).then(r => r[0]);
  
  if (patient?.allergien?.some((a: string) => 
    wirkstoff.toLowerCase().includes(a.toLowerCase())
  )) {
    return res.status(422).json({ error: "ALLERGIE_WARNUNG" });
  }

  // BTM check
  if (btm) {
    const btmCount = await db.select({ count: count() }).from(rezepte)
      .where(and(
        eq(rezepte.patientId, patientId),
        eq(rezepte.btm, true),
        gte(rezepte.erstelltAm, sql`NOW() - INTERVAL '30 days'`)
      )).then(r => r[0]?.count ?? 0);
    
    if (btmCount >= 3) {
      return res.status(422).json({ error: "BTM_LIMIT" });
    }
  }

  const [rezept] = await db.insert(rezepte).values({
    praxisId, patientId, arztId: user.id, medikament, wirkstoff,
    dosierung, menge, packungsgroesse, btm: btm || false,
    wiederholung: wiederholung || 0, erstelltAm: new Date(),
  }).returning();

  res.status(201).json(rezept);
});

router.get("/api/rezepte", requireAuth, async (req, res) => {
  const user = req.user!;
  
  const rows = await db.select().from(rezepte)
    .where(eq(rezepte.praxisId, user.praxisId));

  // BUG 11: ❌ Patient sieht BTM-Rezept-Details
  // Spec sagt: "patient (eigene, ohne BTM-Details)"
  // Kein Filtering der BTM-Felder für Patienten-Rolle
  
  if (user.rolle === "patient") {
    res.json(rows.filter(r => r.patientId === user.patientId));
  } else {
    res.json(rows);
  }
});

// ─── Befunde ──────────────────────────────────────────────────────────────────

router.post("/api/befunde", requireAuth, csrfProtection, async (req, res) => {
  const user = req.user!;
  const { praxisId, patientId, terminId, typ, titel, inhalt, icd10, vertraulich } = req.body;

  if (user.praxisId !== praxisId) {
    return res.status(403).json({ error: "PRAXIS_MISMATCH" });
  }

  const [befund] = await db.insert(befunde).values({
    praxisId, patientId, terminId, arztId: user.id,
    typ, titel, inhalt, icd10, vertraulich: vertraulich || false,
    freigegeben: false, erstelltAm: new Date(),
  }).returning();

  res.status(201).json(befund);
});

// ─── Abrechnung ───────────────────────────────────────────────────────────────

router.post("/api/abrechnungen", requireAuth, csrfProtection, async (req, res) => {
  const user = req.user!;
  const { praxisId, patientId, terminId, leistungen, diagnose } = req.body;

  if (user.praxisId !== praxisId) {
    return res.status(403).json({ error: "PRAXIS_MISMATCH" });
  }

  // Check: Termin abgeschlossen?
  const termin = await db.select().from(termine)
    .where(eq(termine.id, terminId)).then(r => r[0]);
  
  if (!termin || termin.status !== "abgeschlossen") {
    return res.status(422).json({ error: "TERMIN_NICHT_ABGESCHLOSSEN" });
  }

  // Check: bereits abgerechnet?
  const existing = await db.select().from(abrechnungen)
    .where(eq(abrechnungen.terminId, terminId)).then(r => r[0]);
  if (existing) return res.status(409).json({ error: "BEREITS_ABGERECHNET" });

  const [abrechnung] = await db.insert(abrechnungen).values({
    praxisId, patientId, terminId, leistungen, diagnose,
    erstelltAm: new Date(), erstelltVon: user.id,
  }).returning();

  res.status(201).json(abrechnung);
});

router.get("/api/abrechnungen", requireAuth, async (req, res) => {
  const user = req.user!;
  
  const rows = await db.select().from(abrechnungen)
    .where(eq(abrechnungen.praxisId, user.praxisId));

  res.json(rows);
});

// ─── DSGVO ────────────────────────────────────────────────────────────────────

router.delete("/api/patienten/:id/dsgvo", requireAuth, csrfProtection, async (req, res) => {
  const user = req.user!;
  
  // BUG 12: ❌ Jede Rolle kann DSGVO-Löschung durchführen
  // Spec sagt: "Auth: praxis_admin"
  // requireRole("praxis_admin") fehlt — arzt, mfa können auch löschen!

  const patientId = parseInt(req.params.id);

  // Check: offene Termine?
  const offeneTermine = await db.select().from(termine)
    .where(and(
      eq(termine.patientId, patientId),
      sql`${termine.status} NOT IN ('abgeschlossen', 'absage_patient', 'absage_praxis', 'nicht_erschienen')`
    )).then(r => r.length);

  if (offeneTermine > 0) {
    return res.status(422).json({ error: "OFFENE_TERMINE_VORHANDEN" });
  }

  // Anonymize
  await db.update(patienten)
    .set({
      vorname: "[GELÖSCHT]",
      nachname: "[GELÖSCHT]",
      geburtsdatum: null,
      versicherungsnummer: "[REDACTED]",
      telefon: null,
      email: null,
      adresse: null,
      allergien: [],
      notfallkontakt: null,
    })
    .where(eq(patienten.id, patientId));

  res.json({ ok: true, anonymized: true });
});

router.get("/api/patienten/:id/dsgvo-export", requireAuth, async (req, res) => {
  const user = req.user!;
  const patientId = parseInt(req.params.id);

  const patient = await db.select().from(patienten)
    .where(and(
      eq(patienten.id, patientId),
      eq(patienten.praxisId, user.praxisId)
    )).then(r => r[0]);

  if (!patient) return res.status(404).json({ error: "NOT_FOUND" });

  const patientTermine = await db.select().from(termine)
    .where(eq(termine.patientId, patientId));
  const patientRezepte = await db.select().from(rezepte)
    .where(eq(rezepte.patientId, patientId));
  const patientBefunde = await db.select().from(befunde)
    .where(eq(befunde.patientId, patientId));
  const patientAbrechnungen = await db.select().from(abrechnungen)
    .where(eq(abrechnungen.patientId, patientId));

  res.json({
    patient,
    termine: patientTermine,
    rezepte: patientRezepte,
    befunde: patientBefunde,
    abrechnungen: patientAbrechnungen,
    exportedAt: new Date().toISOString(),
  });
});

// ─── Berichte ─────────────────────────────────────────────────────────────────

router.get("/api/berichte/umsatz", requireAuth, async (req, res) => {
  const user = req.user!;
  
  const rows = await db.select().from(abrechnungen)
    .where(eq(abrechnungen.praxisId, user.praxisId));

  res.json({ total: rows.length, data: rows });
});

export default router;

// ─── Schema (Drizzle ORM) ─────────────────────────────────────────────────────
// File: server/schema.ts

import { pgTable, serial, text, integer, boolean, timestamp, date, json, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  praxisId: integer("praxis_id").notNull(),
  rolle: varchar("rolle", { length: 50 }).notNull(), // arzt, mfa, praxis_admin, patient
  patientId: integer("patient_id"), // nur für rolle=patient
});

export const patienten = pgTable("patienten", {
  id: serial("id").primaryKey(),
  praxisId: integer("praxis_id").notNull(),
  vorname: varchar("vorname", { length: 50 }).notNull(),
  nachname: varchar("nachname", { length: 50 }).notNull(),
  geburtsdatum: date("geburtsdatum"),
  versicherungsnummer: varchar("versicherungsnummer", { length: 10 }).notNull(),
  versicherungsart: varchar("versicherungsart", { length: 20 }).notNull(),
  geschlecht: varchar("geschlecht", { length: 10 }).notNull(),
  telefon: varchar("telefon", { length: 20 }),
  email: varchar("email", { length: 200 }),
  adresse: json("adresse"),
  allergien: json("allergien").$type<string[]>(),
  vorerkrankungen: text("vorerkrankungen"),
  notfallkontakt: json("notfallkontakt"),
});

export const termine = pgTable("termine", {
  id: serial("id").primaryKey(),
  praxisId: integer("praxis_id").notNull(),
  patientId: integer("patient_id").notNull(),
  arztId: integer("arzt_id").notNull(),
  datum: date("datum").notNull(),
  uhrzeit: varchar("uhrzeit", { length: 5 }).notNull(),
  dauer: integer("dauer").notNull(),
  terminart: varchar("terminart", { length: 30 }).notNull(),
  beschreibung: text("beschreibung"),
  status: varchar("status", { length: 30 }).notNull().default("angefragt"),
  erstelltVon: integer("erstellt_von").notNull(),
  bestaetigtAm: timestamp("bestaetigt_am"),
  eincheckZeit: timestamp("eincheck_zeit"),
  behandlungStart: timestamp("behandlung_start"),
  behandlungEnde: timestamp("behandlung_ende"),
  absageZeit: timestamp("absage_zeit"),
  absageGrund: text("absage_grund"),
  nichtErschienen: boolean("nicht_erschienen").default(false),
});

export const rezepte = pgTable("rezepte", {
  id: serial("id").primaryKey(),
  praxisId: integer("praxis_id").notNull(),
  patientId: integer("patient_id").notNull(),
  arztId: integer("arzt_id").notNull(),
  medikament: varchar("medikament", { length: 200 }).notNull(),
  wirkstoff: varchar("wirkstoff", { length: 200 }).notNull(),
  dosierung: varchar("dosierung", { length: 100 }).notNull(),
  menge: integer("menge").notNull(),
  packungsgroesse: varchar("packungsgroesse", { length: 5 }).notNull(),
  btm: boolean("btm").default(false),
  wiederholung: integer("wiederholung").default(0),
  erstelltAm: timestamp("erstellt_am").defaultNow(),
});

export const befunde = pgTable("befunde", {
  id: serial("id").primaryKey(),
  praxisId: integer("praxis_id").notNull(),
  patientId: integer("patient_id").notNull(),
  terminId: integer("termin_id"),
  arztId: integer("arzt_id").notNull(),
  typ: varchar("typ", { length: 30 }).notNull(),
  titel: varchar("titel", { length: 200 }).notNull(),
  inhalt: text("inhalt").notNull(),
  icd10: varchar("icd10", { length: 10 }),
  vertraulich: boolean("vertraulich").default(false),
  freigegeben: boolean("freigegeben").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow(),
});

export const abrechnungen = pgTable("abrechnungen", {
  id: serial("id").primaryKey(),
  praxisId: integer("praxis_id").notNull(),
  patientId: integer("patient_id").notNull(),
  terminId: integer("termin_id").notNull(),
  leistungen: json("leistungen").notNull(),
  diagnose: text("diagnose").notNull(),
  erstelltAm: timestamp("erstellt_am").defaultNow(),
  erstelltVon: integer("erstellt_von").notNull(),
});
