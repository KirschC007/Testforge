/**
 * Compliance Certification Packs — curated test bundles per regulation.
 *
 * Each pack maps a compliance criterion to specific ProofTypes that demonstrate
 * compliance. The output is an audit-ready Markdown report with evidence
 * (test IDs) per criterion. Enterprise customers can hand this to their
 * auditor as proof of technical controls.
 *
 * Packs supported:
 *   SOC 2 Type II  — Trust Services Criteria (Security, Availability, Confidentiality)
 *   HIPAA          — Technical safeguards (45 CFR §164.312)
 *   PCI-DSS v4.0   — Build & maintain secure systems
 *   GDPR           — Article 25 (Privacy by Design) + Article 32 (Security)
 *
 * This is what no other test tool offers — the bridge from "we have tests"
 * to "we are demonstrably compliant".
 */
import type { ProofType, ValidatedProofSuite, AnalysisResult } from "./types";

export type ComplianceFramework = "soc2" | "hipaa" | "pci_dss" | "gdpr";

export interface ComplianceCriterion {
  id: string;          // e.g. "CC6.1", "164.312(a)(1)", "Req-3.4", "Art-32(1)(b)"
  title: string;
  description: string;
  // Which ProofTypes (running, passing) satisfy this criterion?
  satisfiedBy: ProofType[];
  // Optional: how many tests of these types are needed (default: 1)
  minTestCount?: number;
  severity: "must" | "should";
}

export interface CompliancePack {
  framework: ComplianceFramework;
  fullName: string;
  version: string;
  description: string;
  url: string;
  criteria: ComplianceCriterion[];
}

// ─── SOC 2 Type II — Trust Services Criteria ─────────────────────────────────
const SOC2_PACK: CompliancePack = {
  framework: "soc2",
  fullName: "SOC 2 Type II",
  version: "2017 TSC",
  url: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2",
  description: "Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, Privacy",
  criteria: [
    {
      id: "CC6.1",
      title: "Logical Access Controls",
      description: "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
      satisfiedBy: ["auth_matrix", "idor", "cross_tenant_chain"],
      minTestCount: 2,
      severity: "must",
    },
    {
      id: "CC6.6",
      title: "Boundary Protection",
      description: "The entity implements logical access security measures to protect against threats from sources outside its system boundaries.",
      satisfiedBy: ["csrf", "rate_limit", "sql_injection"],
      severity: "must",
    },
    {
      id: "CC6.7",
      title: "Data Transmission Security",
      description: "The entity restricts the transmission, movement, and removal of information to authorized internal and external users.",
      satisfiedBy: ["mass_assignment", "graphql"],
      severity: "must",
    },
    {
      id: "CC7.1",
      title: "System Monitoring",
      description: "To meet its objectives, the entity uses detection and monitoring procedures to identify changes to its system components.",
      satisfiedBy: ["audit_log", "spec_drift"],
      severity: "should",
    },
    {
      id: "CC7.2",
      title: "Anomaly Detection",
      description: "The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts.",
      satisfiedBy: ["risk_scoring", "aml_bypass"],
      severity: "should",
    },
    {
      id: "A1.2",
      title: "Capacity Planning & Performance",
      description: "The entity authorizes, designs, develops, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure.",
      satisfiedBy: ["e2e_perf_budget", "rate_limit"],
      severity: "should",
    },
    {
      id: "PI1.4",
      title: "Data Processing Integrity",
      description: "The entity implements policies and procedures to make available or deliver output completely, accurately, and timely in accordance with specifications to meet the entity's objectives.",
      satisfiedBy: ["business_logic", "boundary", "stateful_sequence", "db_transaction"],
      severity: "must",
    },
  ],
};

