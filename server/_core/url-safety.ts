import net from "node:net";

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
}

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isUnsafeIPv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd");
}

export function assessPublicHttpUrl(rawUrl: string): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { safe: false, reason: "Only http and https URLs are allowed" };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return { safe: false, reason: "Missing hostname" };
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return { safe: false, reason: "Local hostnames are not allowed" };
  }
  if (hostname === "metadata.google.internal" || hostname === "169.254.169.254") {
    return { safe: false, reason: "Cloud metadata endpoints are not allowed" };
  }

  const ipHostname = hostname.replace(/^\[|\]$/g, "");
  const ipVersion = net.isIP(ipHostname);
  if (ipVersion === 4 && isPrivateIPv4(hostname)) {
    return { safe: false, reason: "Private IPv4 addresses are not allowed" };
  }
  if (ipVersion === 6 && isUnsafeIPv6(ipHostname)) {
    return { safe: false, reason: "Private IPv6 addresses are not allowed" };
  }

  return { safe: true };
}

export function assertPublicHttpUrl(rawUrl: string, label = "URL"): void {
  const result = assessPublicHttpUrl(rawUrl);
  if (!result.safe) {
    throw new Error(`${label} is not allowed: ${result.reason}`);
  }
}
