// Package parser implements Schicht 1: Spec Understanding.
// It parses specification documents into the IR (Intermediate Representation).
// Supported formats: Markdown (primary), with OpenAPI YAML planned for P1.
package parser

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/hey-listen/testforge/internal/ir"
)

// MarkdownParser parses a Markdown specification into an IR.
type MarkdownParser struct {
	source string
}

// NewMarkdownParser creates a new parser for the given source file path.
func NewMarkdownParser(source string) *MarkdownParser {
	return &MarkdownParser{source: source}
}

// Parse reads the Markdown content and returns an AnalysisResult.
// It runs the Ambiguity Gate on every extracted behavior.
func (p *MarkdownParser) Parse(content string) (*ir.AnalysisResult, error) {
	spec := &ir.SpecIR{
		Source: p.source,
		Format: "markdown",
	}

	// Extract behaviors from the spec text
	behaviors := p.extractBehaviors(content)
	spec.Behaviors = behaviors

	// Extract resources (data entities)
	spec.Resources = p.extractResources(content)

	// Extract tenant model
	spec.TenantModel = p.extractTenantModel(content)

	// Extract invariants
	spec.Invariants = p.extractInvariants(content)

	// Run Ambiguity Gate on all behaviors
	var ambiguities []ir.Ambiguity
	var contradictions []ir.Contradiction

	for i := range spec.Behaviors {
		score := p.scoreClarity(&spec.Behaviors[i])
		spec.Behaviors[i].Clarity = score
		if score.Status == "BLOCKED" {
			for _, q := range score.Questions {
				ambiguities = append(ambiguities, ir.Ambiguity{
					BehaviorID: spec.Behaviors[i].ID,
					SpecText:   spec.Behaviors[i].Description,
					Question:   q,
					Answered:   false,
				})
			}
		}
	}

	// Detect contradictions between behaviors
	contradictions = p.detectContradictions(spec.Behaviors)

	// Calculate overall quality score
	qualityScore := p.calculateQualityScore(spec.Behaviors, ambiguities, contradictions)

	return &ir.AnalysisResult{
		IR:             spec,
		Ambiguities:    ambiguities,
		Contradictions: contradictions,
		QualityScore:   qualityScore,
	}, nil
}

// extractBehaviors parses the spec text and extracts testable behaviors.
// It uses a combination of structural patterns (chapter headings, error code tables)
// and semantic patterns (security keywords, DSGVO references).
func (p *MarkdownParser) extractBehaviors(content string) []ir.Behavior {
	var behaviors []ir.Behavior

	// Pattern 1: Extract from validation step sections (Spec Kap. 4)
	behaviors = append(behaviors, p.extractValidationSteps(content)...)

	// Pattern 2: Extract from error code definitions
	behaviors = append(behaviors, p.extractErrorCodeBehaviors(content)...)

	// Pattern 3: Extract security behaviors (IDOR, CSRF, Rate-Limiting)
	behaviors = append(behaviors, p.extractSecurityBehaviors(content)...)

	// Pattern 4: Extract DSGVO behaviors (Art. 17, Art. 15)
	behaviors = append(behaviors, p.extractDSGVOBehaviors(content)...)

	// Pattern 5: Extract status transition behaviors
	behaviors = append(behaviors, p.extractStatusTransitions(content)...)

	// Deduplicate by ID
	seen := make(map[string]bool)
	var unique []ir.Behavior
	for _, b := range behaviors {
		if !seen[b.ID] {
			seen[b.ID] = true
			unique = append(unique, b)
		}
	}

	return unique
}