// ─── HIPAA — Technical Safeguards (45 CFR §164.312) ──────────────────────────
const HIPAA_PACK: CompliancePack = {
  framework: "hipaa",
  fullName: "HIPAA Security Rule",
  version: "45 CFR §164.312",
  url: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312",
  description: "Technical Safeguards for Protected Health Information (PHI)",
  criteria: [
    {
      id: "164.312(a)(1)",
      title: "Access Control — Unique User Identification",
      description: "Implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to authorized persons.",
      satisfiedBy: ["auth_matrix", "idor"],
      minTestCount: 2,
      severity: "must",
    },
    {
      id: "164.312(a)(2)(i)",
      title: "Automatic Logoff",
      description: "Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.",
      satisfiedBy: ["auth_matrix"],
      severity: "should",
    },
    {
      id: "164.312(b)",
      title: "Audit Controls",
      description: "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.",
      satisfiedBy: ["audit_log"],
      minTestCount: 1,
      severity: "must",
    },
    {
      id: "164.312(c)(1)",
      title: "Integrity",
      description: "Implement policies and procedures to protect ePHI from improper alteration or destruction.",
      satisfiedBy: ["concurrency", "stateful_sequence", "db_transaction"],
      severity: "must",
    },
    {
      id: "164.312(d)",
      title: "Person or Entity Authentication",
      description: "Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.",
      satisfiedBy: ["auth_matrix", "csrf", "idor"],
      severity: "must",
    },
    {
      id: "164.312(e)(1)",
      title: "Transmission Security",
      description: "Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.",
      satisfiedBy: ["mass_assignment", "graphql", "sql_injection"],
      severity: "must",
    },
    {
      id: "164.308(a)(1)(ii)(D)",
      title: "Information System Activity Review",
      description: "Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports.",
      satisfiedBy: ["audit_log", "spec_drift"],
      severity: "should",
    },
  ],
};

// ─── PCI-DSS v4.0 — Payment Card Industry ────────────────────────────────────
const PCI_DSS_PACK: CompliancePack = {
  framework: "pci_dss",
  fullName: "PCI Data Security Standard",
  version: "v4.0",
  url: "https://www.pcisecuritystandards.org/document_library/",
  description: "Payment Card Industry Data Security Standard — protect cardholder data",
  criteria: [
    {
      id: "Req-1.4",
      title: "Network Security Controls",
      description: "Network connections between trusted and untrusted networks are controlled.",
      satisfiedBy: ["csrf", "rate_limit"],
      severity: "must",
    },
    {
      id: "Req-3.4",
      title: "Strong Cryptography for Stored Data",
      description: "PAN is rendered unreadable wherever it is stored.",
      satisfiedBy: ["dsgvo", "audit_log"],
      severity: "must",
    },
    {
      id: "Req-6.2",
      title: "Bespoke Software Security",
      description: "Bespoke and custom software is developed securely.",
      satisfiedBy: ["sql_injection", "mass_assignment", "negative_amount", "property_based"],
      minTestCount: 3,
      severity: "must",
    },
    {
      id: "Req-6.4.1",
      title: "Public-Facing Web Application Reviews",
      description: "Public-facing web applications are protected against attacks.",
      satisfiedBy: ["sql_injection", "mass_assignment", "graphql", "e2e_a11y_full"],
      severity: "must",
    },
    {
      id: "Req-7.1",
      title: "Restrict Access to System Components",
      description: "Access to system components and cardholder data is appropriately restricted to the minimum necessary.",
      satisfiedBy: ["auth_matrix", "idor", "cross_tenant_chain"],
      minTestCount: 2,
      severity: "must",
    },
    {
      id: "Req-8.2",
      title: "User Identification and Authentication",
      description: "Strong authentication for users.",
      satisfiedBy: ["auth_matrix", "csrf"],
      severity: "must",
    },
    {
      id: "Req-10.2",
      title: "Audit Logs",
      description: "Audit logs are implemented to support detection of anomalies and forensic analysis.",
      satisfiedBy: ["audit_log"],
      minTestCount: 1,
      severity: "must",
    },
    {
      id: "Req-11.4",
      title: "External & Internal Penetration Testing",
      description: "External and internal penetration testing is performed regularly.",
      satisfiedBy: ["sql_injection", "mass_assignment", "aml_bypass", "concurrent_write", "negative_amount"],
      minTestCount: 4,
      severity: "should",
    },
  ],
};

