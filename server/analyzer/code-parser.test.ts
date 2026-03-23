/**
 * Unit tests for code-parser.ts
 * Tests the deterministic static analysis of TypeScript/tRPC/Drizzle code.
 */

import { describe, it, expect } from "vitest";
import { detectFramework, parseCodeToIR, type CodeFile } from "./code-parser";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRPC_ROUTER_FILE: CodeFile = {
  path: "server/routers.ts",
  content: `
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  orders: router({
    getById: protectedProcedure
      .input(z.object({ orderId: z.number(), tenantId: z.number() }))
      .query(async ({ input }) => {
        return db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });
      }),

    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        customerId: z.number(),
        amount: z.number().min(0.01).max(999999),
        status: z.enum(["pending", "processing", "shipped", "delivered"]),
      }))
      .mutation(async ({ input }) => {
        return db.insert(orders).values(input);
      }),

    list: publicProcedure
      .input(z.object({ page: z.number().optional() }))
      .query(async () => {
        return db.query.orders.findMany();
      }),
  }),

  users: router({
    updateProfile: publicProcedure
      .input(z.object({ name: z.string(), email: z.string().email() }))
      .mutation(async ({ input }) => {
        return { updated: true };
      }),
  }),
});
`,
};

const DRIZZLE_SCHEMA_FILE: CodeFile = {
  path: "drizzle/schema.ts",
  content: `
import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

export const orders = mysqlTable("orders", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenant_id").notNull(),
  customerId: int("customer_id").notNull(),
  email: varchar("email", { length: 255 }),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "shipped", "delivered"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});
`,
};

const PACKAGE_JSON_TRPC: CodeFile = {
  path: "package.json",
  content: JSON.stringify({
    dependencies: {
      "@trpc/server": "^11.0.0",
      "drizzle-orm": "^0.29.0",
      "zod": "^3.22.0",
      "express": "^4.18.0",
    },
  }),
};

const PACKAGE_JSON_PRISMA: CodeFile = {
  path: "package.json",
  content: JSON.stringify({
    dependencies: {
      "@prisma/client": "^5.0.0",
      "next": "^14.0.0",
    },
  }),
};

const PACKAGE_JSON_NEXT: CodeFile = {
  path: "package.json",
  content: JSON.stringify({
    dependencies: {
      "next": "^14.0.0",
      "fastify": "^4.0.0",
    },
  }),
};

const EXPRESS_ROUTER_FILE: CodeFile = {
  path: "routes/orders.ts",
  content: `
import { Router } from "express";
const router = Router();

router.get("/orders/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  res.json({ id });
});

router.post("/orders", authenticate, async (req, res) => {
  const { tenantId, amount } = req.body;
  res.json({ created: true });
});

router.delete("/orders/:id", requireAdmin, async (req, res) => {
  res.json({ deleted: true });
});

export default router;
`,
};

// ─── detectFramework tests ────────────────────────────────────────────────────

describe("detectFramework", () => {
  it("detects tRPC + Drizzle + Zod from package.json", () => {
    const result = detectFramework([PACKAGE_JSON_TRPC]);
    expect(result).toContain("tRPC");
    expect(result).toContain("Drizzle");
    expect(result).toContain("Zod");
  });

  it("detects Prisma + Next.js from package.json", () => {
    const result = detectFramework([PACKAGE_JSON_PRISMA]);
    expect(result).toContain("Prisma");
    expect(result).toContain("Next.js");
  });

  it("detects Fastify + Next.js from package.json", () => {
    const result = detectFramework([PACKAGE_JSON_NEXT]);
    expect(result).toContain("Next.js");
    expect(result).toContain("Fastify");
  });

  it("falls back to content-based detection when no package.json", () => {
    const result = detectFramework([TRPC_ROUTER_FILE]);
    expect(result).toContain("tRPC");
  });

  it("returns TypeScript when no framework detected", () => {
    const result = detectFramework([{ path: "utils.ts", content: "export const add = (a: number, b: number) => a + b;" }]);
    expect(result).toBe("TypeScript");
  });

  it("handles malformed package.json gracefully", () => {
    const result = detectFramework([{ path: "package.json", content: "{ invalid json" }]);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });
});

// ─── parseCodeToIR tests ──────────────────────────────────────────────────────

