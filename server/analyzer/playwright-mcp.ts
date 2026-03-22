/**
 * TestForge Playwright MCP Integration (S5-3)
 *
 * Closes the feedback loop by actually RUNNING the generated tests
 * via the Playwright MCP server and returning real pass/fail results.
 *
 * Architecture:
 *   TestForge generates tests → MCP executes them → Results flow back
 *   → Feedback Loop (S4-2) stores results → Re-analysis improves tests
 *
 * This is the key differentiator: we don't just generate tests,
 * we execute them and learn from the results.
 */

export interface PlaywrightTestResult {
  proofId: string;
  filename: string;
  passed: boolean;
  durationMs: number;
  errorMessage?: string;
  errorStack?: string;
  actualResponse?: string;
  steps?: Array<{
    title: string;
    passed: boolean;
    durationMs: number;
  }>;
}

export interface PlaywrightRunConfig {
  baseUrl: string;
  authToken?: string;
  timeout?: number; // ms, default 30000
  retries?: number; // default 0
  workers?: number; // default 1 (sequential for API tests)
}

export interface PlaywrightRunResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: PlaywrightTestResult[];
  passRate: number;
}

/**
 * Generate a Playwright config file for the test suite.
 * This config is included in the ZIP download and used by the MCP runner.
 */
export function generatePlaywrightConfig(config: PlaywrightRunConfig): string {
  return `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: ${config.timeout || 30000},
  retries: ${config.retries || 0},
  workers: ${config.workers || 1},
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
  ],
  use: {
    baseURL: '${config.baseUrl}',
    extraHTTPHeaders: {
      ${config.authToken ? `'Authorization': 'Bearer ${config.authToken}',` : ''}
      'Content-Type': 'application/json',
    },
  },
});
`;
}

/**
 * Parse Playwright JSON results into TestForge PlaywrightRunResult format.
 * Playwright JSON output: https://playwright.dev/docs/test-reporters#json-reporter
 */
export function parsePlaywrightResults(jsonOutput: unknown): PlaywrightRunResult {
  const raw = jsonOutput as any;
  const suites = raw?.suites || [];
  const results: PlaywrightTestResult[] = [];

  function processSpec(spec: any) {
    for (const test of spec.tests || []) {
      const result = test.results?.[0];
      if (!result) continue;
      const passed = result.status === "passed";
      results.push({
        proofId: spec.file?.replace(/^tests\//, "").replace(/\.spec\.ts$/, "") || spec.title,
        filename: spec.file || spec.title,
        passed,
        durationMs: result.duration || 0,
        errorMessage: result.error?.message,
        errorStack: result.error?.stack,
        steps: (result.steps || []).map((s: any) => ({
          title: s.title,
          passed: s.error == null,
          durationMs: s.duration || 0,
        })),
      });
    }
    for (const child of spec.suites || []) {
      processSpec(child);
    }
  }

  for (const suite of suites) {
    processSpec(suite);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);

  return {
    total: results.length,
    passed,
    failed,
    skipped: 0,
    durationMs: totalDuration,
    results,
    passRate: results.length > 0 ? Math.round(passed / results.length * 100) : 0,
  };
}

/**
 * Generate a CI/CD workflow that runs tests via Playwright and
 * posts results back to TestForge via the feedback API.
 */
export function generateCIWorkflow(analysisId: number, testforgeUrl: string): string {
  return `# TestForge Auto-Generated CI Workflow
# Generated for Analysis #${analysisId}
# Posts test results back to TestForge Feedback Loop (S4-2)

name: TestForge API Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  testforge-api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run TestForge API tests
        run: npx playwright test --reporter=json > test-results.json || true
        env:
          BASE_URL: \${{ secrets.API_BASE_URL }}
          AUTH_TOKEN: \${{ secrets.API_AUTH_TOKEN }}

      - name: Post results to TestForge
        if: always()
        run: |
          node -e "
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
          const proofResults = [];
          function processSpec(spec) {
            for (const test of spec.tests || []) {
              const r = test.results?.[0];
              if (r) proofResults.push({
                proofId: spec.file?.replace(/^tests\\//, '').replace(/\\.spec\\.ts$/, '') || spec.title,
                passed: r.status === 'passed',
                errorMessage: r.error?.message,
                durationMs: r.duration || 0,
              });
            }
            for (const child of spec.suites || []) processSpec(child);
          }
          for (const s of results.suites || []) processSpec(s);
          fetch('${testforgeUrl}/api/trpc/feedback.submitResults', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': 'session=\${{ secrets.TESTFORGE_SESSION }}' },
            body: JSON.stringify({ json: { analysisId: ${analysisId}, results: proofResults } }),
          }).then(r => r.json()).then(console.log).catch(console.error);
          "
`;
}
