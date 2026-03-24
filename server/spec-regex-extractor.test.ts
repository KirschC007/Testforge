/**
 * Tests for spec-regex-extractor.ts
 * Mechanismus 2: Deterministic fallback extraction without LLM
 */

import { describe, it, expect } from "vitest";
import {
  extractStates,
  extractEndpoints,
  extractRoles,
  extractErrorCodes,
  extractFromSpecText,
  decomposeSpec,
  mergeWithRegex,
} from "../server/analyzer/spec-regex-extractor";
import type { AnalysisIR } from "../server/analyzer/types";

// ─── extractStates ────────────────────────────────────────────────────────────

describe("extractStates", () => {
  it("extracts states from arrow notation", () => {
    const text = "DRAFT → SUBMITTED → APPROVED → DISBURSED";
    const states = extractStates(text);
    expect(states).toContain("DRAFT");
    expect(states).toContain("SUBMITTED");
    expect(states).toContain("APPROVED");
    expect(states).toContain("DISBURSED");
  });

  it("extracts states from ASCII arrow notation", () => {
    const text = "PENDING -> CONFIRMED -> COMPLETED";
    const states = extractStates(text);
    expect(states).toContain("PENDING");
    expect(states).toContain("CONFIRMED");
    expect(states).toContain("COMPLETED");
  });

  it("extracts states from markdown table", () => {
    const text = `
| Von | Nach | Erlaubt |
|-----|------|---------|
| REPORTED | UNDER_INVESTIGATION | Ja |
| UNDER_INVESTIGATION | RESOLVED | Ja |
| RESOLVED | CLOSED | Ja |
`;
    const states = extractStates(text);
    expect(states).toContain("REPORTED");
    expect(states).toContain("UNDER_INVESTIGATION");
    expect(states).toContain("RESOLVED");
    expect(states).toContain("CLOSED");
  });

  it("extracts states from ENUM definition", () => {
    const text = "ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')";
    const states = extractStates(text);
    expect(states).toContain("DRAFT");
    expect(states).toContain("SUBMITTED");
    expect(states).toContain("UNDER_REVIEW");
    expect(states).toContain("APPROVED");
    expect(states).toContain("REJECTED");
  });

  it("extracts states from status: prefix", () => {
    const text = "status: PENDING, CONFIRMED, CANCELLED";
    const states = extractStates(text);
    expect(states).toContain("PENDING");
    expect(states).toContain("CONFIRMED");
    expect(states).toContain("CANCELLED");
  });

  it("deduplicates states", () => {
    const text = "DRAFT → SUBMITTED, DRAFT → CANCELLED, SUBMITTED → APPROVED";
    const states = extractStates(text);
    const draftCount = states.filter(s => s === "DRAFT").length;
    expect(draftCount).toBe(1);
  });

  it("filters out short non-state words", () => {
    const text = "The API uses GET and POST methods";
    const states = extractStates(text);
    expect(states).not.toContain("GET");
    expect(states).not.toContain("POST");
    expect(states).not.toContain("THE");
    expect(states).not.toContain("API");
  });

  it("handles InsuranceClaims states", () => {
    const text = `
Status-Machine:
REPORTED → UNDER_INVESTIGATION → EVIDENCE_COLLECTION → ASSESSMENT_PENDING
→ APPROVED → PAYOUT_PROCESSING → SETTLED (Terminal)
REPORTED → REJECTED (Terminal)
UNDER_INVESTIGATION → FRAUD_DETECTED → CLOSED (Terminal)
`;
    const states = extractStates(text);
    expect(states).toContain("REPORTED");
    expect(states).toContain("UNDER_INVESTIGATION");
    expect(states).toContain("EVIDENCE_COLLECTION");
    expect(states).toContain("ASSESSMENT_PENDING");
    expect(states).toContain("APPROVED");
    expect(states).toContain("PAYOUT_PROCESSING");
    expect(states).toContain("SETTLED");
    expect(states).toContain("REJECTED");
    expect(states).toContain("FRAUD_DETECTED");
    expect(states).toContain("CLOSED");
  });
});

// ─── extractEndpoints ─────────────────────────────────────────────────────────

