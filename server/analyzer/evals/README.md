# TestForge Eval Harness

This folder is the starting point for the benchmark suite that will decide whether TestForge deserves the "Gold Standard" label.

## What belongs here

- Gold-stack fixtures for `tRPC + Zod + Drizzle + TypeScript`
- Supported-stack fixtures for mixed TypeScript backends
- Experimental fixtures for weak vibecode inputs
- Regression fixtures with intentionally injected bugs

## Success criteria

- Tier and evidence level are classified correctly
- Gold readiness stays above the required threshold for benchmark cases
- Forbidden proof types never appear in conservative/minimal cases
- Required proof types remain present for gold fixtures

## Next step

Add real repo snapshots or minimized fixtures and run them through `eval-harness.ts` in CI.

## Current local quality rails

- `npm run eval:bug-zoo -- --json`
  Checks intentionally buggy mini-backends for must-detect and must-not-hallucinate behavior.
- `npm run eval:scoreboard -- --json`
  Combines the Bug Zoo, stack benchmark cases, external repo snapshot benchmarks, and local generated-output snapshots into one machine-readable scoreboard.
  It also breaks the Bug Zoo down by bug category and by proof type, so recall/precision gaps are visible at the proof-class level.
- `npm run eval:false-positives -- --json`
  Runs safe counterexamples that must not trigger static findings or risky proof types.
- `npm run eval:compare-baseline -- --json`
  Compares the current scoreboard to the committed quality baseline and writes a delta report.
- `npm run eval:external-repos-live -- --json`
  Runs the external repo contracts against live public GitHub content instead of the committed minimized snapshots. This is a reality-check rail, not a CI baseline rail.
  The scoreboard also tracks proof-type recall and precision across these external contracts, so public-repo gaps are visible per proof class.
  Each live run now also writes `artifacts/quality/live-repo-harvest.json` and `.md`, which categorize repos into confirmed hits, candidate misses, and watch-list items for bug-zoo follow-up.
  The same run also writes `artifacts/quality/live-repo-fixture-backlog.json` and `.md`, which rank the strongest next fixture candidates from the live suite.

## Planned real-repo benchmark flow

1. Snapshot a public vibecode repo into minimized fixtures.
2. Add one contract in `external-repo-benchmarks.ts` with repo URL, expected tier/evidence/proofs, and notes.
3. Add one regression case to the Bug Zoo if the repo exposed a real miss or hallucination.
4. Keep the scoreboard green before claiming improvements.
5. Keep the baseline comparison green before claiming "world class" stayed true.

## Live GitHub mode

- `external-repo-benchmarks.ts` is the contract source of truth.
- Default runs use `public_snapshot` data so CI stays deterministic.
- Live runs switch the same contracts to `live_github` and fetch real code/spec inputs from GitHub.
- Use `GITHUB_TOKEN` for better rate limits when running `npm run eval:external-repos-live -- --json`.

## Local snapshot benchmarks

The scoreboard also validates selected folders under `scenario-outputs/` as generated-output snapshots.
These are not replacements for public-repo benchmarks, but they are a good intermediate rail:

- they catch regressions in generated package structure
- they ensure the six-layer output stays structurally intact
- they keep local scenario artifacts aligned with current expectations

## Baseline and history

- `quality-baseline.json` is the committed reference point for quality gates.
- `artifacts/quality/scoreboard-compare.json` and `.md` capture the current run vs baseline.
- `artifacts/quality/history/latest.json` plus timestamped snapshots provide local trend points for manual inspection.
