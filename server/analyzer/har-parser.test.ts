/**
 * HAR Parser — Unit Tests
 *
 * Verifies parsing of HAR files (HTTP Archive format from browser DevTools/proxies)
 * into Playwright test suites: replay tests, security tests, perf baselines.
 */
import { describe, it, expect } from "vitest";
import { parseHAR, validateHAR, type HAR, type HAREntry } from "./har-parser";

function makeEntry(overrides: Partial<HAREntry> = {}): HAREntry {
  return {
    request: {
      method: "POST",
      url: "https://api.example.com/api/trpc/users.create",
      headers: [
        { name: "Content-Type", value: "application/json" },
        { name: "Cookie", value: "session=abc123" },
      ],
      postData: {
        mimeType: "application/json",
        text: JSON.stringify({ json: { name: "Alice", age: 30 } }),
      },
    },
    response: {
      status: 200,
      headers: [{ name: "Content-Type", value: "application/json" }],
      content: {
        mimeType: "application/json",
        text: JSON.stringify({ result: { data: { json: { id: 42, name: "Alice" } } } }),
      },
    },
    time: 145,
    ...overrides,
  };
}

function makeHAR(entries: HAREntry[]): HAR {
  return {
    log: {
      version: "1.2",
      entries,
    },
  };
}

describe("HAR Parser — validateHAR", () => {
  it("accepts a valid HAR structure", () => {
    const result = validateHAR(makeHAR([makeEntry()]));
    expect(result.valid).toBe(true);
  });

  it("rejects null", () => {
    const result = validateHAR(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/object/i);
  });

  it("rejects non-object input", () => {
    expect(validateHAR("string").valid).toBe(false);
    expect(validateHAR(42).valid).toBe(false);
    expect(validateHAR(true).valid).toBe(false);
  });

  it("rejects missing .log property", () => {
    const result = validateHAR({ entries: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/log/i);
  });

  it("rejects missing .log.entries", () => {
    const result = validateHAR({ log: { version: "1.2" } });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/entries/i);
  });

  it("rejects empty entries array", () => {
    const result = validateHAR({ log: { entries: [] } });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no entries/i);
  });
});

