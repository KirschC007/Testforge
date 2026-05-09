import { describe, expect, it } from "vitest";
import { buildRiskModel, buildProofTarget } from "./risk-model";
import { parseCodeToIR, type CodeFile } from "./code-parser";
import type { AnalysisResult } from "./types";

function makeAnalysis(files: CodeFile[]): AnalysisResult {
  return parseCodeToIR(files);
}

describe("risk model high-value proof types", () => {
  it("emits negative_amount proof targets for monetary mutation flows", () => {
    const analysis = makeAnalysis([
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            zod: "^4.0.0",
            "drizzle-orm": "^0.45.0",
          },
        }),
      },
      {
        path: "server/payments.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";

          export const paymentRouter = createTRPCRouter({
            transferFunds: protectedProcedure
              .input(z.object({ tenantId: z.number(), amount: z.number(), destinationUserId: z.number() }))
              .mutation(async ({ ctx, input }) => {
                await ctx.db.transfers.create({
                  data: { tenantId: input.tenantId, amount: input.amount, destinationUserId: input.destinationUserId },
                });
                return { ok: true };
              }),
          });
        `,
      },
    ]);

    const riskModel = buildRiskModel(analysis);
    expect(riskModel.proofTargets.some((target) => target.proofType === "negative_amount")).toBe(true);
  });

  it("builds concrete mass_assignment proof targets with protected field checks", () => {
    const analysis = makeAnalysis([
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            "@trpc/server": "^11.0.0",
            zod: "^4.0.0",
            "drizzle-orm": "^0.45.0",
          },
        }),
      },
      {
        path: "server/profile.ts",
        content: `
          import { createTRPCRouter, protectedProcedure } from "@trpc/server";
          import { z } from "zod";

          export const profileRouter = createTRPCRouter({
            updateProfile: protectedProcedure
              .input(z.object({ tenantId: z.number(), displayName: z.string(), role: z.string().optional(), isAdmin: z.boolean().optional() }))
              .mutation(async ({ ctx, input }) => {
                await ctx.db.users.update({
                  where: eq(users.id, ctx.user.id),
                  data: input,
                });
                return { ok: true };
              }),
          });
        `,
      },
    ]);

    const riskModel = buildRiskModel(analysis);
    const target = riskModel.proofTargets.find((proof) => proof.proofType === "mass_assignment");
    expect(target).toBeTruthy();

    const behavior = riskModel.behaviors.find((scored) => scored.behavior.id === target?.behaviorId);
    expect(behavior).toBeTruthy();

    const rebuilt = buildProofTarget(behavior!, "mass_assignment", analysis);
    expect(rebuilt?.mutationTargets.some((mutation) => mutation.description.includes("protected field"))).toBe(true);
    expect(rebuilt?.assertions.some((assertion) => assertion.target.includes("db."))).toBe(true);
  });

  it("injects webhook proof targets from static webhook-signature findings", () => {
    const analysis = makeAnalysis([
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: {
            express: "^4.0.0",
          },
        }),
      },
      {
        path: "server/webhook.ts",
        content: `
          import express from "express";
          const app = express();

          app.post("/webhook/stripe", async (req, res) => {
            await processEvent(req.body);
            res.json({ ok: true });
          });
        `,
      },
    ]) as AnalysisResult & { staticFindings?: Array<{ rule: string }> };

    analysis.staticFindings = [{ rule: "STATIC-010-MISSING-WEBHOOK-SIGNATURE" }];
    const riskModel = buildRiskModel(analysis);

    expect(riskModel.proofTargets.some((target) => target.proofType === "webhook")).toBe(true);
  });
});
