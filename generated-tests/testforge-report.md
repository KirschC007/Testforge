# TestForge Validation Report

Generated: 2026-03-20 05:28:38

## Verdict

3/3 proofs passed validation (score: 10.0/10.0)

## Coverage

| Metric | Value |
|---|---|
| Total Behaviors | 13 |
| Covered | 3 |
| Coverage | 23.1% |

### Uncovered Behaviors

- SPEC-004.1
- SPEC-004.2
- SPEC-004.3
- SPEC-004.5
- SPEC-004.6
- SPEC-004.12
- SPEC-SEC-CSRF-001b
- SPEC-SEC-RATE-001
- SPEC-DSGVO-ART17-001
- SPEC-005.1

## Validated Proofs

### IDOR-001 — idor

- **File:** `tests/security/idor_001_test.ts`
- **Risk Level:** critical
- **Mutation Score:** 1.00

**Validation:**
  ✓ Rule 1: No if-wrapper instead of assertion
  ✓ Rule 2: Not existence-only assertions
  ✓ Rule 3: No broad status code checks
  ✓ Rule 4: Security tests must have side-effect check
  ✓ Rule 5: Security tests must have positive control
  ✓ Rule 6: Risk scoring tests must verify precondition
  ✓ Rule 7: No fake IDOR (non-existent tenant IDs)

### RISK-010 — risk_scoring

- **File:** `tests/integration/risk_010_test.ts`
- **Risk Level:** high
- **Mutation Score:** 1.00

**Validation:**
  ✓ Rule 1: No if-wrapper instead of assertion
  ✓ Rule 2: Not existence-only assertions
  ✓ Rule 3: No broad status code checks
  ✓ Rule 4: Security tests must have side-effect check
  ✓ Rule 5: Security tests must have positive control
  ✓ Rule 6: Risk scoring tests must verify precondition
  ✓ Rule 7: No fake IDOR (non-existent tenant IDs)

### CSRF-001 — csrf

- **File:** `tests/security/csrf_001_test.ts`
- **Risk Level:** critical
- **Mutation Score:** 1.00

**Validation:**
  ✓ Rule 1: No if-wrapper instead of assertion
  ✓ Rule 2: Not existence-only assertions
  ✓ Rule 3: No broad status code checks
  ✓ Rule 4: Security tests must have side-effect check
  ✓ Rule 5: Security tests must have positive control
  ✓ Rule 6: Risk scoring tests must verify precondition
  ✓ Rule 7: No fake IDOR (non-existent tenant IDs)