describe("extractEndpoints", () => {
  it("extracts GET endpoints", () => {
    const text = "GET /api/claims — List all claims";
    const endpoints = extractEndpoints(text);
    expect(endpoints.some(e => e.method === "GET" && e.path.includes("/api/claims"))).toBe(true);
  });

  it("extracts POST endpoints", () => {
    const text = "POST /api/claims — Submit a new claim";
    const endpoints = extractEndpoints(text);
    expect(endpoints.some(e => e.method === "POST" && e.path.includes("/api/claims"))).toBe(true);
  });

  it("extracts PATCH endpoints", () => {
    const text = "PATCH /api/claims/:id/status — Update claim status";
    const endpoints = extractEndpoints(text);
    expect(endpoints.some(e => e.method === "PATCH" && e.path.includes("/api/claims"))).toBe(true);
  });

  it("extracts multiple endpoints from a spec section", () => {
    const text = `
### 3.1 POST /api/claims
Submit a new insurance claim.

### 3.2 GET /api/claims/:id
Get claim details.

### 3.3 PATCH /api/claims/:id/status
Update claim status.

### 3.4 DELETE /api/claims/:id
Delete a claim.
`;
    const endpoints = extractEndpoints(text);
    expect(endpoints.length).toBeGreaterThanOrEqual(4);
  });

  it("deduplicates endpoints", () => {
    const text = `
POST /api/claims — Submit claim
POST /api/claims — Submit a new claim
`;
    const endpoints = extractEndpoints(text);
    const postClaims = endpoints.filter(e => e.method === "POST" && e.path === "/api/claims");
    expect(postClaims.length).toBe(1);
  });
});

// ─── extractRoles ─────────────────────────────────────────────────────────────

describe("extractRoles", () => {
  it("extracts roles from permission table", () => {
    const text = `
| Rolle | Berechtigung |
|-------|-------------|
| policyholder | kann Antrag stellen |
| claims_agent | kann Antrag bearbeiten |
| fraud_analyst | kann Betrug melden |
| insurer_admin | hat alle Rechte |
`;
    const roles = extractRoles(text);
    expect(roles).toContain("policyholder");
    expect(roles).toContain("claims_agent");
    expect(roles).toContain("fraud_analyst");
    expect(roles).toContain("insurer_admin");
  });

  it("extracts roles from role: prefix", () => {
    const text = "role: clinic_admin, doctor, receptionist, patient";
    const roles = extractRoles(text);
    expect(roles).toContain("clinic_admin");
    expect(roles).toContain("doctor");
    expect(roles).toContain("receptionist");
    expect(roles).toContain("patient");
  });

  it("extracts roles from user.role === pattern", () => {
    const text = `
if (user.role === 'loan_officer') { ... }
if (user.role === 'underwriter') { ... }
`;
    const roles = extractRoles(text);
    expect(roles).toContain("loan_officer");
    expect(roles).toContain("underwriter");
  });

  it("deduplicates roles", () => {
    const text = "policyholder can submit. policyholder can view.";
    const roles = extractRoles(text);
    const count = roles.filter(r => r === "policyholder").length;
    expect(count).toBe(1);
  });

  it("filters out common non-role words", () => {
    const text = "The system uses authentication and authorization";
    const roles = extractRoles(text);
    expect(roles).not.toContain("system");
    expect(roles).not.toContain("authentication");
  });
});

// ─── extractErrorCodes ────────────────────────────────────────────────────────

