import { describe, expect, it } from "vitest";
import { assertProductionEnv } from "./env";

const baseEnv = {
  appId: "testforge-prod",
  appBaseUrl: "https://testforge.example",
  cookieSecret: "x".repeat(48),
  databaseUrl: "mysql://testforge:testforge@db:3306/testforge",
  oAuthServerUrl: "https://auth.example",
  ownerOpenId: "",
  isProduction: true,
  forgeApiUrl: "https://forge.example",
  forgeApiKey: `sk-live-${"x".repeat(32)}`,
  authMode: "oauth",
};

describe("production env validation", () => {
  it("accepts a hardened production configuration", () => {
    expect(() => assertProductionEnv(baseEnv)).not.toThrow();
  });

  it("rejects placeholder secrets", () => {
    expect(() =>
      assertProductionEnv({
        ...baseEnv,
        cookieSecret: "changeme_jwt_secret_min_32_chars_long",
      })
    ).toThrow(/JWT_SECRET/);
  });

  it("rejects placeholder LLM keys", () => {
    expect(() =>
      assertProductionEnv({
        ...baseEnv,
        forgeApiKey: "sk-...",
      })
    ).toThrow(/BUILT_IN_FORGE_API_KEY/);
  });

  it("requires HTTPS production URLs", () => {
    expect(() =>
      assertProductionEnv({
        ...baseEnv,
        appBaseUrl: "http://testforge.example",
      })
    ).toThrow(/APP_BASE_URL/);
  });

  it("allows explicit local auth mode without OAuth server", () => {
    expect(() =>
      assertProductionEnv({
        ...baseEnv,
        authMode: "local",
        oAuthServerUrl: "",
      })
    ).not.toThrow();
  });
});