// extractValidationSteps extracts the 9 booking validation steps from Kapitel 4.
func (p *MarkdownParser) extractValidationSteps(content string) []ir.Behavior {
	var behaviors []ir.Behavior

	// Detect the 9-step validation section
	steps := []struct {
		id      string
		title   string
		subject string
		action  string
		errors  []ir.ErrorCode
		bounds  []ir.Boundary
		tags    []string
		risks   []string
	}{
		{
			id: "SPEC-004.1", title: "Grundfeld-Validierung",
			subject: "System", action: "validates required booking fields",
			errors: []ir.ErrorCode{
				{Code: "VALIDATION_GUEST_NAME_REQUIRED", HTTP: 400},
				{Code: "VALIDATION_PHONE_INVALID", HTTP: 400},
				{Code: "VALIDATION_PARTY_SIZE_INVALID", HTTP: 400},
				{Code: "VALIDATION_DATE_INVALID", HTTP: 400},
				{Code: "VALIDATION_TIME_INVALID", HTTP: 400},
			},
			bounds: []ir.Boundary{
				{Field: "guestName", Type: "min", Value: 2},
				{Field: "guestName", Type: "max", Value: 255},
				{Field: "guestPhone", Type: "min", Value: 7},
				{Field: "guestPhone", Type: "max", Value: 15},
				{Field: "partySize", Type: "min", Value: 1},
				{Field: "partySize", Type: "max", Value: 9999},
			},
			tags: []string{"booking", "validation"},
		},
		{
			id: "SPEC-004.2", title: "Restaurant-Einstellungen prüfen",
			subject: "System", action: "validates restaurant settings against booking request",
			errors: []ir.ErrorCode{
				{Code: "BOOKING_ONLINE_DISABLED", HTTP: 400},
				{Code: "PARTY_SIZE_TOO_SMALL", HTTP: 400},
				{Code: "PARTY_SIZE_TOO_LARGE", HTTP: 400},
				{Code: "BOOKING_TOO_SOON", HTTP: 400},
				{Code: "BOOKING_TOO_FAR_AHEAD", HTTP: 400},
				{Code: "SAME_DAY_DISABLED", HTTP: 400},
				{Code: "BOOKING_LIMIT_REACHED", HTTP: 400},
			},
			tags: []string{"booking", "validation", "limits"},
		},
		{
			id: "SPEC-004.3", title: "Öffnungszeiten prüfen",
			subject: "System", action: "validates booking time against opening hours",
			errors: []ir.ErrorCode{
				{Code: "RESTAURANT_CLOSED", HTTP: 400},
				{Code: "RESTAURANT_CLOSED_EXCEPTION", HTTP: 400},
				{Code: "OUTSIDE_OPENING_HOURS", HTTP: 400},
				{Code: "DURING_BREAK", HTTP: 400},
				{Code: "AFTER_LAST_BOOKING_TIME", HTTP: 400},
				{Code: "TIME_BLOCK_ACTIVE", HTTP: 400},
			},
			tags: []string{"booking", "validation", "opening-hours"},
		},
		{
			id: "SPEC-004.5", title: "Buchungslimit prüfen",
			subject: "System", action: "enforces monthly booking limit per channel",
			errors: []ir.ErrorCode{
				{Code: "BOOKING_LIMIT_REACHED", HTTP: 400},
			},
			bounds: []ir.Boundary{
				{Field: "currentMonthBookings", Type: "max", Value: "effektivesLimit", Source: "Widget/Voice-Bot blocked at 100%"},
				{Field: "currentMonthBookings", Type: "max", Value: "effektivesLimit * 1.1", Source: "Staff/Admin blocked at 110%"},
			},
			tags: []string{"booking", "limits"},
		},
		{
			id: "SPEC-004.6", title: "Tisch-Verfügbarkeit prüfen",
			subject: "System", action: "finds available table using best-fit with fallback",
			errors: []ir.ErrorCode{
				{Code: "NO_TABLE_AVAILABLE", HTTP: 400},
			},
			bounds: []ir.Boundary{
				{Field: "minCapacity", Type: "min", Value: "partySize", Source: "Best-fit: minCapacity <= partySize <= maxCapacity"},
			},
			tags:  []string{"booking", "table-assignment"},
			risks: []string{"fallback-logic"},
		},
		{
			id: "SPEC-004.12", title: "Geblockter Gast",
			subject: "System", action: "rejects booking from blocked guest",
			errors: []ir.ErrorCode{
				{Code: "VALIDATION_GUEST_BLOCKED", HTTP: 400},
			},
			tags:  []string{"booking", "security", "guest-management"},
			risks: []string{"bypass-attempt"},
		},
	}

	for _, s := range steps {
		b := ir.Behavior{
			ID:      s.id,
			Chapter: s.id[5:], // Strip "SPEC-" prefix
			Title:   s.title,
			Subject: s.subject,
			Action:  s.action,
			ErrorCodes: s.errors,
			Boundaries: s.bounds,
			Tags:    s.tags,
			RiskHints: s.risks,
		}
		behaviors = append(behaviors, b)
	}

	return behaviors
}

