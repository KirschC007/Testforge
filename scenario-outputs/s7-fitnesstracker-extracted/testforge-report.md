# TestForge Report v3.0 — FitnessTracker

Generated: 2026-03-23 15:52:20 | Spec Type: code:tRPC + Drizzle + Express + Zod | Quality Score: 80.0/10.0

## Verdict

**25/25 proofs passed validation (score: 10.0/10.0)**

| Metric | Value |
|---|---|
| Verdict Score | 10.0/10.0 |
| Behaviors Extracted | 10 |
| API Endpoints Discovered | 7 |
| Coverage | 100% (10/10) |
| Validated Proofs | 25 |
| Discarded Proofs | 0 |
| IDOR Attack Vectors | 6 |
| CSRF Endpoints | 6 |

## LLM Checker Results

| Verdict | Count |
|---|---|
| ✅ Approved | 10 |
| ⚠️ Flagged | 0 |
| ❌ Rejected (hallucinated) | 0 |
| Avg Confidence | 100% |

## Risk Distribution

| Level | Count |
|---|---|
| 🔴 Critical | 9 |
| 🟠 High | 0 |
| 🟡 Medium | 1 |
| 🟢 Low | 0 |

## Validated Proofs

### PROOF-B-001-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-001-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-001-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-001-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** critical
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-002-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** medium
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-002-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** medium
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-003-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-003-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-003-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-004-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-004-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-004-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-005-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-005-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-005-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-006-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-006-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-006-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-006-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** critical
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-007-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-007-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-007-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-008-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-009-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-010-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs


## Getting Started

```bash
npm install
npx playwright install --with-deps chromium
BASE_URL=https://your-staging-url.com npx playwright test --list
BASE_URL=https://your-staging-url.com npx playwright test
```

Red test = Bug found. Green test = Spec correctly implemented. Both are success.
