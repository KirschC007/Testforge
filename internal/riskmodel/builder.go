package riskmodel

import (
	"fmt"
	"strings"

	"github.com/hey-listen/testforge/internal/ir"
)

// Builder constructs a RiskModel from an AnalysisResult.
// It MUST NOT be called if AnalysisResult has unresolved Ambiguities.
type Builder struct{}

// NewBuilder creates a new RiskModel builder.
func NewBuilder() *Builder {
	return &Builder{}
}

// Build constructs the RiskModel from the analysis result.
// Returns an error if there are unresolved ambiguities or contradictions.
func (b *Builder) Build(analysis *ir.AnalysisResult) (*RiskModel, error) {
	// Gate: Do not proceed with unresolved ambiguities
	unresolved := 0
	for _, a := range analysis.Ambiguities {
		if !a.Answered {
			unresolved++
		}
	}
	if unresolved > 0 {
		return nil, fmt.Errorf("cannot build risk model: %d unresolved ambiguities — clarify before proceeding", unresolved)
	}

	model := &RiskModel{}

	// Score all behaviors
	for _, behavior := range analysis.IR.Behaviors {
		scored := b.scoreBehavior(behavior)
		model.Behaviors = append(model.Behaviors, scored)
	}

	// Build tenant model
	if analysis.IR.TenantModel != nil {
		model.TenantModel = b.buildTenantModel(analysis.IR)
	}

	// Build security model
	model.SecurityModel = b.buildSecurityModel(analysis.IR)

	// Generate proof targets
	model.ProofTargets = b.generateProofTargets(model)

	return model, nil
}

// scoreBehavior assigns a risk level and proof types to a behavior.
func (b *Builder) scoreBehavior(behavior ir.Behavior) ScoredBehavior {
	scored := ScoredBehavior{
		Behavior: behavior,
	}

	// Determine risk level based on tags and risk hints
	scored.RiskLevel = b.assessRiskLevel(behavior)
	scored.ProofTypes = b.determineProofTypes(behavior)
	scored.Priority = b.determinePriority(scored.RiskLevel)
	scored.Rationale = b.buildRationale(behavior, scored.RiskLevel)

	return scored
}

// assessRiskLevel determines the risk level of a behavior.
func (b *Builder) assessRiskLevel(behavior ir.Behavior) RiskLevel {
	tags := strings.Join(behavior.Tags, " ")
	hints := strings.Join(behavior.RiskHints, " ")
	combined := tags + " " + hints

	// Critical: Security violations that expose data or bypass auth
	if strings.Contains(combined, "idor") ||
		strings.Contains(combined, "csrf") ||
		strings.Contains(combined, "cross-tenant") ||
		strings.Contains(combined, "bypass") {
		return RiskCritical
	}

	// Critical: DSGVO violations
	if strings.Contains(combined, "pii-leak") ||
		strings.Contains(combined, "dsgvo") ||
		strings.Contains(combined, "gdpr") {
		return RiskCritical
	}

	// High: Business logic that directly affects money or data integrity
	if strings.Contains(combined, "booking") && strings.Contains(combined, "limit") {
		return RiskHigh
	}
	if strings.Contains(combined, "no-show") || strings.Contains(combined, "risk-scoring") {
		return RiskHigh
	}
	if strings.Contains(combined, "status") {
		return RiskHigh
	}

	// Medium: Validation and functional errors
	if strings.Contains(combined, "validation") {
		return RiskMedium
	}

	return RiskLow
}

// determineProofTypes determines what kinds of proofs are needed.
func (b *Builder) determineProofTypes(behavior ir.Behavior) []ProofType {
	var types []ProofType
	seen := make(map[ProofType]bool)

	add := func(t ProofType) {
		if !seen[t] {
			seen[t] = true
			types = append(types, t)
		}
	}

	for _, hint := range behavior.RiskHints {
		switch hint {
		case "idor", "cross-tenant":
			add(ProofIDOR)
		case "csrf", "state-change":
			add(ProofCSRF)
		case "brute-force":
			add(ProofRateLimit)
		case "pii-leak":
			add(ProofDSGVO)
		}
	}

	for _, tag := range behavior.Tags {
		switch tag {
		case "idor", "multi-tenant":
			add(ProofIDOR)
		case "csrf":
			add(ProofCSRF)
		case "rate-limiting":
			add(ProofRateLimit)
		case "dsgvo", "privacy", "gdpr":
			add(ProofDSGVO)
		case "status":
			add(ProofStatusTransition)
		case "no-show", "risk-scoring", "cron":
			add(ProofRiskScoring)
		case "validation", "limits":
			add(ProofBoundary)
		case "booking":
			add(ProofBusinessLogic)
		}
	}

	if len(types) == 0 {
		types = append(types, ProofBusinessLogic)
	}

	return types
}

