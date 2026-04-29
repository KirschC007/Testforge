/**
 * TestForge HAR Parser — Traffic-Based Test Generation
 *
 * Converts real HTTP traffic (HAR files captured from browser DevTools or proxy tools)
 * into Playwright test suites. This is the "record first, generate tests second" workflow.
 *
 * Supported capture methods:
 *   - Chrome DevTools → Network → Export HAR
 *   - Firefox DevTools → Network → Export HAR
 *   - Proxyman, Charles Proxy, mitmproxy → Export HAR
 *   - Playwright: `page.routeFromHAR()` with { update: true }
 *
 * Usage:
 *   const suite = parseHAR(harJson);
 *   // suite.tests contains Playwright test files ready to use
 *   // suite.endpoints contains the discovered API surface
 */

export interface HAREntry {
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    postData?: { mimeType: string; text: string };
    queryString?: Array<{ name: string; value: string }>;
  };
  response: {
    status: number;
    headers: Array<{ name: string; value: string }>;
    content: { mimeType: string; text?: string };
  };
  time: number;
}

export interface HAR {
  log: {
    version: string;
    entries: HAREntry[];
  };
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  baseUrl: string;
  isTrpc: boolean;
  procedureName?: string;    // For tRPC: "guests.create"
  requestBody?: unknown;
  responseBody?: unknown;
  responseStatus: number;
  headers: Record<string, string>;
  avgResponseMs: number;
  samples: number;
  hasCookie: boolean;
  hasAuthHeader: boolean;
}

export interface HARSuite {
  endpoints: ParsedEndpoint[];
  testFiles: Array<{ filename: string; content: string }>;
  summary: {
    totalRequests: number;
    uniqueEndpoints: number;
    authEndpoints: number;
    publicEndpoints: number;
    averageResponseMs: number;
  };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseUrl(raw: string): { baseUrl: string; path: string; query: Record<string, string> } {
  try {
    const u = new URL(raw);
    const query: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { query[k] = v; });
    return { baseUrl: `${u.protocol}//${u.host}`, path: u.pathname, query };
  } catch {
    return { baseUrl: "", path: raw, query: {} };
  }
}

function extractTrpcProcedure(path: string, query: Record<string, string>): string | undefined {
  // Pattern: /api/trpc/procedure.name or /api/trpc/procedure.name?batch=1
  const trpcMatch = path.match(/\/api\/trpc\/([^?&/]+)/);
  if (trpcMatch) return trpcMatch[1];
  // Batch format: ?input={"0":...} → procedure from path
  if (query.input) return undefined; // handled above
  return undefined;
}

function parseBody(entry: HAREntry): unknown {
  const text = entry.request.postData?.text;
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    // tRPC wraps in { json: {...} }
    if (parsed && typeof parsed === "object" && "json" in parsed) return (parsed as Record<string, unknown>).json;
    return parsed;
  } catch {
    return text;
  }
}

function parseResponseBody(entry: HAREntry): unknown {
  const text = entry.response.content.text;
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    // tRPC wraps in { result: { data: { json: {...} } } }
    if (parsed?.result?.data?.json !== undefined) return parsed.result.data.json;
    if (parsed?.result?.data !== undefined) return parsed.result.data;
    return parsed;
  } catch {
    return text;
  }
}

function headersToRecord(headers: Array<{ name: string; value: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) result[h.name.toLowerCase()] = h.value;
  return result;
}

