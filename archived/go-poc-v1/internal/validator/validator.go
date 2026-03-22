// Package validator implements Schicht 4: Proof Validation.
// It takes a RawProofSuite and validates each proof against the False-Green rules.
// Proofs that fail validation are discarded with a documented reason.
// Only ValidatedProofs are passed to the output stage.
package validator

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/hey-listen/testforge/internal/proofgen"
)

// DiscardReason explains why a proof was rejected.
type DiscardReason string

const (
	DiscardConditionalAssertion DiscardReason = "conditional_assertion"  // if (x) { expect(x) }
	DiscardExistenceOnly        DiscardReason = "existence_only"         // only toBeDefined()
	DiscardNoMutationKill       DiscardReason = "no_mutation_kill"       // no boundary assertion
	DiscardBroadStatusCode      DiscardReason = "broad_status_code"      // toBeGreaterThanOrEqual(400)
	DiscardMissingPrecondition  DiscardReason = "missing_precondition"   // no baseline state
	DiscardCompileError         DiscardReason = "compile_error"          // syntax error
	DiscardFakeIDOR             DiscardReason = "fake_idor"              // non-existent tenant ID
)

// ValidatedProof is a proof that passed all validation checks.
type ValidatedProof struct {
	proofgen.RawProof
	MutationScore  float64 // 0.0–1.0
	ValidationNotes []string
}

// DiscardedProof is a proof that failed validation.
type DiscardedProof struct {
	RawProof proofgen.RawProof
	Reason   DiscardReason
	Details  string
}

// Verdict is the overall validation result.
type Verdict struct {
	Passed  int
	Failed  int
	Score   float64 // 0.0–10.0
	Summary string
}

// CoverageReport shows which spec requirements have proofs.
type CoverageReport struct {
	TotalBehaviors  int
	CoveredBehaviors int
	UncoveredIDs    []string
	CoveragePercent float64
}

// ValidatedProofSuite is the final output of Schicht 4.
type ValidatedProofSuite struct {
	Proofs          []ValidatedProof
	DiscardedProofs []DiscardedProof
	Verdict         Verdict
	Coverage        CoverageReport
}

// Validator runs all False-Green detection rules on a RawProofSuite.
type Validator struct {
	rules []rule
}

type rule struct {
	name    string
	check   func(code string) (bool, DiscardReason, string)
}

