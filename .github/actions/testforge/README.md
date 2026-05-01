# TestForge GitHub Action

Auto-generates API security/compliance tests from your spec on every PR. Posts a comment with proofs/mutation-score/coverage.

## Usage

Add to `.github/workflows/testforge.yml`:

```yaml
name: TestForge
on:
  pull_request:
    paths:
      - 'docs/api.md'
      - 'openapi.yaml'

jobs:
  testforge:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: KirschC007/Testforge/.github/actions/testforge@main
        with:
          testforge-token: ${{ secrets.TESTFORGE_TOKEN }}
          # Optional:
          spec-path: docs/api.md
          fail-on-delta: 'true'
```

## What you get on every PR

```
🛡️ TestForge — Quality Compiler

Metric              Value
Generated tests     47 proofs
Mutation score      83/100
Behavior coverage   91%

[Download generated test suite] [Full report]
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `testforge-token` | yes | — | Get from app.testforge.dev/settings |
| `spec-path` | no | (auto-detect) | Direct path to spec file |
| `spec-glob` | no | `docs/api.md,api.md,openapi.yaml,openapi.json` | Where to look |
| `testforge-url` | no | `https://api.testforge.dev` | Self-hosted URL |
| `github-token` | no | `${{ github.token }}` | For PR comments |
| `fail-on-delta` | no | `false` | Fail if mutation<70 or coverage<80% |

## Outputs (use in subsequent steps)

- `proof-count` — number of generated tests
- `mutation-score` — 0-100
- `coverage-pct` — 0-100

## Self-hosting

Run TestForge yourself, set `testforge-url` to your instance.
