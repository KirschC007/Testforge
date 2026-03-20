// Package output implements the final output stage of TestForge.
// It writes validated proofs to test files and generates a report.
package output

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hey-listen/testforge/internal/validator"
)

// Writer writes validated proofs to the filesystem.
type Writer struct {
	outputDir string
}

// NewWriter creates a writer that outputs to the given directory.
func NewWriter(outputDir string) *Writer {
	return &Writer{outputDir: outputDir}
}

// Write saves all validated proofs to files and generates a report.
func (w *Writer) Write(suite *validator.ValidatedProofSuite) error {
	// Create output directory
	if err := os.MkdirAll(w.outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Write each validated proof to its file
	// Group proofs by filename (CSRF-001a and CSRF-001b go into the same file)
	fileContents := make(map[string]string)
	for _, proof := range suite.Proofs {
		fileContents[proof.Filename] += proof.Code + "\n"
	}

	for filename, content := range fileContents {
		fullPath := filepath.Join(w.outputDir, filename)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return fmt.Errorf("failed to create directory for %s: %w", filename, err)
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", filename, err)
		}
		fmt.Printf("✓ Written: %s\n", fullPath)
	}

	// Write the validation report
	report := w.buildReport(suite)
	reportPath := filepath.Join(w.outputDir, "testforge-report.md")
	if err := os.WriteFile(reportPath, []byte(report), 0644); err != nil {
		return fmt.Errorf("failed to write report: %w", err)
	}
	fmt.Printf("✓ Report: %s\n", reportPath)

	return nil
}

// buildReport generates a Markdown validation report.
func (w *Writer) buildReport(suite *validator.ValidatedProofSuite) string {
	var sb strings.Builder

	sb.WriteString("# TestForge Validation Report\n\n")
	sb.WriteString(fmt.Sprintf("Generated: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	// Verdict
	sb.WriteString("## Verdict\n\n")
	sb.WriteString(fmt.Sprintf("%s\n\n", suite.Verdict.Summary))

	// Coverage
	sb.WriteString("## Coverage\n\n")
	sb.WriteString(fmt.Sprintf("| Metric | Value |\n|---|---|\n"))
	sb.WriteString(fmt.Sprintf("| Total Behaviors | %d |\n", suite.Coverage.TotalBehaviors))
	sb.WriteString(fmt.Sprintf("| Covered | %d |\n", suite.Coverage.CoveredBehaviors))
	sb.WriteString(fmt.Sprintf("| Coverage | %.1f%% |\n\n", suite.Coverage.CoveragePercent))

	if len(suite.Coverage.UncoveredIDs) > 0 {
		sb.WriteString("### Uncovered Behaviors\n\n")
		for _, id := range suite.Coverage.UncoveredIDs {
			sb.WriteString(fmt.Sprintf("- %s\n", id))
		}
		sb.WriteString("\n")
	}

	// Validated Proofs
	sb.WriteString("## Validated Proofs\n\n")
	for _, proof := range suite.Proofs {
		sb.WriteString(fmt.Sprintf("### %s — %s\n\n", proof.ID, proof.ProofType))
		sb.WriteString(fmt.Sprintf("- **File:** `%s`\n", proof.Filename))
		sb.WriteString(fmt.Sprintf("- **Risk Level:** %s\n", proof.RiskLevel))
		sb.WriteString(fmt.Sprintf("- **Mutation Score:** %.2f\n", proof.MutationScore))
		sb.WriteString("\n**Validation:**\n")
		for _, note := range proof.ValidationNotes {
			sb.WriteString(fmt.Sprintf("  %s\n", note))
		}
		sb.WriteString("\n")
	}

	// Discarded Proofs
	if len(suite.DiscardedProofs) > 0 {
		sb.WriteString("## Discarded Proofs\n\n")
		sb.WriteString("These proofs were rejected by Schicht 4 (False-Green Detection):\n\n")
		for _, dp := range suite.DiscardedProofs {
			sb.WriteString(fmt.Sprintf("### %s — DISCARDED\n\n", dp.RawProof.ID))
			sb.WriteString(fmt.Sprintf("- **Reason:** `%s`\n", dp.Reason))
			sb.WriteString(fmt.Sprintf("- **Details:** %s\n\n", dp.Details))
		}
	}

	return sb.String()
}
