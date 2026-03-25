import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "pro", "team", "enterprise"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Analysis job status
export type AnalysisStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"])
    .default("pending")
    .notNull(),

  // Uploaded file references (S3 URLs)
  specFileUrl: text("specFileUrl"),
  specFileName: varchar("specFileName", { length: 255 }),
  specFileKey: varchar("specFileKey", { length: 512 }),
  codeFileUrl: text("codeFileUrl"),
  codeFileName: varchar("codeFileName", { length: 255 }),
  codeFileKey: varchar("codeFileKey", { length: 512 }),
  githubUrl: text("githubUrl"),

  // Analysis results stored as JSON
  resultJson: json("resultJson"),

  // Download artifact
  outputZipUrl: text("outputZipUrl"),
  outputZipKey: varchar("outputZipKey", { length: 512 }),

  // Live progress tracking
  progressLayer: int("progressLayer").default(0), // 0=pending, 1=parsing, 2=risk, 3=tests, 4=validation, 5=done
  progressMessage: varchar("progressMessage", { length: 512 }),
  layer1Json: json("layer1Json"), // AnalysisResult after Layer 1 — available early
  layer2Json: json("layer2Json"), // RiskModel after Layer 2 — available early

  // Error info if failed
  errorMessage: text("errorMessage"),

  // Metrics (denormalized for fast list queries)
  verdictScore: int("verdictScore"), // 0-100
  coveragePercent: int("coveragePercent"), // 0-100
  validatedProofCount: int("validatedProofCount"),
  discardedProofCount: int("discardedProofCount"),
  behaviorCount: int("behaviorCount"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Analysis = typeof analyses.$inferSelect;

// ─── Test Runs ────────────────────────────────────────────────────────────────
export const testRuns = mysqlTable("testRuns", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  userId: int("userId").notNull(),
  runId: varchar("runId", { length: 64 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"])
    .default("pending")
    .notNull(),
  totalTests: int("totalTests").default(0),
  passed: int("passed").default(0),
  failed: int("failed").default(0),
  errors: int("errors").default(0),
  passRate: int("passRate").default(0),
  mutationScore: int("mutationScore").default(0),
  resultsJson: json("resultsJson"),
  summary: text("summary"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type TestRun = typeof testRuns.$inferSelect;
export type InsertTestRun = typeof testRuns.$inferInsert;
export type InsertAnalysis = typeof analyses.$inferInsert;

// ─── Settings / Prompt Configuration ─────────────────────────────────────────
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  defaultValue: text("defaultValue").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }).notNull().default("general"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
