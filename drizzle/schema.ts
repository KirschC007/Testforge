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
export type InsertAnalysis = typeof analyses.$inferInsert;