// NewValidator creates a validator with all False-Green detection rules.
func NewValidator() *Validator {
	v := &Validator{}
	v.rules = []rule{
		{
			name: "Rule 1: No if-wrapper instead of assertion",
			check: func(code string) (bool, DiscardReason, string) {
				// Pattern: if (x !== undefined) { expect(x)... }
				re := regexp.MustCompile(`if\s*\([^)]+!==\s*undefined\)\s*\{[^}]*expect\(`)
				if re.MatchString(code) {
					return false, DiscardConditionalAssertion,
						"Found conditional assertion pattern: if (x !== undefined) { expect(x)... }. " +
							"Use expect(x).toBeDefined() followed by unconditional assertions."
				}
				return true, "", ""
			},
		},
		{
			name: "Rule 2: Not existence-only assertions",
			check: func(code string) (bool, DiscardReason, string) {
				// Count assertions
				assertionRe := regexp.MustCompile(`expect\([^)]+\)\.(to\w+)`)
				matches := assertionRe.FindAllStringSubmatch(code, -1)

				if len(matches) == 0 {
					return false, DiscardExistenceOnly, "No assertions found in test"
				}

				// Check if ALL assertions are just toBeDefined/toBeTruthy
				weakOnly := true
				for _, m := range matches {
					method := m[1]
					if method != "toBeDefined" && method != "toBeTruthy" && method != "not" {
						weakOnly = false
						break
					}
				}
				if weakOnly && len(matches) > 0 {
					return false, DiscardExistenceOnly,
						"All assertions are existence-only (toBeDefined/toBeTruthy). " +
							"Add value assertions that would fail if the feature is broken."
				}
				return true, "", ""
			},
		},
		{
			name: "Rule 3: No broad status code checks",
			check: func(code string) (bool, DiscardReason, string) {
				// Pattern: toBeGreaterThanOrEqual(400) or toBeGreaterThan(399)
				broadRe := regexp.MustCompile(`toBeGreaterThan(OrEqual)?\(\s*[34]\d\d\s*\)`)
				if broadRe.MatchString(code) {
					return false, DiscardBroadStatusCode,
						"Found broad status code check (toBeGreaterThanOrEqual(400)). " +
							"Use expect([401, 403]).toContain(status) — 500 is a crash, not protection."
				}
				return true, "", ""
			},
		},
		{
			name: "Rule 4: Security tests must have side-effect check",
			check: func(code string) (bool, DiscardReason, string) {
				// For CSRF/IDOR tests: must check DB state or absence of data
				isSecurityTest := strings.Contains(code, "CSRF") || strings.Contains(code, "IDOR")
				if !isSecurityTest {
					return true, "", ""
				}

				hasDBCheck := strings.Contains(code, ".select()") ||
					strings.Contains(code, "db.") ||
					strings.Contains(code, "getBookings") ||
					strings.Contains(code, "bookings.length")

				hasPIICheck := strings.Contains(code, "not.toMatch") ||
					strings.Contains(code, "not.toContain")

				if !hasDBCheck && !hasPIICheck {
					return false, DiscardNoMutationKill,
						"Security test has no side-effect check. " +
							"A test that only checks HTTP status is insufficient — " +
							"add DB state verification or PII absence check."
				}
				return true, "", ""
			},
		},
		{
			name: "Rule 5: Security tests must have positive control",
			check: func(code string) (bool, DiscardReason, string) {
				// IDOR tests must have both negative (403) and positive (200) tests
				isIDORTest := strings.Contains(code, "IDOR")
				if !isIDORTest {
					return true, "", ""
				}

				hasPositive := strings.Contains(code, "positive control") ||
					strings.Contains(code, "CAN read") ||
					strings.Contains(code, "toBe(200)")

				if !hasPositive {
					return false, DiscardNoMutationKill,
						"IDOR test has no positive control. " +
							"If the server returns 403 for everything, all negative tests pass. " +
							"Add a test that verifies legitimate access works."
				}
				return true, "", ""
			},
		},
		{
			name: "Rule 6: Risk scoring tests must verify precondition",
			check: func(code string) (bool, DiscardReason, string) {
				isRiskTest := strings.Contains(code, "noShowRisk") || strings.Contains(code, "riskScoring")
				if !isRiskTest {
					return true, "", ""
				}

				// Must explicitly set and verify the baseline
				hasPreconditionSet := strings.Contains(code, "noShowRisk: 0")
				hasPreconditionVerify := strings.Contains(code, ".toBe(0)")

				if !hasPreconditionSet || !hasPreconditionVerify {
					return false, DiscardMissingPrecondition,
						"Risk scoring test does not verify precondition. " +
							"Must explicitly set noShowRisk=0 AND verify it is 0 before triggering the job. " +
							"Otherwise the test passes even if noShowRisk was already > 0."
				}
				return true, "", ""
			},
		},
		{
			name: "Rule 7: No fake IDOR (non-existent tenant IDs)",
			check: func(code string) (bool, DiscardReason, string) {
				// Pattern: restaurantId: 1 or restaurantId: 999 without TENANT_B reference
				isIDORTest := strings.Contains(code, "IDOR")
				if !isIDORTest {
					return true, "", ""
				}

				// Check if it uses TENANT_B constant (correct) vs hardcoded small ID (wrong)
				hasTenantBConst := strings.Contains(code, "TENANT_B.RESTAURANT_ID") ||
					strings.Contains(code, "TENANT_B_ID")

				hasFakeID := regexp.MustCompile(`restaurantId:\s*[1-9]\b`).MatchString(code) &&
					!hasTenantBConst

				if hasFakeID {
					return false, DiscardFakeIDOR,
						"IDOR test uses a hardcoded small restaurantId that likely does not exist. " +
							"Use TENANT_B.RESTAURANT_ID which is guaranteed to exist in the test database."
				}
				return true, "", ""
			},
		},
	}
	return v
}

// Validate runs all rules on the RawProofSuite and returns a ValidatedProofSuite.
func (v *Validator) Validate(suite *proofgen.RawProofSuite, behaviorIDs []string) *ValidatedProofSuite {
	result := &ValidatedProofSuite{}

	for _, proof := range suite.Proofs {
		validated, discarded := v.validateProof(proof)
		if discarded != nil {
			result.DiscardedProofs = append(result.DiscardedProofs, *discarded)
		} else {
			result.Proofs = append(result.Proofs, *validated)
		}
	}

	// Calculate verdict
	result.Verdict = v.calculateVerdict(result)

	// Calculate coverage
	result.Coverage = v.calculateCoverage(result.Proofs, behaviorIDs)

	return result
}

