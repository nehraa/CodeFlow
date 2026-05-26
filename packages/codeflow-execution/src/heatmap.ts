/**
 * heatmap.ts
 *
 * Build heatmap of execution frequency/timing per node.
 */

import type { ExecutionSpan } from "./execution-span.js";

// ── Types ────────────────────────────────────────────────────────────────────────

export interface HeatmapEntry {
  nodeId: string;
  frequency: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
}

// ── Frequency ─────────────────────────────────────────────────────────────────

/**
 * Returns a Map of nodeId → execution count (frequency).
 */
export const getNodeExecutionFrequency = (spans: ExecutionSpan[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const span of spans) {
    map.set(span.nodeId, (map.get(span.nodeId) ?? 0) + 1);
  }
  return map;
};

// ── Timing stats ─────────────────────────────────────────────────────────────

/**
 * Returns per-node timing statistics (min, max, avg duration).
 */
export const getNodeTimingStats = (
  spans: ExecutionSpan[]
): Map<string, { min: number; max: number; avg: number }> => {
  const byNode = new Map<string, ExecutionSpan[]>();

  for (const span of spans) {
    if (!byNode.has(span.nodeId)) {
      byNode.set(span.nodeId, []);
    }
    byNode.get(span.nodeId)!.push(span);
  }

  const result = new Map<string, { min: number; max: number; avg: number }>();

  byNode.forEach((nodeSpans, nodeId) => {
    const durations = nodeSpans.map((s) => s.duration);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const avg = total / durations.length;
    result.set(nodeId, { min, max, avg });
  });

  return result;
};

// ── Hotspots ─────────────────────────────────────────────────────────────────

/**
 * Returns nodes sorted by totalDuration descending, optionally limited to `limit`.
 */
export const getExecutionHotspots = (
  spans: ExecutionSpan[],
  limit?: number
): HeatmapEntry[] => {
  const heatmap = buildHeatmap(spans);
  const sorted = [...heatmap].sort((a, b) => b.totalDuration - a.totalDuration);
  if (limit !== undefined && limit >= 0) {
    return sorted.slice(0, limit);
  }
  return sorted;
};

// ── Heatmap builder ───────────────────────────────────────────────────────────

/**
 * Builds a complete heatmap from execution spans.
 */
export const buildHeatmap = (spans: ExecutionSpan[]): HeatmapEntry[] => {
  const byNode = new Map<string, ExecutionSpan[]>();

  for (const span of spans) {
    if (!byNode.has(span.nodeId)) {
      byNode.set(span.nodeId, []);
    }
    byNode.get(span.nodeId)!.push(span);
  }

  return [...byNode.entries()].map(([nodeId, nodeSpans]) => {
    const durations = nodeSpans.map((s) => s.duration);
    const frequency = nodeSpans.length;
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const avgDuration = totalDuration / frequency;
    return { nodeId, frequency, totalDuration, minDuration, maxDuration, avgDuration };
  });
};
