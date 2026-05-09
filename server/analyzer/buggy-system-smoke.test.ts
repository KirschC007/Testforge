import { describe, expect, it } from "vitest";
import { runAnalysisJob } from "./job-runner";
import type { CodeFile } from "./code-parser";

const buggyCodeFiles: CodeFile[] = [
  {
    path: "package.json",
    content: JSON.stringify({
      dependencies: {
        "@trpc/server": "^11.0.0",
        zod: "^4.0.0",
        "drizzle-orm": "^0.45.0",
        jsonwebtoken: "^9.0.0",
      },
    }),
  },
  {
    path: "server/db/schema.ts",
    content: `
      import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";

      export const orders = pgTable("orders", {
        id: serial("id").primaryKey(),
        tenantId: integer("tenant_id").notNull(),
        customerEmail: text("customer_email").notNull(),
        amount: integer("amount").notNull(),
        status: text("status").notNull(),
      });
    `,
  },
  {
    path: "server/auth/login.ts",
    content: `
      import jwt from "jsonwebtoken";
      import { z } from "zod";
      import { createTRPCRouter, publicProcedure, protectedProcedure } from "@trpc/server";

      export const authRouter = createTRPCRouter({
        login: publicProcedure.mutation(async ({ ctx, input }) => {
          const rows = await ctx.db.execute(\`SELECT * FROM users WHERE email = \${input.email}\`);
          const jwt_secret = "super-secret-jwt-key";
          const token = jwt.sign({ userId: rows[0]?.id }, jwt_secret);
          return { token };
        }),

        deleteBillingAccount: publicProcedure.mutation(async ({ ctx, input }) => {
          try {
            await ctx.db.delete(accounts).where(eq(accounts.id, input.accountId));
            return { ok: true };
          } catch (err) {
            return { error: err.stack };
          }
        }),

        createTransfer: protectedProcedure
          .input(z.object({ tenantId: z.number(), amount: z.number() }))
          .mutation(async ({ ctx, input }) => {
            return await ctx.db.insert(transfers).values({
              tenantId: input.tenantId,
              amount: input.amount,
            });
          }),
      });
    `,
  },
  {
    path: "server/orders/router.ts",
    content: `
      import { z } from "zod";
      import { createTRPCRouter, publicProcedure } from "@trpc/server";

      export const ordersRouter = createTRPCRouter({
        getOrder: publicProcedure
          .input(z.object({ tenantId: z.number(), orderId: z.number() }))
          .query(async ({ ctx, input }) => {
            return await ctx.db.query.orders.findFirst({
              where: eq(orders.id, input.orderId),
            });
          }),
      });
    `,
  },
];

describe("buggy vibecode smoke test", () => {
  it("detects real security and quality issues in a broken mini-backend", async () => {
    const result = await runAnalysisJob("", "buggy-vibecode-smoke", undefined, undefined, {
      codeFiles: buggyCodeFiles,
    });

    const staticFindings = ((result.analysisResult as any).staticFindings || []) as Array<{ rule: string }>;
    const staticRuleIds = staticFindings.map((finding) => finding.rule);
    const proofTypes = Array.from(new Set(result.riskModel.proofTargets.map((target) => target.proofType)));

    console.log("Detected static rules:", staticRuleIds);
    console.log("Detected proof types:", proofTypes);

    expect(result.analysisResult.supportedScope?.tier).toBe("gold");
    expect(staticRuleIds).toContain("STATIC-001-HARDCODED-SECRET");
    expect(staticRuleIds).toContain("STATIC-002-NO-RATE-LIMIT");
    expect(staticRuleIds).toContain("STATIC-003-SQL-INJECTION");
    expect(staticRuleIds).toContain("STATIC-009-STACK-TRACE-LEAK");
    expect(staticRuleIds).toContain("STATIC-011-INSECURE-JWT");

    expect(proofTypes).toContain("idor");
    expect(proofTypes).toContain("boundary");
    expect(result.report).toContain("STATIC-001-HARDCODED-SECRET");
    expect(result.report).toContain("STATIC-008-MISSING-TENANT-CHECK");
    expect(result.report).toContain("## Supported Scope");
    expect(result.report).toContain("## Proof Planning");
    expect(result.analysisResult.operationalStatus?.mode).toBe("degraded");
    expect(result.analysisResult.operationalStatus?.notices.some((notice) => notice.component === "llm_code_pass")).toBe(true);
    expect(result.report).toContain("## Operational Status");
  }, 20000);
});
