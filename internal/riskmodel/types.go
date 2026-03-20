// Package riskmodel implements Schicht 2: Rule & Risk Model.
// It takes the AnalysisResult from Schicht 1 and produces a RiskModel
// that drives Schicht 3 (Proof Generation).
package riskmodel

import (
	"github.com/hey-listen/testforge/internal/ir"
)

// RiskLevel classifies the severity of a behavior's risk.
type RiskLevel string

const (
	RiskCritical RiskLevel = "critical" // Data breach, auth bypass, IDOR
	RiskHigh     RiskLevel = "high"     // Business logic violation, data corruption
	RiskMedium   RiskLevel = "medium"   // Functional error, wrong calculation
	RiskLow      RiskLevel = "low"      // Minor UI/UX issue, cosmetic
)

// ProofType defines what kind of proof is needed.
type ProofType string

const (
	ProofIDOR            ProofType = "idor"             // Cross-tenant access test
	ProofCSRF            ProofType = "csrf"             // CSRF protection test
	ProofRateLimit       ProofType = "rate_limit"       // Rate limiting test
	ProofBusinessLogic   ProofType = "business_logic"   // Business rule enforcement
	ProofDSGVO           ProofType = "dsgvo"            // GDPR compliance proof
	ProofStatusTransition ProofType = "status_transition" // State machine test
	ProofBoundary        ProofType = "boundary"         // Input boundary test
	ProofRiskScoring     ProofType = "risk_scoring"     // KI risk score test
)

// ScoredBehavior is a behavior with its risk assessment.
type ScoredBehavior struct {
	Behavior   ir.Behavior
	RiskLevel  RiskLevel
	ProofTypes []ProofType
	Priority   int // 0=P0 (must test), 1=P1, 2=P2
	Rationale  string
}

// TenantModel describes the multi-tenancy isolation requirements.
type TenantModel struct {
	TenantEntity      string
	TenantIDField     string
	IsolatedResources []IsolatedResource
	AttackVectors     []CrossTenantVector
}

// IsolatedResource is a resource that must be tenant-isolated.
type IsolatedResource struct {
	Name       string
	Table      string
	TenantKey  string
	Operations []string
	HasPII     bool
}

// CrossTenantVector is an automatically detected IDOR attack vector.
type CrossTenantVector struct {
	Resource    string
	Operation   string
	AttackPath  string // e.g. "GET /api/trpc/reservations.getByDate?restaurantId=TENANT_B"
	ExpectedHTTP []int // e.g. [401, 403]
	MustNotLeak []string // PII fields that must not appear in error response
}

// SecurityModel describes OWASP-relevant attack surfaces.
type SecurityModel struct {
	IDORVectors   []CrossTenantVector
	CSRFEndpoints []CSRFEndpoint
	RateLimitedEndpoints []RateLimitedEndpoint
}

// CSRFEndpoint is a state-changing endpoint that must be CSRF-protected.
type CSRFEndpoint struct {
	Path        string
	Method      string
	TokenHeader string // e.g. "X-CSRF-Token"
	SideEffect  string // What DB change must NOT happen without valid token
}

// RateLimitedEndpoint is an endpoint with defined rate limiting.
type RateLimitedEndpoint struct {
	Path         string
	MaxAttempts  int
	WindowSecs   int
	ExpectedHTTP int // HTTP status after limit exceeded
}

// ProofTarget defines exactly what must be proven.
type ProofTarget struct {
	ID          string
	BehaviorID  string
	ProofType   ProofType
	RiskLevel   RiskLevel
	Description string
	Preconditions []string
	Assertions  []ProofAssertion
	MutationTargets []MutationTarget
}

// ProofAssertion is a single verifiable claim.
type ProofAssertion struct {
	Type    string // "http_status", "db_state", "field_value", "field_absent"
	Target  string // What is being checked
	Operator string // "eq", "gt", "lt", "contains", "not_contains", "matches"
	Value   interface{}
	Rationale string
}

// MutationTarget defines what code change would kill this test.
type MutationTarget struct {
	Description string // "Remove tenant check in reservations.getByDate"
	ExpectedKill bool  // true = test must go red if this mutation is applied
}

// RiskModel is the output of Schicht 2, input to Schicht 3.
type RiskModel struct {
	Behaviors     []ScoredBehavior
	TenantModel   TenantModel
	SecurityModel SecurityModel
	ProofTargets  []ProofTarget
}