describe("HAR Parser — parseHAR", () => {
  it("returns endpoints + summary + testFiles", () => {
    const suite = parseHAR(makeHAR([makeEntry()]));
    expect(suite.endpoints).toBeInstanceOf(Array);
    expect(suite.summary).toBeDefined();
    expect(suite.testFiles).toBeInstanceOf(Array);
  });

  it("groups duplicate requests by method+path", () => {
    const e1 = makeEntry();
    const e2 = makeEntry({ time: 200 });
    const suite = parseHAR(makeHAR([e1, e2]));

    expect(suite.endpoints).toHaveLength(1);
    expect(suite.endpoints[0].samples).toBe(2);
    // Avg of 145 and 200
    expect(suite.endpoints[0].avgResponseMs).toBe(173);
  });

  it("treats different methods on same path as separate endpoints", () => {
    const get = makeEntry({
      request: { ...makeEntry().request, method: "GET" },
    });
    const post = makeEntry({
      request: { ...makeEntry().request, method: "POST" },
    });
    const suite = parseHAR(makeHAR([get, post]));
    expect(suite.endpoints).toHaveLength(2);
  });

  it("filters out static asset requests", () => {
    const apiCall = makeEntry();
    const cssCall = makeEntry({
      request: { ...makeEntry().request, url: "https://example.com/api/style.css" },
    });
    const jsCall = makeEntry({
      request: { ...makeEntry().request, url: "https://example.com/api/app.js" },
    });
    const suite = parseHAR(makeHAR([apiCall, cssCall, jsCall]));
    expect(suite.endpoints).toHaveLength(1);
  });

  it("filters out OPTIONS preflight requests", () => {
    const post = makeEntry();
    const preflight = makeEntry({
      request: { ...makeEntry().request, method: "OPTIONS" },
    });
    const suite = parseHAR(makeHAR([post, preflight]));
    expect(suite.endpoints).toHaveLength(1);
  });

  it("filters out non-API URLs by default", () => {
    const apiCall = makeEntry();
    const homepage = makeEntry({
      request: { ...makeEntry().request, url: "https://example.com/" },
    });
    const suite = parseHAR(makeHAR([apiCall, homepage]));
    expect(suite.endpoints).toHaveLength(1);
  });

  it("uses custom filterPath when provided", () => {
    const trpcCall = makeEntry();
    const restCall = makeEntry({
      request: { ...makeEntry().request, url: "https://example.com/v2/rest/users" },
    });
    const suite = parseHAR(makeHAR([trpcCall, restCall]), { filterPath: /\/v2\// });
    expect(suite.endpoints).toHaveLength(1);
    expect(suite.endpoints[0].path).toBe("/v2/rest/users");
  });

  it("detects authenticated endpoints via Cookie header", () => {
    const suite = parseHAR(makeHAR([makeEntry()]));
    expect(suite.endpoints[0].hasCookie).toBe(true);
    expect(suite.endpoints[0].hasAuthHeader).toBe(false);
  });

  it("detects authenticated endpoints via Authorization header", () => {
    const entry = makeEntry({
      request: {
        ...makeEntry().request,
        headers: [
          { name: "Content-Type", value: "application/json" },
          { name: "Authorization", value: "Bearer xyz789" },
        ],
      },
    });
    const suite = parseHAR(makeHAR([entry]));
    expect(suite.endpoints[0].hasAuthHeader).toBe(true);
  });

  it("identifies tRPC endpoints by URL pattern", () => {
    const suite = parseHAR(makeHAR([makeEntry()]));
    expect(suite.endpoints[0].isTrpc).toBe(true);
    expect(suite.endpoints[0].procedureName).toBe("users.create");
  });

  it("computes summary statistics", () => {
    const suite = parseHAR(makeHAR([makeEntry(), makeEntry()]));
    expect(suite.summary.totalRequests).toBe(2);
    expect(suite.summary.uniqueEndpoints).toBe(1);
    expect(suite.summary.authEndpoints).toBe(1);
    expect(suite.summary.publicEndpoints).toBe(0);
  });

  it("handles malformed entries gracefully (no crash)", () => {
    const goodEntry = makeEntry();
    const badEntry: any = { request: null, response: null, time: 0 };
    const suite = parseHAR(makeHAR([goodEntry, badEntry]));
    expect(suite.endpoints).toHaveLength(1); // Bad entry skipped
  });

  it("handles entries without postData", () => {
    const entry = makeEntry({
      request: { ...makeEntry().request, method: "GET", postData: undefined },
    });
    const suite = parseHAR(makeHAR([entry]));
    expect(suite.endpoints).toHaveLength(1);
    expect(suite.endpoints[0].requestBody).toBeUndefined();
  });

  it("handles entries without response.content.text", () => {
    const entry = makeEntry({
      response: { ...makeEntry().response, content: { mimeType: "application/json" } },
    });
    const suite = parseHAR(makeHAR([entry]));
    expect(suite.endpoints).toHaveLength(1);
    expect(suite.endpoints[0].responseBody).toBeUndefined();
  });

  it("unwraps tRPC request body wrapper", () => {
    const entry = makeEntry({
      request: {
        ...makeEntry().request,
        postData: {
          mimeType: "application/json",
          text: JSON.stringify({ json: { x: 1 } }),
        },
      },
    });
    const suite = parseHAR(makeHAR([entry]));
    expect(suite.endpoints[0].requestBody).toEqual({ x: 1 });
  });

  it("unwraps tRPC response body wrapper", () => {
    const entry = makeEntry({
      response: {
        ...makeEntry().response,
        content: {
          mimeType: "application/json",
          text: JSON.stringify({ result: { data: { json: { id: 5 } } } }),
        },
      },
    });
    const suite = parseHAR(makeHAR([entry]));
    expect(suite.endpoints[0].responseBody).toEqual({ id: 5 });
  });

  it("handles invalid JSON in body without crashing", () => {
    const entry = makeEntry({
      request: {
        ...makeEntry().request,
        postData: { mimeType: "text/plain", text: "not-json{{{" },
      },
    });
    const suite = parseHAR(makeHAR([entry]));
    expect(suite.endpoints).toHaveLength(1);
    // Falls back to raw text
    expect(suite.endpoints[0].requestBody).toBe("not-json{{{");
  });

  it("respects baseUrl override", () => {
    const suite = parseHAR(makeHAR([makeEntry()]), { baseUrl: "https://staging.example.com" });
    expect(suite.endpoints[0].baseUrl).toBe("https://staging.example.com");
  });
});

describe("HAR Parser — Test File Generation", () => {
  it("generates replay tests for authenticated endpoints", () => {
    const suite = parseHAR(makeHAR([makeEntry()]));
    const replay = suite.testFiles.find(f => f.filename.includes("replay-authenticated"));
    expect(replay).toBeDefined();
    expect(replay!.content).toContain('import { test, expect }');
    expect(replay!.content).toContain("users.create");
  });

  it("generates security tests for authenticated endpoints", () => {
    const suite = parseHAR(makeHAR([makeEntry()]));
    const security = suite.testFiles.find(f => f.filename.includes("security-authenticated"));
    expect(security).toBeDefined();
    expect(security!.content).toContain("undefined // No auth cookie");
    expect(security!.content).toContain("[401, 403]");
  });

  it("generates separate replay file for public endpoints", () => {
    const publicEntry = makeEntry({
      request: {
        ...makeEntry().request,
        headers: [{ name: "Content-Type", value: "application/json" }], // No cookie/auth
      },
    });
    const suite = parseHAR(makeHAR([publicEntry]));
    const publicReplay = suite.testFiles.find(f => f.filename.includes("replay-public"));
    expect(publicReplay).toBeDefined();
  });

  it("does NOT generate security tests for public endpoints", () => {
    const publicEntry = makeEntry({
      request: {
        ...makeEntry().request,
        headers: [{ name: "Content-Type", value: "application/json" }],
      },
    });
    const suite = parseHAR(makeHAR([publicEntry]));
    const security = suite.testFiles.find(f => f.filename.includes("security-authenticated"));
    expect(security).toBeUndefined();
  });

  it("generates perf baseline test with budget = 3× avg response time", () => {
    const slowEntry = makeEntry({ time: 500 }); // 500ms
    const suite = parseHAR(makeHAR([slowEntry]));
    const perf = suite.testFiles.find(f => f.filename.includes("perf-baseline"));
    expect(perf).toBeDefined();
    expect(perf!.content).toContain("1500"); // 3× 500
  });

  it("perf budget has minimum floor of 500ms", () => {
    const fastEntry = makeEntry({ time: 50 }); // 50ms (3× = 150ms < 500 floor)
    const suite = parseHAR(makeHAR([fastEntry]));
    const perf = suite.testFiles.find(f => f.filename.includes("perf-baseline"));
    expect(perf!.content).toContain("500");
  });

  it("generated tests are syntactically valid TypeScript (no template artifacts)", () => {
    const suite = parseHAR(makeHAR([makeEntry()]));
    for (const file of suite.testFiles) {
      // No unresolved template-string artifacts that escaped from generation
      expect(file.content).not.toContain("undefined}");
      // Balanced braces sanity check (template strings legitimately contain ${} so just balance)
      const opens = (file.content.match(/\{/g) || []).length;
      const closes = (file.content.match(/\}/g) || []).length;
      expect(opens).toBe(closes);
    }
  });

  it("produces deterministic output for same input", () => {
    const har = makeHAR([makeEntry(), makeEntry({ time: 200 })]);
    const suite1 = parseHAR(har);
    const suite2 = parseHAR(har);
    expect(suite1.testFiles.map(f => f.content).join("\n"))
      .toBe(suite2.testFiles.map(f => f.content).join("\n"));
  });
});