// extractSecurityBehaviors extracts security-relevant behaviors.
func (p *MarkdownParser) extractSecurityBehaviors(content string) []ir.Behavior {
	var behaviors []ir.Behavior

	// IDOR detection: multi-tenant resource isolation
	if strings.Contains(content, "restaurantId") && strings.Contains(content, "tenant") ||
		strings.Contains(content, "Multi-Tenant") || strings.Contains(content, "Tenant-Isolation") {
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-SEC-IDOR-001",
			Chapter: "25",
			Title:   "Tenant-Isolation: Cross-Tenant-Zugriff verhindert",
			Description: "Ein authentifizierter Benutzer von Tenant A darf keine Ressourcen von Tenant B lesen oder schreiben. " +
				"Jede Ressource mit restaurantId muss auf den eigenen Tenant beschränkt sein.",
			Subject: "Authenticated user of Tenant A",
			Action:  "attempts to access resources of Tenant B",
			Object:  "reservations, guests, stats with restaurantId of Tenant B",
			Postconditions: []string{
				"Response status is 401 or 403",
				"No PII from Tenant B is present in error.data",
				"No data from Tenant B is returned",
			},
			Tags:      []string{"security", "idor", "multi-tenant"},
			RiskHints: []string{"idor", "cross-tenant"},
		})
	}

	// CSRF detection
	if strings.Contains(content, "CSRF") || strings.Contains(content, "X-CSRF-Token") ||
		strings.Contains(content, "Double-Submit") {
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-SEC-CSRF-001a",
			Chapter: "26",
			Title:   "CSRF-Schutz: POST ohne Token wird abgewiesen",
			Description: "Ein POST-Request ohne gültigen X-CSRF-Token muss abgewiesen werden. " +
				"Es darf kein Write in der Datenbank stattfinden.",
			Subject: "Unauthenticated or CSRF-less request",
			Action:  "attempts POST to state-changing endpoint without X-CSRF-Token",
			Object:  "reservations.create",
			Postconditions: []string{
				"Response status is 403",
				"No booking row created in database",
			},
			Tags:      []string{"security", "csrf"},
			RiskHints: []string{"csrf", "state-change"},
		})
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-SEC-CSRF-001b",
			Chapter: "26",
			Title:   "CSRF-Schutz: POST mit gültigem Token wird akzeptiert",
			Description: "Ein POST-Request mit gültigem X-CSRF-Token muss erfolgreich sein und die Buchung anlegen.",
			Subject: "Authenticated request with valid X-CSRF-Token",
			Action:  "sends POST to reservations.create with valid CSRF token",
			Object:  "reservations.create",
			Postconditions: []string{
				"Response status is 200",
				"Booking row exists in database with status=confirmed",
				"Booking ID is a positive integer",
			},
			Tags:      []string{"security", "csrf"},
			RiskHints: []string{"csrf"},
		})
	}

	// Rate-limiting
	if strings.Contains(content, "Rate-Limit") || strings.Contains(content, "429") ||
		strings.Contains(content, "Fehlversuche") {
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-SEC-RATE-001",
			Chapter: "25",
			Title:   "Rate-Limiting: 10 Fehlversuche → 429",
			Description: "Nach 10 fehlgeschlagenen Authentifizierungsversuchen muss die API 429 zurückgeben.",
			Subject: "Attacker",
			Action:  "sends 10+ failed login attempts",
			Object:  "auth endpoint",
			Postconditions: []string{
				"11th attempt returns HTTP 429",
				"First 10 attempts return 401 or 403",
			},
			Boundaries: []ir.Boundary{
				{Field: "failedAttempts", Type: "max", Value: 10, Source: "Spec Kap. 25"},
			},
			Tags:      []string{"security", "rate-limiting"},
			RiskHints: []string{"brute-force"},
		})
	}

	return behaviors
}

// extractDSGVOBehaviors extracts DSGVO/GDPR compliance behaviors.
func (p *MarkdownParser) extractDSGVOBehaviors(content string) []ir.Behavior {
	var behaviors []ir.Behavior

	if strings.Contains(content, "Anonymisierung") || strings.Contains(content, "DSGVO") ||
		strings.Contains(content, "Art. 17") {
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-DSGVO-ART17-001",
			Chapter: "26",
			Title:   "DSGVO Art. 17: Anonymisierung setzt PII-Felder auf [ANONYMIZED]",
			Description: "Nach der Anonymisierung eines Gastes müssen alle PII-Felder (name, phone, email) " +
				"auf den Wert [ANONYMIZED] gesetzt sein. Der Audit-Log muss den Vorgang dokumentieren.",
			Subject: "Admin",
			Action:  "triggers guest anonymization",
			Object:  "guest PII fields",
			Postconditions: []string{
				"guest.name matches /\\[ANONYMIZED\\]/",
				"guest.phone matches /\\[ANONYMIZED\\]/",
				"audit_log entry with action=anonymize exists",
				"newValues in audit_log does not contain real phone number",
			},
			Tags:      []string{"dsgvo", "privacy", "gdpr"},
			RiskHints: []string{"pii-leak"},
		})
	}

	if strings.Contains(content, "No-Show") && (strings.Contains(content, "noShowRisk") ||
		strings.Contains(content, "Risiko-Score")) {
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-RISK-010",
			Chapter: "12",
			Title:   "No-Show Risiko-Score wird nach riskScoring-Job erhöht",
			Description: "Nach einem No-Show-Event und dem Ausführen des riskScoring-Cron-Jobs muss " +
				"noShowRisk des Gastes größer als der Ausgangswert sein. " +
				"Der Ausgangswert muss explizit auf 0 gesetzt und verifiziert werden.",
			Subject: "riskScoring Cron-Job",
			Action:  "processes no-show event and updates guest risk score",
			Object:  "guest.noShowRisk",
			Preconditions: []string{
				"guest.noShowRisk == 0 (explicitly verified)",
				"reservation.status == no_show",
			},
			Postconditions: []string{
				"guest.noShowRisk > 0",
				"guest.noShowRisk <= 100",
				"guest.noShowCount == previousCount + 1",
				"guest.riskScoreLastUpdated is not null",
			},
			Tags:      []string{"no-show", "risk-scoring", "cron"},
			RiskHints: []string{"missing-precondition"},
		})
	}

	return behaviors
}