// determinePriority assigns P0/P1/P2 based on risk level.
func (b *Builder) determinePriority(level RiskLevel) int {
	switch level {
	case RiskCritical:
		return 0
	case RiskHigh:
		return 0
	case RiskMedium:
		return 1
	default:
		return 2
	}
}

// buildRationale explains why this risk level was assigned.
func (b *Builder) buildRationale(behavior ir.Behavior, level RiskLevel) string {
	switch level {
	case RiskCritical:
		return fmt.Sprintf("Critical: %s involves security boundary or PII exposure. "+
			"A failure here means data breach or auth bypass.", behavior.Title)
	case RiskHigh:
		return fmt.Sprintf("High: %s affects core business logic. "+
			"A failure here means incorrect system behavior with financial or operational impact.", behavior.Title)
	case RiskMedium:
		return fmt.Sprintf("Medium: %s is a validation rule. "+
			"A failure here means incorrect user feedback but no data breach.", behavior.Title)
	default:
		return fmt.Sprintf("Low: %s is a minor functional requirement.", behavior.Title)
	}
}

// buildTenantModel constructs the tenant isolation model.
func (b *Builder) buildTenantModel(spec *ir.SpecIR) TenantModel {
	model := TenantModel{
		TenantEntity:  spec.TenantModel.TenantEntity,
		TenantIDField: spec.TenantModel.TenantIDField,
	}

	// Build isolated resources from spec resources
	for _, res := range spec.Resources {
		hasPII := false
		for _, f := range res.Fields {
			if f.IsPII {
				hasPII = true
				break
			}
		}
		model.IsolatedResources = append(model.IsolatedResources, IsolatedResource{
			Name:       res.Name,
			Table:      res.Table,
			TenantKey:  res.TenantKey,
			Operations: res.Operations,
			HasPII:     hasPII,
		})
	}

	// Auto-generate cross-tenant attack vectors for every isolated resource
	for _, res := range model.IsolatedResources {
		for _, op := range res.Operations {
			if op == "read" || op == "create" {
				vector := CrossTenantVector{
					Resource:    res.Name,
					Operation:   op,
					AttackPath:  fmt.Sprintf("%s.%s with restaurantId=TENANT_B", res.Table, op),
					ExpectedHTTP: []int{401, 403},
				}
				if res.HasPII {
					vector.MustNotLeak = []string{"phone", "email", "name", "guestPhone", "guestEmail", "guestName"}
				}
				model.AttackVectors = append(model.AttackVectors, vector)
			}
		}
	}

	return model
}

// buildSecurityModel constructs the security attack surface model.
func (b *Builder) buildSecurityModel(spec *ir.SpecIR) SecurityModel {
	model := SecurityModel{}

	// CSRF endpoints: all state-changing operations
	model.CSRFEndpoints = []CSRFEndpoint{
		{
			Path:        "/api/trpc/reservations.create",
			Method:      "POST",
			TokenHeader: "X-CSRF-Token",
			SideEffect:  "reservation row in database",
		},
		{
			Path:        "/api/trpc/guests.update",
			Method:      "POST",
			TokenHeader: "X-CSRF-Token",
			SideEffect:  "guest row update in database",
		},
	}

	// Rate-limited endpoints
	model.RateLimitedEndpoints = []RateLimitedEndpoint{
		{
			Path:         "/api/auth/login",
			MaxAttempts:  10,
			WindowSecs:   300,
			ExpectedHTTP: 429,
		},
	}

	return model
}

// generateProofTargets creates specific proof targets from the risk model.
func (b *Builder) generateProofTargets(model *RiskModel) []ProofTarget {
	var targets []ProofTarget

	for _, scored := range model.Behaviors {
		if scored.Priority > 0 {
			continue // Only P0 for MVP
		}

		for _, pt := range scored.ProofTypes {
			target := b.buildProofTarget(scored, pt, model)
			if target != nil {
				targets = append(targets, *target)
			}
		}
	}

	return targets
}

