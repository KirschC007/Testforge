# TestForge

> Turn any API spec into a complete Playwright test suite — security, compliance, performance, accessibility — in under 3 minutes.

**One spec in. 35 categories of tests out.** No other tool does this combination.

---

## What you get from one Markdown / OpenAPI / tRPC spec

A complete, runnable test package containing:

```
tests/
├── security/         IDOR · CSRF · SQL injection · XSS · mass assignment · auth matrix
├── business/         Boundary values · business logic · feature gates
├── compliance/       GDPR · audit log · WCAG 2.1 AA
├── concurrency/      Race conditions · idempotency · concurrent writes · DB transactions
├── integration/      Status transitions · stateful CRUD sequences · webhooks · cron jobs
├── e2e/              Smart forms · user journeys · perf budgets · visual regression · network conditions
├── property/         fast-check fuzz tests with 5 invariants
├── traffic/          HAR-replay tests (when imported from browser DevTools)
└── accessibility/    Full WCAG 2.1 AA per-criterion audit

helpers/             api · auth · factories · schemas · browser
playwright.config.ts 5 browser/device matrix (Chromium, Firefox, WebKit, mobile)
mock-server.mjs      Native HTTP mock from your spec — frontend devs start instantly
mutation-sandbox.mjs Real mutation testing of helpers (Stryker integration)
mock + heal + analyze:flakiness + visual-diff-report scripts
.github/workflows/   Ready-to-commit CI pipeline
```

## The numbers

- **35 ProofTypes** generated from one spec
- **1032 self-tests** for TestForge itself, **CI-gated** at ≥70% coverage
- **0 TypeScript errors** in generator AND in generated package
- **<3 seconds** to generate 30+ files for a typical 5-endpoint API
- **Generated package npm-installs cleanly** and `tsc --noEmit` passes (verified in CI)

## Killer features no other tool combines

| Feature | What only TestForge does |
|---------|-------------------------|
| **Multi-format input** | Accepts Markdown, OpenAPI, tRPC/Drizzle code, AND HAR files |
| **IDOR/multi-tenant focus** | Auto-extracts tenant model from spec, generates cross-tenant tests |
| **Mutation-aware tests** | Every `expect()` has `// Kills:` comment; real mutation sandbox verifies |
| **Stateful API sequences** | Auto-chain create→read→update→list→delete with data flow checks |
| **AI-native dev loop** | Conversational refinement (`/api/refine-test`) + failure auto-diagnosis |
| **Compliance reports** | SOC 2, HIPAA, PCI-DSS, GDPR audit-ready Markdown with evidence per criterion |
| **Active security scanner** | SSRF-safe `/api/security-scan` runs probes against live URLs |
| **Mock server from spec** | Same spec → tests + Express-style mock; frontend devs need no backend |
| **Compliance evidence** | Maps tests to specific WCAG / SOC2 / HIPAA / PCI-DSS criteria |

## How to test changes

```bash
pnpm install
pnpm run test           # 1032 unit + integration tests
pnpm run test:smoke     # HTTP endpoint smoke tests
pnpm run test:coverage  # with coverage report (gate: ≥70%)
pnpm run test:pipeline  # full pipeline: generate → npm install → tsc → mock probe
pnpm run check          # tsc --noEmit on TestForge itself
pnpm run build          # production bundle
```

**Before any release:** `pnpm run test:pipeline` MUST pass. It catches the bug class unit tests miss (template-escape, missing imports, strict-TS errors in generated code, npm install failures). This is enforced in CI.

## CI status

Every push runs 4 jobs:
1. **Unit + Integration + Coverage** — 1032 tests, coverage ≥70% gate
2. **HTTP Smoke Tests** — supertest against the express middleware
3. **Production Build** — vite + esbuild bundle
4. **Generated Package End-to-End** — full pipeline: generates a package, npm-installs it, type-checks the generated code, starts the generated mock server

Total CI time: ~45 seconds. All 4 must pass.

## Architecture (high level)

```
Spec input → Layer 1: Parse (LLM or deterministic for code/HAR)
           → Layer 2: Risk Model (declarative rules → ProofTargets)
           → Layer 3: Proof Generation (templates per ProofType)
           → Layer 4: Validator (R1-R11 quality gates, // Kills: required)
           → Layer 5: Independent Checker (LLM rework loop, optional)
           → Layer 6: Helpers + Mock + Config generation
           → Layer 7: Markdown report

Output:    A complete npm package in ZIP, ready to commit.
```

## Project structure

```
server/
├── _core/           ssrf-guard · rate-limit · llm · sdk · server entry
├── analyzer/        the 7-layer pipeline (~17 modules, 35 ProofTypes)
│   ├── proof-generator.ts        all 35 generators (5400+ lines, modular)
│   ├── risk-rules.ts             declarative trigger rules
│   ├── helpers-generator.ts      output package files
│   ├── compliance-packs.ts       SOC2 · HIPAA · PCI-DSS · GDPR mappings
│   ├── failure-analyzer.ts       AI-native test failure diagnosis
│   ├── test-refiner.ts           conversational refinement
│   ├── active-scanner.ts         live security probing (SSRF-safe)
│   ├── har-parser.ts             traffic-based test generation
│   └── ...
├── routers.ts       tRPC API
└── db.ts            drizzle schema + queries

client/             React/Vite frontend (NewAnalysis page is the entry UX)
e2e/                Playwright E2E for TestForge's own UI
scripts/            full-pipeline-e2e.ts + verification utilities
.github/actions/    Composite GitHub Action for one-line PR integration
```

## Stack

TypeScript · Vite · Express · tRPC · Drizzle · MySQL · Vitest · Playwright · pnpm · Node 20

## License

MIT
