import type { EvidenceLevel, EvidenceSignal, SupportedScopeAssessment } from "./types";

type CodeFileLike = {
  path: string;
  content: string;
};

function hasDependency(pkg: CodeFileLike | undefined, names: string[]): boolean {
  if (!pkg) return false;
  try {
    const parsed = JSON.parse(pkg.content);
    const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
    return names.some(name => Boolean(deps[name]));
  } catch {
    return false;
  }
}

function listSourceFiles(files: CodeFileLike[]): CodeFileLike[] {
  return files.filter(file => /\.(ts|tsx|js|jsx|mjs|cjs|prisma)$/.test(file.path));
}

function buildGoldReadiness(signals: EvidenceSignal[]) {
  const matchedGoldSignals = signals.filter(signal => signal.matched).map(signal => signal.label);
  const missingGoldSignals = signals.filter(signal => !signal.matched).map(signal => signal.label);
  const goldReadinessScore = Math.round((matchedGoldSignals.length / signals.length) * 100);
  return { matchedGoldSignals, missingGoldSignals, goldReadinessScore };
}

function deriveEvidenceLevel(signals: EvidenceSignal[]): EvidenceLevel {
  if (signals.some(signal => signal.matched && signal.level === "heuristic")) return "heuristic";
  if (signals.some(signal => signal.matched && signal.level === "inferred")) return "inferred";
  return "detected";
}

function inferPrimaryStack(parts: string[]): string {
  return parts.length > 0 ? parts.join(" + ") : "unknown";
}

function hasSourceSignal(files: CodeFileLike[], pattern: RegExp): boolean {
  return files.some((file) => pattern.test(file.content));
}

