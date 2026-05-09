import { describe, expect, it } from "vitest";
import { buildAnalysisUrl, getConfiguredAppUrl, getRequestAppUrl } from "./app-url";

describe("app-url", () => {
  it("falls back to configured app url for localhost hosts", () => {
    const url = getRequestAppUrl({
      protocol: "http",
      headers: {},
      get: () => "localhost:3000",
    } as any);
    expect(url).toBe(getConfiguredAppUrl());
  });

  it("prefers forwarded host and proto for proxied requests", () => {
    const url = getRequestAppUrl({
      protocol: "http",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
      get: () => "internal:3000",
    } as any);
    expect(url).toBe("https://app.example.com");
  });

  it("builds analysis URLs from request origin", () => {
    const url = buildAnalysisUrl(42, {
      protocol: "https",
      headers: {},
      get: () => "testforge.example.com",
    } as any);
    expect(url).toBe("https://testforge.example.com/analysis/42");
  });
});
