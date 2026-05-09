import type { RequestHandler } from "express";

const productionDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
];

const developmentDirectives = productionDirectives.map((directive) => {
  if (directive === "script-src 'self'") {
    return "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  }
  if (directive === "connect-src 'self' https: wss:") {
    return "connect-src 'self' https: http: ws: wss:";
  }
  return directive;
});

export function buildContentSecurityPolicy(isProduction: boolean): string {
  return (isProduction ? productionDirectives : developmentDirectives).join("; ");
}

export function securityHeaders(isProduction = process.env.NODE_ENV === "production"): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("Content-Security-Policy", buildContentSecurityPolicy(isProduction));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    next();
  };
}
