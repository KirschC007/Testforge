import { describe, it, expect } from "vitest";
import { normalizeOutputContent, normalizeOutputFiles, normalizeOutputConfigs } from "./analyzer/output-normalizer";

describe("normalizeOutputContent — Ebene 5 post-processing", () => {
  it('strips trpc. prefix inside string literals', () => {
    const input = `trpcQuery("trpc.applications.list", cookie, {})`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcQuery("applications.list", cookie, {})`);
    expect(output).not.toContain("trpc.");
  });

  it('strips api. prefix inside string literals', () => {
    const input = `trpcQuery("api.users.create", cookie, payload)`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcQuery("users.create", cookie, payload)`);
    expect(output).not.toContain('"api.');
  });

  it('strips v1. prefix inside string literals', () => {
    const input = `trpcQuery("v1.loans.approve", cookie, {})`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcQuery("loans.approve", cookie, {})`);
    expect(output).not.toContain('"v1.');
  });

  it('strips v2. prefix inside string literals', () => {
    const input = `trpcMutation("v2.payments.process", cookie, payload)`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcMutation("payments.process", cookie, payload)`);
  });

  it('fixes .s.getById → .getById', () => {
    const input = `const res = await trpcQuery("applications.s.getById", cookie, { id: 1 });`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`const res = await trpcQuery("applications.getById", cookie, { id: 1 });`);
    expect(output).not.toContain(".s.getById");
  });

  it('fixes .s.list → .list', () => {
    const input = `trpcQuery("loans.s.list", cookie, {})`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcQuery("loans.list", cookie, {})`);
  });

  it('fixes .s.create → .create', () => {
    const input = `trpcMutation("appointments.s.create", cookie, payload)`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcMutation("appointments.create", cookie, payload)`);
  });

  it('fixes .s.update → .update', () => {
    const input = `trpcMutation("devices.s.update", cookie, payload)`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcMutation("devices.update", cookie, payload)`);
  });

  it('fixes .s.delete → .delete', () => {
    const input = `trpcMutation("records.s.delete", cookie, { id: 5 })`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcMutation("records.delete", cookie, { id: 5 })`);
  });

  it('fixes generic .s.ACTION pattern', () => {
    const input = `trpcMutation("orders.s.cancel", cookie, { id: 3 })`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcMutation("orders.cancel", cookie, { id: 3 })`);
  });

  it('fixes double-dot resource..action', () => {
    const input = `trpcQuery("applications..list", cookie, {})`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(`trpcQuery("applications.list", cookie, {})`);
  });

  it('does not modify already-correct endpoint names', () => {
    const input = `trpcQuery("applications.list", cookie, {})\ntrpcMutation("loans.create", cookie, payload)`;
    const output = normalizeOutputContent(input);
    expect(output).toBe(input);
  });

  it('handles multiple occurrences in one file', () => {
    const input = [
      `trpcQuery("trpc.applications.list", cookie, {})`,
      `trpcMutation("trpc.loans.create", cookie, payload)`,
      `trpcQuery("trpc.users.getById", cookie, { id: 1 })`,
    ].join("\n");
    const output = normalizeOutputContent(input);
    expect(output).not.toContain("trpc.");
    expect(output).toContain('"applications.list"');
    expect(output).toContain('"loans.create"');
    expect(output).toContain('"users.getById"');
  });

  it('does not strip trpc from non-string contexts (comments, variable names)', () => {
    // Variable names and comments should NOT be affected
    const input = `// trpc.applications is the router\nconst trpcClient = createTRPCClient();\ntrpcQuery("applications.list", cookie, {})`;
    const output = normalizeOutputContent(input);
    // The comment and variable name should be unchanged
    expect(output).toContain("// trpc.applications is the router");
    expect(output).toContain("const trpcClient = createTRPCClient()");
    // The string literal should be unchanged (already correct)
    expect(output).toContain('"applications.list"');
  });
});

describe("normalizeOutputFiles", () => {
  it('normalizes content in all files', () => {
    const files = [
      { filename: "tests/security/idor.spec.ts", content: `trpcQuery("trpc.users.list", cookie, {})` },
      { filename: "tests/integration/flows.spec.ts", content: `trpcMutation("trpc.orders.create", cookie, payload)` },
    ];
    const result = normalizeOutputFiles(files);
    expect(result[0].content).toBe(`trpcQuery("users.list", cookie, {})`);
    expect(result[1].content).toBe(`trpcMutation("orders.create", cookie, payload)`);
  });

  it('preserves filename and other fields', () => {
    const files = [
      { filename: "tests/security/idor.spec.ts", content: `trpcQuery("applications.list", cookie, {})`, layer: "security" as const, description: "IDOR test" },
    ];
    const result = normalizeOutputFiles(files);
    expect(result[0].filename).toBe("tests/security/idor.spec.ts");
    expect(result[0].layer).toBe("security");
    expect(result[0].description).toBe("IDOR test");
  });
});

describe("normalizeOutputConfigs", () => {
  it('normalizes content in config values', () => {
    const configs = {
      "vitest.config.ts": `// trpc.applications router\nconst endpoint = "trpc.users.list";`,
    };
    const result = normalizeOutputConfigs(configs);
    expect(result["vitest.config.ts"]).toContain('"users.list"');
    expect(result["vitest.config.ts"]).not.toContain('"trpc.users.list"');
  });

  it('preserves config keys', () => {
    const configs = {
      "vitest.config.ts": `export default {};`,
      "k6.config.ts": `export const options = {};`,
    };
    const result = normalizeOutputConfigs(configs);
    expect(Object.keys(result)).toEqual(["vitest.config.ts", "k6.config.ts"]);
  });
});

describe("normalizeOutputContent — edge cases", () => {
  it('handles empty string', () => {
    expect(normalizeOutputContent("")).toBe("");
  });

  it('handles content with no endpoint references', () => {
    const input = `import { test, expect } from "@playwright/test";\n\ntest("basic test", async () => {\n  expect(1 + 1).toBe(2);\n});`;
    expect(normalizeOutputContent(input)).toBe(input);
  });

  it('handles complex real-world test content', () => {
    const input = `
import { test, expect } from "@playwright/test";
import { trpcQuery, trpcMutation } from "../../helpers/api";
import { getAdminCookie } from "../../helpers/auth";

test("PROOF-S-001 — IDOR: applications list", async ({ page }) => {
  const cookie = await getAdminCookie();
  const res = await trpcQuery("trpc.applications.list", cookie, {
    institutionId: TEST_INSTITUTION_ID
  });
  expect(res.status).toBe(200);
  
  const res2 = await trpcQuery("trpc.applications.s.getById", cookie, { id: 1 });
  expect(res2.status).toBe(200);
});
`;
    const output = normalizeOutputContent(input);
    expect(output).not.toContain('"trpc.');
    expect(output).not.toContain('.s.getById');
    expect(output).toContain('"applications.list"');
    expect(output).toContain('"applications.getById"');
  });
});
