import type { Request } from "express";
import { ENV } from "./env";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeOrigin(value: string): string | null {
  try {
    return stripTrailingSlash(new URL(value).origin);
  } catch {
    return null;
  }
}

export function getConfiguredAppUrl(): string {
  return normalizeOrigin(ENV.appBaseUrl) ?? "https://testforge.dev";
}

export function getRequestAppUrl(req?: Pick<Request, "protocol" | "headers" | "get"> | null): string {
  if (!req) return getConfiguredAppUrl();

  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = typeof forwardedHost === "string"
    ? forwardedHost.split(",")[0]?.trim()
    : req.get?.("host");
  const proto = typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0]?.trim()
    : req.protocol;

  if (!host || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host)) {
    return getConfiguredAppUrl();
  }

  return `${proto || "https"}://${host}`;
}

export function buildAnalysisUrl(analysisId: number | string, req?: Pick<Request, "protocol" | "headers" | "get"> | null): string {
  return `${getRequestAppUrl(req)}/analysis/${analysisId}`;
}