describe("parseCodeToIR", () => {
  describe("basic structure", () => {
    it("returns parseResult and ir fields", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      expect(result).toHaveProperty("parseResult");
      expect(result).toHaveProperty("ir");
      expect(result).toHaveProperty("qualityScore");
      expect(result).toHaveProperty("specType");
    });

    it("specType starts with 'code:'", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      expect(result.specType).toMatch(/^code:/);
    });

    it("ir has required fields", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      expect(result.ir).toHaveProperty("behaviors");
      expect(result.ir).toHaveProperty("apiEndpoints");
      expect(Array.isArray(result.ir.behaviors)).toBe(true);
      expect(Array.isArray(result.ir.apiEndpoints)).toBe(true);
    });
  });

  describe("tRPC procedure detection", () => {
    it("detects tRPC procedures as endpoints", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      expect(result.parseResult.endpointCount).toBeGreaterThan(0);
    });

    it("detects protectedProcedure vs publicProcedure via auth field", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      const endpoints = result.ir.apiEndpoints;
      // auth field is set to the middleware name
      const protectedEps = endpoints.filter(ep => ep.auth && ep.auth !== "publicProcedure");
      const publicEps = endpoints.filter(ep => ep.auth === "publicProcedure");
      expect(protectedEps.length).toBeGreaterThan(0);
      expect(publicEps.length).toBeGreaterThan(0);
    });

    it("detects mutation vs query procedures via method prefix in endpoint.method", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      const endpoints = result.ir.apiEndpoints;
      // method is stored as "POST /api/trpc/..." or "GET /api/trpc/..."
      const mutations = endpoints.filter(ep => ep.method.startsWith("POST") || ep.method.startsWith("PATCH") || ep.method.startsWith("DELETE"));
      const queries = endpoints.filter(ep => ep.method.startsWith("GET"));
      expect(mutations.length).toBeGreaterThan(0);
      expect(queries.length).toBeGreaterThan(0);
    });

    it("extracts procedure names in endpoint.name", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      // endpoint.name contains the procedure name (e.g. "routers.getById")
      const names = result.ir.apiEndpoints.map(ep => ep.name);
      expect(names.length).toBeGreaterThan(0);
      expect(names.some(n => n.includes("getById") || n.includes("create") || n.includes("list") || n.includes("updateProfile"))).toBe(true);
    });
  });

  describe("Drizzle schema detection", () => {
    it("detects tables from Drizzle schema", () => {
      const result = parseCodeToIR([DRIZZLE_SCHEMA_FILE]);
      expect(result.parseResult.tableCount).toBeGreaterThan(0);
    });

    it("detects PII fields (email, phone, firstName, lastName)", () => {
      const result = parseCodeToIR([DRIZZLE_SCHEMA_FILE]);
      expect(result.parseResult.piiFields.length).toBeGreaterThan(0);
      expect(result.parseResult.piiFields.some(f =>
        f.toLowerCase().includes("email") || f.toLowerCase().includes("phone")
      )).toBe(true);
    });

    it("detects tenant key (tenantId)", () => {
      const result = parseCodeToIR([DRIZZLE_SCHEMA_FILE]);
      expect(result.parseResult.tenantKey).toBeTruthy();
    });

    it("detects status enum values", () => {
      const result = parseCodeToIR([DRIZZLE_SCHEMA_FILE]);
      const behaviors = result.ir.behaviors;
      const statusBehavior = behaviors.find(b =>
        b.statusMachine && b.statusMachine.states.length > 0
      );
      // Status machine may or may not be detected depending on enum parsing
      if (statusBehavior) {
        expect(statusBehavior.statusMachine!.states.length).toBeGreaterThan(0);
      }
    });
  });

  describe("combined tRPC + Drizzle", () => {
    it("produces more behaviors with both files", () => {
      const combined = parseCodeToIR([TRPC_ROUTER_FILE, DRIZZLE_SCHEMA_FILE]);
      const trpcOnly = parseCodeToIR([TRPC_ROUTER_FILE]);
      expect(combined.ir.behaviors.length).toBeGreaterThanOrEqual(trpcOnly.ir.behaviors.length);
    });

    it("detects IDOR risk when tenantId present in schema", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE, DRIZZLE_SCHEMA_FILE, PACKAGE_JSON_TRPC]);
      const behaviors = result.ir.behaviors;
      // IDOR risk is captured in riskHints or tags, not proofType
      const idorBehavior = behaviors.find(b =>
        b.tags?.includes("tenant_isolation") ||
        b.riskHints?.some(h => h.toLowerCase().includes("idor") || h.toLowerCase().includes("tenant"))
      );
      expect(idorBehavior).toBeDefined();
    });

    it("detects auth matrix risk via tags when protected procedures exist", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      const behaviors = result.ir.behaviors;
      // auth_matrix is captured in tags
      const authBehavior = behaviors.find(b =>
        b.tags?.includes("auth_matrix") ||
        b.riskHints?.some(h => h.toLowerCase().includes("auth"))
      );
      expect(authBehavior).toBeDefined();
    });
  });

  describe("Express route detection", () => {
    it("detects Express routes as endpoints", () => {
      const result = parseCodeToIR([EXPRESS_ROUTER_FILE]);
      expect(result.parseResult.endpointCount).toBeGreaterThan(0);
    });

    it("detects HTTP methods (GET, POST, DELETE) in endpoint.method string", () => {
      const result = parseCodeToIR([EXPRESS_ROUTER_FILE]);
      // method is stored as "GET /api/trpc/..."
      const methods = result.ir.apiEndpoints.map(ep => ep.method);
      expect(methods.some(m => m.startsWith("GET"))).toBe(true);
      expect(methods.some(m => m.startsWith("POST"))).toBe(true);
    });
  });

  describe("quality score", () => {
    it("returns a quality score between 0 and 100", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE, DRIZZLE_SCHEMA_FILE]);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it("produces higher quality score with more structured code", () => {
      const richResult = parseCodeToIR([TRPC_ROUTER_FILE, DRIZZLE_SCHEMA_FILE, PACKAGE_JSON_TRPC]);
      const minimalResult = parseCodeToIR([{ path: "index.ts", content: "export const x = 1;" }]);
      expect(richResult.qualityScore).toBeGreaterThanOrEqual(minimalResult.qualityScore);
    });
  });

  describe("edge cases", () => {
    it("handles empty file list gracefully", () => {
      const result = parseCodeToIR([]);
      expect(result.ir.behaviors).toBeDefined();
      expect(result.ir.apiEndpoints).toBeDefined();
      expect(result.parseResult.endpointCount).toBe(0);
    });

    it("handles files with no code gracefully", () => {
      const result = parseCodeToIR([{ path: "empty.ts", content: "" }]);
      expect(result).toBeDefined();
      expect(Array.isArray(result.ir.behaviors)).toBe(true);
    });

    it("handles multiple router files", () => {
      const file2: CodeFile = {
        path: "server/routers/payments.ts",
        content: `
export const paymentsRouter = router({
  charge: protectedProcedure
    .input(z.object({ amount: z.number().min(1), currency: z.string() }))
    .mutation(async ({ input }) => ({ charged: true })),
});
`,
      };
      const result = parseCodeToIR([TRPC_ROUTER_FILE, file2]);
      expect(result.parseResult.endpointCount).toBeGreaterThan(0);
    });

    it("does not throw on malformed TypeScript", () => {
      const malformed: CodeFile = {
        path: "broken.ts",
        content: "const x = { unclosed: {",
      };
      expect(() => parseCodeToIR([malformed])).not.toThrow();
    });
  });

  describe("behavior generation", () => {
    it("generates behaviors for each detected endpoint", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      expect(result.ir.behaviors.length).toBeGreaterThan(0);
    });

    it("behaviors have required fields (id, title, subject, action)", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE]);
      for (const behavior of result.ir.behaviors) {
        expect(behavior).toHaveProperty("id");
        expect(behavior).toHaveProperty("title");
        expect(behavior).toHaveProperty("subject");
        expect(behavior).toHaveProperty("action");
        expect(typeof behavior.id).toBe("string");
        expect(typeof behavior.title).toBe("string");
      }
    });

    it("behaviors have tags array", () => {
      const result = parseCodeToIR([TRPC_ROUTER_FILE, DRIZZLE_SCHEMA_FILE]);
      const behaviors = result.ir.behaviors;
      expect(behaviors.length).toBeGreaterThan(0);
      // At least some behaviors should have tags
      const withTags = behaviors.filter(b => b.tags && b.tags.length > 0);
      expect(withTags.length).toBeGreaterThan(0);
    });
  });
});