// ─── GDPR — Article 25 (Privacy by Design) + Article 32 (Security) ───────────
const GDPR_PACK: CompliancePack = {
  framework: "gdpr",
  fullName: "General Data Protection Regulation",
  version: "EU 2016/679",
  url: "https://gdpr-info.eu/",
  description: "EU GDPR — Privacy by Design (Art. 25), Right to Erasure (Art. 17), Security (Art. 32)",
  criteria: [
    {
      id: "Art-17",
      title: "Right to Erasure ('Right to be Forgotten')",
      description: "The data subject shall have the right to obtain from the controller the erasure of personal data concerning him or her without undue delay.",
      satisfiedBy: ["dsgvo"],
      minTestCount: 1,
      severity: "must",
    },
    {
      id: "Art-20",
      title: "Right to Data Portability",
      description: "The data subject shall have the right to receive the personal data concerning him or her in a structured, commonly used and machine-readable format.",
      satisfiedBy: ["dsgvo"],
      severity: "should",
    },
    {
      id: "Art-25",
      title: "Data Protection by Design and by Default",
      description: "The controller shall implement appropriate technical and organisational measures.",
      satisfiedBy: ["idor", "cross_tenant_chain", "mass_assignment"],
      minTestCount: 2,
      severity: "must",
    },
    {
      id: "Art-32(1)(a)",
      title: "Pseudonymisation and Encryption",
      description: "The pseudonymisation and encryption of personal data.",
      satisfiedBy: ["dsgvo", "audit_log"],
      severity: "must",
    },
    {
      id: "Art-32(1)(b)",
      title: "Confidentiality, Integrity, Availability",
      description: "The ability to ensure the ongoing confidentiality, integrity, availability and resilience of processing systems and services.",
      satisfiedBy: ["auth_matrix", "idor", "concurrency", "e2e_network", "rate_limit"],
      minTestCount: 3,
      severity: "must",
    },
    {
      id: "Art-32(1)(d)",
      title: "Regular Testing & Evaluation",
      description: "A process for regularly testing, assessing and evaluating the effectiveness of technical and organisational measures.",
      satisfiedBy: ["spec_drift", "property_based", "stateful_sequence"],
      severity: "must",
    },
    {
      id: "Art-33",
      title: "Notification of Data Breach",
      description: "In the case of a personal data breach, the controller shall notify the supervisory authority within 72 hours.",
      satisfiedBy: ["audit_log"],
      severity: "should",
    },
  ],
};

const ALL_PACKS: Record<ComplianceFramework, CompliancePack> = {
  soc2: SOC2_PACK,
  hipaa: HIPAA_PACK,
  pci_dss: PCI_DSS_PACK,
  gdpr: GDPR_PACK,
};

export function getPack(framework: ComplianceFramework): CompliancePack {
  return ALL_PACKS[framework];
}

export function listPacks(): CompliancePack[] {
  return Object.values(ALL_PACKS);
}

export interface CriterionResult {
  criterion: ComplianceCriterion;
  passed: boolean;
  evidence: Array<{ proofId: string; proofType: ProofType; mutationScore: number }>;
  missingProofTypes: ProofType[];
  reason?: string; // why it failed
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  packName: string;
  packVersion: string;
  generatedAt: string;
  passed: boolean;             // all "must" criteria satisfied
  passRate: number;            // 0-100 across all criteria
  mustPassRate: number;        // 0-100 across "must" criteria only
  mustCount: { passed: number; failed: number };
  shouldCount: { passed: number; failed: number };
  results: CriterionResult[];
}

/**
 * Evaluate a validated proof suite against a compliance pack.
 * Returns a report with evidence (which proofs satisfy which criterion) and
 * verdict (pass/fail per criterion).
 */
