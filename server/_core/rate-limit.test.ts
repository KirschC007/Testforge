/**
 * Rate Limiter — Unit Tests
 *
 * Verifies the token bucket logic correctly throttles per-IP request rates,
 * refills tokens over time, and emits proper HTTP 429 responses with Retry-After.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRateLimiter } from "./rate-limit";

function makeReq(ip = "192.0.2.1", forwardedFor?: string) {
  return {
    ip,
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
  };
}

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    setHeader(key: string, value: string) { headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(_body: unknown) { return this; },
  };
}

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
    const req = makeReq();
    const next = vi.fn();

    for (let i = 0; i < 5; i++) {
      const res = makeRes();
      limiter(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
  });

  it("rejects requests exceeding the limit with 429", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
    const req = makeReq();

    // Exhaust the bucket
    for (let i = 0; i < 3; i++) {
      limiter(req, makeRes(), vi.fn());
    }

    // Next request should be rejected
    const res = makeRes();
    const next = vi.fn();
    limiter(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets Retry-After header on 429", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const req = makeReq();

    // Use up the only token
    limiter(req, makeRes(), vi.fn());

    // Next is rejected
    const res = makeRes();
    limiter(req, res, vi.fn());

    expect(res.headers["Retry-After"]).toBeDefined();
    expect(parseInt(res.headers["Retry-After"], 10)).toBeGreaterThan(0);
  });

  it("sets X-RateLimit-Limit and X-RateLimit-Remaining headers", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
    const req = makeReq();

    const res = makeRes();
    limiter(req, res, vi.fn());

    expect(res.headers["X-RateLimit-Limit"]).toBe("5");
    expect(res.headers["X-RateLimit-Remaining"]).toBe("4");
  });

  it("tracks separate buckets per IP", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });

    // IP 1 exhausts its bucket
    limiter(makeReq("1.1.1.1"), makeRes(), vi.fn());
    limiter(makeReq("1.1.1.1"), makeRes(), vi.fn());

    // IP 1 is now blocked
    const res1 = makeRes();
    limiter(makeReq("1.1.1.1"), res1, vi.fn());
    expect(res1.statusCode).toBe(429);

    // IP 2 is unaffected
    const res2 = makeRes();
    const next2 = vi.fn();
    limiter(makeReq("2.2.2.2"), res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(res2.statusCode).toBe(200);
  });

  it("uses x-forwarded-for header when present (behind proxy)", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const realIp = "10.0.0.5"; // proxy IP
    const clientIp = "203.0.113.42"; // real client behind proxy

    // Client A first request — uses XFF, not req.ip
    limiter(makeReq(realIp, clientIp), makeRes(), vi.fn());

    // Different XFF should NOT be blocked (different bucket)
    const res = makeRes();
    const next = vi.fn();
    limiter(makeReq(realIp, "198.51.100.1"), res, next);
    expect(next).toHaveBeenCalled();

    // Same XFF SHOULD be blocked
    const res2 = makeRes();
    limiter(makeReq(realIp, clientIp), res2, vi.fn());
    expect(res2.statusCode).toBe(429);
  });

  it("handles comma-separated x-forwarded-for (uses first IP)", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });

    // Client → CDN → LB → us
    limiter(makeReq("10.0.0.1", "203.0.113.42, 10.0.0.99, 10.0.0.50"), makeRes(), vi.fn());

    // Same first IP, different downstream proxies → still blocked
    const res = makeRes();
    limiter(makeReq("10.0.0.1", "203.0.113.42, 192.168.1.1"), res, vi.fn());
    expect(res.statusCode).toBe(429);
  });

  it("refills tokens over time", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ max: 10, windowMs: 1000 }); // 10 tokens per second
    const req = makeReq();

    // Exhaust
    for (let i = 0; i < 10; i++) limiter(req, makeRes(), vi.fn());

    // 500ms passes → should have ~5 tokens back
    vi.advanceTimersByTime(500);

    let allowed = 0;
    for (let i = 0; i < 6; i++) {
      const next = vi.fn();
      limiter(req, makeRes(), next);
      if (next.mock.calls.length > 0) allowed++;
    }

    expect(allowed).toBeGreaterThanOrEqual(4);
    expect(allowed).toBeLessThanOrEqual(6);
    vi.useRealTimers();
  });

  it("uses custom keyFn when provided", () => {
    const limiter = createRateLimiter({
      max: 1,
      windowMs: 60_000,
      keyFn: (req: any) => req.userId, // Per-user, not per-IP
    });

    // Same IP, different users — independent buckets
    limiter({ ip: "1.1.1.1", userId: "alice", headers: {} }, makeRes(), vi.fn());

    const res = makeRes();
    const next = vi.fn();
    limiter({ ip: "1.1.1.1", userId: "bob", headers: {} }, res, next);
    expect(next).toHaveBeenCalled();

    // Same user, different IP — same bucket
    const res2 = makeRes();
    limiter({ ip: "2.2.2.2", userId: "alice", headers: {} }, res2, vi.fn());
    expect(res2.statusCode).toBe(429);
  });

  it("falls back to 'unknown' when no IP is present", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const req = { ip: undefined, headers: {} };

    limiter(req as any, makeRes(), vi.fn());
    const res = makeRes();
    limiter(req as any, res, vi.fn());
    expect(res.statusCode).toBe(429);
  });

  it("returns descriptive 429 message with retry time", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const req = makeReq();
    limiter(req, makeRes(), vi.fn());

    const res = makeRes();
    let body: any = null;
    res.json = (b: unknown) => { body = b; return res as any; };
    limiter(req, res, vi.fn());

    expect(body).toBeDefined();
    expect(body.error).toMatch(/rate limit/i);
    expect(body.error).toMatch(/\d+/); // contains numbers
  });
});
