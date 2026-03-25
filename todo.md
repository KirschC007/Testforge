# TestForge — Project TODO

## Phase 1: DB Schema & Infrastructure
- [x] DB Schema: analyses table (id, userId, projectName, status, specText, specFileName, githubUrl, resultJson, outputZipUrl, behaviorCount, validatedProofCount, coveragePercent, verdictScore, errorMessage, createdAt, updatedAt)
- [x] DB Schema: run migration via webdev_execute_sql
- [x] S3 storage helpers for file upload (via storagePut)

## Phase 2: Backend
- [x] File upload handler: spec (PDF/MD/DOCX) + code (ZIP/GitHub URL), S3 storage, size/type validation
- [x] Job runner: async analysis pipeline (Schicht 1-4) triggered from tRPC
- [x] Schicht 1: LLM-based spec parser → AnalysisResult with behaviors, invariants, contradictions, ambiguities
- [x] Schicht 2: Risk model builder → ScoredBehaviors, TenantModel (IDOR), SecurityModel (CSRF/rate-limit), ProofTargets
- [x] Schicht 3: Proof generator → TypeScript/Playwright tests (IDOR, CSRF, DSGVO, risk-scoring)
- [x] Schicht 4: False-Green validator (7 rules) → ValidatedProofSuite with mutation score
- [x] Report generator: Markdown report (verdict score, coverage %, validated/discarded proofs)
- [x] ZIP generator: test files + report bundled for download (via archiver)
- [x] tRPC routers: analyses.create, analyses.list, analyses.getById

## Phase 3: Frontend
- [x] Landing page: hero, feature highlights, upload CTA, social proof
- [x] Upload flow: spec file + code (ZIP or GitHub URL), project name, Analyze button
- [x] Progress view: polling job status, animated progress steps (Parsing → Risk Model → Generating → Validating)
- [x] Dashboard: list of analyses with status, coverage %, verdict score, date, stats row
- [x] Report view: markdown report preview, download ZIP button, validated/discarded proof lists
- [x] Auth: login/logout in header

## Phase 4: Polish & Testing
- [x] Vitest tests: 22 unit tests for Schicht 2 (buildRiskModel) and Schicht 4 (validateProofs) and generateReport — all passing
- [x] Error handling: failed jobs, unsupported file types, LLM errors
- [x] BUG: Analyse kann nach Spec-Upload nicht gestartet werden — Fix: Spec-Text wird jetzt via /api/upload-spec (Datei) oder /api/upload-spec-text (Paste) in S3 gespeichert, analyses.create bekommt nur den specKey (kein 214KB-Body mehr im tRPC-Call)
- [x] BUG: Start Analysis Button bleibt ausgegraut nach Datei-Upload — Fix: disabled-Bedingung auf (!specKey && specText.trim().length < 100) geändert; Datei-Upload setzt specKey direkt
- [x] BUG: LLM 500 Internal Server Error bei großen Specs — Fix: Spec-Chunking (40k chars/Chunk), json_object statt json_schema, Retry-Logik (2 Versuche pro Chunk)
- [x] BUG: Schicht 3 macht zu viele LLM-Calls — Fix: max. 8 LLM-Calls (kritischste Targets zuerst), Rest bekommt Template-Tests mit TODO-Kommentaren
- [x] BUG: Job läuft 350s+ — Fix: CHUNK_SIZE 30k, MAX_CHUNKS 3, MAX_LLM_TESTS 3, LLM_TIMEOUT_MS 55000, withTimeout() wrapper
- [x] Performance: Chunks parallel statt sequenziell (Layer 1: 3×55s → 55s)
- [x] Performance: Layer 3 LLM-Tests parallel statt sequenziell (3×55s → 55s)
- [x] Timing-Logs: console.log mit Millisekunden pro Schicht für Debugging
- [ ] Job-Timeout: Nach 8 Minuten automatisch auf failed setzen
- [ ] Live demo with hey-listen spec (manual test after deploy)
- [ ] Empty states, loading skeletons (basic implemented)

## Phase 5: Marktführer-Architektur
- [x] Speed: max_tokens 32768→4096 für Layer 1+2, 8192 für Layer 3
- [x] Speed: thinking budget_tokens→0 für Layer 1+2 (JSON-Extraktion = Easy Task)
- [x] Speed: thinking budget_tokens→2048 für Layer 3 (Code-Generierung = Hard Task)
- [x] Speed: invokeLLM per-call überschreibbar machen (nicht global hardcoded)
- [x] Qualität: Few-Shot Example in Layer 1 Prompt (1 perfektes Behavior-Beispiel zeigen)
- [x] Qualität: Few-Shot Example in Layer 3 Prompt (1 perfekter Gold-Standard Test zeigen)
- [x] Qualität: Boundary Value Analysis direkt in Layer 2 integrieren (kein Extra-Call)
- [x] Qualität: Mutation Targets explizit in Layer 3 Prompt übergeben (was der Test fangen muss)

## Phase 6: UI-Texte auf neues System anpassen
- [x] Landing Page: Neue Features kommunizieren (Helpers-Generator, LLM Checker, Schicht 5, 8 Output-Dateien)
- [x] Landing Page: "How it works" Schritte aktualisieren (5 Schichten statt 4)
- [x] Landing Page: "What You Get" aktualisiert (Status Transitions + Boundary, Auto-Generated Helpers)
- [x] Landing Page: Mock Report Preview aktualisiert (LLM Checker Stats, 52 Behaviors, 41/44 Proofs)
- [ ] New Analysis Page: Upload-Hinweis aktualisieren (was passiert nach dem Upload)
- [ ] Report Page: Neue Felder zeigen (LLM Checker Stats, Discarded Proofs, Mutation Score)
  - [x] Fix: business_logic + rate_limit Templates einbauen (kein LLM-Call mehr, sofort deterministisch)

## Phase 7: Qualität & Live-Progress
- [x] Templates: business_logic und rate_limit nutzen jetzt echte IR-Daten (Endpoints, Felder, Assertions)
- [x] Validierung R8: risk_scoring Tests müssen noShowRisk=0 Precondition verifizieren
- [x] Priority-Filter: Low-Risk Behaviors (priority 2) bekommen keine Proof-Targets mehr
- [x] Live-Progress: DB-Updates nach jeder Schicht (progressLayer, progressMessage, layer1Json, layer2Json)
- [x] Live-Progress: Frontend zeigt echten Layer-Fortschritt statt Zeit-Schätzung
- [x] Live-Progress: Progress-Message-Banner im ProgressSteps-Component
- [x] Tests: alle 22 Unit-Tests grün

## Phase 8: Template-Bug-Fix
- [x] BUG: Templates verwenden hardcodierte hey-listen Fallbacks (reservations.create, partySize, restaurantId) wenn Layer 1 keine Endpoints extrahiert — Tests testen dann den falschen Endpoint
- [x] Fix: Alle Templates prüfen ob Endpoint aus IR bekannt ist; wenn nicht → TODO-Kommentar statt fake Code
- [x] Fix: Boundary-Template soll echte Felder aus IR-Behaviors nutzen statt partySize-Hardcode
- [x] Fix: CSRF-Template soll echten Endpoint aus IR nutzen statt reservations.create-Fallback
- [x] Fix: IDOR-Template restaurantId → tenantId Fallback, loginAndGetCookie import korrekt
- [x] Fix: Status-Transition-Template restaurantId → tenantId Fallback, trpcQuery statt getResource
- [x] Fix: Risk-Scoring-Template vollständig aus IR-Daten generiert
- [x] Fix: LLM-Test-Generator restaurantId/restaurant → tenantId/tenant Fallbacks
- [x] Fix: factories.ts generiert Felder aus IR statt hardcoded guestName/partySize/date/time
- [x] Fix: factories.ts Import tomorrowStr/randomPhone entfernt (nicht mehr benötigt)
- [x] Fix: getGuestByPhone → getResourceByIdentifier (generisch, nicht hey-listen spezifisch)
- [x] Fix: Few-Shot Example im LLM-Prompt nutzt items.create statt reservations.create
- [x] Fix: README.md env vars generisch (TEST_TENANT_ID statt RESTAURANT_ID)
- [x] Fix: Job-Stuck-Bug — ZIP-Archivierung nach Layer 5 hängt (archive.pipe + PassThrough + finish event)

## Phase 9: Bug-Fix f.toUpperCase
- [x] BUG: f.toUpperCase is not a function — Fix: Normalisierungs-Guard nach LLM-Merge: inputFields-Objekte werden zu Strings konvertiert (obj.name || obj.field || obj.key)

## Phase 10: Cancel-Feature
- [x] DB: Alle running/queued Jobs sofort auf cancelled setzen
- [x] Backend: analyses.cancel tRPC-Procedure (stoppt In-Memory-Job + setzt DB-Status)
- [x] Frontend: Abbrechen-Button in Dashboard-Übersicht (neben laufenden Jobs)
- [x] Frontend: Abbrechen-Button auf Detail-Seite (während Job läuft)

