/**
 * SSE Event Bus for Test Runner Live Streaming
 *
 * Architecture:
 * - In-memory Map: runId → Set<SSEClient>
 * - runTests() calls emitTestResult() after each test completes
 * - Express GET /api/test-runs/:runId/stream opens SSE connection
 * - On completion, emitRunComplete() closes all clients for that runId
 */

import type { Response } from "express";
import type { TestResult, TestRunResult } from "./test-runner";

export interface SSEClient {
  res: Response;
  connectedAt: Date;
}

// ─── In-Memory Event Bus ──────────────────────────────────────────────────────

const clients = new Map<string, Set<SSEClient>>();

/**
 * Register a new SSE client for a given runId.
 * Returns a cleanup function that removes the client on disconnect.
 */
export function registerSSEClient(runId: string, res: Response): () => void {
  if (!clients.has(runId)) {
    clients.set(runId, new Set());
  }
  const client: SSEClient = { res, connectedAt: new Date() };
  clients.get(runId)!.add(client);

  return () => {
    const set = clients.get(runId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        clients.delete(runId);
      }
    }
  };
}

/**
 * Emit a single test result to all SSE clients watching this runId.
 */
export function emitTestResult(runId: string, result: TestResult, progress: { completed: number; total: number }): void {
  const set = clients.get(runId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({
    type: "test_result",
    result,
    progress,
  });

  for (const client of Array.from(set)) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      // Client disconnected — will be cleaned up by close handler
    }
  }
}

/**
 * Emit run completion event and close all SSE connections for this runId.
 */
export function emitRunComplete(runId: string, summary: TestRunResult): void {
  const set = clients.get(runId);
  if (!set || set.size === 0) {
    clients.delete(runId);
    return;
  }

  const payload = JSON.stringify({
    type: "run_complete",
    summary,
  });

  for (const client of Array.from(set)) {
    try {
      client.res.write(`data: ${payload}\n\n`);
      client.res.end();
    } catch {
      // Already disconnected
    }
  }

  clients.delete(runId);
}

/**
 * Emit an error event and close all SSE connections for this runId.
 */
export function emitRunError(runId: string, error: string): void {
  const set = clients.get(runId);
  if (!set || set.size === 0) {
    clients.delete(runId);
    return;
  }

  const payload = JSON.stringify({
    type: "run_error",
    error,
  });

  for (const client of Array.from(set)) {
    try {
      client.res.write(`data: ${payload}\n\n`);
      client.res.end();
    } catch {
      // Already disconnected
    }
  }

  clients.delete(runId);
}

/**
 * Returns the number of active SSE clients for a given runId.
 * Useful for testing.
 */
export function getClientCount(runId: string): number {
  return clients.get(runId)?.size ?? 0;
}

/**
 * Clear all clients (for testing cleanup).
 */
export function clearAllClients(): void {
  clients.clear();
}