// validateProof runs all rules on a single proof.
func (v *Validator) validateProof(proof proofgen.RawProof) (*ValidatedProof, *DiscardedProof) {
	var notes []string

	for _, rule := range v.rules {
		ok, reason, details := rule.check(proof.Code)
		if !ok {
			return nil, &DiscardedProof{
				RawProof: proof,
				Reason:   reason,
				Details:  fmt.Sprintf("[%s] %s", rule.name, details),
			}
		}
		notes = append(notes, fmt.Sprintf("✓ %s", rule.name))
	}

	// Calculate mutation score
	mutationScore := v.calculateMutationScore(proof)

	return &ValidatedProof{
		RawProof:        proof,
		MutationScore:   mutationScore,
		ValidationNotes: notes,
	}, nil
}

// calculateMutationScore estimates how many mutations this test would catch.
// Score 0.0–1.0: 1.0 means the test kills all known mutation targets.
func (v *Validator) calculateMutationScore(proof proofgen.RawProof) float64 {
	if len(proof.MutationTargets) == 0 {
		return 0.5 // Default score when no explicit targets defined
	}

	killed := 0
	for _, target := range proof.MutationTargets {
		if target.ExpectedKill {
			// Check if the test has assertions that would catch this mutation
			if v.wouldKillMutation(proof.Code, target.Description) {
				killed++
			}
		}
	}

	if len(proof.MutationTargets) == 0 {
		return 0.5
	}
	return float64(killed) / float64(len(proof.MutationTargets))
}

// wouldKillMutation checks if the test code would detect a specific mutation.
func (v *Validator) wouldKillMutation(code, mutationDesc string) bool {
	desc := strings.ToLower(mutationDesc)

	// "Remove tenant check" → test must have status check [401,403]
	if strings.Contains(desc, "tenant check") || strings.Contains(desc, "restaurantid") {
		return strings.Contains(code, "[401, 403]") || strings.Contains(code, "toBe(403)")
	}

	// "Remove CSRF middleware" → test must check for 403
	if strings.Contains(desc, "csrf") {
		return strings.Contains(code, "toBe(403)")
	}

	// "Remove noShowRisk update" → test must check toBeGreaterThan(0)
	if strings.Contains(desc, "noshowrisk") || strings.Contains(desc, "risk") {
		return strings.Contains(code, "toBeGreaterThan(0)")
	}

	// "Block all requests" → test must have positive control (toBe(200))
	if strings.Contains(desc, "block all") {
		return strings.Contains(code, "toBe(200)")
	}

	return true // Default: assume it would kill
}

// calculateVerdict computes the overall validation verdict.
func (v *Validator) calculateVerdict(result *ValidatedProofSuite) Verdict {
	passed := len(result.Proofs)
	failed := len(result.DiscardedProofs)
	total := passed + failed

	score := 0.0
	if total > 0 {
		score = float64(passed) / float64(total) * 10.0
	}

	summary := fmt.Sprintf("%d/%d proofs passed validation (score: %.1f/10.0)", passed, total, score)
	if failed > 0 {
		summary += fmt.Sprintf(" — %d proofs discarded", failed)
	}

	return Verdict{
		Passed:  passed,
		Failed:  failed,
		Score:   score,
		Summary: summary,
	}
}

// calculateCoverage checks which behaviors have at least one validated proof.
func (v *Validator) calculateCoverage(proofs []ValidatedProof, behaviorIDs []string) CoverageReport {
	covered := make(map[string]bool)
	for _, p := range proofs {
		covered[p.BehaviorID] = true
	}

	var uncovered []string
	for _, id := range behaviorIDs {
		if !covered[id] {
			uncovered = append(uncovered, id)
		}
	}

	total := len(behaviorIDs)
	coveredCount := total - len(uncovered)
	pct := 0.0
	if total > 0 {
		pct = float64(coveredCount) / float64(total) * 100.0
	}

	return CoverageReport{
		TotalBehaviors:   total,
		CoveredBehaviors: coveredCount,
		UncoveredIDs:     uncovered,
		CoveragePercent:  pct,
	}
}