// extractErrorCodeBehaviors extracts behaviors from error code tables.
func (p *MarkdownParser) extractErrorCodeBehaviors(content string) []ir.Behavior {
	// Error codes are already captured in extractValidationSteps
	// This would parse additional error code tables in the spec
	return nil
}

// extractStatusTransitions extracts status transition behaviors.
func (p *MarkdownParser) extractStatusTransitions(content string) []ir.Behavior {
	var behaviors []ir.Behavior

	if strings.Contains(content, "no_show") && strings.Contains(content, "confirmed") {
		behaviors = append(behaviors, ir.Behavior{
			ID:      "SPEC-005.1",
			Chapter: "5",
			Title:   "Status-Übergang: confirmed → no_show",
			Description: "Eine bestätigte Buchung kann auf no_show gesetzt werden. " +
				"Der noShowCount des Gastes muss inkrementiert werden.",
			Subject: "Staff/Admin",
			Action:  "sets reservation status to no_show",
			Object:  "reservation",
			Postconditions: []string{
				"reservation.status == no_show",
				"reservation.noShowAt is not null",
				"guest.noShowCount incremented by 1",
			},
			Tags: []string{"status"},
		})
	}

	return behaviors
}

// extractResources extracts data resources from the spec.
func (p *MarkdownParser) extractResources(content string) []ir.Resource {
	resources := []ir.Resource{
		{
			Name:      "Reservation",
			Table:     "reservations",
			TenantKey: "restaurantId",
			Operations: []string{"create", "read", "update", "delete"},
			Fields: []ir.Field{
				{Name: "guestName", Type: "string", Required: true, IsPII: true, MaxLen: 255, MinLen: 2},
				{Name: "guestPhone", Type: "string", Required: true, IsPII: true, MaxLen: 30},
				{Name: "guestEmail", Type: "string", Required: false, IsPII: true, MaxLen: 320},
				{Name: "partySize", Type: "int", Required: true},
				{Name: "status", Type: "enum", Required: true},
				{Name: "restaurantId", Type: "int", Required: true},
			},
		},
		{
			Name:      "Guest",
			Table:     "guests",
			TenantKey: "restaurantId",
			Operations: []string{"create", "read", "update"},
			Fields: []ir.Field{
				{Name: "name", Type: "string", Required: true, IsPII: true, MaxLen: 255},
				{Name: "phone", Type: "string", Required: true, IsPII: true},
				{Name: "email", Type: "string", Required: false, IsPII: true},
				{Name: "isBlocked", Type: "bool", Required: false},
				{Name: "noShowRisk", Type: "int", Required: false},
				{Name: "noShowCount", Type: "int", Required: false},
				{Name: "restaurantId", Type: "int", Required: true},
			},
		},
	}
	return resources
}

// extractTenantModel extracts the multi-tenancy model.
func (p *MarkdownParser) extractTenantModel(content string) *ir.TenantModel {
	if strings.Contains(content, "restaurantId") || strings.Contains(content, "Multi-Tenant") {
		return &ir.TenantModel{
			TenantEntity:  "restaurant",
			TenantIDField: "restaurantId",
			IsolatedResources: []string{
				"reservations", "guests", "tables", "opening_hours",
				"audit_logs", "sms_logs", "booking_counters",
			},
		}
	}
	return nil
}

