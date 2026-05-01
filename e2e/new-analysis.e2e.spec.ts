/**
 * NewAnalysis Page E2E Tests
 *
 * Verifies the 3-mode input picker (Spec, Code, HAR) and the basic flows.
 * These tests need an authenticated session.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL;
const E2E_USER = process.env.E2E_USER;
const E2E_PASS = process.env.E2E_PASS;
const HAS_AUTH = !!(BASE_URL && E2E_USER && E2E_PASS);

test.describe("NewAnalysis page", () => {
  test.skip(!HAS_AUTH, "BASE_URL/E2E_USER/E2E_PASS not set — skipping E2E");

  test.beforeEach(async ({ page }) => {
    // Best-effort login flow — adapt selectors to your actual login page
    await page.goto("/login");
    const emailField = page.getByLabel(/email/i).first();
    if (await emailField.count() > 0 && E2E_USER && E2E_PASS) {
      await emailField.fill(E2E_USER);
      await page.getByLabel(/password|passwort/i).first().fill(E2E_PASS);
      await page.getByRole("button", { name: /login|sign in|anmelden/i }).first().click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });

  test("shows 3 input mode cards: Spec, Code, HAR", async ({ page }) => {
    await page.goto("/new-analysis");
    await expect(page.getByText(/I have a Spec/i)).toBeVisible();
    await expect(page.getByText(/I have Code/i)).toBeVisible();
    await expect(page.getByText(/I have Traffic/i)).toBeVisible();
  });

  test("clicking HAR card opens the HAR upload form", async ({ page }) => {
    await page.goto("/new-analysis");
    await page.getByText(/I have Traffic/i).click();
    await expect(page.getByText(/HAR file/i)).toBeVisible();
    await expect(page.getByText(/Generate Tests from HAR/i)).toBeVisible();
  });

  test("HAR form back button returns to mode picker", async ({ page }) => {
    await page.goto("/new-analysis");
    await page.getByText(/I have Traffic/i).click();
    // Back to picker (the ArrowLeft button)
    await page.locator("button").filter({ has: page.locator("svg") }).first().click();
    await expect(page.getByText(/I have a Spec/i)).toBeVisible();
  });

  test("clicking Spec card opens the spec input form", async ({ page }) => {
    await page.goto("/new-analysis");
    await page.getByText(/I have a Spec/i).click();
    await expect(page.getByText(/Spec-based Analysis/i)).toBeVisible();
  });

  test("clicking Code card opens the code scan form", async ({ page }) => {
    await page.goto("/new-analysis");
    await page.getByText(/I have Code/i).click();
    // Either GitHub URL field or ZIP upload should be visible
    const hasGithubInput = await page.getByPlaceholder(/github\.com/i).count();
    const hasZipUpload = await page.getByText(/zip/i).count();
    expect(hasGithubInput + hasZipUpload).toBeGreaterThan(0);
  });
});

test.describe("HAR API endpoint smoke", () => {
  test.skip(!BASE_URL, "BASE_URL not set");

  test("POST /api/analyze-har without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/analyze-har", {
      multipart: {
        file: { name: "test.har", mimeType: "application/json", buffer: Buffer.from("{}") },
      },
    });
    // Either 401 (unauthorized) or 422 (invalid HAR) is acceptable
    // The IMPORTANT thing is that it doesn't return 200 / 500 to anonymous callers
    expect([401, 403, 422]).toContain(res.status());
  });

  test("POST /api/upload-spec without auth still returns rate-limit headers", async ({ request }) => {
    const res = await request.post("/api/upload-spec");
    // Should hit the rate limit middleware which sets X-RateLimit-* headers
    expect(res.headers()["x-ratelimit-limit"]).toBeDefined();
  });
});
