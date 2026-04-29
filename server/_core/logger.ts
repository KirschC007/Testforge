/**
 * TestForge Structured Logger
 *
 * Outputs JSON in production for log aggregation (Datadog, CloudWatch, Loki).
 * Pretty-prints in development for readability.
 * Zero new dependencies — uses JSON.stringify only.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  analysisId?: number;
  layer?: number;
  durationMs?: number;
  proofCount?: number;
  userId?: number;
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === "production";
const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as LogLevel;

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[LOG_LEVEL];
}

function formatPretty(level: LogLevel, message: string, ctx: LogContext): string {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const prefix = level === "error" ? "✗" : level === "warn" ? "⚠" : level === "debug" ? "·" : "→";
  const ctxStr = Object.keys(ctx).length
    ? " " + Object.entries(ctx).map(([k, v]) => `${k}=${v}`).join(" ")
    : "";
  return `[${ts}] ${prefix} ${message}${ctxStr}`;
}

function formatJson(level: LogLevel, message: string, ctx: LogContext): string {
  return JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...ctx });
}

function log(level: LogLevel, ctx: LogContext, message: string): void {
  if (!shouldLog(level)) return;
  const formatted = IS_PROD ? formatJson(level, message, ctx) : formatPretty(level, message, ctx);
  if (level === "error") console.error(formatted);
  else if (level === "warn") console.warn(formatted);
  else console.log(formatted);
}

export const logger = {
  debug: (ctx: LogContext, message: string) => log("debug", ctx, message),
  info:  (ctx: LogContext, message: string) => log("info",  ctx, message),
  warn:  (ctx: LogContext, message: string) => log("warn",  ctx, message),
  error: (ctx: LogContext, message: string) => log("error", ctx, message),

  /** Convenience: log with timing. Returns elapsed ms. */
  timed: (ctx: LogContext, message: string, startMs: number): number => {
    const elapsed = Date.now() - startMs;
    log("info", { ...ctx, durationMs: elapsed }, message);
    return elapsed;
  },
};
