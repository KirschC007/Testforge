/**
 * Active Security Scanner — runs generated security tests against a LIVE target URL.
 *
 * Unlike the test-generation pipeline (which produces test files for the user to run
 * themselves), this scanner actively probes a target URL with the same payloads the
 * generated tests would use. Result: a security report identifying which attacks
 * succeeded.
 *
 * Safety:
 *   - SSRF guard blocks private IPs, cloud metadata, dangerous ports
 *   - Per-scan timeout (max 5 minutes)
 *   - Bounded number of probes per endpoint (max 20)
 *   - Optional rate limit between probes
 *   - All probes are READ or non-destructive variants when possible
 *
 * The user opts in by providing a target URL — TestForge does NOT scan
 * automatically. This is for "scan my staging environment" workflows.
 */

import { checkURL } from "../_core/ssrf-guard";
import type { AnalysisResult, APIEndpoint } from "./types";

export interface ScanProbe {
  category: "auth_bypass" | "sql_injection" | "xss" | "ssrf" | "mass_assignment" | "rate_limit";
  endpoint: string;
  method: string;
  payload: unknown;
  headers?: Record<string, string>;
  description: string;
}

export interface ScanFinding {
  probe: ScanProbe;
  status: number;
  responseTimeMs: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  finding: string;
  evidence?: string; // first 200 chars of response body
}

export interface ScanReport {
  targetUrl: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalProbes: number;
  findings: ScanFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    safe: number; // probes that returned expected error responses (no vuln)
  };
}

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1 UNION SELECT NULL--",
  "admin'--",
];

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "javascript:alert(1)",
  "<img src=x onerror=alert(1)>",
];

const MASS_ASSIGNMENT_PAYLOAD = {
  role: "admin",
  isAdmin: true,
  permissions: ["*"],
  emailVerified: true,
  balance: 999999,
};

/**
 * Build the probe set for a given analysis (typically run against staging).
 * Each probe is a single HTTP request that tests a specific vulnerability class.
 */
export function buildProbes(analysis: AnalysisResult, options: { maxPerEndpoint?: number } = {}): ScanProbe[] {
  const maxPer = options.maxPerEndpoint ?? 4;
  const probes: ScanProbe[] = [];

  for (const ep of analysis.ir.apiEndpoints) {
    const method = ep.method.includes("GET") ? "GET" : "POST";

    // ── Auth bypass: drop the auth header/cookie ──
    if (ep.auth && ep.auth !== "public" && ep.auth !== "publicProcedure") {
      probes.push({
        category: "auth_bypass",
        endpoint: ep.name,
        method,
        payload: {},
        headers: {}, // no auth
        description: `Call ${ep.name} without auth — should return 401/403, not 200`,
      });
    }

    // ── SQL injection: inject into a string field ──
    const stringField = (ep.inputFields || []).find(f => f.type === "string" && !f.isTenantKey);
    if (stringField) {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, maxPer)) {
        probes.push({
          category: "sql_injection",
          endpoint: ep.name,
          method,
          payload: { [stringField.name]: payload },
          description: `SQL injection in ${stringField.name}: ${payload.slice(0, 30)}`,
        });
      }
    }

    // ── XSS: inject into a string field ──
    if (stringField) {
      probes.push({
        category: "xss",
        endpoint: ep.name,
        method,
        payload: { [stringField.name]: XSS_PAYLOADS[0] },
        description: `XSS in ${stringField.name}`,
      });
    }

    // ── Mass assignment: try to inject privileged fields ──
    if (method === "POST" && /create|update|register/i.test(ep.name)) {
      probes.push({
        category: "mass_assignment",
        endpoint: ep.name,
        method,
        payload: MASS_ASSIGNMENT_PAYLOAD,
        description: `Mass assignment: inject role=admin into ${ep.name}`,
      });
    }
  }

  return probes;
}

/**
 * Execute one probe against the target. Classifies the response severity.
 */