export function assessSupportedScopeForCodebase(
  files: CodeFileLike[],
  mode: "code" | "hybrid" = "code"
): SupportedScopeAssessment {
  const pkg = files.find(file => file.path.endsWith("package.json"));
  const sources = listSourceFiles(files);
  const tsSources = files.filter(file => /\.(ts|tsx)$/.test(file.path));
  const jsSources = files.filter(file => /\.(js|jsx|mjs|cjs)$/.test(file.path));

  const hasTrpcDependency = hasDependency(pkg, ["@trpc/server"]);
  const hasExpressDependency = hasDependency(pkg, ["express"]);
  const hasNextDependency = hasDependency(pkg, ["next"]);
  const hasZodDependency = hasDependency(pkg, ["zod"]);
  const hasDrizzleDependency = hasDependency(pkg, ["drizzle-orm"]);
  const hasPrisma = hasDependency(pkg, ["@prisma/client", "prisma"]);
  const hasFastifyDependency = hasDependency(pkg, ["fastify"]);
  const hasTrpcSource = hasSourceSignal(sources, /\b(createTRPCRouter|initTRPC|publicProcedure|protectedProcedure|router)\b/);
  const hasExpressSource = hasSourceSignal(sources, /\bexpress\s*\(|\bRouter\s*\(|app\.(get|post|put|patch|delete)\b/);
  const hasNextSource = hasSourceSignal(sources, /\bexport\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b|next\/server|Response\.json\b/);
  const hasZodSource = hasSourceSignal(sources, /\bz\.(object|string|number|enum|array|boolean|coerce)\b/);
  const hasDrizzleSource = hasSourceSignal(sources, /\bdrizzle-orm\b|\b(pgTable|mysqlTable|sqliteTable|createInsertSchema)\b/);
  const hasFastifySource = hasSourceSignal(sources, /\bfastify\s*\(|FastifyInstance\b/);
  const hasTrpcExpressAdapter = hasSourceSignal(sources, /@trpc\/server\/adapters\/express|createExpressMiddleware/);

  const hasTrpc = hasTrpcDependency || hasTrpcSource;
  const hasExpress = hasExpressDependency || hasExpressSource;
  const hasNext = hasNextDependency || hasNextSource;
  const hasZod = hasZodDependency || hasZodSource;
  const hasDrizzle = hasDrizzleDependency || hasDrizzleSource;
  const hasFastify = hasFastifyDependency || hasFastifySource;
  const countsAsStandaloneExpress = hasExpress && !(hasTrpc && hasTrpcExpressAdapter);
  const frameworkCount = [hasTrpc, countsAsStandaloneExpress, hasNext, hasFastify].filter(Boolean).length;

  const strengths: string[] = [];
  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (!pkg) blockers.push("`package.json` fehlt; Stack-Erkennung ist nur heuristisch möglich.");
  if (sources.length === 0) blockers.push("Keine relevanten Quellcodedateien erkannt.");
  if (tsSources.length > 0) strengths.push(`TypeScript-Dateien erkannt (${tsSources.length})`);
  if (jsSources.length > 0) strengths.push(`JavaScript-Dateien erkannt (${jsSources.length})`);
  if (hasTrpc) strengths.push(hasTrpcDependency ? "tRPC erkannt" : "tRPC-Signale im Source erkannt");
  if (hasExpress) strengths.push(hasTrpc && hasTrpcExpressAdapter ? "Express als tRPC-Transport erkannt" : hasExpressDependency ? "Express erkannt" : "Express-Signale im Source erkannt");
  if (hasNext) strengths.push(hasNextDependency ? "Next.js erkannt" : "Next.js Route-Handler-Signale erkannt");
  if (hasFastify) strengths.push(hasFastifyDependency ? "Fastify erkannt" : "Fastify-Signale im Source erkannt");
  if (hasZod) strengths.push(hasZodDependency ? "Zod-Schemas erkannt" : "Zod-Signale im Source erkannt");
  if (hasDrizzle) strengths.push(hasDrizzleDependency ? "Drizzle-Schema erkannt" : "Drizzle-Signale im Source erkannt");
  if (hasPrisma) strengths.push("Prisma-Schema erkannt");

  const evidenceSignals: EvidenceSignal[] = [
    { label: "TypeScript source files", matched: tsSources.length > 0, level: "detected", source: "file extension scan" },
    { label: "Single router stack", matched: frameworkCount === 1, level: "inferred", source: "package dependency mix" },
    { label: "tRPC router", matched: hasTrpc, level: hasTrpcDependency ? "detected" : "inferred", source: hasTrpcDependency ? "package.json dependency" : "source fingerprint" },
    { label: "Zod contracts", matched: hasZod, level: hasZodDependency ? "detected" : "inferred", source: hasZodDependency ? "package.json dependency" : "source fingerprint" },
    { label: "Drizzle schema", matched: hasDrizzle, level: hasDrizzleDependency ? "detected" : "inferred", source: hasDrizzleDependency ? "package.json dependency" : "source fingerprint" },
    { label: "No mixed backend frameworks", matched: frameworkCount <= 1, level: "inferred", source: hasTrpc && hasTrpcExpressAdapter ? "framework signal set with transport adapter normalization" : "framework signal set" },
  ];
  if (!pkg) {
    evidenceSignals.push({
      label: "Fallback codebase fingerprint",
      matched: sources.length > 0,
      level: "heuristic",
      source: "source file presence without package manifest",
    });
  }

  const goldSignals = buildGoldReadiness(evidenceSignals);
  const primaryStackParts = [
    hasTrpc ? "tRPC" : null,
    countsAsStandaloneExpress ? "Express" : null,
    hasNext ? "Next.js" : null,
    hasFastify ? "Fastify" : null,
    hasZod ? "Zod" : null,
    hasDrizzle ? "Drizzle" : null,
    hasPrisma ? "Prisma" : null,
    tsSources.length > 0 ? "TypeScript" : jsSources.length > 0 ? "JavaScript" : null,
  ].filter(Boolean) as string[];
  const evidenceLevel = deriveEvidenceLevel(evidenceSignals);
  const primaryStack = inferPrimaryStack(primaryStackParts);

  const isGold = Boolean((pkg || sources.length > 0) && hasTrpc && hasZod && hasDrizzle && tsSources.length > 0 && frameworkCount === 1 && !countsAsStandaloneExpress && !hasNext && !hasFastify && !hasPrisma);
  if (isGold) {
    return {
      verdict: "supported",
      tier: "gold",
      evidenceLevel,
      confidenceScore: 95,
      goldReadinessScore: goldSignals.goldReadinessScore,
      mode,
      primaryStack,
      summary: "Gold Standard erreicht: TypeScript + tRPC + Zod + Drizzle.",
      strengths,
      blockers: [],
      recommendations: [],
      matchedGoldSignals: goldSignals.matchedGoldSignals,
      missingGoldSignals: [],
      evidenceSignals,
    };
  }

  const isBroadlySupported = sources.length > 0 && (hasTrpc || hasExpress || hasNext || hasFastify || tsSources.length > 0 || jsSources.length > 0);
  if (isBroadlySupported) {
    if (!hasZod) blockers.push("Keine oder zu wenige explizite Zod-Schemas erkannt; Boundary- und Contract-Checks werden schwächer.");
    if (!hasDrizzle && !hasPrisma) blockers.push("Kein deterministisches ORM-Schema erkannt; Datenmodell- und PII-Analyse ist weniger belastbar.");
    if (frameworkCount === 0) blockers.push("Kein klares Router-Framework erkannt; Analyse läuft im generischen Fallback-Modus.");
    if (frameworkCount > 1) blockers.push("Mehrere Backend-Frameworks erkannt; Routing-Extraktion läuft mit reduzierter Sicherheit.");
    if (jsSources.length > 0 && tsSources.length === 0) blockers.push("Nur JavaScript erkannt; Typ- und Schemaableitung ist schwächer als im TypeScript-Pfad.");

    recommendations.push("Für Gold Standard auf TypeScript + tRPC + Zod + Drizzle vereinheitlichen.");
    recommendations.push("Ein einzelnes Router-Framework und ein deterministisches Schema-System beibehalten.");

    return {
      verdict: "partial",
      tier: "supported",
      evidenceLevel,
      confidenceScore: hasZod && (hasDrizzle || hasPrisma) ? 72 : hasZod && frameworkCount <= 1 && tsSources.length > 0 ? 64 : 58,
      goldReadinessScore: goldSignals.goldReadinessScore,
      mode,
      primaryStack,
      summary: "Analyse läuft, aber nicht im Gold-Standard-Pfad.",
      strengths,
      blockers,
      recommendations,
      matchedGoldSignals: goldSignals.matchedGoldSignals,
      missingGoldSignals: goldSignals.missingGoldSignals,
      evidenceSignals,
    };
  }

  recommendations.push("Mindestens Quellcodedateien plus ein identifizierbares Backend- oder Typingsignal bereitstellen.");

  return {
    verdict: "unsupported",
    tier: "experimental",
    evidenceLevel,
    confidenceScore: 25,
    goldReadinessScore: goldSignals.goldReadinessScore,
    mode,
    primaryStack,
    summary: "Nur experimenteller Fallback möglich; Ergebnisse wären schwach und nicht verkaufbar.",
    strengths,
    blockers,
    recommendations,
    matchedGoldSignals: goldSignals.matchedGoldSignals,
    missingGoldSignals: goldSignals.missingGoldSignals,
    evidenceSignals,
  };
}

export function assessSupportedScopeForSpec(
  specText: string,
  mode: "openapi" | "spec"
): SupportedScopeAssessment {
  const evidenceSignals: EvidenceSignal[] = [
    { label: "Structured API contract", matched: specText.trim().length > 0, level: "detected", source: "uploaded spec content" },
    { label: "OpenAPI/Swagger format", matched: mode === "openapi", level: mode === "openapi" ? "detected" : "heuristic", source: mode === "openapi" ? "OpenAPI parser" : "free-text spec path" },
    { label: "Deterministic field extraction", matched: mode === "openapi", level: mode === "openapi" ? "detected" : "heuristic", source: mode === "openapi" ? "schema-driven parser" : "LLM/spec heuristics" },
  ];
  const goldSignals = buildGoldReadiness(evidenceSignals);
  const evidenceLevel: EvidenceLevel = mode === "openapi" ? "detected" : "heuristic";
  const primaryStack = mode === "openapi" ? "OpenAPI" : "Free-text spec";

  if (mode === "openapi") {
    return {
      verdict: "supported",
      tier: "gold",
      evidenceLevel,
      confidenceScore: 97,
      goldReadinessScore: goldSignals.goldReadinessScore,
      mode,
      primaryStack,
      summary: "Gold Standard erreicht: deterministische OpenAPI-Spezifikation.",
      strengths: ["OpenAPI-Dokument erkannt"],
      blockers: [],
      recommendations: [],
      matchedGoldSignals: goldSignals.matchedGoldSignals,
      missingGoldSignals: [],
      evidenceSignals,
    };
  }

  const blockers = ["Freitext-Spezifikation erkannt; Feld- und Contract-Extraktion ist heuristischer als bei OpenAPI."];
  const recommendations = specText.length > 0
    ? ["Für Gold Standard die Spezifikation als OpenAPI/Swagger bereitstellen."]
    : ["Eine Spezifikation bereitstellen, idealerweise OpenAPI/Swagger."];

  return {
    verdict: "partial",
    tier: "supported",
    evidenceLevel,
    confidenceScore: 60,
    goldReadinessScore: goldSignals.goldReadinessScore,
    mode,
    primaryStack,
    summary: "Analyse läuft im heuristischen Spec-Modus, nicht im Gold-Standard-Pfad.",
    strengths: [],
    blockers,
    recommendations,
    matchedGoldSignals: goldSignals.matchedGoldSignals,
    missingGoldSignals: goldSignals.missingGoldSignals,
    evidenceSignals,
  };
}
