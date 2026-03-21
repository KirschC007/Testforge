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
