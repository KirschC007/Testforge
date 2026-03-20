// Package ir defines the Intermediate Representation (IR) for TestForge.
// The IR is the contract between Schicht 1 (Parser) and Schicht 2 (Risk Model).
// It captures all semantically relevant information from a specification.
package ir

// SpecIR is the complete intermediate representation of a specification.
type SpecIR struct {
	Source      string       // Original source file path
	Format      string       // "markdown", "openapi", "freetext"
	Behaviors   []Behavior   // All extracted behaviors/requirements
	Resources   []Resource   // All identified resources (tables, entities)
	TenantModel *TenantModel // Multi-tenancy model if detected
	Invariants  []Invariant  // System-wide invariants
}

// Behavior represents a single testable requirement from the spec.
type Behavior struct {
	ID          string            // e.g. "SPEC-004.3.STEP5"
	Chapter     string            // e.g. "4.3"
	Title       string            // Human-readable title
	Description string            // Full requirement text
	Subject     string            // Who/what performs the action
	Action      string            // What action is performed
	Object      string            // What is acted upon
	Preconditions []string        // Required conditions before action
	Postconditions []string       // Expected state after action
	ErrorCodes  []ErrorCode       // Defined error cases
	Boundaries  []Boundary        // Numeric/enum boundaries
	Tags        []string          // e.g. ["security", "dsgvo", "booking"]
	RiskHints   []string          // e.g. ["idor", "csrf", "no-show"]
	Clarity     ClarityScore      // Ambiguity gate result
}

// ErrorCode represents a defined error case in the spec.
type ErrorCode struct {
	Code    string // e.g. "VALIDATION_GUEST_BLOCKED"
	Message string // Human-readable error message
	HTTP    int    // Expected HTTP status code (0 if not specified)
}

// Boundary represents a numeric or enum constraint.
type Boundary struct {
	Field    string      // Field name
	Type     string      // "min", "max", "enum", "regex"
	Value    interface{} // The boundary value
	Source   string      // Spec text that defines this boundary
}

// Invariant is a system-wide rule that must always hold.
type Invariant struct {
	ID          string
	Description string
	Scope       string // "global", "tenant", "resource"
}

// Resource represents a data entity in the system.
type Resource struct {
	Name       string
	Table      string   // Database table name
	Fields     []Field
	TenantKey  string   // Field that scopes this resource to a tenant (e.g. "restaurantId")
	Operations []string // Allowed operations: "create", "read", "update", "delete"
}

// Field represents a column/field in a resource.
type Field struct {
	Name      string
	Type      string
	Required  bool
	IsPII     bool   // Personally Identifiable Information
	MaxLen    int
	MinLen    int
}

// TenantModel describes the multi-tenancy structure.
type TenantModel struct {
	TenantEntity  string   // e.g. "restaurant"
	TenantIDField string   // e.g. "restaurantId"
	IsolatedResources []string // Resources that must be tenant-isolated
}

// ClarityScore is the result of the Ambiguity Gate.
type ClarityScore struct {
	Score      int      // 0–10
	Status     string   // "BLOCKED", "WARNING", "ACCEPTED"
	Issues     []string // Specific clarity problems found
	Questions  []AmbiguityQuestion // Clarification questions to ask
}

// AmbiguityQuestion is a structured clarification request.
type AmbiguityQuestion struct {
	Problem  string
	Question string
	Options  []string
}

// AnalysisResult is the output of Schicht 1, input to Schicht 2.
// Schicht 2 MUST NOT proceed if len(Ambiguities) > 0 and they are unanswered.
type AnalysisResult struct {
	IR              *SpecIR
	Ambiguities     []Ambiguity
	Contradictions  []Contradiction
	QualityScore    float64 // 0.0–10.0
}

// Ambiguity represents a blocked requirement that needs clarification.
type Ambiguity struct {
	BehaviorID string
	SpecText   string
	Question   AmbiguityQuestion
	Answered   bool
	Answer     string
}

// Contradiction represents two conflicting requirements.
type Contradiction struct {
	BehaviorA  string
	BehaviorB  string
	Conflict   string
	Resolved   bool
	Resolution string
}
