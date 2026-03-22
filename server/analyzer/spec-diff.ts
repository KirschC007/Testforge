/**
 * TestForge Spec-Diff Engine v1.0 (S4-1)
 *
 * Compares two AnalysisIR objects and produces a structured diff:
 * - Added behaviors (new in v2, not in v1)
 * - Removed behaviors (in v1, not in v2)
 * - Changed behaviors (same ID, different content)
 * - Added/removed endpoints
 * - Status machine changes
 *
 * Used to show users exactly what changed between two spec versions,
 * so they know which tests to update.
 */

import type { AnalysisIR, Behavior, APIEndpoint } from "./types";

export interface BehaviorDiff {
  type: "added" | "removed" | "changed";
  id: string;
  title: string;
  // For "changed": what fields changed
  changes?: Array<{
    field: string;
    before: string;
    after: string;
  }>;
  // Original behavior for context
  behavior?: Behavior;
  riskHints?: string[];
  tags?: string[];
}

export interface EndpointDiff {
  type: "added" | "removed" | "changed";
  name: string;
  changes?: Array<{ field: string; before: string; after: string }>;
}

export interface SpecDiffResult {
  behaviorDiffs: BehaviorDiff[];
  endpointDiffs: EndpointDiff[];
  statusMachineDiff: {
    addedStates: string[];
    removedStates: string[];
    addedTransitions: [string, string][];
    removedTransitions: [string, string][];
  } | null;
  summary: {
    addedBehaviors: number;
    removedBehaviors: number;
    changedBehaviors: number;
    addedEndpoints: number;
    removedEndpoints: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    affectedProofTypes: string[];
  };
}

// Compute a simple content hash for a behavior (for change detection)
function behaviorHash(b: Behavior): string {
  return JSON.stringify({
    subject: b.subject,
    action: b.action,
    object: b.object,
    preconditions: b.preconditions?.sort(),
    postconditions: b.postconditions?.sort(),
    errorCases: b.errorCases?.sort(),
    tags: b.tags?.sort(),
  });
}

// Normalize behavior ID for matching (strip version suffixes)
function normalizeId(id: string): string {
  return id.replace(/-v\d+$/, "").replace(/_v\d+$/, "").toLowerCase();
}

// Find the best matching behavior by ID or title similarity
function findMatch(b: Behavior, candidates: Behavior[]): Behavior | undefined {
  // Exact ID match
  const exact = candidates.find(c => c.id === b.id);
  if (exact) return exact;
  // Normalized ID match
  const normId = normalizeId(b.id);
  const normMatch = candidates.find(c => normalizeId(c.id) === normId);
  if (normMatch) return normMatch;
  // Title similarity (simple word overlap)
  const titleWords = b.title.toLowerCase().split(/\s+/);
  let bestScore = 0;
  let bestMatch: Behavior | undefined;
  for (const c of candidates) {
    const cWords = c.title.toLowerCase().split(/\s+/);
    const overlap = titleWords.filter(w => cWords.includes(w)).length;
    const score = overlap / Math.max(titleWords.length, cWords.length);
    if (score > 0.7 && score > bestScore) {
      bestScore = score;
      bestMatch = c;
    }
  }
  return bestMatch;
}

