// TestForge — Quality Compiler for SaaS Test Suites
// Version: MVP 1.0
//
// Usage:
//   testforge --spec <spec-file> --output <output-dir> [--format typescript|go]
//
// The compiler runs through 4 layers:
//   Schicht 1: Spec Understanding (Parser → IR)
//   Schicht 2: Rule & Risk Model (IR → RiskModel)
//   Schicht 3: Proof Generation (RiskModel → RawProofSuite)
//   Schicht 4: Proof Validation (RawProofSuite → ValidatedProofSuite)
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/hey-listen/testforge/internal/output"
	"github.com/hey-listen/testforge/internal/parser"
	"github.com/hey-listen/testforge/internal/proofgen"
	"github.com/hey-listen/testforge/internal/riskmodel"
	"github.com/hey-listen/testforge/internal/validator"
)

func main() {
	specFile := flag.String("spec", "", "Path to the specification file (Markdown or OpenAPI YAML)")
	outputDir := flag.String("output", "./testforge-output", "Output directory for generated tests")
	format := flag.String("format", "typescript", "Output format: typescript or go")
	reportOnly := flag.Bool("report-only", false, "Only generate the analysis report, no test files")
	flag.Parse()

	if *specFile == "" {
		fmt.Fprintln(os.Stderr, "Error: --spec is required")
		flag.Usage()
		os.Exit(1)
	}

	fmt.Printf("TestForge MVP 1.0 — Quality Compiler\n")
	fmt.Printf("=====================================\n")
	fmt.Printf("Spec: %s\n", *specFile)
	fmt.Printf("Output: %s\n", *outputDir)
	fmt.Printf("Format: %s\n\n", *format)

	// Read spec file
	content, err := os.ReadFile(*specFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading spec file: %v\n", err)
		os.Exit(1)
	}

	// ─────────────────────────────────────────────────────────
	// SCHICHT 1: Spec Understanding
	// ─────────────────────────────────────────────────────────
	fmt.Println("► Schicht 1: Spec Understanding...")

	p := parser.NewMarkdownParser(*specFile)
	analysis, err := p.Parse(string(content))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing spec: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("  Behaviors extracted: %d\n", len(analysis.IR.Behaviors))
	fmt.Printf("  Resources identified: %d\n", len(analysis.IR.Resources))
	fmt.Printf("  Quality score: %.1f/10.0\n", analysis.QualityScore)

	// Report ambiguities
	if len(analysis.Ambiguities) > 0 {
		fmt.Printf("\n  ⚠ AMBIGUITY GATE: %d blocked requirements\n", len(analysis.Ambiguities))
		for _, a := range analysis.Ambiguities {
			fmt.Printf("    [BLOCKED] %s\n", a.BehaviorID)
			fmt.Printf("    Problem: %s\n", a.Question.Problem)
			fmt.Printf("    Question: %s\n", a.Question.Question)
		}
		fmt.Println()
	} else {
		fmt.Println("  ✓ Ambiguity Gate: All requirements are clear")
	}

	if len(analysis.Contradictions) > 0 {
		fmt.Printf("  ⚠ %d contradictions detected\n", len(analysis.Contradictions))
	}

	if *reportOnly {
		printAnalysisReport(analysis)
		return
	}

	// ─────────────────────────────────────────────────────────
	// SCHICHT 2: Risk Model
	// ─────────────────────────────────────────────────────────
	fmt.Println("\n► Schicht 2: Risk & Rule Model...")

	builder := riskmodel.NewBuilder()
	riskModel, err := builder.Build(analysis)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error building risk model: %v\n", err)
		os.Exit(1)
	}

	// Count by risk level
	critical, high, medium, low := 0, 0, 0, 0
	for _, b := range riskModel.Behaviors {
		switch b.RiskLevel {
		case riskmodel.RiskCritical:
			critical++
		case riskmodel.RiskHigh:
			high++
		case riskmodel.RiskMedium:
			medium++
		case riskmodel.RiskLow:
			low++
		}
	}
	fmt.Printf("  Risk distribution: %d critical, %d high, %d medium, %d low\n",
		critical, high, medium, low)
	fmt.Printf("  Proof targets (P0): %d\n", len(riskModel.ProofTargets))
	fmt.Printf("  IDOR attack vectors: %d\n", len(riskModel.TenantModel.AttackVectors))
	fmt.Printf("  CSRF endpoints: %d\n", len(riskModel.SecurityModel.CSRFEndpoints))

	// ─────────────────────────────────────────────────────────
	// SCHICHT 3: Proof Generation
	// ─────────────────────────────────────────────────────────
	fmt.Println("\n► Schicht 3: Proof Generation...")

	gen := proofgen.NewGenerator(*format)
	rawSuite, err := gen.Generate(riskModel)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating proofs: %v\n", err)
		os.Exit(1)
	}

	// Merge CSRF proofs into single file
	rawSuite = proofgen.MergeCSRFProofs(rawSuite)

	fmt.Printf("  Raw proofs generated: %d\n", len(rawSuite.Proofs))
	for _, p := range rawSuite.Proofs {
		fmt.Printf("    → %s (%s) → %s\n", p.ID, p.ProofType, p.Filename)
	}

	// ─────────────────────────────────────────────────────────
	// SCHICHT 4: Proof Validation
	// ─────────────────────────────────────────────────────────
	fmt.Println("\n► Schicht 4: Proof Validation (False-Green Detection)...")

	// Collect behavior IDs for coverage check
	var behaviorIDs []string
	for _, b := range analysis.IR.Behaviors {
		behaviorIDs = append(behaviorIDs, b.ID)
	}

	v := validator.NewValidator()
	validatedSuite := v.Validate(rawSuite, behaviorIDs)

	fmt.Printf("  %s\n", validatedSuite.Verdict.Summary)
	if len(validatedSuite.DiscardedProofs) > 0 {
		fmt.Printf("\n  ✗ Discarded proofs:\n")
		for _, dp := range validatedSuite.DiscardedProofs {
			fmt.Printf("    [%s] %s: %s\n", dp.Reason, dp.RawProof.ID, dp.Details[:min(80, len(dp.Details))])
		}
	}

	fmt.Printf("  Coverage: %.1f%% (%d/%d behaviors)\n",
		validatedSuite.Coverage.CoveragePercent,
		validatedSuite.Coverage.CoveredBehaviors,
		validatedSuite.Coverage.TotalBehaviors)

	// ─────────────────────────────────────────────────────────
	// OUTPUT: Write to filesystem
	// ─────────────────────────────────────────────────────────
	fmt.Println("\n► Writing output...")

	w := output.NewWriter(*outputDir)
	if err := w.Write(validatedSuite); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing output: %v\n", err)
		os.Exit(1)
	}

	// Final summary
	fmt.Printf("\n=====================================\n")
	fmt.Printf("TestForge Complete\n")
	fmt.Printf("  Validated proofs: %d\n", len(validatedSuite.Proofs))
	fmt.Printf("  Discarded: %d\n", len(validatedSuite.DiscardedProofs))
	fmt.Printf("  Output: %s\n", *outputDir)

	if len(validatedSuite.Proofs) == 0 {
		fmt.Println("\n⚠ WARNING: No proofs passed validation. Check the report for details.")
		os.Exit(1)
	}

	// Verify MVP success criteria
	fmt.Println("\n► MVP Success Criteria:")
	checkMVP(validatedSuite)
}

// checkMVP verifies the three required proofs are present and valid.
func checkMVP(suite *validator.ValidatedProofSuite) {
	required := map[string]bool{
		"IDOR-001":  false,
		"RISK-010":  false,
		"CSRF-001":  false,
	}

	for _, p := range suite.Proofs {
		id := p.ID
		// Normalize: CSRF-001a and CSRF-001b count as CSRF-001
		if strings.HasPrefix(id, "CSRF-001") {
			required["CSRF-001"] = true
		} else {
			required[id] = true
		}
	}

	allPassed := true
	for id, found := range required {
		if found {
			fmt.Printf("  ✓ %s — generated and validated\n", id)
		} else {
			fmt.Printf("  ✗ %s — MISSING\n", id)
			allPassed = false
		}
	}

	if allPassed {
		fmt.Println("\n✓ MVP COMPLETE: All three required proofs generated and validated.")
	} else {
		fmt.Println("\n✗ MVP INCOMPLETE: Some required proofs are missing.")
		os.Exit(1)
	}
}

// printAnalysisReport prints a detailed analysis report to stdout.
func printAnalysisReport(analysis interface{}) {
	data, _ := json.MarshalIndent(analysis, "", "  ")
	fmt.Println(string(data))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
