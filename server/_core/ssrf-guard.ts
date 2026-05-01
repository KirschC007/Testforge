/**
 * SSRF Guard — validates URLs before making outbound HTTP requests.
 * Blocks private IP ranges, link-local addresses, and cloud metadata services.
 *
 * Use this on ANY user-supplied URL that gets fetched by the server.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "metadata.google.internal", // GCP metadata
  "metadata",                  // Some k8s
]);

const BLOCKED_CIDR_PREFIXES = [
  "10.",       // Private 10.0.0.0/8
  "172.16.",   // Private 172.16.0.0/12 (incomplete check, see isPrivateIPv4)
  "192.168.",  // Private 192.168.0.0/16
  "169.254.",  // Link-local (AWS metadata, Azure metadata)
  "127.",      // Loopback
  "0.",        // 0.0.0.0/8
  "224.",      // Multicast
  "255.",      // Broadcast
];

function isPrivateIPv4(host: string): boolean {
  // Reject anything not a valid IPv4 dotted-quad
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [, a, b, c, d] = m.map(Number);
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;

  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12 (172.16.x.x to 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 224.0.0.0/4 multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 reserved
  if (a >= 240) return true;
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const lower = host.toLowerCase().replace(/^\[|\]$/g, "");
  // ::1 loopback
  if (lower === "::1") return true;
  // fe80::/10 link-local
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  // fc00::/7 unique-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // ::ffff:127.0.0.1 IPv4-mapped loopback
  if (lower.startsWith("::ffff:")) {
    const ipv4 = lower.slice(7);
    return isPrivateIPv4(ipv4);
  }
  return false;
}

export interface SSRFCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a URL is safe to fetch (not pointing at private/internal infrastructure).
 *
 * @param rawUrl  URL string to validate
 * @param options Optional allowlist of hostnames (e.g., ["api.github.com"])
 */
export function checkURL(rawUrl: string, options: { allowedHostnames?: string[] } = {}): SSRFCheckResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }

  // Only allow HTTP/HTTPS
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: `Disallowed protocol: ${url.protocol} (only http/https)` };
  }

  const hostname = url.hostname.toLowerCase();

  // Allowlist check (if provided, must match)
  if (options.allowedHostnames && options.allowedHostnames.length > 0) {
    const allowed = options.allowedHostnames.some(h =>
      hostname === h.toLowerCase() || hostname.endsWith("." + h.toLowerCase())
    );
    if (!allowed) return { allowed: false, reason: `Host not in allowlist: ${hostname}` };
  }

  // Block exact bad hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { allowed: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Block private IPs (IPv4)
  if (isPrivateIPv4(hostname)) {
    return { allowed: false, reason: `Private IPv4 address blocked: ${hostname}` };
  }

  // Block private IPs (IPv6)
  if (isPrivateIPv6(hostname)) {
    return { allowed: false, reason: `Private IPv6 address blocked: ${hostname}` };
  }

  // Block obvious private CIDR prefixes (defense in depth)
  for (const prefix of BLOCKED_CIDR_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return { allowed: false, reason: `Private network range blocked: ${hostname}` };
    }
  }

  // Block file:// implicitly (handled by protocol check above) and require explicit port
  // Reject suspicious ports commonly used for internal services
  const port = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80);
  const BLOCKED_PORTS = new Set([
    22, 23, 25, 110, 143,  // SSH, Telnet, SMTP, POP3, IMAP
    3306, 5432, 6379, 9200, 27017, // MySQL, Postgres, Redis, ES, MongoDB
    9000, 9001, // MinIO admin
    8500, 8501, // Consul
  ]);
  if (BLOCKED_PORTS.has(port)) {
    return { allowed: false, reason: `Blocked port: ${port}` };
  }

  return { allowed: true };
}

/**
 * Wraps fetch() with SSRF protection AND a timeout.
 * Use this for any fetch where the URL comes from user input.
 */
export async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number; allowedHostnames?: string[] } = {},
): Promise<Response> {
  const { timeoutMs = 10000, allowedHostnames, ...fetchInit } = init;

  const check = checkURL(url, { allowedHostnames });
  if (!check.allowed) {
    throw new Error(`SSRF guard rejected URL: ${check.reason}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...fetchInit, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}