export function diffAnalysisIR(v1: AnalysisIR, v2: AnalysisIR): SpecDiffResult {
  const behaviorDiffs: BehaviorDiff[] = [];
  const endpointDiffs: EndpointDiff[] = [];

  // ── Behavior Diff ────────────────────────────────────────────────────────
  const v1Behaviors = v1.behaviors || [];
  const v2Behaviors = v2.behaviors || [];
  const matchedV2Ids = new Set<string>();

  for (const b1 of v1Behaviors) {
    const b2 = findMatch(b1, v2Behaviors);
    if (!b2) {
      // Removed
      behaviorDiffs.push({
        type: "removed",
        id: b1.id,
        title: b1.title,
        behavior: b1,
        riskHints: b1.riskHints,
        tags: b1.tags,
      });
    } else {
      matchedV2Ids.add(b2.id);
      // Check if changed
      const h1 = behaviorHash(b1);
      const h2 = behaviorHash(b2);
      if (h1 !== h2) {
        const changes: BehaviorDiff["changes"] = [];
        const fields: (keyof Behavior)[] = ["subject", "action", "object"];
        for (const f of fields) {
          const val1 = String(b1[f] || "");
          const val2 = String(b2[f] || "");
          if (val1 !== val2) {
            changes.push({ field: f, before: val1, after: val2 });
          }
        }
        // Check preconditions/postconditions/errorCases as sets
        const checkSet = (field: string, a: string[] | undefined, b: string[] | undefined) => {
          const setA = new Set(a || []);
          const setB = new Set(b || []);
          const added = Array.from(setB).filter(x => !setA.has(x));
          const removed = Array.from(setA).filter(x => !setB.has(x));
          if (added.length > 0) changes.push({ field: `${field}+`, before: "", after: added.join("; ") });
          if (removed.length > 0) changes.push({ field: `${field}-`, before: removed.join("; "), after: "" });
        };
        checkSet("preconditions", b1.preconditions, b2.preconditions);
        checkSet("postconditions", b1.postconditions, b2.postconditions);
        checkSet("errorCases", b1.errorCases, b2.errorCases);
        if (changes.length > 0) {
          behaviorDiffs.push({
            type: "changed",
            id: b2.id,
            title: b2.title,
            changes,
            behavior: b2,
            riskHints: b2.riskHints,
            tags: b2.tags,
          });
        }
      }
    }
  }

  // Added behaviors (in v2 but not matched)
  for (const b2 of v2Behaviors) {
    if (!matchedV2Ids.has(b2.id)) {
      // Check if it was matched from v1 side
      const wasMatched = v1Behaviors.some(b1 => {
        const match = findMatch(b1, v2Behaviors);
        return match?.id === b2.id;
      });
      if (!wasMatched) {
        behaviorDiffs.push({
          type: "added",
          id: b2.id,
          title: b2.title,
          behavior: b2,
          riskHints: b2.riskHints,
          tags: b2.tags,
        });
      }
    }
  }

  // ── Endpoint Diff ────────────────────────────────────────────────────────
  const v1Endpoints = v1.apiEndpoints || [];
  const v2Endpoints = v2.apiEndpoints || [];
  const v1EpNames = new Set(v1Endpoints.map(e => e.name));
  const v2EpNames = new Set(v2Endpoints.map(e => e.name));

  for (const ep of v1Endpoints) {
    if (!v2EpNames.has(ep.name)) {
      endpointDiffs.push({ type: "removed", name: ep.name });
    } else {
      const ep2 = v2Endpoints.find(e => e.name === ep.name)!;
      const changes: EndpointDiff["changes"] = [];
      if (ep.auth !== ep2.auth) {
        changes.push({ field: "auth", before: ep.auth || "", after: ep2.auth || "" });
      }
      const fields1 = new Set((ep.inputFields || []).map(f => f.name));
      const fields2 = new Set((ep2.inputFields || []).map(f => f.name));
      const addedFields = Array.from(fields2).filter(f => !fields1.has(f));
      const removedFields = Array.from(fields1).filter(f => !fields2.has(f));
      if (addedFields.length > 0) changes.push({ field: "inputFields+", before: "", after: addedFields.join(", ") });
      if (removedFields.length > 0) changes.push({ field: "inputFields-", before: removedFields.join(", "), after: "" });
      if (changes.length > 0) {
        endpointDiffs.push({ type: "changed", name: ep.name, changes });
      }
    }
  }
  for (const ep of v2Endpoints) {
    if (!v1EpNames.has(ep.name)) {
      endpointDiffs.push({ type: "added", name: ep.name });
    }
  }

  // ── Status Machine Diff ──────────────────────────────────────────────────
  let statusMachineDiff: SpecDiffResult["statusMachineDiff"] = null;
  if (v1.statusMachine || v2.statusMachine) {
    const sm1 = v1.statusMachine;
    const sm2 = v2.statusMachine;
    const states1 = new Set(sm1?.states || []);
    const states2 = new Set(sm2?.states || []);
    const trans1 = new Set((sm1?.transitions || []).map(t => `${t[0]}→${t[1]}`));
    const trans2 = new Set((sm2?.transitions || []).map(t => `${t[0]}→${t[1]}`));
    statusMachineDiff = {
      addedStates: Array.from(states2).filter(s => !states1.has(s)),
      removedStates: Array.from(states1).filter(s => !states2.has(s)),
      addedTransitions: (sm2?.transitions || []).filter(t => !trans1.has(`${t[0]}→${t[1]}`)),
      removedTransitions: (sm1?.transitions || []).filter(t => !trans2.has(`${t[0]}→${t[1]}`)),
    };
    if (
      statusMachineDiff.addedStates.length === 0 &&
      statusMachineDiff.removedStates.length === 0 &&
      statusMachineDiff.addedTransitions.length === 0 &&
      statusMachineDiff.removedTransitions.length === 0
    ) {
      statusMachineDiff = null;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const added = behaviorDiffs.filter(d => d.type === "added").length;
  const removed = behaviorDiffs.filter(d => d.type === "removed").length;
  const changed = behaviorDiffs.filter(d => d.type === "changed").length;
  const addedEp = endpointDiffs.filter(d => d.type === "added").length;
  const removedEp = endpointDiffs.filter(d => d.type === "removed").length;

  // Determine risk level
  const hasSecurityChanges = behaviorDiffs.some(d =>
    d.riskHints?.some(h => ["idor", "csrf", "sqli", "xss", "auth"].some(k => h.includes(k)))
  );
  const hasRemovedBehaviors = removed > 0 || removedEp > 0;
  const totalChanges = added + removed + changed + addedEp + removedEp;

  let riskLevel: SpecDiffResult["summary"]["riskLevel"] = "low";
  if (hasSecurityChanges || removedEp > 0) riskLevel = "critical";
  else if (hasRemovedBehaviors || changed > 5) riskLevel = "high";
  else if (totalChanges > 3) riskLevel = "medium";

  // Affected proof types
  const affectedProofTypes = new Set<string>();
  for (const d of behaviorDiffs) {
    for (const tag of d.tags || []) {
      affectedProofTypes.add(tag);
    }
    for (const hint of d.riskHints || []) {
      affectedProofTypes.add(hint);
    }
  }

  return {
    behaviorDiffs,
    endpointDiffs,
    statusMachineDiff,
    summary: {
      addedBehaviors: added,
      removedBehaviors: removed,
      changedBehaviors: changed,
      addedEndpoints: addedEp,
      removedEndpoints: removedEp,
      riskLevel,
      affectedProofTypes: Array.from(affectedProofTypes).slice(0, 10),
    },
  };
}
