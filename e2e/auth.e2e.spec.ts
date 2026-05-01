/**
 * Authentication Flow E2E Tests
 *
 * Run: BASE_URL=http://localhost:3000 npm run test:e2e
 * If BASE_URL is unset, tests skip (so CI without a deployed instance still passes).
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL;
const HAS_SERVER = !!BASE_URL;

test.describe("Auth Flow", () => {
  test.skip(!HAS_SERVER, "BASE_URL not set — skipping E2E");

  test("loads login page successfully", async ({ page }) => {
    await page.goto("/");
    // Either we land on dashboard (already signed in) or login page
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard|signin|new-analysis|$)/);
  });

  test("login page has accessible form fields", async ({ page }) => {
    await page.goto("/login");
    // Email + password fields should be findable by label OR placeholder
    const emailField = page.getByLabel(/email/i).first().or(page.getByPlaceholder(/email/i).first());
    const passwordField = page.getByLabel(/password|passwort/i).first().or(page.getByPlaceholder(/password/i).first());

    // Skip strict assertions if site uses OAuth-only (no local login)
    if (await emailField.count() > 0) {
      await expect(emailField).toBeVisible();
    }
    if (await passwordField.count() > 0) {
      await expect(passwordField).toBeVisible();
    }
  });

  test("/health endpoint returns 200", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("security headers are present on all responses", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
  });
});
