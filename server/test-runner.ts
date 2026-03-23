/**
 * TestForge Server-Side Test Runner
 * 
 * Executes generated API tests directly against a real API without Playwright.
 * Uses node-fetch to make HTTP calls, parses the generated test code to extract
 * test cases, and streams results back in real-time.
 * 
 * Architecture:
 * - Parse generated Playwright test code to extract test cases
 * - Translate test cases to HTTP calls using the configured base URL + auth token
 * - Execute tests in parallel (configurable concurrency)
 * - Stream results via SSE or collect for batch return
 */

import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestRunConfig {
  baseUrl: string;         // e.g. "https://api.myapp.com"
  authToken: string;       // Bearer token for admin role
  roleTokens?: Record<string, string>; // role name -> bearer token
  timeout?: number;        // per-test timeout in ms (default: 10000)
  concurrency?: number;    // parallel tests (default: 5)
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  proofType: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body?: unknown;
  expectedStatus: number[];
  assertions: TestAssertion[];
  mutationKill?: string;   // What mutation this test kills
}

export interface TestAssertion {
  type: "status" | "body_absent" | "body_present" | "error_code" | "field_value" | "not_null";
  path?: string;           // JSON path in response
  expected?: unknown;
  operator?: "eq" | "in" | "not_null" | "falsy" | "contains";
}

export interface TestResult {
  testId: string;
  name: string;
  proofType: string;
  status: "pass" | "fail" | "error" | "skip";
  durationMs: number;
  actualStatus?: number;
  expectedStatus?: number[];
  failureReason?: string;
  responseBody?: unknown;
  mutationKill?: string;
}

export interface TestRunResult {
  runId: string;
  analysisId: number;
  baseUrl: string;
  startedAt: Date;
  completedAt: Date;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;        // 0-100
  mutationScore: number;   // 0-100 (% of mutation kills caught)
  results: TestResult[];
  summary: string;
}

// ─── Test Case Extractor ──────────────────────────────────────────────────────

/**
 * Extracts executable test cases from generated Playwright test code.
 * Parses the TypeScript source to find test() blocks and their assertions.
 */