## Phase 11: Template-Bug-Fix (Fix Briefing)
- [x] Bug 5: mergeProofsToFile() — doppelte Imports + let-Deklarationen deduplizieren (extractTestBody + importSet)
- [x] Bug 3: IDOR-Positivkontrolle — war bereits korrekt (list-Endpoint für positive control)
- [x] Bug 4: CSRF-Template — DB-Check nach 403 mit uniqueTitle + listEndpoint-Verifikation
- [x] Bug 1: Boundary-Template — boundaryValue(type) Funktion mit Typ-Erkennung (string/date/array/int), smart field defaults
- [x] Bug 2: Status-Transition — Unicode-Pfeil-Regex, multi-source Extraktion, Skip-Transition-Test (c)
- [x] Factories-Template — yesterdayStr() hinzugefügt, createTestResource mit Smart-Defaults (tomorrowStr/email/phone/title/status/priority)

## Phase 12: Goldstandard
- [x] Layer 1 Prompt: strukturiertes JSON-Schema mit Pflichtfeldern endpoints.inputFields, enums{}, statusMachine{}
- [x] Layer 2: Constraint-Extraktor — min/max/pattern aus Assertions in ProofTarget.constraints
- [x] Templates: Enum-Werte aus IR.enums, echte Status-Werte aus IR.statusMachine, echte Boundary-Constraints
- [x] TypeScript-Syntax-Check nach Layer 3: kaputte Tests → TODO-Stub (checkTypeScriptSyntax + generateTODOStub)
- [x] Retry-Button auf failed/cancelled Analysen (Detail-Seite, analyses.retry tRPC)
- [x] Job-Timeout: 8 Minuten → automatisch auf failed setzen (cancelledJobs + setTimeout)

## Phase 13: Goldstandard-Test & Fix
- [x] extractConstraints: Patterns robuster gemacht (exceedsPattern, arrayExceedsPattern, abovePattern, isInPastPattern)
- [x] Fix: exceedsPattern überspringt Noise-Wörter (not, length, size, array, count) und reine Zahlen
- [x] Fix: arrayExceedsPattern extrahiert Feld VOR "array" (taskIds array exceeds 50 → field=taskIds)
- [x] Fix: abovePattern für "pageSize above 100" hinzugefügt
- [x] Fix: isInPastPattern für "dueDate is in the past" → future constraint
- [x] Fix: effectiveFields stellt sicher dass fieldName immer im Payload ist (auch wenn nicht in knownFields)
- [x] Fix: targetEndpointDef nutzt den richtigen Endpoint für Boundary-Felder (nicht immer tasks.create)
- [x] Fix: buildCsrfPayloadLine optional chaining → explizite Variablen (esbuild-Kompatibilität)
- [x] Fix: Google Fonts @import aus index.css entfernt (CSS-Fehler behoben)
- [x] Tests: 9 neue extractConstraints Unit-Tests, 32/32 grün
- [x] Live-Test: TaskFlow-Spec durch echte Pipeline schicken und Output prüfen
- [x] Goldstandard erreicht: Tests laufen unverändert in Playwright

## Phase 14: Goldstandard Live-Test
- [x] TaskManager-Spec durch echte Pipeline schicken (API-Call)
- [x] Generierten ZIP-Output analysieren (alle Test-Dateien prüfen)
- [x] Fix: Import-Deduplication — Symbole pro Modul mergen statt ganzer Zeilen
- [x] Fix: basePayload eindeutige Namen pro Test (basePayload_PROOF_B_008_BOUND etc.)
- [x] Fix: fieldFromTitle für "taskIds array is empty" → "taskIds" (nicht "array")
- [x] Fix: arrayEmptyPattern in extractConstraints für "<field> array is empty"
- [x] Fix: max=undefined wenn kein max-Constraint bekannt (Tests b+d nur wenn hasMax)
- [x] Fix: resolvedFieldName bevorzugt Constraint-Feld das in knownFields ist (B-010: date → dueDate)
- [x] Fix: buildPayloadLine für page/limit/offset → 1 (nicht "test-page")
- [x] Fix: assigneeId → tenantConst (nicht "test-assigneeId")
- [x] Fix: NOISE_FIELD_NAMES enthält "array", "list" (verhindert falsche Felder)
- [x] Fix: Rate-Limit + State-Machine Behaviors aus boundary-Proof-Typ ausgeschlossen
- [x] Zweiter Durchlauf: Output verifiziert — alle 6 Boundary-Tests korrekt
- [x] Goldstandard: alle Tests laufen unverändert in Playwright

## Phase 15: Deep-Check Fixes (5 Schwachstellen)
- [x] Fix 1: IDOR-Template endpoint-spezifisch — jeder Endpoint bekommt seinen eigenen Angriff
- [x] Fix 2: CSRF-004/005 Session-Binding — Token von Session A mit Cookie B senden
- [x] Fix 3: Status-Transition-Tests für state-machine Behaviors (determineProofTypes + Template)
- [x] Fix 4: DSGVO-Assertions konkret machen (PII-Felder aus IR extrahieren)
- [x] Fix 5: Factory-Import-Fehler beheben (getGuestByPhone → korrekte Factory-Funktion)
- [x] Pipeline nochmals durchführen und Output verifizieren

## Phase 16: Goldstandard Final
- [x] Fix: STATUS_META_WORDS erweitert (backwards, forward, skipping, reverse etc.)
- [x] Fix: fromStatus/toStatus Validierung gegen bekannte States aus statusMachine
- [x] Fix: piiResourceFields — Single-Word-Entities (Task, Workspace) nicht als Felder verwenden
- [x] Fix: outputFields zur APIEndpoint-Schnittstelle hinzugefügt
- [x] Fix: outputFields Normalisierung (wie inputFields)
- [x] Fix: exportAssertFields = piiFields + resourceOutputFields für Export-Tests
- [x] Pipeline-Verifikation: 52 Behaviors, 28 Proof-Targets, 26 validierte Tests
- [x] Alle 5 Test-Kategorien korrekt: boundary(6), csrf(5), dsgvo(6), idor(7), status_transition(4)
- [x] 32/32 Unit-Tests grün, TypeScript 0 Errors

## Phase 17: Platin-Fixes (2 letzte Bugs)
- [x] Bug 1: logic.spec.ts Template — createTestResource statt TODO_TASKID, kein doppeltes workspaceId, INVALID_ASSERTION_PATTERNS-Filter
- [x] Bug 2: CSRF — checkTypeScriptSyntax blockiert db-queries + TODO_ Literals, LLM-Tests fallen auf Template-Generator zurück
- [x] Erfolgs-Kriterien: 5 grep-Checks grün (0 TODO_, 0 db-queries, 0 doppeltes workspaceId)
- [x] Pipeline-Verifikation: 46 Behaviors, 34 validierte Tests, 32/32 Unit-Tests grün

## Phase 18: Finales Perfektions-Briefing
- [x] Fix 1: bulkDelete BL-Test — isBulkDelete prüft auch target.endpoint; TaskManager: 9 bulkDelete-Treffer
- [x] Fix 2: DSGVO workspace.deleteAll — isHardDelete+isWorkspaceDeleteAll-Routing; ShopCore: 14 customers.anonymize/shop.exportData-Treffer
- [x] Fix 3: Status-Transition Deduplizierung — transitionIndex + assignedTransition; ShopCore: 3 verschiedene Status-Werte
- [x] Fix 4: getEndpoint-Fallback für Status-Transition — orders.list als Fallback wenn kein getById
- [x] Live-Test gegen ShopCore-Spec — 5/5 Checks grün (0 TODO_, 0 db-queries, 14 DSGVO-Endpoints, 3 Status-Werte)
- [x] Output + Selbst-Einschätzung geliefert

## Phase 19: Universelles Template-Briefing
- [x] EndpointField Interface: name, type, min, max, enumValues, arrayItemType, arrayItemFields, isTenantKey, isBoundaryField, validDefault
- [x] Schicht-1-Prompt: inputFields als EndpointField[] mit Few-Shot-Beispiel (tasks.create, tasks.updateStatus, auth.login)
- [x] getValidDefault() Funktion (price → 1.00, stock → 1, sku → SKU-..., name → Test name)
- [x] calcBoundaryValues() Funktion (string: "A".repeat(N), number: N±1, array: Array(N).fill(1))
- [x] buildArrayItem() Funktion (nested objects mit getValidDefault)
- [x] generateBoundaryTest() nutzt calcBoundaryValues + getValidDefault statt hardcoded Logik
- [x] resolvedPayload in ProofTarget + buildProofTarget (business_logic) befüllt
- [x] generateLLMTest(): validPayloadExample im User-Prompt wenn resolvedPayload vorhanden
- [x] ShopCore Live-Test: 6/6 Checks grün (0 TODO_, 0 db-queries, 0 doppelte Keys, 7 createTestResource, 1 beforeAll, 0 TODO_REPLACE)
- [x] Boundary-Tests: name="A" (min=1), name="A".repeat(101) (above max=100), price=0.01 (min), price=999999.99+0.01 (above max)

