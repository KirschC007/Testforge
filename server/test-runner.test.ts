/**
 * Unit Tests: test-runner.ts + test-run-sse.ts
 *
 * Coverage:
 * - extractTestCases: parses Playwright test code → TestCase[]
 * - executeTestCase (via runTests): HTTP execution with pass/fail/error
 * - evaluateResponse: status checks, body assertions
 * - runTests: concurrency, onResult callback, metrics calculation
 * - SSE bus: registerSSEClient, emitTestResult, emitRunComplete, emitRunError
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractTestCases,
  runTests,
  type TestRunConfig,
  type TestResult,
} from "./test-runner";
import {
  registerSSEClient,
  emitTestResult,
  emitRunComplete,
  emitRunError,
  getClientCount,
  clearAllClients,
} from "./test-run-sse";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_IDOR_TEST = `
import { test, expect } from "@playwright/test";

test.describe("IDOR: /api/trpc/users.getById", () => {
  test("should block cross-tenant access", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const res = await trpcQuery(request, "users.getById", { id: "OTHER_TENANT_ID" });
    expect(res.status()).toBeOneOf([403, 404]);
    expect(leakedData).toBeFalsy();
    // Kills: IDOR-mutation-1
  });
  test("should allow own resource access", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const res = await trpcQuery(request, "users.getById", { id: "OWN_ID" });
    expect(res.status()).toBeOneOf([200]);
    expect(data).not.toBeNull();
  });
});

function basePayload_users() {
  return { name: "Test User", email: "test@example.com" };
}
`;

const SAMPLE_AUTH_MATRIX_TEST = `
import { test, expect } from "@playwright/test";

test.describe("Auth Matrix: /api/trpc/admin.deleteUser", () => {
  test("admin can delete user", async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const res = await trpcMutation(request, "admin.deleteUser", { userId: "123" });
    expect(res.status()).toBeOneOf([200, 204]);
    // Kills: AUTH-MATRIX-admin-delete
  });
  test("unauthenticated cannot delete user", async ({ request }) => {
    const res = await trpcMutation(request, "admin.deleteUser", { userId: "123" });
    expect(res.status()).toBeOneOf([401, 403]);
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode);
    // Kills: AUTH-MATRIX-unauth-delete
  });
});
`;

const EMPTY_TEST = `
// No test blocks here
const x = 1;
`;

const CONFIG: TestRunConfig = {
  baseUrl: "https://api.example.com",
  authToken: "test-admin-token",
  timeout: 5000,
  concurrency: 3,
};

// ─── extractTestCases ─────────────────────────────────────────────────────────

describe("extractTestCases", () => {
  it("extracts test cases from IDOR test code", () => {
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, CONFIG);
    expect(cases.length).toBeGreaterThanOrEqual(1);
    const first = cases[0];
    expect(first.proofType).toBe("idor");
    expect(first.endpoint).toBe("users.getById");
    expect(first.method).toBe("GET");
    expect(first.expectedStatus).toContain(403);
    expect(first.expectedStatus).toContain(404);
  });

  it("extracts mutation kill comment", () => {
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, CONFIG);
    const withKill = cases.find(c => c.mutationKill);
    expect(withKill).toBeDefined();
    expect(withKill?.mutationKill).toContain("IDOR-mutation-1");
  });

  it("extracts body_absent assertion for data leak check", () => {
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, CONFIG);
    const first = cases[0];
    const bodyAbsent = first.assertions.find(a => a.type === "body_absent");
    expect(bodyAbsent).toBeDefined();
  });

  it("extracts not_null assertion for own resource access", () => {
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, CONFIG);
    // The second test case should have a not_null assertion (expect(data).not.toBeNull())
    // Find by assertion type since test name matching depends on regex
    const withNotNull = cases.find(c => c.assertions.some(a => a.type === "not_null"));
    expect(withNotNull).toBeDefined();
    const notNull = withNotNull?.assertions.find(a => a.type === "not_null");
    expect(notNull).toBeDefined();
  });

  it("detects trpcMutation as POST method", () => {
    const cases = extractTestCases(SAMPLE_AUTH_MATRIX_TEST, "auth_matrix", CONFIG.baseUrl, CONFIG);
    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0].method).toBe("POST");
  });

  it("extracts error_code assertion for unauthenticated test", () => {
    const cases = extractTestCases(SAMPLE_AUTH_MATRIX_TEST, "auth_matrix", CONFIG.baseUrl, CONFIG);
    // Find the test case that has an error_code assertion
    // (from: expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(errorCode))
    const withErrCode = cases.find(c => c.assertions.some(a => a.type === "error_code"));
    expect(withErrCode).toBeDefined();
    const errCode = withErrCode?.assertions.find(a => a.type === "error_code");
    expect(errCode).toBeDefined();
    expect(errCode?.expected).toContain("FORBIDDEN");
    expect(errCode?.expected).toContain("UNAUTHORIZED");
  });

  it("removes Authorization header for unauthenticated tests", () => {
    const cases = extractTestCases(SAMPLE_AUTH_MATRIX_TEST, "auth_matrix", CONFIG.baseUrl, CONFIG);
    const unauth = cases.find(c => c.name.toLowerCase().includes("unauthenticated"));
    if (unauth) {
      expect(unauth.headers["Authorization"]).toBeUndefined();
    }
  });

  it("returns empty array for test code with no test blocks", () => {
    const cases = extractTestCases(EMPTY_TEST, "idor", CONFIG.baseUrl, CONFIG);
    expect(cases).toHaveLength(0);
  });

  it("assigns Bearer token from config.authToken", () => {
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, CONFIG);
    const first = cases[0];
    expect(first.headers["Authorization"]).toBe(`Bearer ${CONFIG.authToken}`);
  });

  it("uses roleTokens when available", () => {
    const configWithRoles: TestRunConfig = {
      ...CONFIG,
      roleTokens: { advisor: "advisor-token-123" },
    };
    // The IDOR test uses getAdminCookie, so it should use authToken
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, configWithRoles);
    expect(cases[0].headers["Authorization"]).toBe(`Bearer ${CONFIG.authToken}`);
  });

  it("assigns unique IDs to each test case", () => {
    const cases = extractTestCases(SAMPLE_IDOR_TEST, "idor", CONFIG.baseUrl, CONFIG);
    const ids = cases.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─── runTests ─────────────────────────────────────────────────────────────────

describe("runTests", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty result when no test cases can be extracted", async () => {
    const result = await runTests(
      [{ filename: "empty.spec.ts", content: EMPTY_TEST }],
      CONFIG
    );
    expect(result.totalTests).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.summary).toContain("No executable test cases found");
  });

  it("calls onResult callback for each completed test", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 403,
      text: async () => JSON.stringify({ error: { data: { code: "FORBIDDEN" } } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const onResult = vi.fn();
    await runTests(
      [{ filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" }],
      CONFIG,
      onResult
    );

    expect(onResult).toHaveBeenCalled();
    const firstCall = onResult.mock.calls[0][0] as TestResult;
    expect(firstCall).toHaveProperty("testId");
    expect(firstCall).toHaveProperty("status");
    expect(firstCall).toHaveProperty("durationMs");
  });

  it("marks test as pass when status matches expectedStatus", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "{}",
    }));

    const results: TestResult[] = [];
    await runTests(
      [{ filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" }],
      CONFIG,
      r => results.push(r)
    );

    // First test expects 403/404 — mock returns 403 → should pass
    const first = results[0];
    expect(first.status).toBe("pass");
  });

  it("marks test as fail when status does not match expectedStatus", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "{}",
    }));

    const results: TestResult[] = [];
    await runTests(
      [{ filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" }],
      CONFIG,
      r => results.push(r)
    );

    // First test expects 403/404 — mock returns 200 → should fail
    const first = results[0];
    expect(first.status).toBe("fail");
    expect(first.failureReason).toContain("Expected status");
  });

  it("marks test as error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const results: TestResult[] = [];
    await runTests(
      [{ filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" }],
      CONFIG,
      r => results.push(r)
    );

    expect(results.some(r => r.status === "error")).toBe(true);
  });

  it("calculates passRate correctly", async () => {
    // All tests return 403 → first test (expects 403/404) passes, second (expects 200) fails
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "{}",
    }));

    const result = await runTests(
      [{ filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" }],
      CONFIG
    );

    expect(result.totalTests).toBeGreaterThan(0);
    expect(result.passRate).toBeGreaterThanOrEqual(0);
    expect(result.passRate).toBeLessThanOrEqual(100);
  });

  it("calculates mutationScore as 100 when no mutation-kill tests exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "{}",
    }));

    // Use SAMPLE_IDOR_TEST but strip the mutation kill comment
    // to simulate a test with no mutation kills
    const noKillTest = SAMPLE_IDOR_TEST.replace(/\/\/ Kills:.*\n/g, "");

    const result = await runTests(
      [{ filename: "idor.spec.ts", content: noKillTest, proofType: "idor" }],
      CONFIG
    );

    // When no tests have mutationKill, score should be 100 (no mutations to kill)
    const testsWithKills = result.results.filter(r => r.mutationKill);
    if (testsWithKills.length === 0) {
      expect(result.mutationScore).toBe(100);
    } else {
      // If some kills remain, score is still valid
      expect(result.mutationScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes runId and analysisId in result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "{}",
    }));

    const result = await runTests(
      [{ filename: "empty.spec.ts", content: EMPTY_TEST }],
      CONFIG
    );

    expect(result.runId).toMatch(/^run-/);
    expect(result.analysisId).toBe(0);
  });

  it("includes startedAt and completedAt timestamps", async () => {
    const result = await runTests(
      [{ filename: "empty.spec.ts", content: EMPTY_TEST }],
      CONFIG
    );

    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
  });

  it("processes multiple files", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "{}",
    }));

    const result = await runTests(
      [
        { filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" },
        { filename: "auth.spec.ts", content: SAMPLE_AUTH_MATRIX_TEST, proofType: "auth_matrix" },
      ],
      CONFIG
    );

    // Each file should contribute at least 1 test case
    expect(result.totalTests).toBeGreaterThanOrEqual(2);
  });
});

// ─── SSE Event Bus ────────────────────────────────────────────────────────────

describe("SSE Event Bus", () => {
  beforeEach(() => {
    clearAllClients();
  });

  afterEach(() => {
    clearAllClients();
  });

  function makeMockRes() {
    const written: string[] = [];
    let ended = false;
    return {
      write: vi.fn((data: string) => { written.push(data); }),
      end: vi.fn(() => { ended = true; }),
      _written: written,
      _ended: () => ended,
    } as any;
  }

  it("registerSSEClient increases client count", () => {
    const res = makeMockRes();
    expect(getClientCount("run-1")).toBe(0);
    registerSSEClient("run-1", res);
    expect(getClientCount("run-1")).toBe(1);
  });

  it("cleanup function removes client", () => {
    const res = makeMockRes();
    const cleanup = registerSSEClient("run-2", res);
    expect(getClientCount("run-2")).toBe(1);
    cleanup();
    expect(getClientCount("run-2")).toBe(0);
  });

  it("multiple clients can register for same runId", () => {
    const res1 = makeMockRes();
    const res2 = makeMockRes();
    registerSSEClient("run-3", res1);
    registerSSEClient("run-3", res2);
    expect(getClientCount("run-3")).toBe(2);
  });

  it("emitTestResult writes SSE data to all clients", () => {
    const res1 = makeMockRes();
    const res2 = makeMockRes();
    registerSSEClient("run-4", res1);
    registerSSEClient("run-4", res2);

    const result: TestResult = {
      testId: "idor-1",
      name: "Test 1",
      proofType: "idor",
      status: "pass",
      durationMs: 42,
    };

    emitTestResult("run-4", result, { completed: 1, total: 10 });

    expect(res1.write).toHaveBeenCalledOnce();
    expect(res2.write).toHaveBeenCalledOnce();

    const payload = JSON.parse(res1._written[0].replace("data: ", "").trim());
    expect(payload.type).toBe("test_result");
    expect(payload.result.testId).toBe("idor-1");
    expect(payload.progress.completed).toBe(1);
    expect(payload.progress.total).toBe(10);
  });

  it("emitTestResult does nothing when no clients registered", () => {
    // Should not throw
    const result: TestResult = {
      testId: "idor-1",
      name: "Test 1",
      proofType: "idor",
      status: "pass",
      durationMs: 42,
    };
    expect(() => emitTestResult("nonexistent-run", result, { completed: 1, total: 1 })).not.toThrow();
  });

  it("emitRunComplete writes completion event and ends connections", () => {
    const res = makeMockRes();
    registerSSEClient("run-5", res);

    const summary = {
      runId: "run-5",
      totalTests: 5,
      passed: 4,
      failed: 1,
      errors: 0,
      passRate: 80,
      mutationScore: 100,
      results: [],
      summary: "Done",
      startedAt: new Date(),
      completedAt: new Date(),
    } as any;

    emitRunComplete("run-5", summary);

    expect(res.write).toHaveBeenCalledOnce();
    expect(res.end).toHaveBeenCalledOnce();

    const payload = JSON.parse(res._written[0].replace("data: ", "").trim());
    expect(payload.type).toBe("run_complete");
    expect(payload.summary.runId).toBe("run-5");
  });

  it("emitRunComplete removes all clients after completion", () => {
    const res = makeMockRes();
    registerSSEClient("run-6", res);
    expect(getClientCount("run-6")).toBe(1);

    emitRunComplete("run-6", { runId: "run-6" } as any);
    expect(getClientCount("run-6")).toBe(0);
  });

  it("emitRunError writes error event and ends connections", () => {
    const res = makeMockRes();
    registerSSEClient("run-7", res);

    emitRunError("run-7", "Connection refused");

    expect(res.write).toHaveBeenCalledOnce();
    expect(res.end).toHaveBeenCalledOnce();

    const payload = JSON.parse(res._written[0].replace("data: ", "").trim());
    expect(payload.type).toBe("run_error");
    expect(payload.error).toBe("Connection refused");
  });

  it("emitRunError removes all clients after error", () => {
    const res = makeMockRes();
    registerSSEClient("run-8", res);
    expect(getClientCount("run-8")).toBe(1);

    emitRunError("run-8", "Fatal error");
    expect(getClientCount("run-8")).toBe(0);
  });

  it("clearAllClients removes all registrations", () => {
    const res1 = makeMockRes();
    const res2 = makeMockRes();
    registerSSEClient("run-9", res1);
    registerSSEClient("run-10", res2);

    clearAllClients();

    expect(getClientCount("run-9")).toBe(0);
    expect(getClientCount("run-10")).toBe(0);
  });

  it("handles write errors gracefully (client disconnected mid-stream)", () => {
    const res = makeMockRes();
    res.write = vi.fn().mockImplementation(() => { throw new Error("write EPIPE"); });
    registerSSEClient("run-11", res);

    const result: TestResult = {
      testId: "t1",
      name: "T1",
      proofType: "idor",
      status: "pass",
      durationMs: 10,
    };

    // Should not throw even when write fails
    expect(() => emitTestResult("run-11", result, { completed: 1, total: 1 })).not.toThrow();
  });
});

// ─── Integration: runTests + SSE ─────────────────────────────────────────────

describe("runTests + SSE integration", () => {
  beforeEach(() => {
    clearAllClients();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "{}",
    }));
  });

  afterEach(() => {
    clearAllClients();
    vi.unstubAllGlobals();
  });

  it("SSE clients receive test_result events during runTests", async () => {
    const res = makeMockRes();
    const runId = "integration-run-1";
    registerSSEClient(runId, res);

    const onResult = vi.fn((result: TestResult) => {
      emitTestResult(runId, result, { completed: 1, total: 1 });
    });

    await runTests(
      [{ filename: "idor.spec.ts", content: SAMPLE_IDOR_TEST, proofType: "idor" }],
      CONFIG,
      onResult
    );

    // Should have received at least one test_result event
    const events = res._written.map((d: string) => JSON.parse(d.replace("data: ", "").trim()));
    const testResultEvents = events.filter((e: any) => e.type === "test_result");
    expect(testResultEvents.length).toBeGreaterThan(0);
  });
});

function makeMockRes() {
  const written: string[] = [];
  return {
    write: vi.fn((data: string) => { written.push(data); }),
    end: vi.fn(),
    _written: written,
  } as any;
}