export function extractTestCases(
  testCode: string,
  proofType: string,
  baseUrl: string,
  config: TestRunConfig
): TestCase[] {
  const cases: TestCase[] = [];

  // Extract test.describe blocks
  const describeMatch = testCode.match(/test\.describe\("([^"]+)"/);
  const describeName = describeMatch?.[1] || "Unknown";

  // Extract individual test() blocks
  const testBlockRegex = /test\("([^"]+)",\s*async\s*\(\s*\{\s*request\s*\}\s*\)\s*=>\s*\{([\s\S]*?)(?=\n  test\(|\n\}\);)/g;
  let match;
  let testIdx = 0;

  while ((match = testBlockRegex.exec(testCode)) !== null) {
    const testName = match[1];
    const testBody = match[2];
    testIdx++;

    // Extract endpoint from trpcMutation/trpcQuery calls
    const endpointMatch = testBody.match(/trpc(?:Mutation|Query)\(request,\s*"([^"]+)"/);
    const endpoint = endpointMatch?.[1] || "";

    // Determine HTTP method from trpcMutation vs trpcQuery
    const isMutation = testBody.includes("trpcMutation");
    const method = isMutation ? "POST" : "GET";

    // Extract expected status codes
    const statusMatch = testBody.match(/toBeOneOf\(\[([^\]]+)\]\)/);
    const expectedStatus = statusMatch
      ? statusMatch[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : [200];

    // Extract payload from basePayload function or inline
    const payloadFnMatch = testCode.match(/function basePayload_[^(]+\(\)\s*\{\s*return\s*(\{[\s\S]*?\});\s*\}/);
    let body: unknown = undefined;
    if (payloadFnMatch) {
      try {
        // Safe eval of the payload object (it's generated code we control)
        const payloadStr = payloadFnMatch[1]
          .replace(/TEST_\w+_ID/g, '"TEST_TENANT_ID"')
          .replace(/\/\/[^\n]*/g, "");
        body = JSON.parse(payloadStr.replace(/(\w+):/g, '"$1":').replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
      } catch {
        body = {};
      }
    }

    // Determine auth role from cookie function name
    const cookieFnMatch = testBody.match(/await\s+(get\w+Cookie)\(request\)/);
    const cookieFn = cookieFnMatch?.[1] || "getAdminCookie";
    const roleName = cookieFn.replace(/^get/, "").replace(/Cookie$/, "").toLowerCase();
    const token = config.roleTokens?.[roleName] || config.authToken;

    // Build assertions
    const assertions: TestAssertion[] = [
      { type: "status", expected: expectedStatus, operator: "in" }
    ];

    // Check for data leak assertions
    if (testBody.includes("expect(data).toBeFalsy()") || testBody.includes("expect(leakedData).toBeFalsy()")) {
      assertions.push({ type: "body_absent", path: "result.data", operator: "falsy" });
    }
    if (testBody.includes("expect(data).not.toBeNull()")) {
      assertions.push({ type: "not_null", path: "result.data", operator: "not_null" });
    }
    if (testBody.includes('expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode)')) {
      assertions.push({ type: "error_code", expected: ["FORBIDDEN", "UNAUTHORIZED"], operator: "in" });
    }

    // Extract mutation kill comment
    const killMatch = testBody.match(/\/\/ Kills:\s*(.+)/);
    const mutationKill = killMatch?.[1]?.trim();

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // For unauthenticated tests, remove auth header
    if (testName.includes("unauthenticated")) {
      delete headers["Authorization"];
    }

    if (endpoint) {
      cases.push({
        id: `${proofType}-${testIdx}`,
        name: `${describeName} > ${testName}`,
        description: testName,
        proofType,
        endpoint,
        method,
        headers,
        body: isMutation ? body : undefined,
        expectedStatus,
        assertions,
        mutationKill,
      });
    }
  }

  return cases;
}

// ─── HTTP Executor ────────────────────────────────────────────────────────────

/**
 * Executes a single test case against the real API.
 * Translates tRPC endpoint names to REST paths.
 */
async function executeTestCase(
  tc: TestCase,
  config: TestRunConfig
): Promise<TestResult> {
  const t0 = Date.now();

  try {
    // Translate tRPC endpoint to REST path
    // tRPC endpoints like "analyses.create" → "/api/trpc/analyses.create"
    const url = tc.endpoint.includes("/")
      ? `${config.baseUrl}${tc.endpoint}`
      : `${config.baseUrl}/api/trpc/${tc.endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 10000);

    let response: Response;
    try {
      const fetchOptions: RequestInit = {
        method: tc.method,
        headers: tc.headers,
        signal: controller.signal,
      };

      if (tc.method !== "GET" && tc.body !== undefined) {
        fetchOptions.body = JSON.stringify({ json: tc.body });
      } else if (tc.method === "GET" && tc.body !== undefined) {
        // tRPC GET queries use input param
        const inputEncoded = encodeURIComponent(JSON.stringify({ json: tc.body }));
        response = await fetch(`${url}?input=${inputEncoded}`, fetchOptions);
        clearTimeout(timeoutId);
        return await evaluateResponse(tc, response, t0);
      }

      response = await fetch(url, fetchOptions);
    } finally {
      clearTimeout(timeoutId);
    }

    return await evaluateResponse(tc, response, t0);

  } catch (err: unknown) {
    const durationMs = Date.now() - t0;
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      testId: tc.id,
      name: tc.name,
      proofType: tc.proofType,
      status: "error",
      durationMs,
      failureReason: isAbort ? `Timeout after ${config.timeout || 10000}ms` : String(err),
      mutationKill: tc.mutationKill,
    };
  }
}

async function evaluateResponse(tc: TestCase, response: Response, t0: number): Promise<TestResult> {
  const durationMs = Date.now() - t0;
  const actualStatus = response.status;

  let responseBody: unknown;
  try {
    const text = await response.text();
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = null;
  }

  // Check status assertion
  const statusOk = tc.expectedStatus.includes(actualStatus);
  if (!statusOk) {
    return {
      testId: tc.id,
      name: tc.name,
      proofType: tc.proofType,
      status: "fail",
      durationMs,
      actualStatus,
      expectedStatus: tc.expectedStatus,
      failureReason: `Expected status ${tc.expectedStatus.join(" or ")} but got ${actualStatus}`,
      responseBody,
      mutationKill: tc.mutationKill,
    };
  }

  // Check additional assertions
  for (const assertion of tc.assertions) {
    if (assertion.type === "status") continue; // already checked

    const body = responseBody as Record<string, unknown>;

    if (assertion.type === "body_absent") {
      // Check that result.data is falsy (no data leak)
      const data = getNestedValue(body, assertion.path || "result.data");
      if (data !== null && data !== undefined && data !== false) {
        return {
          testId: tc.id,
          name: tc.name,
          proofType: tc.proofType,
          status: "fail",
          durationMs,
          actualStatus,
          failureReason: `Data leak detected: ${assertion.path} should be falsy but got ${JSON.stringify(data)}`,
          responseBody,
          mutationKill: tc.mutationKill,
        };
      }
    }

    if (assertion.type === "not_null") {
      const data = getNestedValue(body, assertion.path || "result.data");
      if (data === null || data === undefined) {
        return {
          testId: tc.id,
          name: tc.name,
          proofType: tc.proofType,
          status: "fail",
          durationMs,
          actualStatus,
          failureReason: `Expected ${assertion.path} to be non-null but got null/undefined`,
          responseBody,
          mutationKill: tc.mutationKill,
        };
      }
    }

    if (assertion.type === "error_code") {
      const errorCode = getNestedValue(body, "error.data.code") ||
        getNestedValue(body, "result.error.data.code");
      const expected = assertion.expected as string[];
      if (!expected.includes(errorCode as string)) {
        return {
          testId: tc.id,
          name: tc.name,
          proofType: tc.proofType,
          status: "fail",
          durationMs,
          actualStatus,
          failureReason: `Expected error code in [${expected.join(", ")}] but got "${errorCode}"`,
          responseBody,
          mutationKill: tc.mutationKill,
        };
      }
    }
  }

  return {
    testId: tc.id,
    name: tc.name,
    proofType: tc.proofType,
    status: "pass",
    durationMs,
    actualStatus,
    expectedStatus: tc.expectedStatus,
    responseBody: undefined, // Don't store response body for passing tests
    mutationKill: tc.mutationKill,
  };
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ─── Test Run Orchestrator ────────────────────────────────────────────────────

/**
 * Runs all test cases from a set of generated test files.
 * Streams results via onResult callback.
 */
export async function runTests(
  testFiles: Array<{ filename: string; content: string; proofType?: string }>,
  config: TestRunConfig,
  onResult?: (result: TestResult) => void
): Promise<TestRunResult> {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date();
  const allResults: TestResult[] = [];

  // Extract all test cases from all files
  const allCases: TestCase[] = [];
  for (const file of testFiles) {
    const proofType = file.proofType ||
      file.filename.replace(/\.spec\.ts$/, "").split("/").pop() || "unknown";
    const cases = extractTestCases(file.content, proofType, config.baseUrl, config);
    allCases.push(...cases);
  }

  if (allCases.length === 0) {
    const completedAt = new Date();
    return {
      runId,
      analysisId: 0,
      baseUrl: config.baseUrl,
      startedAt,
      completedAt,
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      passRate: 0,
      mutationScore: 0,
      results: [],
      summary: "No executable test cases found. Tests may require manual placeholder replacement.",
    };
  }

  // Execute tests with concurrency limit
  const concurrency = config.concurrency || 5;
  const chunks: TestCase[][] = [];
  for (let i = 0; i < allCases.length; i += concurrency) {
    chunks.push(allCases.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(tc => executeTestCase(tc, config))
    );
    for (const result of chunkResults) {
      allResults.push(result);
      onResult?.(result);
    }
  }

  // Calculate metrics
  const passed = allResults.filter(r => r.status === "pass").length;
  const failed = allResults.filter(r => r.status === "fail").length;
  const errors = allResults.filter(r => r.status === "error").length;
  const passRate = allResults.length > 0 ? Math.round((passed / allResults.length) * 100) : 0;

  // Mutation score: % of mutation kills that were caught (failed tests with mutationKill)
  const testsWithKills = allResults.filter(r => r.mutationKill);
  const killedMutations = testsWithKills.filter(r => r.status === "fail").length;
  const mutationScore = testsWithKills.length > 0
    ? Math.round((killedMutations / testsWithKills.length) * 100)
    : 100;

  const completedAt = new Date();
  const durationSec = ((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1);

  const summary = [
    `TestForge Run ${runId}`,
    `Duration: ${durationSec}s`,
    `Tests: ${allResults.length} total, ${passed} passed, ${failed} failed, ${errors} errors`,
    `Pass Rate: ${passRate}%`,
    `Mutation Score: ${mutationScore}%`,
    failed > 0 ? `\nFailed Tests:\n${allResults.filter(r => r.status === "fail").map(r => `  - ${r.name}: ${r.failureReason}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");

  return {
    runId,
    analysisId: 0,
    baseUrl: config.baseUrl,
    startedAt,
    completedAt,
    totalTests: allResults.length,
    passed,
    failed,
    errors,
    passRate,
    mutationScore,
    results: allResults,
    summary,
  };
}

// ─── LLM-Assisted Placeholder Resolver ───────────────────────────────────────

/**
 * Uses LLM to resolve placeholder values in test code.
 * Replaces TODO_REPLACE_WITH_* with sensible defaults based on context.
 */
export async function resolvePlaceholders(
  testCode: string,
  config: TestRunConfig,
  specContext?: string
): Promise<string> {
  const hasTodos = testCode.includes("TODO_REPLACE_WITH");
  if (!hasTodos) return testCode;

  const todos = testCode.match(/TODO_REPLACE_WITH_\w+/g) || [];
  const uniqueTodos = Array.from(new Set(todos));

  const prompt = `You are a test configuration assistant. 
Given this Playwright API test code with placeholder values, replace each TODO_REPLACE_WITH_* with a sensible default value.

BASE_URL: ${config.baseUrl}
PLACEHOLDERS TO REPLACE: ${uniqueTodos.join(", ")}

${specContext ? `API CONTEXT:\n${specContext.slice(0, 2000)}\n` : ""}

RULES:
- Replace TODO_REPLACE_WITH_ENDPOINT with the most likely tRPC endpoint name (e.g. "users.getById")
- Replace TODO_REPLACE_WITH_MUTATION_ENDPOINT with a POST endpoint name
- Replace TODO_REPLACE_WITH_QUERY_ENDPOINT with a GET endpoint name
- Replace TODO_REPLACE_WITH_LIST_ENDPOINT with a list/getAll endpoint name
- Keep replacements as simple strings
- Output ONLY the corrected test code, no markdown

ORIGINAL CODE:
${testCode.slice(0, 4000)}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
    });
    const resolved = response.choices[0].message.content as string;
    return resolved.replace(/^```typescript\n?|^```\n?|```$/gm, "").trim();
  } catch {
    return testCode; // Return original if LLM fails
  }
}
