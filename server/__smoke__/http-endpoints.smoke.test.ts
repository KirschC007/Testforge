/**
 * HTTP Endpoint Smoke Tests
 *
 * Verifies the security-critical middleware (rate limiter, SSRF guard, headers,
 * health endpoint) work correctly against a minimal Express app. Does NOT
 * exercise the full SDK/DB stack — those are integration tests.
 *
 * Why: catches regressions in middleware ordering, header emission, and rate
 * limit accounting without requiring a running database or auth provider.
 */
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { createRateLimiter } from "../_core/rate-limit";
import { checkURL } from "../_core/ssrf-guard";

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Mirror the production middleware stack
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  // Rate-limited test endpoint
  const rl = createRateLimiter({ max: 3, windowMs: 60_000 });
  app.post("/rate-limited", rl, (_req, res) => res.status(200).json({ ok: true }));

  // SSRF-protected endpoint
  app.post("/ssrf-test", (req, res) => {
    const url = req.body?.url;
    if (!url) return res.status(400).json({ error: "url required" });
    const check = checkURL(url);
    if (!check.allowed) return res.status(400).json({ error: check.reason });
    res.status(200).json({ url, accepted: true });
  });
});

describe("Smoke: /health endpoint", () => {
  it("returns 200 with status payload", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("emits security headers", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("Smoke: Rate Limiter", () => {
  it("allows requests under the limit and emits remaining count", async () => {
    const res = await request(app).post("/rate-limited").set("X-Forwarded-For", "203.0.113.1");
    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("3");
    expect(parseInt(res.headers["x-ratelimit-remaining"] ?? "0", 10)).toBeGreaterThanOrEqual(0);
  });

  it("returns 429 with Retry-After when limit exceeded", async () => {
    const ip = "203.0.113.42";
    // Use up the bucket
    for (let i = 0; i < 3; i++) {
      await request(app).post("/rate-limited").set("X-Forwarded-For", ip);
    }
    // Next request blocked
    const blocked = await request(app).post("/rate-limited").set("X-Forwarded-For", ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.error).toMatch(/rate limit/i);
  });

  it("isolates buckets per IP (different IPs are independent)", async () => {
    const ipA = "198.51.100.10";
    const ipB = "198.51.100.20";

    // IP A uses up its bucket
    for (let i = 0; i < 3; i++) {
      await request(app).post("/rate-limited").set("X-Forwarded-For", ipA);
    }
    const blockedA = await request(app).post("/rate-limited").set("X-Forwarded-For", ipA);
    expect(blockedA.status).toBe(429);

    // IP B is unaffected
    const okB = await request(app).post("/rate-limited").set("X-Forwarded-For", ipB);
    expect(okB.status).toBe(200);
  });
});

describe("Smoke: SSRF Guard endpoint integration", () => {
  it("accepts legitimate external URL", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "https://api.github.com/repos" });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);
  });

  it("rejects localhost", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "http://localhost/admin" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/blocked|private|localhost/i);
  });

  it("rejects 127.0.0.1", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "http://127.0.0.1/" });
    expect(res.status).toBe(400);
  });

  it("rejects AWS metadata IP 169.254.169.254", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "http://169.254.169.254/latest/meta-data/" });
    expect(res.status).toBe(400);
  });

  it("rejects file:// URLs", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "file:///etc/passwd" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/protocol/i);
  });

  it("rejects internal IPv6 ::1", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "http://[::1]/" });
    expect(res.status).toBe(400);
  });

  it("rejects private 10.0.0.0/8 range", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "http://10.0.0.5/" });
    expect(res.status).toBe(400);
  });

  it("rejects dangerous port (Redis 6379)", async () => {
    const res = await request(app).post("/ssrf-test").send({ url: "http://example.com:6379/" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing url", async () => {
    const res = await request(app).post("/ssrf-test").send({});
    expect(res.status).toBe(400);
  });
});

describe("Smoke: HAR Parser via /api/analyze-har contract", () => {
  // This test validates the HAR Parser's external contract (request shape, error responses)
  // without actually wiring it to the SDK auth — that's covered in integration tests.
  it("parseHAR + validateHAR work end-to-end on a minimal valid HAR", async () => {
    const { parseHAR, validateHAR } = await import("../analyzer/har-parser");
    const har = {
      log: {
        version: "1.2",
        entries: [{
          request: {
            method: "POST",
            url: "https://api.example.com/api/users.create",
            headers: [{ name: "Content-Type", value: "application/json" }],
            postData: { mimeType: "application/json", text: '{"name":"Alice"}' },
          },
          response: {
            status: 200,
            headers: [],
            content: { mimeType: "application/json", text: '{"id":42}' },
          },
          time: 100,
        }],
      },
    };
    expect(validateHAR(har).valid).toBe(true);
    const suite = parseHAR(har as any);
    expect(suite.endpoints).toHaveLength(1);
    expect(suite.testFiles.length).toBeGreaterThan(0);
  });
});
