import { describe, expect, it } from "vitest";
import {
  allowedHostGuard,
  fixedWindowRateLimit,
  isSecureRequest,
  requestId,
  requireHttpsInProduction,
} from "./runtime-security";

function mockRes() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    headers,
  };
}

describe("runtime security", () => {
  it("detects HTTPS behind a trusted proxy header", () => {
    expect(isSecureRequest({ protocol: "http", secure: false, headers: { "x-forwarded-proto": "https" } } as any)).toBe(true);
    expect(isSecureRequest({ protocol: "http", secure: false, headers: { "x-forwarded-proto": "http" } } as any)).toBe(false);
  });

  it("rejects unexpected host headers", () => {
    const guard = allowedHostGuard("https://testforge.example", "app.testforge.example");
    const res = mockRes();
    let nextCalled = false;

    guard({ headers: { host: "evil.example" } } as any, res as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(421);
  });

  it("allows configured and local host headers", () => {
    const guard = allowedHostGuard("https://testforge.example");
    const res = mockRes();
    let nextCalled = false;

    guard({ headers: { host: "testforge.example" } } as any, res as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it("requires HTTPS in production except health checks", () => {
    const guard = requireHttpsInProduction(true);
    const res = mockRes();
    let nextCalled = false;

    guard({ path: "/dashboard", protocol: "http", secure: false, headers: {} } as any, res as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(426);

    const healthRes = mockRes();
    guard({ path: "/api/health", protocol: "http", secure: false, headers: {} } as any, healthRes as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("emits a request id and enforces fixed-window limits", () => {
    const idMiddleware = requestId();
    const idRes = mockRes();
    idMiddleware({ headers: {} } as any, idRes as any, () => {});
    expect(idRes.headers.get("X-Request-Id")).toBeTruthy();

    const limiter = fixedWindowRateLimit({ windowMs: 60_000, max: 1 });
    const req = { ip: "203.0.113.10", headers: {} };
    const first = mockRes();
    const second = mockRes();
    let firstNext = false;

    limiter(req as any, first as any, () => {
      firstNext = true;
    });
    limiter(req as any, second as any, () => {});

    expect(firstNext).toBe(true);
    expect(second.statusCode).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });
});
