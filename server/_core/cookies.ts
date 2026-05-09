import type { CookieOptions, Request } from "express";
import { ENV } from "./env";
import { isSecureRequest } from "./runtime-security";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const crossSiteCookies = process.env.CROSS_SITE_COOKIES === "1";
  const secure = ENV.isProduction || isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    sameSite: crossSiteCookies ? "none" : "lax",
    secure,
  };
}
