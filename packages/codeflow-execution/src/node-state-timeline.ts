/**
 * node-state-timeline.ts
 *
 * Track each node's state over time.
 */

import type { ExecutionSpan } from "./execution-span.js";

// ── Types ────────────────────────────────────────────────────────────────────────

export interface NodeStateTimelineEntry {
  nodeId: string;
  status: ExecutionSpan["status"];
  timestamp: number;
  reason?: string;
}

// ── Timeline builders ────────────────────────────────────────────────────────

/**
 * Build a chronological list of all state entries for a specific node.
 */
export const buildNodeTimeline = (
  spans: ExecutionSpan[],
  nodeId: string
): NodeStateTimelineEntry[] => {
  return spans
    .filter((span) => span.nodeId === nodeId)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((span) => ({
      nodeId: span.nodeId,
      status: span.status,
      timestamp: span.timestamp,
      reason: span.metadata?.reason as string | undefined
    }));
};

/**
 * Get the node's status at a specific point in time (frame timestamp).
 * Returns null when the node has no spans before the frame timestamp.
 */
export const getNodeStateAtFrame = (
  spans: ExecutionSpan[],
  nodeId: string,
  frameTimestamp: number
): ExecutionSpan["status"] | null => {
  const nodeSpans = spans
    .filter((span) => span.nodeId === nodeId)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (nodeSpans.length === 0) return null;

  // Find the last span with timestamp <= frameTimestamp
  let latest: ExecutionSpan | null = null;
  for (const span of nodeSpans) {
    if (span.timestamp <= frameTimestamp) {
      latest = span;
    } else {
      break;
    }
  }

  return latest?.status ?? null;
};

/**
 * Return only the state transitions (status changes) for a node.
 * Each entry marks when the status changed and what it changed to.
 */
export const getStateTransitions = (
  spans: ExecutionSpan[],
  nodeId: string
): NodeStateTimelineEntry[] => {
  const timeline = buildNodeTimeline(spans, nodeId);
  if (timeline.length === 0) return [];

  const transitions: NodeStateTimelineEntry[] = [];
  let lastStatus: ExecutionSpan["status"] | null = null;

  for (const entry of timeline) {
    if (lastStatus === null || entry.status !== lastStatus) {
      transitions.push(entry);
      lastStatus = entry.status;
    }
  }

  return transitions;
};
