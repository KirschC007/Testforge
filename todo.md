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