function inferFieldType(value: unknown): string {
  if (value === null) return "unknown";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "number" : "number";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "datetime";
    if (/^[a-f0-9-]{36}$/.test(value)) return "uuid";
    if (/^\+?[\d\s\-()]{7,}$/.test(value)) return "phone";
    if (value.includes("@")) return "email";
    return "string";
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseHAR(har: HAR, options: { baseUrl?: string; filterPath?: RegExp } = {}): HARSuite {
  const { filterPath = /\/api\// } = options;

  // Group entries by endpoint key (method + path)
  const grouped = new Map<string, HAREntry[]>();

  for (const entry of har.log.entries) {
    const { path } = parseUrl(entry.request.url);

    // Filter: only API calls
    if (!filterPath.test(path)) continue;
    // Skip browser preflight OPTIONS
    if (entry.request.method === "OPTIONS") continue;
    // Skip static assets
    if (/\.(js|css|png|jpg|svg|woff|ico)(\?|$)/.test(path)) continue;

    const key = `${entry.request.method}:${path}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  // Build ParsedEndpoint for each unique endpoint
  const endpoints: ParsedEndpoint[] = [];
  for (const [key, entries] of Array.from(grouped.entries())) {
    const [method, path] = key.split(/:(.+)/);
    const first = entries[0];
    const { baseUrl, query } = parseUrl(first.request.url);
    const requestHeaders = headersToRecord(first.request.headers);
    const isTrpc = path.includes("/api/trpc/") || !!requestHeaders["content-type"]?.includes("application/json") && path.includes("trpc");
    const procedureName = extractTrpcProcedure(path, query);

    endpoints.push({
      method,
      path,
      baseUrl: options.baseUrl || baseUrl,
      isTrpc,
      procedureName,
      requestBody: parseBody(first),
      responseBody: parseResponseBody(first),
      responseStatus: first.response.status,
      headers: requestHeaders,
      avgResponseMs: Math.round(entries.reduce((s: number, e: HAREntry) => s + e.time, 0) / entries.length),
      samples: entries.length,
      hasCookie: !!requestHeaders["cookie"],
      hasAuthHeader: !!requestHeaders["authorization"],
    });
  }

  // Generate test files
  const testFiles = generateHARTests(endpoints);

  const authEndpoints = endpoints.filter(e => e.hasCookie || e.hasAuthHeader).length;

  return {
    endpoints,
    testFiles,
    summary: {
      totalRequests: har.log.entries.length,
      uniqueEndpoints: endpoints.length,
      authEndpoints,
      publicEndpoints: endpoints.length - authEndpoints,
      averageResponseMs: endpoints.length > 0
        ? Math.round(endpoints.reduce((s, e) => s + e.avgResponseMs, 0) / endpoints.length)
        : 0,
    },
  };
}

// ─── Test Generator ───────────────────────────────────────────────────────────

function generateHARTests(endpoints: ParsedEndpoint[]): Array<{ filename: string; content: string }> {
  const files: Array<{ filename: string; content: string }> = [];

  // Group endpoints by category
  const authEndpoints = endpoints.filter(e => e.hasCookie || e.hasAuthHeader);
  const publicEndpoints = endpoints.filter(e => !e.hasCookie && !e.hasAuthHeader);

  if (authEndpoints.length > 0) {
    files.push({
      filename: "tests/traffic/replay-authenticated.spec.ts",
      content: generateReplayFile(authEndpoints, true),
    });
    files.push({
      filename: "tests/traffic/security-authenticated.spec.ts",
      content: generateSecurityFile(authEndpoints),
    });
  }

  if (publicEndpoints.length > 0) {
    files.push({
      filename: "tests/traffic/replay-public.spec.ts",
      content: generateReplayFile(publicEndpoints, false),
    });
  }

  // Performance baseline from real traffic timing
  files.push({
    filename: "tests/traffic/perf-baseline.spec.ts",
    content: generatePerfFile(endpoints),
  });

  return files;
}

function bodyToTs(body: unknown, indent = "  "): string {
  if (body === null || body === undefined) return "{}";
  if (typeof body === "string") return JSON.stringify(body);
  if (typeof body !== "object" || Array.isArray(body)) return JSON.stringify(body, null, 2);

  const obj = body as Record<string, unknown>;
  const lines = Object.entries(obj).map(([k, v]) => {
    const type = inferFieldType(v);
    let val: string;
    switch (type) {
      case "string": val = JSON.stringify(v); break;
      case "number": val = String(v); break;
      case "boolean": val = String(v); break;
      case "date": val = `"${v}" /* date */`; break;
      case "phone": val = `process.env.TEST_PHONE || "${v}"`; break;
      case "email": val = `process.env.TEST_EMAIL || "${v}"`; break;
      case "uuid": val = `"${v}" /* uuid — replace with test fixture */`; break;
      default: val = JSON.stringify(v);
    }
    return `${indent}  ${JSON.stringify(k)}: ${val},`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}

function generateReplayFile(endpoints: ParsedEndpoint[], authenticated: boolean): string {
  const lines: string[] = [
    `import { test, expect } from "@playwright/test";`,
    `import { trpcMutation, trpcQuery, BASE_URL } from "../../helpers/api";`,
    authenticated ? `import { getAdminCookie } from "../../helpers/auth";` : "",
    ``,
    `// GENERATED by TestForge HAR Parser — Traffic Replay Tests`,
    `// Source: HAR capture from real traffic`,
    `// These tests replay captured API calls and verify responses match expectations.`,
    `// Update the request bodies to use test fixtures instead of production data.`,
    ``,
  ].filter(l => l !== undefined);

  if (authenticated) {
    lines.push(`let adminCookie: string;`, ``, `test.beforeAll(async ({ request }) => {`, `  adminCookie = await getAdminCookie(request);`, `});`, ``);
  }

  for (const ep of endpoints) {
    const id = `HAR_${ep.method}_${(ep.procedureName || ep.path).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;
    const expectedStatus = ep.responseStatus;
    const cookie = authenticated ? ", adminCookie" : "";
    const bodyTs = bodyToTs(ep.requestBody);
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(ep.method);

    lines.push(
      `test("${id} — replay: ${ep.procedureName || ep.path} returns ${expectedStatus}", async ({ request }) => {`,
      `  // Captured: ${ep.samples} sample(s), avg ${ep.avgResponseMs}ms`,
      `  const { status, data } = await ${isWrite ? "trpcMutation" : "trpcQuery"}(`,
      `    request,`,
      `    ${JSON.stringify(ep.procedureName || (ep.method + " " + ep.path))},`,
      `    ${bodyTs},`,
      `    ${authenticated ? "adminCookie" : "undefined"}`,
      `  );`,
      `  // Kills: endpoint refactor changes response contract`,
      `  expect(status).toBe(${expectedStatus});`,
      `  expect(data).toBeDefined();`,
      `});`,
      ``,
    );
  }

  return lines.join("\n");
}

function generateSecurityFile(endpoints: ParsedEndpoint[]): string {
  const lines: string[] = [
    `import { test, expect } from "@playwright/test";`,
    `import { trpcMutation, trpcQuery, BASE_URL } from "../../helpers/api";`,
    ``,
    `// GENERATED by TestForge HAR Parser — Security Tests from Real Traffic`,
    `// Source: Authenticated endpoints discovered in HAR capture`,
    `// These tests verify that authentication is actually enforced.`,
    ``,
  ];

  for (const ep of endpoints) {
    if (!ep.hasCookie && !ep.hasAuthHeader) continue;
    const id = `SEC_${ep.method}_${(ep.procedureName || ep.path).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(ep.method);
    const bodyTs = bodyToTs(ep.requestBody);

    lines.push(
      `test("${id} — unauthenticated request is rejected (401/403)", async ({ request }) => {`,
      `  // Verify: ${ep.procedureName || ep.path} requires auth (observed ${ep.samples} authenticated calls)`,
      `  const { status } = await ${isWrite ? "trpcMutation" : "trpcQuery"}(`,
      `    request,`,
      `    ${JSON.stringify(ep.procedureName || (ep.method + " " + ep.path))},`,
      `    ${bodyTs},`,
      `    undefined // No auth cookie`,
      `  );`,
      `  // Kills: authentication middleware removed or short-circuited`,
      `  expect([401, 403]).toContain(status);`,
      `});`,
      ``,
    );
  }

  return lines.join("\n");
}

function generatePerfFile(endpoints: ParsedEndpoint[]): string {
  // Only include endpoints with timing data
  const withTiming = endpoints.filter(e => e.avgResponseMs > 0);
  if (withTiming.length === 0) return `// No timing data available in HAR\n`;

  const lines: string[] = [
    `import { test, expect } from "@playwright/test";`,
    `import { trpcMutation, trpcQuery } from "../../helpers/api";`,
    `import { getAdminCookie } from "../../helpers/auth";`,
    ``,
    `// GENERATED by TestForge HAR Parser — Performance Baseline Tests`,
    `// Source: Response times from HAR capture`,
    `// These tests fail if response time regresses beyond 3x the captured baseline.`,
    ``,
    `let adminCookie: string;`,
    ``,
    `test.beforeAll(async ({ request }) => {`,
    `  adminCookie = await getAdminCookie(request);`,
    `});`,
    ``,
  ];

  // Sort by slowest first (most impactful to monitor)
  const sorted = [...withTiming].sort((a, b) => b.avgResponseMs - a.avgResponseMs).slice(0, 10);

  for (const ep of sorted) {
    const id = `PERF_${(ep.procedureName || ep.path).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;
    const budget = Math.max(ep.avgResponseMs * 3, 500); // 3x baseline or 500ms minimum
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(ep.method);
    const bodyTs = bodyToTs(ep.requestBody);
    const cookie = ep.hasCookie || ep.hasAuthHeader ? ", adminCookie" : ", undefined";

    lines.push(
      `test("${id} — response time < ${budget}ms (baseline: ${ep.avgResponseMs}ms)", async ({ request }) => {`,
      `  const t0 = Date.now();`,
      `  const { status } = await ${isWrite ? "trpcMutation" : "trpcQuery"}(`,
      `    request,`,
      `    ${JSON.stringify(ep.procedureName || (ep.method + " " + ep.path))},`,
      `    ${bodyTs}${cookie}`,
      `  );`,
      `  const elapsed = Date.now() - t0;`,
      `  // Kills: N+1 query or missing index introduced by refactor`,
      `  expect(elapsed, \`\${${JSON.stringify(ep.procedureName || ep.path)}} took \${elapsed}ms (budget: ${budget}ms)\`).toBeLessThan(${budget});`,
      `  expect(status).not.toBe(500);`,
      `});`,
      ``,
    );
  }

  return lines.join("\n");
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateHAR(input: unknown): { valid: boolean; error?: string } {
  if (!input || typeof input !== "object") return { valid: false, error: "Input is not an object" };
  const obj = input as Record<string, unknown>;
  if (!obj.log || typeof obj.log !== "object") return { valid: false, error: "Missing .log property" };
  const log = obj.log as Record<string, unknown>;
  if (!Array.isArray(log.entries)) return { valid: false, error: "Missing .log.entries array" };
  if (log.entries.length === 0) return { valid: false, error: "HAR has no entries" };
  return { valid: true };
}