describe("extractErrorCodes", () => {
  it("extracts error codes from markdown table", () => {
    const text = `
| Code | HTTP | Beschreibung |
|------|------|-------------|
| INSURER_MISMATCH | 422 | Versicherer stimmt nicht überein |
| POLICY_NOT_FOUND | 404 | Police nicht gefunden |
| ALREADY_SETTLED | 409 | Bereits abgerechnet |
`;
    const codes = extractErrorCodes(text);
    expect(codes.some(c => c.code === "INSURER_MISMATCH")).toBe(true);
    expect(codes.some(c => c.code === "POLICY_NOT_FOUND")).toBe(true);
    expect(codes.some(c => c.code === "ALREADY_SETTLED")).toBe(true);
  });

  it("extracts HTTP status from error code table", () => {
    const text = `
| Code | HTTP | Beschreibung |
|------|------|-------------|
| CLAIM_LIMIT_EXCEEDED | 422 | Maximale Anzahl überschritten |
`;
    const codes = extractErrorCodes(text);
    const code = codes.find(c => c.code === "CLAIM_LIMIT_EXCEEDED");
    expect(code).toBeDefined();
    expect(code?.httpStatus).toBe(422);
  });

  it("extracts error codes from inline mentions", () => {
    const text = "Returns 409 DUPLICATE_CLAIM if a claim already exists for this policy.";
    const codes = extractErrorCodes(text);
    expect(codes.some(c => c.code === "DUPLICATE_CLAIM")).toBe(true);
  });

  it("deduplicates error codes", () => {
    const text = `
POLICY_NOT_FOUND: 404
Returns POLICY_NOT_FOUND if not found.
`;
    const codes = extractErrorCodes(text);
    const count = codes.filter(c => c.code === "POLICY_NOT_FOUND").length;
    expect(count).toBe(1);
  });
});

// ─── extractFromSpecText ──────────────────────────────────────────────────────

describe("extractFromSpecText", () => {
  it("returns a complete RegexExtractionResult", () => {
    const text = `
# InsuranceClaims API

## Rollen
policyholder, claims_agent

## Status
REPORTED → UNDER_INVESTIGATION → RESOLVED

## Endpoints
POST /api/claims
GET /api/claims/:id

## Fehler-Codes
| Code | HTTP |
|------|------|
| POLICY_NOT_FOUND | 404 |
`;
    const result = extractFromSpecText(text);
    expect(result.states.length).toBeGreaterThan(0);
    expect(result.roles.length).toBeGreaterThan(0);
    expect(result.endpoints.length).toBeGreaterThan(0);
    expect(result.errorCodes.length).toBeGreaterThan(0);
  });
});

// ─── decomposeSpec ────────────────────────────────────────────────────────────

describe("decomposeSpec", () => {
  it("returns a full section always", () => {
    const text = "# Simple Spec\n\nSome content here.";
    const sections = decomposeSpec(text);
    expect(sections.full).toBe(text);
  });

  it("identifies endpoints section", () => {
    const text = `
# API Spec

## Endpoints
POST /api/claims
GET /api/claims/:id

## Rollen
policyholder, claims_agent
`;
    const sections = decomposeSpec(text);
    expect(sections.endpoints).toBeDefined();
    expect(sections.endpoints!.length).toBeGreaterThan(0);
  });

  it("identifies status machine section", () => {
    const text = `
# API Spec

## Status-Übergänge
REPORTED → UNDER_INVESTIGATION → RESOLVED

## Endpoints
POST /api/claims
`;
    const sections = decomposeSpec(text);
    expect(sections.statusMachine).toBeDefined();
    expect(sections.statusMachine!.length).toBeGreaterThan(0);
  });

  it("identifies roles section", () => {
    const text = `
# API Spec

## Rollen und Berechtigungen
policyholder, claims_agent, fraud_analyst

## Endpoints
POST /api/claims
`;
    const sections = decomposeSpec(text);
    expect(sections.roles).toBeDefined();
    expect(sections.roles!.length).toBeGreaterThan(0);
  });
});

// ─── mergeWithRegex ───────────────────────────────────────────────────────────