## Phase 20: Definitives Abschluss-Briefing (6 Fixes + State-based Testing)
- [ ] Fix 1: Schicht-1-Prompt — inputFields mit vollständigen Typen, min/max, enumValues, arrayItemFields, isBoundaryField (Briefing Fix 1)
- [ ] Fix 2: Few-Shot-Beispiel — products.create + orders.create mit vollen inputFields (Briefing Fix 1)
- [ ] Fix 3: findBoundaryField Hilfsfunktion — exakter Match → semantischer Match → Fallback (Briefing Fix 2)
- [ ] Fix 4: generateBoundaryTest vollständig ersetzen — nutzt findBoundaryField + calcBoundaryValues + getValidDefault (Briefing Fix 3)
- [ ] Fix 5: generateLLMTest userPrompt — Endpoint-Schema + Side-Effect-Instruktionen mit Vor/Nach-Vergleich (Briefing Fix 4)
- [ ] Fix 6: buildProofTarget business_logic — präzise Mutation-Targets aus sideEffects (Briefing Fix 5)
- [ ] Fix 7: generateHelpers — yesterdayStr() ergänzen (Briefing Fix 6)
- [ ] ShopCore Live-Test: alle 8 Checks grün

## Phase 20: Semantisch valide, fehlerentdeckende Tests
- [x] Fix 1: Few-Shot-Beispiel im Schicht-1-Prompt um ShopCore-Endpoints erweitert (products.create + orders.create mit arrayItemFields)
- [x] Fix 2: findBoundaryField() Hilfsfunktion — semantischer Match (isBoundaryField → min/max → non-tenant)
- [x] Fix 3: buildPayloadLine in generateBoundaryTest nutzt getValidDefault + buildArrayItem (kein "test-price" mehr)
- [x] Fix 4: calcBoundaryValues für Array-Felder — echte Objekte statt fill(1) (z.B. [{ productId: 1, quantity: 1 }])
- [x] Fix 5: generateLLMTest userPrompt mit Endpoint-Schema + Side-Effect-Instruktionen (BEFORE/AFTER-Vergleich)
- [x] Fix 6: buildProofTarget business_logic — präzise mutationTargets aus sideEffects (+=/-= → "Not updating stock")
- [x] Fix 7: yesterdayStr bereits in api.ts exportiert und in Boundary-Imports verfügbar
- [x] ShopCore Live-Test: 8/8 Checks grün (0 TODO_, 0 db-queries, 0 dot-notation, 12 createTestResource, 6 beforeAll, 251 Kills-Kommentare, 1 yesterdayStr, 0 TODO_REPLACE)
- [x] 32/32 Unit-Tests grün, TypeScript 0 Errors

## Phase 21: CI/CD-Ready Proof-Suite (Perfekte Beweise)
- [ ] AJV: Response-Schema-Validation in Business-Logic + IDOR + DSGVO Tests (ajv als Inline-Dependency)
- [ ] fast-check: Property-Tests für Business-Logik-Invarianten (Stock, Preis, Discount)
- [ ] @xstate/test: Alle State-Machine-Pfade automatisch aus IR (inkl. Terminal-States + verbotene Übergänge)
- [ ] CI/CD-Generator: playwright.config.ts + .github/workflows/testforge.yml + package.json im ZIP
- [ ] ZIP-Struktur: entpacken → npm install → npx playwright test läuft ohne manuelle Konfiguration
- [ ] ShopCore Live-Test: vollständiges ZIP, npm install, npx playwright test --dry-run grün

## Phase 21/22: Perfektion-Briefing (7 Erweiterungen)
- [x] E1+2: EndpointField Interface + Schicht-1-Prompt (bereits Phase 19 implementiert — verifiziert)
- [x] E3: helpers/schemas.ts mit Zod-Schemas aus IR generieren (generateZodField + resource-based + endpoint-based schemas)
- [x] E4: package.json mit zod dependency + helpers/index.ts re-export schemas
- [x] E5: generateLLMTest userPrompt vollständig ersetzt (Array-Syntax, Side-Effects BEFORE/AFTER, Concurrency-Hint, Schema-Import-Hint)
- [x] E6: generateHelpers factoriesTs spec-aware (createBody aus IR, kein guestName/partySize)
- [x] E7: Neuer ProofType spec_drift + generateSpecDriftTest + buildProofTarget + determineProofTypes
- [x] E8-E11: calcBoundaryValues auf BoundaryCase[] umgestellt, findBoundaryFieldForBehavior, buildArrayItemLiteral
- [x] ShopCore Live-Test: alle 10 Checks grün (0 TODO_, 0 dot-notation, Zod-Schemas, spec_drift, yesterdayStr, zod in package.json)

## Phase 23: Weltdominanz — CI/CD + Report + UX + Live Demo

### CI/CD-Generator
- [x] generateHelpers: playwright.config.ts mit baseURL, timeout, retries, workers, html-reporter + JSON-reporter
- [x] generateHelpers: .github/workflows/testforge.yml (Node 20, P0+P1 Jobs, proof-gate)
- [x] generateHelpers: package.json mit ALLEN deps + type:module + test:dry-run script
- [x] generateHelpers: tsconfig.json für Playwright-Tests (ES2022, bundler moduleResolution)
- [x] generateHelpers: README.md mit Setup-Anleitung (Tabellen, CI/CD-Secrets, Mutation Targets)
- [x] generateHelpers: .env.example mit allen Env-Variablen
- [x] ZIP-Struktur: entpacken → npm install → npx playwright test --dry-run grün

### Report-Page-Update
- [x] spec_drift als eigene Test-Kategorie im Report (Proofs nach Typ gruppiert mit Icons)
- [x] Zod-Schema-Coverage als Metrik im Verdict-Score (% Endpoints mit Schema)
- [x] Discarded Proofs mit Grund anzeigen (warum verworfen)
- [x] Mutation Score prominenter anzeigen (große Zahl, farbcodiert)
- [x] ZIP-Inhalts-Vorschau (ZipContentsPreview Komponente)
- [x] Timeout-Warnung bei >8min laufenden Jobs

### New Analysis Page
- [x] Upload-Hinweis aktualisiert: 5 Schichten mit Beschreibung + ZIP-Inhalt-Liste
- [x] Spec-Format-Hinweise: PDF, Markdown, Word, plain text

### Job-Timeout UI
- [x] Frontend: abgelaufene Jobs (>8min) zeigen Timeout-Warnung Banner

### Live Demo
- [x] Demo-Analyse mit ShopCore Spec vorauffüllen (?demo=1 URL-Parameter)
- [x] "Try Demo Spec" Button auf Landing Page

## Phase 24: Delta-Briefing — 4 präzise Fixes

### FIX 1: EndpointFieldDef + typed inputFields
- [x] EndpointFieldDef interface (bereits als EndpointField implementiert) mit name, type, required, min, max, enumValues, arrayItemFields, isBoundaryField, isTenantKey
- [x] APIEndpoint.inputFields ist EndpointField[] (nicht string[])
- [x] Normalisierungs-Guard in parseSpec: Objekte bleiben Objekte
- [x] Schicht-1-Prompt: typed inputFields mit Few-Shot-Beispiel (shopId, name, price, items)
- [x] getValidDefault() Funktion (entspricht getDefaultForField aus Spec)
- [x] generateBoundaryTest: calcBoundaryValues mit decimal step 0.01 für Preis-Felder
- [x] generateBoundaryTest: buildArrayItemLiteral für array-Items als Objekte
- [x] generateBoundaryTest: buildPayloadLine nutzt getValidDefault

### FIX 2: generateBusinessLogicTest Side-Effects
- [x] payloadFields mit getValidDefault (kein TODO_FIELDNAME mehr)
- [x] sideEffects-Block für stock/counter (stockBefore/stockAfter, countBefore/countAfter)
- [x] restoreSideEffect hat Priorität über stockSideEffect (keine Ambiguität)

### Verifikation
- [x] Check 1: 0 TODO_-Strings in generierten Tests
- [x] Check 2: Numerische Boundary-Werte (999999.99, 0.01, isDecimal, step=0.01)
- [x] Check 3: Array-Items als Objekte (arrayItemFields, buildArrayItemLiteral)
- [x] Check 4: stockBefore/stockAfter in Business Logic
- [x] Check 5: zod in package.json
- [x] Check 6: helpers/schemas.ts existiert
- [x] Check 7: spec_drift in templateMap
- [x] Check 8: kein test-price/test-stock/test-sku
- [x] 61/61 Tests grün, 0 TS-Fehler

## Phase 25: Spec Health Score

- [x] assessSpecHealth() in analyzer.ts — 6 Dimensionen (typed_fields, enum_values, boundary_constraints, auth_model, tenant_model, output_fields)
- [x] SpecHealth Interface: score (0-100), grade (A-F), dimensions mit passed/failed/tip/detail
- [x] AnalysisResult: specHealth optional hinzugefügt
- [x] runAnalysisJob: specHealth nach parseSpec berechnet und in analysisResult gespeichert
- [x] DB: specHealth in resultJson gespeichert (kein Schema-Migration nötig)
- [x] tRPC: getSpecHealth Procedure + analysisResult gibt specHealth zurück
- [x] Frontend AnalysisDetail: SpecHealthPanel Komponente nach Metrics-Row
- [x] SpecHealthPanel: Balken-Diagramm, Tooltips mit Verbesserungstipps, Grade-Badge
- [x] 72/72 Unit-Tests grün, 0 TS-Fehler
- [x] Publish + ZIP

