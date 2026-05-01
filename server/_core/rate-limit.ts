/**
 * Simple in-memory rate limiter — token bucket per IP.
 *
 * For multi-instance deployments, replace with Redis-backed limiter.
 * For now (single-instance), in-memory is sufficient.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

interface RateLimiterOptions {
  /** Max requests allowed per window */
  max: number;
  /** Window in milliseconds (e.g., 60000 = 1 minute) */
  windowMs: number;
  /** Optional key function — defaults to req.ip */
  keyFn?: (req: any) => string;
}

export function createRateLimiter(opts: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();
  const refillRate = opts.max / opts.windowMs; // tokens per ms

  // Periodic cleanup so the map doesn't grow unbounded.
  // Buckets idle for >2× window are evicted.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of Array.from(buckets.entries())) {
      if (now - bucket.lastRefillMs > opts.windowMs * 2) {
        buckets.delete(key);
      }
    }
  }, opts.windowMs);
  // Allow process to exit even if cleanup interval is active (e.g., during tests)
  if (cleanup.unref) cleanup.unref();

  return function rateLimitMiddleware(req: any, res: any, next: any) {
    const key = opts.keyFn
      ? opts.keyFn(req)
      // X-Forwarded-For first (behind nginx), then req.ip
      : (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.ip || "unknown");

    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: opts.max, lastRefillMs: now };
      buckets.set(key, bucket);
    } else {
      // Refill tokens based on time elapsed
      const elapsed = now - bucket.lastRefillMs;
      bucket.tokens = Math.min(opts.max, bucket.tokens + elapsed * refillRate);
      bucket.lastRefillMs = now;
    }

    if (bucket.tokens < 1) {
      const retryAfterSec = Math.ceil((1 - bucket.tokens) / refillRate / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(opts.max));
      res.setHeader("X-RateLimit-Remaining", "0");
      return res.status(429).json({
        error: `Rate limit exceeded — ${opts.max} requests per ${Math.round(opts.windowMs / 1000)}s. Retry in ${retryAfterSec}s.`,
      });
    }

    bucket.tokens -= 1;
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.floor(bucket.tokens)));
    next();
  };
}