describe("mergeWithRegex", () => {
  it("adds missing states to status machine", () => {
    const ir: AnalysisIR = {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: null,
      resources: [],
      apiEndpoints: [],
      authModel: null,
      enums: {},
      statusMachine: {
        states: ["REPORTED", "RESOLVED"],
        transitions: [["REPORTED", "RESOLVED"]],
        forbidden: [],
        initialState: "REPORTED",
        terminalStates: ["RESOLVED"],
      },
      userFlows: [],
    };

    const regexResult = {
      states: ["REPORTED", "UNDER_INVESTIGATION", "RESOLVED", "CLOSED"],
      transitions: [["REPORTED", "UNDER_INVESTIGATION"]] as [string, string][],
      forbidden: [] as [string, string][],
      roles: [],
      endpoints: [],
      errorCodes: [],
    };

    const merged = mergeWithRegex(ir, regexResult);
    expect(merged.statusMachine?.states).toContain("UNDER_INVESTIGATION");
    expect(merged.statusMachine?.states).toContain("CLOSED");
    expect(merged.statusMachine?.states.length).toBe(4);
  });

  it("creates status machine from regex if IR has none", () => {
    const ir: AnalysisIR = {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: null,
      resources: [],
      apiEndpoints: [],
      authModel: null,
      enums: {},
      statusMachine: null,
      userFlows: [],
    };

    const regexResult = {
      states: ["PENDING", "APPROVED", "REJECTED"],
      transitions: [["PENDING", "APPROVED"], ["PENDING", "REJECTED"]] as [string, string][],
      forbidden: [] as [string, string][],
      roles: [],
      endpoints: [],
      errorCodes: [],
    };

    const merged = mergeWithRegex(ir, regexResult);
    expect(merged.statusMachine).not.toBeNull();
    expect(merged.statusMachine?.states).toContain("PENDING");
    expect(merged.statusMachine?.states).toContain("APPROVED");
    expect(merged.statusMachine?.states).toContain("REJECTED");
  });

  it("adds missing roles to auth model", () => {
    const ir: AnalysisIR = {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: null,
      resources: [],
      apiEndpoints: [],
      authModel: {
        loginEndpoint: "/api/auth/login",
        roles: [{ name: "admin", envUserVar: "ADMIN_USER", envPassVar: "ADMIN_PASS", defaultUser: "admin", defaultPass: "pass" }],
      },
      enums: {},
      statusMachine: null,
      userFlows: [],
    };

    const regexResult = {
      states: [],
      transitions: [] as [string, string][],
      forbidden: [] as [string, string][],
      roles: ["admin", "user", "moderator"],
      endpoints: [],
      errorCodes: [],
    };

    const merged = mergeWithRegex(ir, regexResult);
    expect(merged.authModel?.roles.map(r => r.name)).toContain("user");
    expect(merged.authModel?.roles.map(r => r.name)).toContain("moderator");
    expect(merged.authModel?.roles.length).toBe(3);
  });

  it("does not duplicate existing roles", () => {
    const ir: AnalysisIR = {
      behaviors: [],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: null,
      resources: [],
      apiEndpoints: [],
      authModel: {
        loginEndpoint: "/api/auth/login",
        roles: [{ name: "admin", envUserVar: "ADMIN_USER", envPassVar: "ADMIN_PASS", defaultUser: "admin", defaultPass: "pass" }],
      },
      enums: {},
      statusMachine: null,
      userFlows: [],
    };

    const regexResult = {
      states: [],
      transitions: [] as [string, string][],
      forbidden: [] as [string, string][],
      roles: ["admin"],
      endpoints: [],
      errorCodes: [],
    };

    const merged = mergeWithRegex(ir, regexResult);
    const adminCount = merged.authModel?.roles.filter(r => r.name === "admin").length;
    expect(adminCount).toBe(1);
  });

  it("preserves existing IR data when merging", () => {
    const ir: AnalysisIR = {
      behaviors: [{ id: "B-001", title: "Test", subject: "user", action: "submit", object: "claim", preconditions: [], postconditions: [], errorCases: [], tags: [], confidence: 1.0 }],
      invariants: [],
      ambiguities: [],
      contradictions: [],
      tenantModel: { entity: "insurer", idField: "insurerId" },
      resources: [],
      apiEndpoints: [{ name: "claims.submit", method: "POST", auth: "requireAuth", relatedBehaviors: [], inputFields: [] }],
      authModel: null,
      enums: {},
      statusMachine: null,
      userFlows: [],
    };

    const regexResult = {
      states: [],
      transitions: [] as [string, string][],
      forbidden: [] as [string, string][],
      roles: [],
      endpoints: [],
      errorCodes: [],
    };

    const merged = mergeWithRegex(ir, regexResult);
    expect(merged.behaviors.length).toBe(1);
    expect(merged.tenantModel?.entity).toBe("insurer");
    expect(merged.apiEndpoints.length).toBe(1);
  });
});
