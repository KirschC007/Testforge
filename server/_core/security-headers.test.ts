import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("builds a strict production CSP for static assets", () => {
    const csp = buildContentSecurityPolicy(true);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows Vite development transports without weakening production", () => {
    const csp = buildContentSecurityPolicy(false);

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https: http: ws: wss:");
  });

  it("sets enterprise-grade browser hardening headers", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    };
    let nextCalled = false;

    securityHeaders(true)({} as any, res as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });
});