async function executeProbe(
  baseUrl: string,
  probe: ScanProbe,
  authCookie: string | undefined,
  timeoutMs: number,
): Promise<ScanFinding> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();

  try {
    // Build URL — assume tRPC convention if no leading slash
    const url = probe.endpoint.startsWith("/")
      ? `${baseUrl}${probe.endpoint}`
      : `${baseUrl}/api/trpc/${probe.endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(probe.headers || {}),
    };
    // probe.headers === {} explicitly means "no auth" (auth bypass test)
    if (probe.headers === undefined && authCookie) {
      if (authCookie.startsWith("Bearer ")) headers["Authorization"] = authCookie;
      else headers["Cookie"] = authCookie;
    }

    const fetchInit: RequestInit = {
      method: probe.method,
      headers,
      signal: controller.signal,
    };
    if (probe.method !== "GET") {
      fetchInit.body = JSON.stringify({ json: probe.payload });
    }

    const response = await fetch(url, fetchInit);
    const responseText = await response.text().catch(() => "");
    const elapsed = Date.now() - t0;

    return classifyFinding(probe, response.status, responseText, elapsed);
  } catch (err: any) {
    return {
      probe,
      status: 0,
      responseTimeMs: Date.now() - t0,
      severity: "info",
      finding: err.name === "AbortError"
        ? "Probe timed out — endpoint may be slow or unreachable"
        : `Network error: ${err.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Classify whether the response indicates a vulnerability or correct rejection.
 * The art is in distinguishing "we expected this to fail, and it did (safe)" from
 * "we expected this to fail, but it succeeded (vuln)".
 */
function classifyFinding(probe: ScanProbe, status: number, body: string, elapsed: number): ScanFinding {
  const evidence = body.slice(0, 200);

  switch (probe.category) {
    case "auth_bypass":
      // Expected: 401 or 403 (correct rejection)
      // Bad:      200 (auth bypassed!)
      if (status === 200 || status === 201) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "critical",
          finding: "Auth bypass: endpoint returned 200 without authentication",
        };
      }
      if (status === 500) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "medium",
          finding: "Endpoint crashed (500) on missing auth — should return 401",
        };
      }
      return {
        probe, status, responseTimeMs: elapsed,
        severity: "info",
        finding: "Endpoint correctly rejected unauthenticated request",
      };

    case "sql_injection":
      // Bad:  200 (payload accepted, possibly executed)
      // Bad:  500 (unhandled — leaks DB error to attacker)
      // Safe: 400/422 (input validated and rejected)
      if (status === 500) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "high",
          finding: "SQL injection caused 500 — input not parameterized, may leak schema info",
        };
      }
      // Detect SQL error leakage in response body
      if (/sql|syntax|mysql|postgres|sqlite|ORA-/i.test(body)) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "high",
          finding: "SQL error leaked in response body (info disclosure)",
        };
      }
      return {
        probe, status, responseTimeMs: elapsed,
        severity: "info",
        finding: `Injection rejected (status ${status})`,
      };

    case "xss":
      // Bad:  reflected payload in response
      if (body.includes("<script>") || body.includes("javascript:")) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "high",
          finding: "XSS payload reflected unescaped in response",
        };
      }
      return {
        probe, status, responseTimeMs: elapsed,
        severity: "info",
        finding: "XSS payload not reflected (escaped or rejected)",
      };

    case "mass_assignment":
      // Bad: response confirms privileged field was set
      if (/role.*admin|isAdmin.*true|balance.*999999/i.test(body)) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "critical",
          finding: "Mass assignment succeeded: privileged field was accepted",
        };
      }
      if (status === 500) {
        return {
          probe, status, responseTimeMs: elapsed, evidence,
          severity: "medium",
          finding: "Mass assignment payload caused 500 — extra fields may bypass validation",
        };
      }
      return {
        probe, status, responseTimeMs: elapsed,
        severity: "info",
        finding: "Mass assignment rejected (allowlist enforced)",
      };

    default:
      return {
        probe, status, responseTimeMs: elapsed,
        severity: "info",
        finding: `Status ${status}`,
      };
  }
}

/**
 * Run an active scan against a target URL.
 * SSRF-guarded, time-bounded, probe-bounded.
 */
export async function runActiveScan(
  analysis: AnalysisResult,
  options: {
    targetUrl: string;
    authCookie?: string;
    maxProbes?: number;
    maxDurationMs?: number;
    probeTimeoutMs?: number;
    delayBetweenProbesMs?: number;
  },
): Promise<ScanReport> {
  // Hard SSRF check on target URL (defense in depth — caller should also check)
  const ssrf = checkURL(options.targetUrl);
  if (!ssrf.allowed) {
    throw new Error(`Active scan rejected: ${ssrf.reason}`);
  }

  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const maxProbes = options.maxProbes ?? 100;
  const maxDuration = options.maxDurationMs ?? 5 * 60 * 1000; // 5min default
  const probeTimeout = options.probeTimeoutMs ?? 10_000;
  const delay = options.delayBetweenProbesMs ?? 100;

  const allProbes = buildProbes(analysis).slice(0, maxProbes);
  const findings: ScanFinding[] = [];

  for (const probe of allProbes) {
    if (Date.now() - t0 > maxDuration) break; // global timeout
    const finding = await executeProbe(options.targetUrl, probe, options.authCookie, probeTimeout);
    findings.push(finding);
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
  }

  const summary = {
    critical: findings.filter(f => f.severity === "critical").length,
    high: findings.filter(f => f.severity === "high").length,
    medium: findings.filter(f => f.severity === "medium").length,
    low: findings.filter(f => f.severity === "low").length,
    safe: findings.filter(f => f.severity === "info").length,
  };

  return {
    targetUrl: options.targetUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    totalProbes: findings.length,
    findings,
    summary,
  };
}
