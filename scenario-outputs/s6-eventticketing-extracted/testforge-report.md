# TestForge Report v3.0 — EventTicketing

Generated: 2026-03-23 15:52:20 | Spec Type: api-spec | Quality Score: 8.0/10.0

## Verdict

**76/76 proofs passed validation (score: 10.0/10.0)**

| Metric | Value |
|---|---|
| Verdict Score | 10.0/10.0 |
| Behaviors Extracted | 55 |
| API Endpoints Discovered | 7 |
| Coverage | 76% (42/55) |
| Validated Proofs | 76 |
| Discarded Proofs | 0 |
| IDOR Attack Vectors | 7 |
| CSRF Endpoints | 2 |

## LLM Checker Results

| Verdict | Count |
|---|---|
| ✅ Approved | 55 |
| ⚠️ Flagged | 0 |
| ❌ Rejected (hallucinated) | 0 |
| Avg Confidence | 100% |

## Risk Distribution

| Level | Count |
|---|---|
| 🔴 Critical | 20 |
| 🟠 High | 16 |
| 🟡 Medium | 11 |
| 🟢 Low | 8 |

## Validated Proofs

### PROOF-B-001-IDOR — IDOR
- **File:** `tests/security/idor.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-001-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-002-IDOR — IDOR
- **File:** `tests/security/idor.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-002-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-008-IDOR — IDOR
- **File:** `tests/security/idor.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-008-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-009-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-009-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-010-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-010-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-011-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-011-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-012-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-012-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-012-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** critical
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-013-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-013-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-013-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** critical
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-014-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-014-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-014-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** critical
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-015-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-016-CSRF — CSRF
- **File:** `tests/security/csrf.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-017-IDOR — IDOR
- **File:** `tests/security/idor.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-017-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-018-IDOR — IDOR
- **File:** `tests/security/idor.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-018-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-019-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** medium
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-027-BOUND — BOUNDARY
- **File:** `tests/business/boundary.spec.ts`
- **Risk:** medium
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-029-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** medium
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-030-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** medium
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-031-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** medium
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-032-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** medium
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-033-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-033-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-033-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-034-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-035-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-035-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-036-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-036-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-036-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-037-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-037-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-037-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-038-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-038-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-039-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-039-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-040-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-040-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-041-BL — BUSINESS_LOGIC
- **File:** `tests/business/logic.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-041-AUTHMATRIX — AUTH_MATRIX
- **File:** `tests/security/auth-matrix.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-042-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-043-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-043-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-044-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-044-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-045-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-045-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-046-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-046-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-047-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-047-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-048-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-048-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-048-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-049-STATUS — STATUS_TRANSITION
- **File:** `tests/integration/status-transitions.spec.ts`
- **Risk:** high
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-049-CONCURRENCY — CONCURRENCY
- **File:** `tests/concurrency/race-conditions.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-049-IDEMPOTENCY — IDEMPOTENCY
- **File:** `tests/integration/idempotency.spec.ts`
- **Risk:** high
- **Mutation Score:** 33%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-050-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-051-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-052-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-053-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-054-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

### PROOF-B-055-DSGVO — DSGVO
- **File:** `tests/compliance/dsgvo.spec.ts`
- **Risk:** critical
- **Mutation Score:** 100%
- **Validation:** ✓ R1: No if-wrapper assertions, ✓ R2: Has value assertions, ✓ R3: No broad status codes, ✓ R4: Has side-effect check, ✓ R5: Has positive control, ✓ R6: Baseline present, ✓ R8: Preconditions verified, ✓ R7: Has mutation-kill comments, ✓ R7b: No fake IDOR IDs

## Uncovered Behaviors

- **B-003**: Attendees are global and can buy from any organizer
- **B-004**: System returns JWT upon successful login
- **B-005**: JWT contains userId, organizerId, and role
- **B-006**: organizerId in JWT is null for attendees
- **B-007**: System rate limits failed login attempts
- **B-020**: System returns 400 DATE_TOO_SOON if event date is less than 7 days from now
- **B-021**: earlyBirdPrice must be less than ticketPrice
- **B-022**: earlyBirdDeadline must be before event date
- **B-023**: Event must exist and be published for order creation
- **B-024**: System returns 404 if event does not exist or is not published for order creation
- **B-025**: Event must not be sold out for order creation
- **B-026**: System returns 422 SOLD_OUT if event is sold out for order creation
- **B-028**: System returns 422 EVENT_PAST if event is in past for order creation

## Getting Started

```bash
npm install
npx playwright install --with-deps chromium
BASE_URL=https://your-staging-url.com npx playwright test --list
BASE_URL=https://your-staging-url.com npx playwright test
```

Red test = Bug found. Green test = Spec correctly implemented. Both are success.