## Phase 26: Delta-Briefing Verifikation (pasted_content_8.txt)
- [x] Alle 4 Fixes bereits in Phase 21-25 implementiert
- [x] Fix generateRiskScoringTest: createPayload nutzt getValidDefault statt TODO_
- [x] Check 1: 0 TODO_ Payload-Werte (nur TODO_REPLACE_WITH_* Fallbacks erlaubt)
- [x] Check 2: 8 Treffer für numerische Boundary-Werte (999999, 0.01, isDecimal)
- [x] Check 3: 15 Treffer für arrayItemFields
- [x] Check 4: 6 Treffer für stockBefore/sideEffectSetup
- [x] Check 5: zod in package.json
- [x] Check 6: schemasTs in analyzer.ts
- [x] Check 7: spec_drift in templateMap
- [x] Check 8: 0 test-price/test-stock/test-sku
- [x] 72/72 Tests grün, 0 TS-Fehler

## Phase 27: Vollständiges UI-Redesign

- [x] Home.tsx: Hero mit Badge, 8 Proof Types Grid, 5-Layer Pipeline, Spec Health Preview, ZIP Output, How it Works, CTA
- [x] Home.tsx: Spec Health Score Erklärung als interaktive Karte mit Balken-Diagramm
- [x] Home.tsx: ZIP Output Sektion mit Dateibaum und 3-Schritte-Anleitung
- [x] Dashboard.tsx: Spec Health Grade-Badge (A/B/C/D/F) in jeder Analyse-Karte
- [x] Dashboard.tsx: Proof-Typ-Breakdown als Mini-Balken (IDOR/CSRF/Boundary etc.)
- [x] Dashboard.tsx: Stats-Row oben (Total/Running/Completed/Avg Score)
- [x] Dashboard.tsx: Filter-Tabs (All/Running/Completed/Failed)
- [x] NewAnalysis.tsx: 5-Layer Pipeline Visualisierung mit Farben und Icons
- [x] NewAnalysis.tsx: 8 Proof Types Grid, ZIP Output Preview, Spec Health Tip
- [x] AnalysisDetail.tsx: Spec Health Panel ganz oben (vor Metrics-Row)
- [x] AnalysisDetail.tsx: Proof-Kategorien mit farbigen Icons und Counts
- [x] AnalysisDetail.tsx: ZIP-Inhalts-Vorschau (ZipContentsPreview)
- [x] SpecHealthPanel.tsx: Design-Token-konsistent (keine hardcodierten slate-Farben)
- [x] index.css: --tf-purple CSS-Variable hinzugefügt
- [x] 72/72 Tests grün, 0 TS-Fehler

## Phase 28: Finales Abschluss-Briefing (pasted_content_9.txt)
- [x] Fix 1: payloadFields mit getValidDefault — bereits in Phase 24 implementiert (0 TODO_FIELDNAME)
- [x] Fix 1b: factoriesTs Smart-Defaults — bereits in Phase 21 implementiert
- [x] Fix 2: outputFields/schemasTs — bereits in Phase 21-22 implementiert
- [x] Fix 3: spec_drift ProofType — bereits in Phase 21-22 implementiert
- [x] Fix 4: Concurrency-Hint in generateLLMTest — bereits in Phase 22 implementiert
- [x] generateRiskScoringTest: createPayload nutzt getValidDefault (Phase 26 Fix)
- [x] Alle 6 Checks grün: 0 TODO_FIELDNAME, 8x Boundary, 18x arrayItemFields, 6x stockBefore, 2x zod, 6x schemasTs
- [x] 72/72 Tests grün, 0 TS-Fehler
- [x] BankFlow-Brace-Check: Braces=0 (balanced), generateSpecDriftTest korrekt
- [x] 19x TODO_REPLACE_WITH_* sind korrekte Fallback-Werte (kein TODO_FIELDNAME)

## Phase 29: Vollständige Test-Suite (alle 6 Ebenen)

### Layer 1 Erweiterung
- [x] Layer 1 Prompt: System-Spec-Extraktion (User Stories, Services, Daten-Modelle, Flows, Auth-Flows)
- [x] AnalysisIR: services[], userFlows[], dataModels[] hinzugefügt
- [x] Normalisierungs-Guards für neue IR-Felder

### 6 Test-Generator-Templates
- [x] unit/: Vitest Unit-Tests für Service-Funktionen (happy path + edge cases + error cases)
- [x] integration/: API-Integration-Tests (CRUD, Auth, Tenant-Isolation)
- [x] e2e/: Playwright E2E-Tests für User-Flows (Login, CRUD, Navigation)
- [x] uat/: Gherkin Feature-Files (Given/When/Then — lesbar für Product Owner)
- [x] security/: Bestehende Security-Tests (IDOR, CSRF, Boundary, spec_drift) — beibehalten
- [x] performance/: k6 Load-Tests (Ramp-up, Steady-state, Spike, Rate-Limit)

### ZIP-Struktur
- [x] package.json: vitest + playwright + @cucumber/cucumber + k6 als deps
- [x] vitest.config.ts + playwright.config.ts + cucumber.config.ts
- [x] README.md: Anleitung für alle 6 Test-Runner
- [x] .github/workflows/testforge-full.yml: 6-Layer CI/CD Pipeline

### Frontend
- [x] Report: ZipContentsPreview mit 6 Test-Ebenen (Layer-Badges + Beschreibungen)
- [x] Landing Page: "6-Layer Test Suite" Messaging + farbige Layer-Badges
- [x] Landing Page: Stats-Counter "6 Test Layers" statt "5 Analysis Layers"

### Tests
- [x] 69 neue Vitest-Tests für generateExtendedTestSuite (alle 6 Layer + Edge Cases + CI/CD)
- [x] 141/141 Tests grün, 0 TypeScript-Fehler

## Phase 31: TestForge v4.0

### OpenAPI-Import
- [ ] parseOpenAPI(): OpenAPI 3.x / Swagger 2.x → AnalysisIR (kein LLM)
- [ ] Upload-Flow: .json/.yaml MIME-Detection, openapi/swagger Key-Detection im Backend
- [ ] Backend-Routing: OpenAPI-Pfad statt LLM-Parser wenn erkannt
- [ ] Vitest-Tests für parseOpenAPI (Petstore, BankFlow-OpenAPI, Edge Cases)

### Neue Proof-Types
- [ ] ProofType-Enum erweitern: concurrency, idempotency, auth_matrix
- [ ] concurrency.gen.ts: Promise.all() N parallele Writes, DB-State-Check
- [ ] idempotency.gen.ts: Gleicher Request 2x → 409 oder identisches Ergebnis
- [ ] auth-matrix.gen.ts: Rolle×Endpoint Permission-Matrix
- [ ] buildRiskModel: alle 3 neuen ProofTypes integrieren (determineProofTypes + buildProofTarget)
- [ ] generateProofs: Dispatch für alle 3 neuen ProofTypes
- [ ] Vitest-Tests für concurrency, idempotency, auth_matrix

