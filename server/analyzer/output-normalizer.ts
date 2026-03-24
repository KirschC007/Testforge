/**
 * output-normalizer.ts
 *
 * Ebene 5: Post-processing pass over all generated test file content.
 * Removes residual framework prefixes (trpc., api., v1., etc.) and
 * fixes s.getById → getById patterns that slip through the IR normalization.
 *
 * This is a belt-and-suspenders layer — the IR normalization (Ebenen 1-4)
 * should handle most cases. This layer catches anything that was hardcoded
 * as a string literal in templates or came from LLM output.
 *
 * IMPORTANT: Use replacement functions (not string literals) to avoid
 * JavaScript's special $1/$2 replacement syntax causing incorrect output.
 */

const FRAMEWORK_PREFIXES_PATTERN = /^(trpc|api|v[1-9]|rest|graphql|rpc|grpc)$/i;

/**
 * Normalize a single generated test file's content.
 * Returns the normalized content string.
 */
export function normalizeOutputContent(content: string): string {
  let result = content;

  // 1. Strip framework prefixes inside string literals: "trpc.resource.action" → "resource.action"
  //    Also handles "api.resource.action", "v1.resource.action" etc.
  //    Pattern: opening quote + framework_prefix + dot + resource.action + closing quote
  result = result.replace(
    /"([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)"/g,
    (_match, prefix, rest) => {
      if (FRAMEWORK_PREFIXES_PATTERN.test(prefix)) {
        return `"${rest}"`;
      }
      return `"${prefix}.${rest}"`;
    }
  );

  // 2. Fix .s.ACTION patterns (spurious "s." prefix from split(".").pop() artifacts)
  //    e.g. "applications.s.getById" → "applications.getById"
  result = result.replace(/\.s\.([a-zA-Z][a-zA-Z0-9]*)/g, (_match, action) => `.${action}`);

  // 3. Fix double-dot artifacts: "resource..action" → "resource.action"
  result = result.replace(/([a-zA-Z][a-zA-Z0-9]*)\.\.([a-zA-Z][a-zA-Z0-9]*)/g, (_match, resource, action) => `${resource}.${action}`);

  return result;
}

/**
 * Normalize all test files in the output.
 * Returns new array with normalized content (does not mutate originals).
 */
export function normalizeOutputFiles<T extends { content: string }>(files: T[]): T[] {
  return files.map(f => ({
    ...f,
    content: normalizeOutputContent(f.content),
  }));
}

/**
 * Normalize all configs (vitest.config.ts, etc.) in the output.
 */
export function normalizeOutputConfigs(configs: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(configs)) {
    result[key] = normalizeOutputContent(value);
  }
  return result;
}
