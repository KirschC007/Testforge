import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(value: string | undefined): string {
  if (!value) return "";
  const host = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (host.startsWith("[")) return host.slice(1, host.indexOf("]"));
  return host.split(":")[0] ?? host;
}

export function isSecureRequest(req: Request) {
  if (req.secure || req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwardedProto) ? forwardedProto : String(forwardedProto ?? "").split(",");
  return values.some((proto) => proto.trim().toLowerCase() === "https");
}

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && incoming.length <= 128 ? incoming : crypto.randomUUID();
    (req as any).requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  };
}

export function allowedHostGuard(appBaseUrl: string, extraHosts = process.env.TRUSTED_HOSTS): RequestHandler {
  const allowed = new Set<string>(splitCsv(extraHosts));
  try {
    allowed.add(new URL(appBaseUrl).hostname.toLowerCase());
  } catch {
    // Production env validation catches this before serving traffic.
  }
  Array.from(LOCAL_HOSTS).forEach((host) => allowed.add(host));

  return (req, res, next) => {
    const host = normalizeHost(req.headers.host);
    if (!host || allowed.has(host)) return next();
    res.status(421).json({ error: "Misdirected request" });
  };
}

export function requireHttpsInProduction(isProduction = process.env.NODE_ENV === "production"): RequestHandler {
  return (req, res, next) => {
    if (!isProduction || process.env.DISABLE_HTTPS_REDIRECT === "1" || isSecureRequest(req)) return next();
    if (req.path === "/api/health" || req.path === "/api/ready") return next();
    res.status(426).json({ error: "HTTPS is required" });
  };
}

export function fixedWindowRateLimit(options: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { resetAt: number; count: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || normalizeHost(req.headers["x-forwarded-for"] as string | undefined) || "unknown";
    const key = `${options.keyPrefix ?? "rl"}:${ip}`;
    const current = hits.get(key);
    const bucket = current && current.resetAt > now ? current : { resetAt: now + options.windowMs, count: 0 };
    bucket.count += 1;
    hits.set(key, bucket);

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: options.message ?? "Too many requests" });
      return;
    }

    if (hits.size > 10_000) {
      for (const [storedKey, value] of Array.from(hits.entries())) {
        if (value.resetAt <= now) hits.delete(storedKey);
      }
    }

    next();
  };
}