// buildProofTarget creates a ProofTarget for a specific behavior and proof type.
func (b *Builder) buildProofTarget(scored ScoredBehavior, pt ProofType, model *RiskModel) *ProofTarget {
	behavior := scored.Behavior

	switch pt {
	case ProofIDOR:
		return &ProofTarget{
			ID:          fmt.Sprintf("PROOF-%s-IDOR", behavior.ID),
			BehaviorID:  behavior.ID,
			ProofType:   ProofIDOR,
			RiskLevel:   scored.RiskLevel,
			Description: fmt.Sprintf("Prove that %s cannot be accessed cross-tenant", behavior.Object),
			Preconditions: []string{
				"TENANT_A and TENANT_B both exist in test database",
				"User authenticated as TENANT_A",
				"Resource exists in TENANT_B",
			},
			Assertions: []ProofAssertion{
				{
					Type:      "http_status",
					Target:    "response",
					Operator:  "in",
					Value:     []int{401, 403},
					Rationale: "401=not authenticated, 403=not authorized. 500 is a crash, not protection.",
				},
				{
					Type:      "field_absent",
					Target:    "response.error.data",
					Operator:  "not_contains",
					Value:     "TENANT_B_PII",
					Rationale: "Error response must not leak PII from the target tenant",
				},
			},
			MutationTargets: []MutationTarget{
				{Description: "Remove restaurantId check in query WHERE clause", ExpectedKill: true},
				{Description: "Return all records without tenant filter", ExpectedKill: true},
			},
		}

	case ProofCSRF:
		if behavior.ID == "SPEC-SEC-CSRF-001a" {
			return &ProofTarget{
				ID:         "PROOF-CSRF-001a",
				BehaviorID: behavior.ID,
				ProofType:  ProofCSRF,
				RiskLevel:  scored.RiskLevel,
				Description: "Prove that POST without X-CSRF-Token is rejected AND no DB write occurs",
				Preconditions: []string{
					"User is authenticated (valid session cookie)",
					"No X-CSRF-Token header in request",
				},
				Assertions: []ProofAssertion{
					{
						Type:      "http_status",
						Target:    "response",
						Operator:  "eq",
						Value:     403,
						Rationale: "Must be exactly 403, not 200 or 500",
					},
					{
						Type:      "db_state",
						Target:    "reservations WHERE guestPhone = testPhone",
						Operator:  "eq",
						Value:     0,
						Rationale: "Side-effect check: no booking must have been created",
					},
				},
				MutationTargets: []MutationTarget{
					{Description: "Remove CSRF middleware from route", ExpectedKill: true},
					{Description: "Accept requests without CSRF token", ExpectedKill: true},
				},
			}
		}
		if behavior.ID == "SPEC-SEC-CSRF-001b" {
			return &ProofTarget{
				ID:         "PROOF-CSRF-001b",
				BehaviorID: behavior.ID,
				ProofType:  ProofCSRF,
				RiskLevel:  scored.RiskLevel,
				Description: "Prove that POST with valid X-CSRF-Token succeeds and booking is in DB",
				Preconditions: []string{
					"User is authenticated (valid session cookie)",
					"Valid X-CSRF-Token obtained from /api/csrf-token",
				},
				Assertions: []ProofAssertion{
					{
						Type:      "http_status",
						Target:    "response",
						Operator:  "eq",
						Value:     200,
						Rationale: "Valid token must result in successful booking",
					},
					{
						Type:      "field_value",
						Target:    "response.result.data.id",
						Operator:  "gt",
						Value:     0,
						Rationale: "Booking ID must be a positive integer",
					},
					{
						Type:      "db_state",
						Target:    "reservations WHERE id = createdId AND status = 'confirmed'",
						Operator:  "eq",
						Value:     1,
						Rationale: "Booking must exist in DB with confirmed status",
					},
				},
				MutationTargets: []MutationTarget{
					{Description: "Block all requests regardless of CSRF token", ExpectedKill: true},
				},
			}
		}

	case ProofRiskScoring:
		return &ProofTarget{
			ID:         "PROOF-RISK-010",
			BehaviorID: behavior.ID,
			ProofType:  ProofRiskScoring,
			RiskLevel:  scored.RiskLevel,
			Description: "Prove that noShowRisk increases after riskScoring job runs on a no-show reservation",
			Preconditions: []string{
				"guest.noShowRisk == 0 (explicitly set and verified)",
				"reservation created and status set to no_show",
				"riskScoring cron job triggered",
			},
			Assertions: []ProofAssertion{
				{
					Type:      "field_value",
					Target:    "guest.noShowRisk",
					Operator:  "gt",
					Value:     0,
					Rationale: "Score must increase from 0 — direction is specified in Spec Kap. 12",
				},
				{
					Type:      "field_value",
					Target:    "guest.noShowRisk",
					Operator:  "lte",
					Value:     100,
					Rationale: "Score must not exceed 100 — upper bound specified in Spec",
				},
				{
					Type:      "field_value",
					Target:    "guest.noShowCount",
					Operator:  "eq",
					Value:     "previousCount + 1",
					Rationale: "noShowCount must be incremented exactly once",
				},
				{
					Type:      "field_value",
					Target:    "guest.riskScoreLastUpdated",
					Operator:  "not_null",
					Value:     nil,
					Rationale: "Timestamp must be set after job runs",
				},
			},
			MutationTargets: []MutationTarget{
				{Description: "Remove noShowRisk update in riskScoring job", ExpectedKill: true},
				{Description: "Set noShowRisk to 0 instead of incrementing", ExpectedKill: true},
			},
		}
	}

	return nil
}