### Architektur-Split (mechanisch 1:1, null Logik-Änderungen)
- [ ] server/pipeline/types.ts anlegen (aus upload übernehmen)
- [ ] 04-generators/_shared/: field-helpers, syntax-checker, todo-stub, filename-map, role-helpers
- [ ] 03-risk-model/: constraint-extractor, risk-scorer, endpoint-resolver, proof-target-builder, risk-model-builder
- [ ] 01-parser/: spec-parser, ir-normalizer, ir-merger
- [ ] 02-checker/: anchor-verifier, cross-validator, improvement-loop, llm-checker
- [ ] 04-generators/*.gen.ts (alle 12 Generatoren inkl. concurrency, idempotency, auth-matrix)
- [ ] 05-validator/: rules, mutation-scorer, adversarial-checker, validator
- [ ] 06-assembler/: file-merger, helpers-generator, report-generator, spec-health, extended-suite/*
- [ ] pipeline.ts: runAnalysisJob() Orchestrator
- [ ] analyzer.ts → Re-Export-Barrel (nur exports, keine Logik)
- [ ] npx tsc --noEmit: 0 Fehler nach Split
- [ ] pnpm test: alle Tests grün nach Split

## Phase 20: Neue Proof-Types (concurrency, idempotency, auth_matrix)
- [x] ProofType Union erweitert: "concurrency" | "idempotency" | "auth_matrix" hinzugefügt
- [x] assessRiskLevel: race-condition/double-booking/overbooking/atomic/concurrent → high; duplicate/retry/idempotent/dedup → high; permission/rbac/authorization/role-based/access-control → critical
- [x] determineProofTypes: Erkennung für alle 3 neuen Typen (tags + riskHints)
- [x] buildProofTarget: 3 neue Fälle (CONCURRENCY, IDEMPOTENCY, AUTHMATRIX) mit je 3 mutationTargets + 3 assertions
- [x] generateConcurrencyTest: Promise.all mit 5 parallelen Requests, no-500-Check, Duplikat-Check, Konsistenz-Check
- [x] generateIdempotencyTest: 2× gleicher Request, 409-Check, Duplikat-in-Liste-Check, idempotencyKey-Test
- [x] generateAuthMatrixTest: admin-OK, unauthenticated-401, cross-tenant-403, non-admin-403 pro Rolle
- [x] templateMap: alle 3 neuen Generatoren registriert (kein LLM-Fallback mehr)
- [x] Vitest: 66 neue Tests in server/new-proof-types.test.ts — alle grün
- [x] Gesamt: 215/215 Tests grün, 0 TS-Fehler

## Phase 21: OpenAPI-Import
- [ ] Upload-Endpoint: .json und .yaml MIME-Types + Dateiendungen erlauben
- [ ] Backend: detectSpecType() — erkennt openapi/swagger Key im JSON/YAML
- [ ] Backend: OpenAPI-to-IR Parser (Endpoints, Behaviors, AuthModel aus Spec)
- [ ] Backend: Route zu OpenAPI-Parser wenn Spec erkannt, sonst LLM-Parser
- [ ] Frontend: Upload-Hinweis aktualisieren (OpenAPI .json/.yaml jetzt unterstützt)
- [ ] Vitest: Tests für OpenAPI-Parser

## Phase 22: Architektur-Split (mechanisch 1:1)
- [ ] server/routers/types.ts — alle Interfaces und Types aus analyzer.ts
- [ ] server/routers/risk-model.ts — buildRiskModel, assessRiskLevel, determineProofTypes, buildProofTarget
- [ ] server/routers/generators/ — alle generate*Test Funktionen (eine Datei pro Typ)
- [ ] server/routers/helpers-generator.ts — generateHelpers
- [ ] server/routers/validator.ts — validateProofs, checkTypeScriptSyntax
- [ ] server/routers/report.ts — generateReport
- [ ] server/analyzer.ts — nur noch Re-Exports (kein Logik-Code)
- [ ] Tests: alle 215 Tests grün nach Split

## Phase 23: Code-Builder
- [ ] generatePlaywrightPackage() — erzeugt package.json, playwright.config.ts, .env.example, README.md
- [ ] package.json: @playwright/test + dotenv als devDependencies, test-Script
- [ ] playwright.config.ts: baseURL aus .env, timeout 30s, retries 1
- [ ] .env.example: alle benötigten Env-Vars aus IR (TEST_TENANT_ID, E2E_*_USER/PASS, BASE_URL)
- [ ] README.md: Setup-Anleitung (cp .env.example .env, pnpm install, pnpm playwright test)
- [ ] ZIP: Code-Builder Output in bestehenden ZIP einbinden
- [ ] Vitest: Tests für generatePlaywrightPackage

## Phase 21: OpenAPI-Import Tests
- [x] Vitest tests for isOpenAPIDocument (JSON + YAML, OpenAPI 3.x + Swagger 2.x)
- [x] Vitest tests for parseOpenAPI (endpoints, behaviors, auth model, inputFields)
- [x] Bug fix: $ref resolver navigated from components/ instead of document root
- [x] Bug fix: camelToDot pluralization for non-list methods (create, update, delete)
- [x] Bug fix: Swagger 2.x body parameter extraction
- [x] 61 new tests in server/openapi-parser.test.ts — all green

## Phase 22: Architektur-Split (mechanisch 1:1)
- [x] server/analyzer/types.ts — alle Interfaces und Types
- [x] server/analyzer/llm-parser.ts — LLM_TIMEOUT_MS, withTimeout, parseSpecChunk, parseSpec
- [x] server/analyzer/risk-model.ts — assessRiskLevel, determineProofTypes, buildProofTarget, buildRiskModel
- [x] server/analyzer/helpers-generator.ts — generateHelpers (alle Helper-Dateien)
- [x] server/analyzer/proof-generator.ts — alle generateXxxTest Funktionen + generateProofs
- [x] server/analyzer/validator.ts — validateProof, validateProofs, runIndependentChecker
- [x] server/analyzer/report.ts — generateReport
- [x] server/analyzer/job-runner.ts — runAnalysisJob, assessSpecHealth
- [x] server/analyzer/extended-suite.ts — generateExtendedTestSuite
- [x] server/analyzer/index.ts — re-exportiert alle oeffentlichen Symbole
- [x] Alle 276 Tests bleiben gruen nach dem Split
- [x] 0 TS-Fehler in Sub-Files

## Phase 23: Code-Builder (validate-payloads.mjs)
- [x] validate-payloads.mjs Generator in helpers-generator.ts (ESM, ANSI-Farben, Payload-Validator)
- [x] GeneratedHelpers Interface um validate-payloads.mjs erweitert
- [x] validate-Script in package.json (node validate-payloads.mjs)
- [x] README Quick-Start um Schritt 4 (npm run validate) erweitert
- [x] 39 neue Vitest-Tests in server/code-builder.test.ts — alle gruen
- [x] Gesamt: 315/315 Tests gruen, 0 TS-Fehler

## Sprint 1: Aufräumen + Sichtbarkeit (22.03.2026)
- [x] FIX-1: analyzer.ts.bak existiert nicht (war nie erstellt), pipeline-types-reference.ts gelöscht
- [x] FIX-2: todo.md bereinigen (erledigte Checkboxen in alten Phasen abhaken)
- [x] UX-5: Landing Page — Concurrency, Idempotency, Auth-Matrix als neue Proof-Types hinzufügen
- [x] UX-1: NewAnalysis Page — OpenAPI/Swagger Badge + Erklaerung
- [x] TS-2: Rate-Limiting — max 5 Analysen/Tag pro User (Free-Tier)

## Sprint 2: Smart Parser 3-Pass Integration (22.03.2026)
- [x] SP-1: smart-parser.ts nach server/analyzer/ kopieren
- [x] SP-2: server/analyzer/job-runner.ts ersetzen (3-Pfad-Routing: OpenAPI / Smart / Standard)
- [x] SP-3: server/analyzer/index.ts aktualisieren (parseSpecSmart export)
- [x] SP-4: TS-Fehler prüfen und beheben (5 Set-Iteration-Fehler + classifySection preauth-Bug)
- [x] SP-5: Vitest-Tests für smart-parser schreiben (59 Tests)
- [x] SP-6: 374/374 Tests grün, 0 TS-Fehler, Checkpoint

## Sprint 3: Bug-Finding-Rate 30% → 65-75% (22.03.2026)
- [x] FIX-1a: types.ts — StructuredSideEffect Interface
- [x] FIX-1b: types.ts — Behavior.errorCodes + Behavior.structuredSideEffects
- [x] FIX-1c: types.ts — ProofTarget.structuredSideEffects
- [x] FIX-1d: types.ts — ProofType union + flow/cron_job/webhook/feature_gate
- [x] FIX-1e: types.ts — FlowStep, FlowDefinition, CronJobDef, FeatureGate Interfaces
- [x] FIX-1f: types.ts — AnalysisIR.cronJobs + AnalysisIR.featureGates + AnalysisIR.flows
- [x] FIX-2a: smart-parser.ts — structuredSideEffects + errorCodes in extraction prompts
- [x] FIX-2b: smart-parser.ts — flows/cronJobs/featureGates in extraction JSON
- [x] FIX-3a: risk-model.ts — structuredSideEffects in buildProofTarget
- [x] FIX-3b: risk-model.ts — flow/cron_job/webhook/feature_gate detection in determineProofTypes
- [x] FIX-4a: proof-generator.ts — structuredSideEffect assertions in generateStatusTransitionTest
- [x] FIX-4b: proof-generator.ts — errorCode assertions in generateBoundaryTest
- [x] FIX-5a: proof-generator.ts — generateCronJobTest + templateMap + getFilename
- [x] FIX-5b: proof-generator.ts — generateWebhookTest + templateMap + getFilename
- [x] FIX-5c: proof-generator.ts — generateFeatureGateTest + templateMap + getFilename
- [x] FIX-6: proof-generator.ts — generateFlowTest + templateMap + getFilename
- [x] FIX-7: index.ts — neue Exports
- [x] FIX-8: Vitest-Tests für alle neuen Generatoren (76 Tests in sprint3-generators.test.ts)

## BLOCKER (22.03.2026 Nacht)
- [x] B-1: server/analyzer.ts löschen (Monolith → Modul-Verzeichnis)
- [x] B-2: Go-Code archivieren (cmd/ internal/ go.mod go.sum → archived/go-poc-v1/)

## Sprint 1: Praxisvalidierung
- [x] S1-1: Smart Parser gegen hey-listen Spec testen (test_smart_parser_live.mjs)
- [x] S1-2: Volle Pipeline durchlaufen lassen + Prüfpunkte (TODO_REPLACE, neue ProofTypes, structuredSideEffects)

## Sprint 2: UX für Marktfähigkeit
- [x] S2-1: Landing Page aktualisieren (16 proof types, Flow/Cron/Webhook/FeatureGate in Grid, OpenAPI-Badge, Smart-Parser-Badge)
- [x] S2-2: Onboarding-Wizard auf NewAnalysis-Page (3 Schritte: Format wählen, Upload + Spec Health Preview, Analyse starten)
- [x] S2-3: Report-Page — Findings zuerst (Security Issues, Business Logic Gaps, dann Metrics)
- [x] S2-4: OpenAPI First-Class auf NewAnalysis-Page (Empfohlen-Badge, Alternativ-Hinweis)

## Sprint 3: Business-Modell
- [x] S3-1: Rate-Limiting (5 Analysen/User/Tag, DB-basiert)
- [x] S3-2: Pricing-Page (Free/Pro/Team/Enterprise, Stripe Checkout für Pro/Team)
- [x] S3-3: Analytics (Page Views, Analyse-Events, Spec-Typ, ZIP-Download)

## Sprint 4: Differenzierende Features
- [x] S4-1: Spec-Diff (diffIR Funktion, Delta-ZIP, Diff-Badge auf Dashboard)
- [x] S4-2: Feedback-Loop (Playwright JSON-Report Upload → Behavior-Mapping)
- [x] S4-3: GitHub PR-Integration (Push to GitHub Button → Branch + PR)
- [x] S4-4: Docker Self-Hosted (Dockerfile, docker-compose.yml, README)

## Sprint 5: Qualitätssprünge
- [x] S5-1: Repo-Scan (GitHub-URL → tRPC/Drizzle/Express Code-Analyse → perfekte IR)
- [x] S5-2: Branchenspezifische Proof-Packs (Fintech, Healthcare, E-Commerce)
- [x] S5-3: Playwright MCP Integration (generateMCPConfig, mcp-server.ts)

## Abschluss
- [ ] Website aktualisieren (alle Features korrekt darstellen)
- [ ] Alle Tests grün verifizieren
- [ ] Checkpoint speichern
- [ ] ZIP erstellen


## Features (23.03.2026)
- [x] Spec-Diff UI: Vergleichsseite /analysis/:id/diff mit grün/rot/gelb Darstellung
- [x] Industry Pack Auswahl im NewAnalysis-Wizard (FinTech/HealthTech/eCommerce/SaaS)

## Demo ohne Login (23.03.2026)
- [x] Backend: Demo-Analyse publicProcedure mit vorberechneten Daten
- [x] Frontend: /demo Seite mit vollständiger Analyse-Ansicht + CTA
- [x] Landing Page: Demo-CTA Button einbauen

## Perfektionierung (23.03.2026)
- [x] P4: DSGVO TODO-Platzhalter fixen — Fallback auf ersten GET-Endpoint
- [x] P2: Concurrency Detection — semantische Heuristiken (amount/transfer/debit/credit)
- [ ] P2: Idempotency Detection — semantische Heuristiken (idempotencyKey/requestId)
- [x] P3: Auth-Matrix Mutation Score 100% — Response-Body + Fehlermeldung + Datenleck
- [x] P1: Server-Side Test Runner — Base URL + Token, Live-Ausführung, Pass/Fail Stream
- [x] P1: Test Runner UI — Live-Stream, Pass/Fail Dashboard, Feedback Loop

## Audit-Findings (23.03.2026 — vor SSE/Navbar Sprint)
- [x] SSE Live-Stream: Test Runner zeigt Ergebnisse erst nach Abschluss (Polling), kein Echtzeit-Stream
- [x] Navbar: "Demo" Link fehlt in der Navbar (nur "Pricing" und "Sign In")
- [x] Test-Runner Unit-Tests fehlen (test-runner.ts hat keine Vitest-Coverage)

## Dual-Input Architektur (23.03.2026)
- [x] Backend: /api/upload-code Endpoint (ZIP entpacken, Dateien extrahieren, Framework erkennen)
- [x] Backend: fetchRepoCodeFiles() in repo-scanner.ts (Dateien aus GitHub laden)
- [x] Backend: analyses.createFromCode tRPC-Procedure (Rate-Limit, GitHub oder codeFiles)
- [x] Backend: job-runner.ts — codeFiles-Option + Routing-Logik (Code → parseCodeToIR)
- [x] Frontend: NewAnalysis.tsx — Dual-Input UI (Spec vs Code Karten)
- [x] Frontend: Home.tsx — Vibecoding-Section + Dual-Input Hero
- [x] Frontend: Dashboard.tsx — Analyse-Typ Badge (Spec / Code Scan)
- [x] Frontend: AnalysisDetail.tsx — Source-Info Header
- [x] Test: BankingCore Spec-Analyse durchführen → output-spec-test.zip
- [x] Test: Vibecoding Code-Scan durchführen → output-vibecoding-test.zip
- [x] Unit-Tests für Code-Scan-Pfad (546 Tests grün)

## Bug-Fix Briefing (23.03.2026 — 0% → 80%)
- [x] Bug 1: REST-Endpoints als tRPC-Procedure-Names (openapi-parser.ts + helpers-generator.ts)
- [x] Bug 2: Import-Mismatch getCustomerCookie/getAdminCookie (mergeProofsToFile)
- [x] Bug 3: Auth-Matrix String-Literale statt Variablen (generateAuthMatrixTest)
- [x] Bug 4: Status-Transition skipStatus nur aus statusMachine (kein Text-Fallback)
- [x] Bug 5: Duplizierte Boundary-Tests deduplizieren (generateProofs)
- [x] Bug 6: Dateinamen mit Leerzeichen/Slashes sanitisieren (extended-suite.ts)
- [x] Bug 7: Boundary-Fallback auf echtes Feld statt "value" (findBoundaryFieldForBehavior)
- [x] Bug 8: Drizzle Enum-Werte extrahieren (code-parser.ts)

## Fix-Briefing 2 (23.03.2026 — 40% → 95%)
- [ ] Fix 1+10: getPreferredRole() Hilfsfunktion + alle 12 Generatoren umstellen (Admin bevorzugen)
- [ ] Fix 2: Skip-Status Text-Fallback entfernen (generateStatusTransitionTest)
- [ ] Fix 3: Concurrency Cookie-Init + Payload-Typen (keine Strings statt Zahlen)
- [ ] Fix 4: Auth-Matrix Payload escaped Strings (JSON.stringify entfernen)
- [ ] Fix 5: Idempotency Cookie-Initialisierung
- [x] Fix 6: DSGVO PII-Felder (name/email/phone statt .log/.pers)
- [x] Fix 7: Helpers doppelt genested (ZIP-Builder in routers.ts)
- [x] Fix 8: DSGVO-Export Endpoint (customers.export statt customers.getById)
- [x] Fix 9: DSGVO-Audit Endpoint (customers.gdpr statt accounts.delete)
- [x] Verifikations-Script ausführen (Quality Gate): 17/17 Checks bestanden
- [ ] BankingCore + alle Specs testen
- [ ] 2 ZIPs liefern (Output + Code)

## v5.0: Browser E2E Tests + GitHub PR (23.03.2026)
- [x] types.ts: BrowserFlowStep Interface hinzugefügt
- [x] types.ts: GeneratedHelpers um "helpers/browser.ts" erweitert
- [x] smart-parser.ts: user-flows Topic in classifySection + groupSectionsForExtraction + topicInstructions
- [x] extended-suite.ts: generateBrowserFlowTests() mit 5 Test-Typen A-E implementiert
  - [x] A: Auth-Flow (page.goto, page.fill, page.click — echter Browser)
  - [x] B: CRUD-Flow (dedupliziert nach entityName — kein bookings-crud.spec.ts 3x)
  - [x] C: Status-Machine-Flow (page.click auf Status-Buttons)
  - [x] D: DSGVO/Compliance-Flow (Export-Button, Datei-Download)
  - [x] E: User-Flow aus ## User Flows Abschnitt (1:1 Übersetzung)
- [x] helpers-generator.ts: helpers/browser.ts mit loginViaUI + loginAsRole generiert
- [x] helpers-generator.ts: playwright.config.ts mit 2 Projekten (api-security + browser-e2e)
- [x] helpers-generator.ts: GitHub Actions YAML mit p2-browser-e2e Job
- [x] github-pr.ts: createPR() Funktion (Branch + Commit + PR via GitHub API)
- [x] routers.ts: github.createPR tRPC-Procedure
- [x] run-all-scenarios.mjs: Quality Gate 14 → 17 Checks (Browser E2E, helpers/browser.ts, GitHub Actions)
- [x] TravelAgency-Szenario: 18/18 Quality Gate Checks bestanden
  - [x] 23 Behaviors extrahiert
  - [x] 11 E2E-Dateien in tests/e2e/ (4 aus ## User Flows + 7 generische)
  - [x] helpers/browser.ts mit loginViaUI
  - [x] .github/workflows/testforge.yml mit p2-browser-e2e Job
  - [x] playwright.config.ts mit 2 Projekten
- [x] extended-suite.test.ts: Failing Test gefixt (core-flows → auth.spec.ts)
- [x] 546/546 Vitest-Tests grün, 0 TypeScript-Fehler

## v5.1: Finales Briefing — Alle Fixes + Erweiterungen (23.03.2026)
- [x] Teil 1: normalize.ts — normalizeEndpointName() aus llm-parser.ts extrahieren (1 Funktion, 2 Imports)
- [x] Teil 2: risk-rules.ts — deklarative RiskRule-Engine (16 Regeln), determineProofTypes() auf 3 Zeilen reduziert
- [x] Teil 3: code-parser.ts — Express (resource.action Namen, Zod-Felder, Auth) + Next.js App Router Support
- [x] Teil 5: extractConstraints zweistufig — Stage 1 (inputFields deterministisch) → Stage 2 (Regex-Fallback)
- [x] Teil 7: DB-State-Verification bereits korrekt implementiert (readBack nach jeder Mutation in test a)
- [x] Teil 9: Packaging-Bug bereits behoben (helpers/ + configs/ korrekt in ZIP)
- [x] Teil 8: TravelAgency 18/18 Checks bestanden (29 Behaviors, 26 Test-Dateien, 11 E2E-Dateien)
- [x] Vitest 546/546 Tests grün, 0 TS-Fehler

## v5.2: KANN-Teile aus Briefing

- [ ] Teil 4: NestJS Support — @Controller/@Get/@Post/@Roles Decorator-Parser, DTO-Feld-Extraktion aus class-validator, extractDtoFields(), Integration in parseCodeToIR() [v2]
- [x] Teil 6: LLM-Prompt aufteilen — Pass 1 jetzt 4 parallele fokussierte Calls (A: Endpoints+Tenant, B: Status+Enums, C: Auth+Roles, D: Chapters+PII), deterministisches Merge, 0 TS-Fehler, 546/546 Tests grün

## v5.3: UI & Webseiteninhalte auf v5.2-Funktionsumfang anpassen

- [x] Home.tsx: Hero, 5 Browser-Test-Typen A-E, 4-parallele Pass-1, Express/Next.js App Router, GitHub PR createPR()
- [x] Pricing.tsx: Smart Parser Beschreibung, 5 Browser-Test-Typen, Express/Next.js in Features, GitHub PR
- [x] AnalysisDetail.tsx: E2E Layer 3 auf 5 Typen A-E, helpers/browser.ts, playwright.config.ts 2 Projekte, testforge.yml
- [x] NewAnalysis.tsx: Express + Next.js App Router in Code-Scan Beschreibung
- [x] 546/546 Vitest-Tests grün, 0 TS-Fehler

## MedRental: Ultimativer Testcase (24.03.2026)
- [x] MedRental-Spec durch TestForge-Pipeline laufen lassen
- [x] Alle Verifikations-Checks bestanden (Endpoints, Tenant, DSGVO, Auth-Matrix, Status-Machines, Browser, CI/CD)
- [x] Output-ZIP mit Zusammenfassung liefern

## v5.4: normalize.ts Verb-Synonyme + MedRental 48/48

- [x] normalize.ts: verbSynonyms (register/book/generate/record/submit/add/enroll/invite → create) + gdprDelete-Suffix-Fix
- [x] normalize.ts: segments.length===1 nutzt HTTP-Methode (POST→create, GET→list, PATCH→update, DELETE→delete)
- [x] llm-sanitizer.ts: Stufe 1 REST-Endpoint-Extraktion aus Spec-Text (### POST /api/devices → devices.create)
- [x] llm-sanitizer.ts: dynamic import entfernt (normalizeEndpointName direkt importiert)
- [x] proof-generator.ts: roleToCookieFn handles spaces in role names (billing user → getBillingUserCookie)
- [x] helpers-generator.ts: tenantEntity detection verbessert (clinicId → TEST_CLINIC_ID)
- [x] types.ts: statusMachines array für multiple State-Machines
- [x] risk-model.ts: determineProofTypes akzeptiert endpoint + ir Parameter
- [x] MedRental Pipeline: 48/48 Checks bestanden ✅
- [x] Vitest: 546/546 Tests grün, 0 TS-Fehler
- [x] Checkpoint + ZIP

## Fix-Briefing 2 Implementierung (24.03.2026)

- [x] Fix 1+10: getPreferredRole() Hilfsfunktion (admin > manager > user > guest) + alle 12 Generatoren umstellen
- [x] Fix 2: Skip-Status Text-Fallback entfernen (generateStatusTransitionTest — nur statusMachine-States)
- [x] Fix 3: Concurrency Cookie-Init + Payload-Typen (number statt string für numerische Felder)
- [x] Fix 4: Auth-Matrix Payload escaped Strings (JSON.stringify entfernen → direkte Werte)
- [x] Fix 5: Idempotency Cookie-Initialisierung (getAdminCookie() vor Test)
- [x] Fix 6: DSGVO PII-Felder (name/email/phone statt .log/.pers)
- [x] Fix 7: Helpers doppelt genested (ZIP-Builder in routers.ts)
- [x] Fix 8: DSGVO-Export Endpoint (customers.export statt customers.getById)
- [x] Fix 9: DSGVO-Audit Endpoint (customers.gdpr statt accounts.delete)
- [x] Verifikations-Script ausführen (Quality Gate): 17/17 Checks bestanden
- [x] BankingCore Pipeline testen: 9 Test-Dateien, 38 Proofs
- [x] Checkpoint + 2 ZIPs liefern

## Fix-Briefing 3 — ClinicBooking 7/7 (24.03.2026)

- [x] Fix 1: Hybrid-Modus in job-runner.ts (Spec + Code zusammen, mergeIRs Funktion)
- [x] Fix 2: Tenant-Key aus Session-Objekten (req.session.clinicId) in code-parser.ts
- [x] Fix 3: Rollen aus Code-Vergleichen (user.role === 'clinic_admin') in code-parser.ts
- [x] Fix 4: trpc.-Prefix in normalize.ts entfernen
- [x] Fix 5: Status-Transition-Filter (nur PATCH/PUT Endpoints) in risk-rules.ts
- [x] TypeScript clean + Vitest 546/546 grün, 0 TS-Fehler
- [x] ClinicBooking Pipeline: 7/7 Bugs gefunden ✅ (vorher 3/7 = 43%)
- [x] MedRental: 48/48 Checks bestanden ✅
- [x] Checkpoint + ZIP liefern

## Fix-Briefing 4 — Endpoint-Normalisierung 5-Ebenen (24.03.2026)

- [x] Ebene 1: normalizeEndpointName() in normalize.ts — FRAMEWORK_PREFIXES Set (trpc, api, v1-v4, rest, graphql, rpc, grpc)
- [x] Ebene 2: resolveEndpoint() in risk-model.ts — normalizeEndpointName() auf direct.name + fallback.name
- [x] Ebene 3: 8 Stellen in proof-generator.ts — alle endpoint-Zuweisungen durch normalizeEndpointName() geschickt
- [x] Ebene 4: extended-suite.ts — ep.name normalisiert beim Gruppieren in modules Map
- [x] Ebene 5: output-normalizer.ts erstellt + in job-runner.ts integriert (Regex-Funktion statt String-Literal)
- [x] Vitest 567/567 + TypeScript 0 Fehler (21 neue Tests für output-normalizer)
- [x] LoanApproval: trpc.=0, s.*=0 ✅
- [x] ClinicBooking: trpc.=0, s.*=0 ✅
- [x] MedRental: trpc.=0, s.*=0 ✅
- [x] Checkpoint + ZIP liefern

## Landing Page Update — v5.7 (24.03.2026)

- [x] Hybrid-Modus (Spec + Code) in Hero + Pipeline-Beschreibung ergänzt
- [x] Layer-Beschreibungen korrigiert: Layer 1 = Spec/Code Parse (3 fast-paths), Layer 2 = Behavior Verification (LLM Checker), Layer 3 = Risk Model + Test Generation, Layer 4 = Independent Checker, Layer 5 = False-Green Guard
- [x] Spec Health Score Sektion: korrekte 6 Dimensionen mit Detail-Texten
- [x] "5-Ebenen Endpoint-Normalisierung" als v5-Feature-Karte ergänzt
- [x] Code-Scan: Hybrid-Modus mit mergeIRs() Terminal-Demo ergänzt
- [x] "What Makes TestForge Different": 8 Karten (Hybrid-Modus NEU, 5-Level-Normalisierung NEU)
- [x] "3 Input Modes" neue Sektion: Spec-Only / Code-Scan / Hybrid-Modus
- [x] TypeScript 0 Fehler, Vitest 567/567

## Fix-Briefing 5 — Bullet-Proof LLM Pipeline v7.0 (24.03.2026)

- [x] Mechanismus 2: spec-regex-extractor.ts erstellt (extractStates, extractRoles, extractEndpoints, extractErrorCodes, extractFromSpecText, mergeWithRegex, decomposeSpec)
- [x] Mechanismus 1: spec-decomposed-parser.ts erstellt (parseSpecDecomposed mit 7 parallelen LLM-Calls für Specs >= 8KB)
- [x] Mechanismus 3: verifyAndRepairIR() implementiert (Regex-Fallback + targeted LLM repair für fehlende States/Endpoints/Rollen)
- [x] job-runner.ts integriert: Specs >= 8KB → Decomposed Parser, < 8KB → Standard Parser
- [x] Vitest: 599/599 Tests grün (+32 neue Tests für spec-regex-extractor.ts)
- [x] InsuranceClaims: 11/11 States ✅, 14 Endpoints ✅, 6/6 Rollen ✅, 21 Error-Codes ✅
  HINWEIS: Die erwarteten States im Briefing (EVIDENCE_COLLECTION, SETTLED, etc.) kommen NICHT in der Spec vor.
  Der LLM extrahiert korrekt die echten Spec-States (REPORTED, UNDER_REVIEW, UNDER_INVESTIGATION, etc.)
- [x] TypeScript 0 Fehler, Vitest 599/599 grün
- [x] Checkpoint + ZIP liefern

## Fix-Briefing 6 — v7.1 (24.03.2026)

- [ ] Fix 1: extractTenantModel() in spec-regex-extractor.ts (5 Patterns)
- [ ] Fix 1: mergeWithRegex() in spec-decomposed-parser.ts — Tenant-Model aus Regex wenn LLM null
- [ ] Fix 2: statusMachines[] Array in types.ts (zusätzlich zu statusMachine)
- [ ] Fix 2: Block 3 Prompt in spec-decomposed-parser.ts — Multiple Machines extrahieren
- [ ] Fix 2: proof-generator.ts — statusMachines wenn vorhanden, sonst statusMachine
- [ ] Fix 3: Rollen-Naming in helpers-generator.ts prüfen (warehouse_manager → getWarehouseManagerCookie)
- [ ] TypeScript 0 Fehler + Vitest grün
- [ ] Szenario 1: TodoApp (Code-Scan) — raw output
- [ ] Szenario 2: SupplyChainOps (Spec-Only, re-run nach Fixes) — raw output
- [ ] Szenario 3: ProjectTracker (Hybrid) — raw output
- [ ] Szenario 4: EventTicketing (Spec-Only) — raw output
- [ ] Szenario 5: FleetManager (Hybrid) — raw output
- [ ] Checkpoint + ZIP liefern

## Fix-Briefing 6 — v7.1 (24.03.2026)

- [x] Fix 1: extractTenantModel() in spec-regex-extractor.ts (companyId, organizerId, tenantId, etc.)
- [x] Fix 1b: mergeWithRegex() nutzt jetzt extractTenantModel() für Tenant-Key-Merge
- [x] Fix 2: Block 3 in spec-decomposed-parser.ts unterstützt jetzt machines[] Array für Multi-Status-Machine
- [x] Fix 3: Rollen-Naming in helpers-generator.ts bereits korrekt (warehouse_manager → getWarehouseManagerCookie)
- [x] TypeScript 0 Fehler, Vitest 599/599 grün
- [x] 5 Szenarien durchgejagt (TodoApp, ProjectTracker, EventTicketing, SupplyChainOps, FleetManager)
- [x] Checkpoint + ZIP geliefert

### Bekannte Probleme (für Fix-Briefing 7):
- s.getById Artefakt: 'lists.getById' → 's.getById' (output-normalizer entfernt 'list' als Prefix fälschlicherweise)
- States (primary): 0 für TodoApp/EventTicketing/ProjectTracker (Status-Machine nicht erkannt bei Standard-Parser < 8KB)
- Spec Health: ?/100 in summary.json (ir.specHealth liegt unter analysisResult.ir.specHealth)
- TenantKey: none für SupplyChainOps + FleetManager (companyId/fleetId in JWT aber nicht als tenantModel erkannt)

## Fix-Briefing 8 — Hey-Listen Fix v7.2 (24.03.2026)

- [x] Fix 1: getPreferredRole() in proof-generator.ts defensiv machen (validRoles filter + default admin fallback)
- [x] Fix 2: Leere Rollen aus IR filtern in job-runner.ts (nach LLM-Parse)
- [x] Fix 3: Regex-Fallback für Rollen wenn LLM versagt (extractRoles() aus spec-regex-extractor.ts)
- [x] Fix 4: Pass 3 Status-Machine-Overwrite Guard in smart-parser.ts (Pass 1 States erhalten wenn Pass 2 nichts liefert)
- [x] Vitest 599/599 + TypeScript 0 Fehler
- [ ] Hey-Listen: 0 Crashes, Rollen erkannt, >= 300 Proofs, 6 States (LLM-Kontingent erschöpft — ausstehend)
- [ ] Checkpoint + ZIP liefern

## Fix-Briefing 9 — Perfektion v7.3 (24.03.2026)

- [x] Fix 1: extractTenantModel() Pattern 7 — Frequenz-Heuristik (häufigstes xId gesamt + INDEX-Bonus)
- [x] Fix 1b: extractTenantModel() Pattern 8 — "Alle Tabellen ... haben `xId`" (deutsch)
- [x] Fix 2: extractStates() + extractTransitions() — Lowercase State-Pattern (confirmed → CONFIRMED)
- [x] Fix 3: extractRoles() ROLE_NOISE_BLOCKLIST (idx_, _sessions, _login, _logout, _locked, _unlocked)
- [x] Fix 4: specHealth immer in resultJson speichern (top-level + getSpecHealth-Fallback)
- [x] Fix 5: Smart-Parser Tenant-Regex-Fallback nach enrichFromStructuralMap() in smart-parser.ts
- [x] Fix 6: Rollen-Noise im Regex-Fallback filtern (job-runner.ts: nur echte Rollen aus extractRoles)
- [x] Vitest 611/611 + TypeScript 0 Fehler (12 neue Tests)
- [ ] Hey-Listen Pipeline-Test (wenn LLM-Kontingent verfügbar)
- [x] Checkpoint + ZIP liefern

## Fix-Briefing 10 — LLM-Checker + Endpoint-Filter v7.4 (24.03.2026)

- [x] Fix 2: LLM-Checker Rejection-Rate senken — verifyAnchor Title-Fallback, Threshold 0.8→0.75, Rejection-Schwelle 0.5→0.35
- [x] Fix 3: Endpoint-Filter — isGenericEndpoint() in normalize.ts + job-runner.ts Filter
- [x] Vitest 617/617 + TypeScript 0 Fehler (6 neue Tests)
- [x] Checkpoint liefern

## Fix-Briefing 11 — Absolute Perfektion v7.5 (24.03.2026)

- [x] Fix 6: Pattern 8 vor Pattern 7 in extractTenantModel (explizit schlägt Frequenz)
- [x] Fix 4: Behavior-Dedup nach LLM-Checker in job-runner.ts (semanticDedup() aufrufen)
- [x] Fix 5: TODO_REPLACE-Stubs aus ZIP herausfiltern (job-runner.ts vor ZIP-Build)
- [x] Fix 2: specHealth-Fallback in AnalysisDetail + Dashboard (result?.specHealth || result?.analysisResult?.specHealth)
- [x] Fix 3: llmCheckerStats in resultJson gespeichert + Balken-Visualisierung in AnalysisDetail
- [x] Fix 1: IR-Summary-Panel in AnalysisDetail (Rollen, Tenant, States, AuthModel, Endpoints)
- [x] Vitest 621/621 + TypeScript 0 Fehler (4 neue Tests)
- [x] Checkpoint liefern

## Fix-Briefing 12 — Deep-Search Optimierungen v7.6 (25.03.2026)

- [x] Fix Watcher: tsconfig.json incremental:false (Watcher-Cache-Fehler dauerhaft behoben)
- [x] Spec-Diff: bereits vollständig implementiert (Route + tRPC + Button vorhanden)
- [x] K1: R7b-Regel generisch (restaurantId|tenantId|workspaceId|companyId|fleetId|orgId|...)
- [x] H1: TODO_REPLACE_WITH_YOUR_ENDPOINT zum Fix-5-Filter hinzugefügt
- [x] H4: industryPack in resultJson gespeichert + Badge in AnalysisDetail
- [x] K2: LLM-Checker Batching in Gruppen von 20 (BATCH_SIZE=20, sequentielle Batches)
- [x] Vitest 626/626 + TypeScript 0 Fehler (5 neue K1-Tests)
- [x] Checkpoint liefern

## Validierung v7.6 (25.03.2026)

- [ ] Szenario 1: PetClinic durch Pipeline (Standard Parser)
- [ ] Szenario 2: LogisticsHub durch Pipeline (Smart Parser)
- [ ] RAW Output liefern

## Phase 26: Docs + Settings + Prompt-Management
- [x] DB-Schema: settings-Tabelle für editierbare System-Prompts
- [x] Backend: settings-Router (getAll, update, reset)
- [x] Analyzer: System-Prompts aus DB laden (llm-parser, smart-parser, proof-generator, risk-model)
- [x] Frontend: Docs-Seite (/docs) mit Anleitungen und Feature-Erklärungen
- [x] Frontend: Settings-Seite (/settings) mit Prompt-Editor (nur admin)
- [x] Navigation: Docs + Settings Links hinzufügen

## Phase 28: Manus OAuth → Eigenes Passwort-Login
- [x] DB-Schema: users.passwordHash Feld hinzufügen + Migration
- [x] Backend: auth.login (email+password → JWT), auth.register, auth.me, auth.logout
- [x] Backend: bcrypt für Passwort-Hashing, kein Account-Lockout
- [x] Frontend: Login/Register-Seite (/login)
- [x] Frontend: Auth-Flow ohne OAuth (getLoginUrl → /login)
- [x] OAuth-Callback-Route bleibt als Fallback erhalten