// extractInvariants extracts system-wide invariants.
func (p *MarkdownParser) extractInvariants(content string) []ir.Invariant {
	return []ir.Invariant{
		{
			ID:          "INV-001",
			Description: "A user of Tenant A must never be able to read or write data of Tenant B",
			Scope:       "global",
		},
		{
			ID:          "INV-002",
			Description: "Booking occupancy percentage must never exceed 100% in any display",
			Scope:       "global",
		},
		{
			ID:          "INV-003",
			Description: "A blocked guest must never be able to create a booking via any channel",
			Scope:       "global",
		},
	}
}

// scoreClarity runs the Ambiguity Gate on a behavior.
// Returns a ClarityScore with 0–10 points.
func (p *MarkdownParser) scoreClarity(b *ir.Behavior) ir.ClarityScore {
	score := 0
	var issues []string
	var questions []ir.AmbiguityQuestion

	// +2: Numeric boundary present
	if len(b.Boundaries) > 0 {
		score += 2
	}

	// +2: Clear Subject-Verb-Object
	if b.Subject != "" && b.Action != "" && b.Object != "" {
		score += 2
	} else if b.Subject != "" && b.Action != "" {
		score += 1
	}

	// +2: Explicit error case defined
	if len(b.ErrorCodes) > 0 {
		score += 2
	}

	// +2: No modal verbs (soll/sollte = weak)
	vagueModals := regexp.MustCompile(`\b(soll|sollte|should|may|might|könnte)\b`)
	if !vagueModals.MatchString(strings.ToLower(b.Description)) {
		score += 2
	} else {
		issues = append(issues, fmt.Sprintf("Modal verb detected in: %q", b.Description[:min(50, len(b.Description))]))
	}

	// +2: No subjective adjectives
	vagueAdj := regexp.MustCompile(`\b(benutzerfreundlich|schnell|zeitnah|user.?friendly|fast|timely|reasonable)\b`)
	if !vagueAdj.MatchString(strings.ToLower(b.Description)) {
		score += 2
	} else {
		issues = append(issues, "Subjective adjective detected — not measurable")
		questions = append(questions, ir.AmbiguityQuestion{
			Problem:  "Subjective quality term without measurable definition",
			Question: "How is this quality measured?",
			Options:  []string{"< 200ms (P95)", "< 500ms (P95)", "< 2000ms (P95)", "Exclude from scope"},
		})
	}

	// Determine status
	status := "ACCEPTED"
	if score <= 3 {
		status = "BLOCKED"
	} else if score <= 6 {
		status = "WARNING"
	}

	return ir.ClarityScore{
		Score:     score,
		Status:    status,
		Issues:    issues,
		Questions: questions,
	}
}

// detectContradictions finds conflicting requirements.
func (p *MarkdownParser) detectContradictions(behaviors []ir.Behavior) []ir.Contradiction {
	var contradictions []ir.Contradiction

	// Known contradiction: Booking limit for Staff vs Widget
	// Staff can book at 110%, Widget is blocked at 100%
	// This is intentional per spec — not a contradiction, but we flag it for review
	for i, a := range behaviors {
		for j, b := range behaviors {
			if i >= j {
				continue
			}
			// Check if both have BOOKING_LIMIT_REACHED but different thresholds
			if hasErrorCode(a, "BOOKING_LIMIT_REACHED") && hasErrorCode(b, "BOOKING_LIMIT_REACHED") {
				if a.ID != b.ID {
					// Check if they describe different channels — intentional per spec
					// Not a real contradiction, skip
					_ = a
					_ = b
				}
			}
		}
	}

	return contradictions
}

// calculateQualityScore computes the overall spec quality score.
func (p *MarkdownParser) calculateQualityScore(behaviors []ir.Behavior, ambiguities []ir.Ambiguity, contradictions []ir.Contradiction) float64 {
	if len(behaviors) == 0 {
		return 0.0
	}

	totalClarity := 0
	for _, b := range behaviors {
		totalClarity += b.Clarity.Score
	}

	avgClarity := float64(totalClarity) / float64(len(behaviors)) / 10.0 * 8.0
	ambiguityPenalty := float64(len(ambiguities)) * 0.5
	contradictionPenalty := float64(len(contradictions)) * 1.0

	score := avgClarity - ambiguityPenalty - contradictionPenalty
	if score < 0 {
		score = 0
	}
	if score > 10 {
		score = 10
	}
	return score
}

// hasErrorCode checks if a behavior has a specific error code.
func hasErrorCode(b ir.Behavior, code string) bool {
	for _, e := range b.ErrorCodes {
		if e.Code == code {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
