/**
 * TestForge Auto Industry Pack Detector
 *
 * Analyzes an AnalysisResult and automatically selects the best-matching
 * industry proof pack based on keyword frequency in behaviors, tags, and endpoints.
 *
 * Replaces the manual pack selection that required users to know the pack names.
 * If a pack is manually specified, auto-detection is skipped.
 */

import type { AnalysisResult } from "./types";
import type { IndustryPack } from "./industry-proof-packs";

interface PackSignal {
  pack: IndustryPack;
  keywords: string[];
  tags: string[];
  /** Minimum score (0–100) required to trigger auto-selection */
  threshold: number;
  /** Human-readable reason for selection */
  reason: string;
}

const PACK_SIGNALS: PackSignal[] = [
  {
    pack: "fintech",
    threshold: 30,
    reason: "Detected financial domain: payment, transfer, balance, or KYC/AML signals",
    keywords: [
      "payment", "transfer", "balance", "transaction", "account", "iban",
      "sepa", "swift", "kyc", "aml", "anti-money laundering", "psd2",
      "bank", "banking", "wire", "debit", "credit", "settlement",
      "clearing", "bic", "ledger", "float", "overdraft", "fintech",
    ],
    tags: ["payment", "transfer", "account", "balance", "kyc", "aml", "psd2", "banking", "financial"],
  },
  {
    pack: "healthtech",
    threshold: 25,
    reason: "Detected healthcare domain: patient records, PHI, HIPAA, or clinical signals",
    keywords: [
      "patient", "health", "medical", "fhir", "hl7", "phi", "prescription",
      "diagnosis", "treatment", "clinic", "hospital", "doctor", "physician",
      "healthcare", "hipaa", "clinical", "vitals", "appointment", "medication",
      "ehr", "emr", "icd", "cpt", "lab result", "radiology",
    ],
    tags: ["patient", "health", "medical", "fhir", "phi", "hipaa", "clinical", "ehr"],
  },
  {
    pack: "ecommerce",
    threshold: 30,
    reason: "Detected e-commerce domain: orders, cart, inventory, or payment signals",
    keywords: [
      "order", "cart", "checkout", "product", "inventory", "stock",
      "shipping", "fulfillment", "sku", "catalog", "price", "discount",
      "coupon", "refund", "return", "pci", "stripe", "paypal",
      "ecommerce", "e-commerce", "shop", "store", "merchant", "seller",
    ],
    tags: ["order", "cart", "product", "inventory", "shipping", "ecommerce", "pci"],
  },
  {
    pack: "saas",
    threshold: 25,
    reason: "Detected SaaS domain: multi-tenancy, subscriptions, feature gates, or usage metering",
    keywords: [
      "tenant", "subscription", "plan", "billing", "feature gate", "feature flag",
      "tier", "workspace", "organization", "multi-tenant", "saas",
      "usage", "metering", "quota", "seat", "license", "upgrade",
      "downgrade", "trial", "freemium", "enterprise", "professional",
    ],
    tags: ["tenant", "subscription", "billing", "feature-gate", "saas", "multi-tenant", "workspace"],
  },
];

/**
 * Scores a pack against the analysis content.
 * Returns a 0–100 score based on keyword frequency in behaviors, endpoints, and tags.
 */
function scorePackMatch(analysis: AnalysisResult, signal: PackSignal): number {
  const ir = analysis.ir;
  let score = 0;

  // Build a combined text corpus from all behaviors
  const corpus = [
    ...ir.behaviors.flatMap(b => [
      b.title, b.subject, b.action, b.object,
      ...b.preconditions, ...b.postconditions, ...b.errorCases,
      ...b.tags, ...b.riskHints,
    ]),
    ...ir.apiEndpoints.map(e => e.name),
    ...ir.resources.map(r => r.name),
    ...Object.keys(ir.enums || {}),
    ir.tenantModel?.tenantEntity || "",
  ].join(" ").toLowerCase();

  // Keyword scoring: +3 per occurrence (capped per keyword to avoid inflation)
  for (const kw of signal.keywords) {
    const count = (corpus.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    score += Math.min(count * 3, 12); // cap at 12 per keyword
  }

  // Tag scoring: +5 per matching tag in behavior tags
  const allTags = ir.behaviors.flatMap(b => b.tags || []);
  for (const tag of signal.tags) {
    if (allTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
      score += 5;
    }
  }

  // Clamp to 0–100
  return Math.min(100, score);
}

export interface AutoDetectResult {
  pack: IndustryPack | null;
  score: number;
  reason: string;
  allScores: Record<IndustryPack, number>;
}

/**
 * Automatically detects the best industry pack for an analysis.
 * Returns null if no pack scores above its threshold.
 *
 * @param analysis - The analysis result from the LLM/code parser
 * @returns The detected pack (or null) with score and reasoning
 */
export function autoDetectIndustryPack(analysis: AnalysisResult): AutoDetectResult {
  const scores: Record<IndustryPack, number> = {
    fintech: 0, healthtech: 0, ecommerce: 0, saas: 0,
  };

  let bestPack: IndustryPack | null = null;
  let bestScore = 0;
  let bestReason = "No industry pack matched (score below threshold)";

  for (const signal of PACK_SIGNALS) {
    const score = scorePackMatch(analysis, signal);
    scores[signal.pack] = score;

    if (score >= signal.threshold && score > bestScore) {
      bestScore = score;
      bestPack = signal.pack;
      bestReason = `${signal.reason} (score: ${score}/100)`;
    }
  }

  return { pack: bestPack, score: bestScore, reason: bestReason, allScores: scores };
}