export function evaluateCompliance(
  framework: ComplianceFramework,
  validatedSuite: ValidatedProofSuite,
): ComplianceReport {
  const pack = getPack(framework);
  const results: CriterionResult[] = pack.criteria.map(criterion => {
    // Find proofs of the right type that passed validation
    const matching = validatedSuite.proofs.filter(p =>
      criterion.satisfiedBy.includes(p.proofType)
    );
    const required = criterion.minTestCount ?? 1;
    const passed = matching.length >= required;

    const missingProofTypes = passed
      ? []
      : criterion.satisfiedBy.filter(pt =>
          !validatedSuite.proofs.some(p => p.proofType === pt)
        );

    return {
      criterion,
      passed,
      evidence: matching.map(p => ({
        proofId: p.id,
        proofType: p.proofType,
        mutationScore: p.mutationScore,
      })),
      missingProofTypes,
      reason: !passed
        ? (matching.length === 0
          ? `No tests of required ProofTypes (${criterion.satisfiedBy.join(", ")})`
          : `Found ${matching.length} test(s), need at least ${required}`)
        : undefined,
    };
  });

  const must = results.filter(r => r.criterion.severity === "must");
  const should = results.filter(r => r.criterion.severity === "should");
  const mustPassed = must.filter(r => r.passed).length;
  const shouldPassed = should.filter(r => r.passed).length;
  const totalPassed = results.filter(r => r.passed).length;

  return {
    framework,
    packName: pack.fullName,
    packVersion: pack.version,
    generatedAt: new Date().toISOString(),
    passed: must.every(r => r.passed),
    passRate: results.length > 0 ? Math.round((totalPassed / results.length) * 100) : 0,
    mustPassRate: must.length > 0 ? Math.round((mustPassed / must.length) * 100) : 100,
    mustCount: { passed: mustPassed, failed: must.length - mustPassed },
    shouldCount: { passed: shouldPassed, failed: should.length - shouldPassed },
    results,
  };
}

/**
 * Render a compliance report as audit-ready Markdown.
 * The output is suitable to attach to an auditor request.
 */
export function renderComplianceReport(report: ComplianceReport, analysis: AnalysisResult): string {
  const pack = getPack(report.framework);
  const verdict = report.passed
    ? "✅ **PASS** — all required criteria satisfied"
    : "❌ **FAIL** — required criteria not satisfied";

  const lines: string[] = [
    `# ${pack.fullName} Compliance Report`,
    ``,
    `**Project:** ${analysis.specType}`,
    `**Generated:** ${report.generatedAt}`,
    `**Framework:** ${pack.fullName} (${pack.version})`,
    `**Reference:** ${pack.url}`,
    ``,
    `## Verdict`,
    ``,
    verdict,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Required ("must") criteria | ${report.mustCount.passed}/${report.mustCount.passed + report.mustCount.failed} passed (${report.mustPassRate}%) |`,
    `| Recommended ("should") criteria | ${report.shouldCount.passed}/${report.shouldCount.passed + report.shouldCount.failed} passed |`,
    `| Overall pass rate | ${report.passRate}% |`,
    ``,
    `## Criteria Detail`,
    ``,
  ];

  for (const r of report.results) {
    const icon = r.passed ? "✅" : "❌";
    const sev = r.criterion.severity === "must" ? "**REQUIRED**" : "*recommended*";
    lines.push(`### ${icon} ${r.criterion.id} — ${r.criterion.title} (${sev})`);
    lines.push(``);
    lines.push(`> ${r.criterion.description}`);
    lines.push(``);

    if (r.passed) {
      lines.push(`**Evidence (${r.evidence.length} test${r.evidence.length === 1 ? "" : "s"}):**`);
      lines.push(``);
      lines.push(`| Test ID | ProofType | Mutation Score |`);
      lines.push(`|---------|-----------|----------------|`);
      for (const e of r.evidence) {
        lines.push(`| \`${e.proofId}\` | ${e.proofType} | ${(e.mutationScore * 100).toFixed(0)}% |`);
      }
    } else {
      lines.push(`**Reason:** ${r.reason}`);
      if (r.missingProofTypes.length > 0) {
        lines.push(``);
        lines.push(`**Missing ProofTypes:** ${r.missingProofTypes.map(t => `\`${t}\``).join(", ")}`);
        lines.push(``);
        lines.push(`*To satisfy this criterion, add behaviors/endpoints in your spec that trigger these test types.*`);
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  lines.push(`## Limitations`);
  lines.push(``);
  lines.push(`This report verifies that **TestForge generated tests covering the required criteria**. `);
  lines.push(`It does NOT prove that those tests pass against your production system. To complete the audit:`);
  lines.push(`1. Run the generated test suite against your production/staging environment`);
  lines.push(`2. Achieve mutation score ≥ 80% on each criterion's tests`);
  lines.push(`3. Maintain CI gates that prevent regression`);
  lines.push(``);
  lines.push(`*Report generated by [TestForge](https://testforge.dev) — turn any spec into compliance evidence.*`);

  return lines.join("\n");
}
