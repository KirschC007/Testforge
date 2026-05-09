# TestForge Launch Readiness

This document tracks the public-launch checklist for TestForge.

## Legal

- Replace all `TODO` placeholders in `/impressum`, `/datenschutz`, `/agb`, and `/avv`.
- Finalize company/operator name, address, support email, privacy contact, and sales contact.
- List all processors: hosting, database, object storage, LLM/API provider, email, payment, monitoring.
- Define artifact retention by plan.
- Review AGB, Datenschutzerklärung, Impressum, and AVV with qualified legal counsel before paid launch.

## Product

- Free launch model: one free full-strength analysis per user.
- Paid follow-up model: single credits or credit packs.
- Keep proof types fully enabled on free run; limit quantity, not quality.
- Keep generated ZIP downloadable after first run to create the product aha moment.

## Operations

- Production URL configured via `APP_BASE_URL`.
- Database and object storage backups enabled.
- Monitoring and error alerts connected.
- Support inbox configured.
- Abuse/rate-limit monitoring enabled for upload and analysis endpoints.

## Security

- Security headers enabled.
- Upload hardening enabled.
- SSRF guard enabled for live URLs.
- Secrets redaction for secret-like code upload files.
- Live execution must only target user-authorized systems.

## Evidence

- `npm run quality:gate` must pass before launch.
- Keep `artifacts/quality/scoreboard.md` and `scoreboard-compare.md` as public proof material.
- Run live repo benchmarks with `GITHUB_TOKEN` before public claims about broad real-world coverage.
