/**
 * execution-span.ts
 *
 * Records timing, state changes, and stack traces per execution step.
 * This is the foundational type for other tracking modules.
 */

import type { NodeStatus } from "@abhinav2203/codeflow-core";

// ── Types ────────────────────────────────────────────────────────────────────────

export type NodeStatus = "idle" | "running" | "success" | "failed" | "warning";

export interface ExecutionSpan {
  nodeId: string;
  status: NodeStatus;
  duration: number;
  timestamp: number;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

export interface TraceEvent {
  name: string;
  timestamp: number;
  duration?: number;
  nodeId?: string;
}

export interface SpanStats {
  nodeId: string;
  count: number;
  totalDuration: number;
  successCount: number;
  failedCount: number;
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Creates an ExecutionSpan with the given options.
 * status defaults to "idle" and duration defaults to 0.
 */
export const createExecutionSpan = (opts: {
  nodeId: string;
  status?: NodeStatus;
  duration?: number;
  timestamp: number;
}): ExecutionSpan => ({
  nodeId: opts.nodeId,
  status: opts.status ?? "idle",
  duration: opts.duration ?? 0,
  timestamp: opts.timestamp,
  metadata: opts.metadata
});

// ── Transformations ──────────────────────────────────────────────────────────

/**
 * Attaches a stack trace to an existing span, returning a new span.
 * Does not mutate the original span.
 */
export const attachStackTrace = (span: ExecutionSpan, stackTrace: string): ExecutionSpan => ({
  ...span,
  stackTrace
});

/**
 * Converts an ExecutionSpan to a TraceEvent.
 */
export const spanToTraceEvent = (span: ExecutionSpan): TraceEvent => {
  const event: TraceEvent = {
    name: span.nodeId,
    timestamp: span.timestamp
  };
  if (span.duration > 0) {
    event.duration = span.duration;
  }
  if (span.nodeId) {
    event.nodeId = span.nodeId;
  }
  return event;
};

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregates execution spans into per-node statistics.
 */
export const aggregateSpanStats = (spans: ExecutionSpan[]): Map<string, SpanStats> => {
  const map = new Map<string, SpanStats>();

  for (const span of spans) {
    if (!map.has(span.nodeId)) {
      map.set(span.nodeId, {
        nodeId: span.nodeId,
        count: 0,
        totalDuration: 0,
        successCount: 0,
        failedCount: 0
      });
    }

    const stats = map.get(span.nodeId)!;
    stats.count += 1;
    stats.totalDuration += span.duration;

    if (span.status === "success") {
      stats.successCount += 1;
    } else if (span.status === "failed" || span.status === "warning") {
      stats.failedCount += 1;
    }
  }

  return map;
};
