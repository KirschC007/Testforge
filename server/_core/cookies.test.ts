import { afterEach, describe, expect, it, vi } from "vitest";

describe("session cookies", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.CROSS_SITE_COOKIES;
  });

  it("uses same-site lax cookies by default", async () => {
    const { getSessionCookieOptions } = await import("./cookies");

    const options = getSessionCookieOptions({
      protocol: "https",
      secure: true,
      headers: {},
    } as any);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.secure).toBe(true);
  });

  it("allows explicit cross-site cookies only with SameSite=None", async () => {
    process.env.CROSS_SITE_COOKIES = "1";
    const { getSessionCookieOptions } = await import("./cookies");

    const options = getSessionCookieOptions({
      protocol: "https",
      secure: true,
      headers: {},
    } as any);

    expect(options.sameSite).toBe("none");
    expect(options.secure).toBe(true);
  });
});
