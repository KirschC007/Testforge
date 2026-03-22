/**
 * Tests for smart-parser.ts — 3-Pass Smart Spec Parser
 *
 * Tests cover:
 * - classifySection: topic detection from title + text
 * - splitIntoSections: markdown header splitting
 * - compressSpec: spec compression logic
 * - semanticDedup: behavior deduplication by word overlap
 * - mergeEndpoints: endpoint merging by richest inputFields
 * - enrichFromStructuralMap: IR enrichment from structural map
 * - normalizeEndpointFields: field normalization
 * - normalizeStringFields: string field normalization
 * - groupSectionsForExtraction: section grouping by topic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifySection,
  splitIntoSections,
  compressSpec,
  semanticDedup,
  mergeEndpoints,
  enrichFromStructuralMap,
  normalizeEndpointFields,
  normalizeStringFields,
  groupSectionsForExtraction,
  type SpecSection,
  type StructuralMap,
  type ChunkGroup,
} from "./analyzer/smart-parser";
import type { Behavior, APIEndpoint, AnalysisIR } from "./analyzer/types";

// ─── classifySection ──────────────────────────────────────────────────────────

describe("classifySection", () => {
  it("classifies tRPC router sections as endpoints", () => {
    expect(classifySection("API v1 Router", "trpc procedures")).toBe("endpoints");
    expect(classifySection("Kapitel 3: Router", "router.create.query")).toBe("endpoints");
    expect(classifySection("Prozeduren", "endpoint definitions")).toBe("endpoints");
  });

  it("classifies schema/database sections", () => {
    expect(classifySection("Datenbankschema", "CREATE TABLE users")).toBe("schema");
    expect(classifySection("Schema", "tabelle mit feldern")).toBe("schema");
    expect(classifySection("DB", "datenbank struktur")).toBe("schema");
  });

  it("classifies status/state machine sections", () => {
    expect(classifySection("Status-Übergänge", "von pending zu active")).toBe("status");
    expect(classifySection("State Machine", "transition rules")).toBe("status");
    expect(classifySection("Kapitel 5", "status änderungen und übergänge")).toBe("status");
  });

  it("classifies auth sections", () => {
    expect(classifySection("Authentifizierung", "login mit passwort")).toBe("auth");
    expect(classifySection("Auth", "session management jwt token")).toBe("auth");
    expect(classifySection("Login", "auth flow")).toBe("auth");
  });

  it("classifies security sections", () => {
    expect(classifySection("Sicherheit", "csrf protection rate-limit")).toBe("security");
    expect(classifySection("Security", "cors headers")).toBe("security");
    expect(classifySection("CSRF", "token validation")).toBe("security");
  });

  it("classifies DSGVO/GDPR sections", () => {
    expect(classifySection("DSGVO", "anonymisierung von nutzerdaten")).toBe("dsgvo");
    expect(classifySection("Datenschutz", "löschung personenbezogener daten")).toBe("dsgvo");
    expect(classifySection("Privacy", "gdpr deletion")).toBe("dsgvo");
  });

  it("classifies edge case sections", () => {
    expect(classifySection("Edge Cases", "race condition handling")).toBe("edge-cases");
    expect(classifySection("Sonderfälle", "edge case behavior")).toBe("edge-cases");
  });

  it("classifies business logic sections", () => {
    expect(classifySection("Buchungslogik", "reservierung und warteliste")).toBe("business-logic");
    expect(classifySection("Booking", "cron job für stornierung")).toBe("business-logic");
    expect(classifySection("Payment", "stripe preauth flow")).toBe("business-logic");
    expect(classifySection("Widget", "self-service portal")).toBe("business-logic");
  });

  it("classifies unknown sections as other", () => {
    expect(classifySection("Einleitung", "allgemeine beschreibung des systems")).toBe("other");
    expect(classifySection("Glossar", "definitionen und begriffe")).toBe("other");
  });
});

// ─── splitIntoSections ────────────────────────────────────────────────────────

describe("splitIntoSections", () => {
  it("returns empty array for spec with no sections over 100 chars", () => {
    const sections = splitIntoSections("# Title\nShort.");
    expect(sections).toHaveLength(0);
  });

  it("splits a spec with multiple headers into sections", () => {
    const spec = `# Preamble
This is the introduction to the system. It describes the overall architecture and goals.
The system has multiple components working together to provide a seamless experience.

## API Router
The tRPC router exposes the following procedures for client consumption.
Each procedure has typed inputs and outputs validated by Zod schemas.
Endpoints include: users.create, users.get, users.update, users.delete.

## Status-Übergänge
The booking status transitions follow a strict state machine.
Allowed transitions: pending → confirmed → completed, pending → cancelled.
Forbidden: completed → pending, cancelled → confirmed.`;

    const sections = splitIntoSections(spec);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    const titles = sections.map(s => s.title);
    expect(titles).toContain("API Router");
    expect(titles).toContain("Status-Übergänge");
  });

  it("assigns correct topics to sections", () => {
    const spec = `# Intro
This is a long enough preamble section that has more than one hundred characters in it to pass the filter.

## Auth Flow
Login and session management with JWT tokens and passwort validation.
The auth flow includes CSRF protection and rate limiting per IP address.

## DSGVO Compliance
Anonymisierung von nutzerdaten nach 30 Tagen inaktivität.
Löschung aller personenbezogenen daten auf anfrage des nutzers.`;

    const sections = splitIntoSections(spec);
    const authSection = sections.find(s => s.title === "Auth Flow");
    const dsgvoSection = sections.find(s => s.title === "DSGVO Compliance");
    expect(authSection?.topic).toBe("auth");
    expect(dsgvoSection?.topic).toBe("dsgvo");
  });

  it("correctly sets level for headers", () => {
    // Parser behavior: when a header is at i=0, it is NOT processed as a boundary (i > 0 guard).
    // The first section gets title "Preamble" and level 1 (initial defaults).
    // The header at i=0 sets currentTitle/currentLevel only when the NEXT header is encountered.
    // So: ## at i=0 → first section pushed as "Preamble" level 1 when ### is hit.
    // ### at i=3 → becomes last section with level 3.
    const spec = `## Second Level
This section also has enough content to be included in the sections array for testing.

### Third Level
This section also has enough content to be included in the sections array for testing.`;

    const sections = splitIntoSections(spec);
    // First section: "Preamble" level 1 (because ## at i=0 is skipped as boundary)
    expect(sections[0].level).toBe(1);
    // Last section: "Third Level" level 3
    const third = sections.find(s => s.title === "Third Level");
    expect(third?.level).toBe(3);
  });

  it("skips sections with fewer than 100 chars", () => {
    const spec = `# Short
Too short.

## Long Section
This section has enough content to be included in the sections array for testing purposes.
It spans multiple lines and has more than one hundred characters total.`;

    const sections = splitIntoSections(spec);
    expect(sections.every(s => s.charCount > 100)).toBe(true);
    expect(sections.some(s => s.title === "Long Section")).toBe(true);
  });

  it("sets startLine and endLine correctly", () => {
    const spec = `# Section A
Line 1 of section A with enough content to pass the minimum length filter for sections.
Line 2 of section A with more content to ensure we exceed the threshold.

## Section B
Line 1 of section B with enough content to pass the minimum length filter for sections.
Line 2 of section B with more content to ensure we exceed the threshold.`;

    const sections = splitIntoSections(spec);
    expect(sections[0].startLine).toBe(0);
    expect(sections[0].endLine).toBeGreaterThan(0);
    expect(sections[1].startLine).toBeGreaterThan(sections[0].endLine);
  });
});

// ─── compressSpec ─────────────────────────────────────────────────────────────

describe("compressSpec", () => {
  it("keeps headers in compressed output", () => {
    const spec = "# Chapter 1\n## Sub Section\n### Deep Level\n" + "x".repeat(5000);
    const compressed = compressSpec(spec, 10000);
    expect(compressed).toContain("# Chapter 1");
    expect(compressed).toContain("## Sub Section");
    expect(compressed).toContain("### Deep Level");
  });

  it("keeps table rows in compressed output", () => {
    const spec = "| Field | Type | Required |\n| name | string | yes |\n| age | number | no |\n" + "x".repeat(5000);
    const compressed = compressSpec(spec, 10000);
    expect(compressed).toContain("| Field | Type | Required |");
    expect(compressed).toContain("| name | string | yes |");
  });

  it("keeps lines with key patterns (→, ENUM, min, max, status)", () => {
    const spec = "pending → confirmed → completed\nENUM('active','inactive')\nmin: 1, max: 100\n" + "x".repeat(5000);
    const compressed = compressSpec(spec, 10000);
    expect(compressed).toContain("pending → confirmed → completed");
    expect(compressed).toContain("ENUM('active','inactive')");
    expect(compressed).toContain("min: 1, max: 100");
  });

  it("keeps SQL CREATE TABLE statements in code blocks", () => {
    const spec = "```sql\nCREATE TABLE users (\n  id INT NOT NULL,\n  name VARCHAR(255) DEFAULT 'test'\n);\n```\n" + "x".repeat(5000);
    const compressed = compressSpec(spec, 10000);
    expect(compressed).toContain("CREATE TABLE users");
    expect(compressed).toContain("NOT NULL");
  });

  it("truncates output to maxChars", () => {
    const spec = "# Header\n" + "This is a very long line that should be kept because it is short enough.\n".repeat(1000);
    const compressed = compressSpec(spec, 1000);
    expect(compressed.length).toBeLessThanOrEqual(1200); // Allow some slack for the truncation marker
    expect(compressed).toContain("[... middle sections compressed ...]");
  });

  it("returns spec unchanged if under maxChars", () => {
    const spec = "# Short spec\nJust a few lines.\n| col1 | col2 |\n| val1 | val2 |";
    const compressed = compressSpec(spec, 10000);
    expect(compressed).toContain("# Short spec");
    expect(compressed.length).toBeLessThan(10000);
    expect(compressed).not.toContain("[... middle sections compressed ...]");
  });
});

// ─── semanticDedup ────────────────────────────────────────────────────────────

describe("semanticDedup", () => {
  const makeBehavior = (id: string, title: string): Behavior => ({
    id,
    title,
    subject: "system",
    action: "validates",
    object: "input",
    preconditions: [],
    postconditions: [],
    errorCases: [],
    tags: [],
    riskHints: [],
    chapter: "test",
    specAnchor: "test anchor",
  });

  it("keeps all behaviors when no duplicates", () => {
    const behaviors = [
      makeBehavior("B-001", "User can create booking"),
      makeBehavior("B-002", "Admin can cancel booking"),
      makeBehavior("B-003", "System sends confirmation email"),
    ];
    const result = semanticDedup(behaviors);
    expect(result).toHaveLength(3);
  });

  it("removes exact duplicate titles (after normalization)", () => {
    const behaviors = [
      makeBehavior("B-001", "User can create booking"),
      makeBehavior("B-002", "User can create booking"), // exact duplicate
    ];
    const result = semanticDedup(behaviors);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("B-001");
  });

  it("removes near-duplicate titles with 80%+ word overlap", () => {
    const behaviors = [
      makeBehavior("B-001", "User cannot create booking when restaurant is closed"),
      makeBehavior("B-002", "User cannot create booking when restaurant is closed today"), // 80%+ overlap
    ];
    const result = semanticDedup(behaviors);
    expect(result).toHaveLength(1);
  });

  it("keeps behaviors with different enough titles", () => {
    const behaviors = [
      makeBehavior("B-001", "User can create booking"),
      makeBehavior("B-002", "Admin can delete restaurant"),
      makeBehavior("B-003", "System validates payment method"),
    ];
    const result = semanticDedup(behaviors);
    expect(result).toHaveLength(3);
  });

  it("keeps the first occurrence when deduplicating", () => {
    const behaviors = [
      makeBehavior("B-001", "User creates booking with valid data"),
      makeBehavior("B-002", "User creates booking with valid data"),
    ];
    const result = semanticDedup(behaviors);
    expect(result[0].id).toBe("B-001");
  });

  it("handles empty array", () => {
    expect(semanticDedup([])).toHaveLength(0);
  });

  it("handles single behavior", () => {
    const behaviors = [makeBehavior("B-001", "Single behavior")];
    expect(semanticDedup(behaviors)).toHaveLength(1);
  });

  it("ignores short words (<=3 chars) in overlap calculation", () => {
    // "the" and "a" and "is" are too short — these titles should NOT be considered duplicates
    const behaviors = [
      makeBehavior("B-001", "The user is authenticated"),
      makeBehavior("B-002", "The admin is authorized"),
    ];
    const result = semanticDedup(behaviors);
    // "user" and "admin" are different long words — should not be 80%+ overlap
    expect(result).toHaveLength(2);
  });
});

// ─── mergeEndpoints ───────────────────────────────────────────────────────────

describe("mergeEndpoints", () => {
  const makeEndpoint = (name: string, inputFields: string[], relatedBehaviors: string[] = []): APIEndpoint => ({
    name,
    method: "POST /api/trpc/" + name,
    auth: "requireAuth",
    relatedBehaviors,
    inputFields: inputFields.map(f => ({ name: f, type: "string" as const, required: true })),
    outputFields: [],
  });

  it("returns unique endpoints when no duplicates", () => {
    const endpoints = [
      makeEndpoint("users.create", ["name", "email"]),
      makeEndpoint("users.get", ["id"]),
      makeEndpoint("users.delete", ["id"]),
    ];
    const result = mergeEndpoints(endpoints);
    expect(result).toHaveLength(3);
  });

  it("merges duplicate endpoints keeping the one with more inputFields", () => {
    const endpoints = [
      makeEndpoint("bookings.create", ["restaurantId"]),                          // fewer fields
      makeEndpoint("bookings.create", ["restaurantId", "date", "partySize", "notes"]), // more fields
    ];
    const result = mergeEndpoints(endpoints);
    expect(result).toHaveLength(1);
    expect(result[0].inputFields).toHaveLength(4);
  });

  it("merges relatedBehaviors from both versions", () => {
    const endpoints = [
      makeEndpoint("bookings.create", ["restaurantId"], ["B-001", "B-002"]),
      makeEndpoint("bookings.create", ["restaurantId", "date", "partySize"], ["B-003", "B-004"]),
    ];
    const result = mergeEndpoints(endpoints);
    expect(result).toHaveLength(1);
    const behaviors = result[0].relatedBehaviors;
    expect(behaviors).toContain("B-001");
    expect(behaviors).toContain("B-002");
    expect(behaviors).toContain("B-003");
    expect(behaviors).toContain("B-004");
  });

  it("deduplicates relatedBehaviors in merge", () => {
    const endpoints = [
      makeEndpoint("users.get", ["id"], ["B-001", "B-002"]),
      makeEndpoint("users.get", ["id", "fields"], ["B-001", "B-003"]), // B-001 appears in both
    ];
    const result = mergeEndpoints(endpoints);
    const behaviors = result[0].relatedBehaviors;
    const b001Count = behaviors.filter(b => b === "B-001").length;
    expect(b001Count).toBe(1); // deduplicated
  });

  it("handles empty array", () => {
    expect(mergeEndpoints([])).toHaveLength(0);
  });

  it("handles single endpoint", () => {
    const endpoints = [makeEndpoint("users.create", ["name", "email"])];
    const result = mergeEndpoints(endpoints);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("users.create");
  });
});

// ─── enrichFromStructuralMap ─────────────────────────────────────────────────

describe("enrichFromStructuralMap", () => {
  const makeEmptyIR = (): AnalysisIR => ({
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
    services: [],
    userFlows: [],
    dataModels: [],
  });

  const makeStructuralMap = (overrides: Partial<StructuralMap> = {}): StructuralMap => ({
    endpoints: [],
    statusMachine: null,
    tenantModel: null,
    authModel: null,
    enums: {},
    piiTables: [],
    chapters: [],
    ...overrides,
  });

  it("sets tenantModel from structural map when IR has none", () => {
    const ir = makeEmptyIR();
    const map = makeStructuralMap({
      tenantModel: { entity: "restaurant", idField: "restaurantId" },
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.tenantModel).not.toBeNull();
    expect(ir.tenantModel?.tenantEntity).toBe("restaurant");
    expect(ir.tenantModel?.tenantIdField).toBe("restaurantId");
  });

  it("does not overwrite existing tenantModel", () => {
    const ir = makeEmptyIR();
    ir.tenantModel = { tenantEntity: "workspace", tenantIdField: "workspaceId" };
    const map = makeStructuralMap({
      tenantModel: { entity: "restaurant", idField: "restaurantId" },
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.tenantModel?.tenantEntity).toBe("workspace"); // unchanged
  });

  it("sets authModel from structural map when IR has none", () => {
    const ir = makeEmptyIR();
    const map = makeStructuralMap({
      authModel: {
        loginEndpoint: "auth.login",
        csrfEndpoint: "auth.csrf",
        csrfPattern: "X-CSRF-Token",
        roles: [
          { name: "admin", permissions: ["all"] },
          { name: "user", permissions: ["read"] },
        ],
      },
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.authModel).not.toBeNull();
    expect(ir.authModel?.loginEndpoint).toBe("auth.login");
    expect(ir.authModel?.roles).toHaveLength(2);
    expect(ir.authModel?.roles[0].name).toBe("admin");
    expect(ir.authModel?.roles[0].envUserVar).toBe("E2E_ADMIN_USER");
    expect(ir.authModel?.roles[0].envPassVar).toBe("E2E_ADMIN_PASS");
  });

  it("merges enums from structural map", () => {
    const ir = makeEmptyIR();
    ir.enums = { status: ["pending", "active"] };
    const map = makeStructuralMap({
      enums: {
        status: ["pending", "active", "cancelled"], // adds "cancelled"
        type: ["standard", "premium"],              // new enum
      },
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.enums.status).toContain("cancelled");
    expect(ir.enums.status).toHaveLength(3); // no duplicates
    expect(ir.enums.type).toEqual(["standard", "premium"]);
  });

  it("adds missing endpoints from structural map to IR", () => {
    const ir = makeEmptyIR();
    const map = makeStructuralMap({
      endpoints: [
        { name: "bookings.create", method: "POST", auth: "requireAuth", chapter: "API" },
        { name: "bookings.get", method: "GET", auth: "requireAuth", chapter: "API" },
      ],
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.apiEndpoints).toHaveLength(2);
    expect(ir.apiEndpoints[0].name).toBe("bookings.create");
    expect(ir.apiEndpoints[1].name).toBe("bookings.get");
  });

  it("does not add endpoints that already exist in IR", () => {
    const ir = makeEmptyIR();
    ir.apiEndpoints = [{
      name: "bookings.create",
      method: "POST /api/trpc/bookings.create",
      auth: "requireAuth",
      relatedBehaviors: ["B-001"],
      inputFields: [{ name: "restaurantId", type: "number", required: true }],
      outputFields: [],
    }];
    const map = makeStructuralMap({
      endpoints: [
        { name: "bookings.create", method: "POST", auth: "requireAuth", chapter: "API" },
      ],
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.apiEndpoints).toHaveLength(1); // not duplicated
    expect(ir.apiEndpoints[0].inputFields).toHaveLength(1); // original preserved
  });

  it("sets statusMachine from structural map when IR has none", () => {
    const ir = makeEmptyIR();
    const map = makeStructuralMap({
      statusMachine: {
        entity: "booking",
        states: ["pending", "confirmed", "cancelled"],
        transitions: [["pending", "confirmed"], ["confirmed", "cancelled"]],
        forbidden: [["cancelled", "confirmed"]],
        initialState: "pending",
        terminalStates: ["cancelled"],
      },
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.statusMachine).not.toBeNull();
    expect(ir.statusMachine?.states).toContain("pending");
    expect(ir.statusMachine?.transitions).toHaveLength(2);
    expect(ir.statusMachine?.forbidden).toHaveLength(1);
  });

  it("adds missing transitions from structural map to existing statusMachine", () => {
    const ir = makeEmptyIR();
    ir.statusMachine = {
      states: ["pending", "confirmed"],
      transitions: [["pending", "confirmed"]],
      forbidden: [],
      initialState: "pending",
      terminalStates: [],
    };
    const map = makeStructuralMap({
      statusMachine: {
        entity: "booking",
        states: ["pending", "confirmed", "cancelled"],
        transitions: [["pending", "confirmed"], ["confirmed", "cancelled"]], // adds new transition
        forbidden: [["cancelled", "confirmed"]],
        initialState: "pending",
        terminalStates: ["cancelled"],
      },
    });
    enrichFromStructuralMap(ir, map);
    expect(ir.statusMachine?.transitions).toHaveLength(2); // added the missing one
    expect(ir.statusMachine?.transitions).toContainEqual(["confirmed", "cancelled"]);
  });
});

// ─── normalizeEndpointFields ─────────────────────────────────────────────────

describe("normalizeEndpointFields", () => {
  it("normalizes string fields to EndpointField objects", () => {
    const result = normalizeEndpointFields(["name", "email", "age"]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "name", type: "string", required: true });
    expect(result[1]).toEqual({ name: "email", type: "string", required: true });
  });

  it("normalizes object fields with all properties", () => {
    const result = normalizeEndpointFields([{
      name: "partySize",
      type: "number",
      required: true,
      min: 1,
      max: 20,
    }]);
    expect(result[0].name).toBe("partySize");
    expect(result[0].type).toBe("number");
    expect(result[0].min).toBe(1);
    expect(result[0].max).toBe(20);
  });

  it("normalizes object fields with enumValues", () => {
    const result = normalizeEndpointFields([{
      name: "status",
      type: "string",
      required: true,
      enumValues: ["pending", "confirmed", "cancelled"],
    }]);
    expect(result[0].enumValues).toEqual(["pending", "confirmed", "cancelled"]);
  });

  it("sets isTenantKey and isBoundaryField flags", () => {
    const result = normalizeEndpointFields([{
      name: "restaurantId",
      type: "number",
      required: true,
      isTenantKey: true,
      isBoundaryField: false,
    }]);
    expect(result[0].isTenantKey).toBe(true);
  });

  it("uses field/key as fallback for name", () => {
    const result = normalizeEndpointFields([{ field: "userId", type: "number", required: true }]);
    expect(result[0].name).toBe("userId");
  });

  it("defaults required to true when not specified", () => {
    const result = normalizeEndpointFields([{ name: "optionalField", type: "string" }]);
    expect(result[0].required).toBe(true);
  });

  it("handles empty array", () => {
    expect(normalizeEndpointFields([])).toHaveLength(0);
  });
});

// ─── normalizeStringFields ────────────────────────────────────────────────────

describe("normalizeStringFields", () => {
  it("passes through string values unchanged", () => {
    const result = normalizeStringFields(["id", "name", "email"]);
    expect(result).toEqual(["id", "name", "email"]);
  });

  it("extracts name from object fields", () => {
    const result = normalizeStringFields([{ name: "userId" }, { field: "restaurantId" }]);
    expect(result).toEqual(["userId", "restaurantId"]);
  });

  it("handles mixed string and object fields", () => {
    const result = normalizeStringFields(["id", { name: "email" }, "status"]);
    expect(result).toEqual(["id", "email", "status"]);
  });

  it("handles empty array", () => {
    expect(normalizeStringFields([])).toHaveLength(0);
  });
});

// ─── groupSectionsForExtraction ───────────────────────────────────────────────

describe("groupSectionsForExtraction", () => {
  const makeSection = (title: string, topic: SpecSection["topic"], charCount: number): SpecSection => ({
    title,
    level: 2,
    startLine: 0,
    endLine: 10,
    text: "x".repeat(charCount),
    charCount,
    topic,
  });

  const emptyMap: StructuralMap = {
    endpoints: [],
    statusMachine: null,
    tenantModel: null,
    authModel: null,
    enums: {},
    piiTables: [],
    chapters: [],
  };

  it("groups sections by topic", () => {
    const sections: SpecSection[] = [
      makeSection("API Router 1", "endpoints", 5000),
      makeSection("Status Machine", "status", 3000),
      makeSection("API Router 2", "endpoints", 4000),
    ];
    const groups = groupSectionsForExtraction(sections, emptyMap);
    const endpointGroups = groups.filter(g => g.topics[0] === "endpoints");
    expect(endpointGroups.length).toBeGreaterThanOrEqual(1);
    // Both endpoint sections should be in the same group (total 9000 < 20000)
    const totalEndpointChars = endpointGroups.reduce((sum, g) => sum + g.charCount, 0);
    expect(totalEndpointChars).toBe(9000);
  });

  it("splits large topic groups into multiple chunks", () => {
    const sections: SpecSection[] = [
      makeSection("Endpoints Part 1", "endpoints", 15000),
      makeSection("Endpoints Part 2", "endpoints", 15000), // total 30000 > 20000 limit
    ];
    const groups = groupSectionsForExtraction(sections, emptyMap);
    const endpointGroups = groups.filter(g => g.topics[0] === "endpoints");
    expect(endpointGroups.length).toBe(2); // split into 2 groups
  });

  it("returns empty array for empty sections", () => {
    const groups = groupSectionsForExtraction([], emptyMap);
    expect(groups).toHaveLength(0);
  });

  it("follows the topic order (endpoints first, then status, auth, etc.)", () => {
    const sections: SpecSection[] = [
      makeSection("Auth", "auth", 5000),
      makeSection("Status", "status", 5000),
      makeSection("API", "endpoints", 5000),
    ];
    const groups = groupSectionsForExtraction(sections, emptyMap);
    expect(groups[0].topics[0]).toBe("endpoints");
    expect(groups[1].topics[0]).toBe("status");
    expect(groups[2].topics[0]).toBe("auth");
  });

  it("sets group title from section titles", () => {
    const sections: SpecSection[] = [
      makeSection("Chapter 3: Router", "endpoints", 5000),
      makeSection("Chapter 4: Procedures", "endpoints", 4000),
    ];
    const groups = groupSectionsForExtraction(sections, emptyMap);
    const endpointGroup = groups.find(g => g.topics[0] === "endpoints");
    expect(endpointGroup?.title).toContain("Chapter 3: Router");
  });
});
