import { describe, expect, it } from "vitest";
import {
  buildNodeTimeline,
  getNodeStateAtFrame,
  getStateTransitions,
  type NodeStateTimelineEntry
} from "./node-state-timeline.js";
import type { ExecutionSpan } from "./execution-span.js";
import { createExecutionSpan } from "./execution-span.js";

const makeSpan = (
  nodeId: string,
  status: ExecutionSpan["status"],
  timestamp: number,
  duration = 100
): ExecutionSpan =>
  createExecutionSpan({ nodeId, status, timestamp, duration });

// ── buildNodeTimeline ─────────────────────────────────────────────────────────

describe("buildNodeTimeline", () => {
  it("returns an empty array for a node with no spans", () => {
    const spans = [makeSpan("a", "success", 1000)];
    expect(buildNodeTimeline(spans, "unknown-node")).toHaveLength(0);
  });

  it("orders entries chronologically by timestamp", () => {
    const spans = [
      makeSpan("a", "running", 2000),
      makeSpan("a", "success", 3000),
      makeSpan("a", "idle", 1000)
    ];
    const timeline = buildNodeTimeline(spans, "a");
    expect(timeline[0].timestamp).toBe(1000);
    expect(timeline[1].timestamp).toBe(2000);
    expect(timeline[2].timestamp).toBe(3000);
  });

  it("records status and nodeId on each entry", () => {
    const spans = [makeSpan("a", "success", 1000)];
    const timeline = buildNodeTimeline(spans, "a");
    expect(timeline[0]).toMatchObject({ nodeId: "a", status: "success" });
  });

  it("includes optional reason when metadata provides it", () => {
    const span = createExecutionSpan({
      nodeId: "a",
      status: "failed",
      timestamp: 1000,
      metadata: { reason: "connection refused" }
    });
    const timeline = buildNodeTimeline([span], "a");
    expect(timeline[0].reason).toBe("connection refused");
  });

  it("includes all spans for a given node", () => {
    const spans = [
      makeSpan("a", "running", 1000),
      makeSpan("a", "success", 2000),
      makeSpan("a", "failed", 3000)
    ];
    const timeline = buildNodeTimeline(spans, "a");
    expect(timeline).toHaveLength(3);
  });
});

// ── getNodeStateAtFrame ─────────────────────────────────────────────────────

describe("getNodeStateAtFrame", () => {
  it("returns null when no spans exist for the node", () => {
    const spans = [makeSpan("a", "success", 1000)];
    expect(getNodeStateAtFrame(spans, "unknown", 1500)).toBeNull();
  });

  it("returns the status of the latest span before the frame timestamp", () => {
    const spans = [
      makeSpan("a", "running", 1000),
      makeSpan("a", "success", 3000)
    ];
    expect(getNodeStateAtFrame(spans, "a", 2000)).toBe("running");
  });

  it("returns idle when frame is before any span", () => {
    const spans = [makeSpan("a", "running", 2000)];
    expect(getNodeStateAtFrame(spans, "a", 500)).toBeNull();
  });

  it("returns the latest status when frame is after all spans", () => {
    const spans = [
      makeSpan("a", "running", 1000),
      makeSpan("a", "success", 2000)
    ];
    expect(getNodeStateAtFrame(spans, "a", 5000)).toBe("success");
  });

  it("returns null for an empty span array", () => {
    expect(getNodeStateAtFrame([], "a", 1000)).toBeNull();
  });

  it("handles exact timestamp match", () => {
    const spans = [makeSpan("a", "failed", 2000)];
    expect(getNodeStateAtFrame(spans, "a", 2000)).toBe("failed");
  });
});

// ── getStateTransitions ─────────────────────────────────────────────────────

describe("getStateTransitions", () => {
  it("returns empty array when no spans for node", () => {
    const spans = [makeSpan("a", "success", 1000)];
    expect(getStateTransitions(spans, "unknown")).toHaveLength(0);
  });

  it("returns single entry when only one span", () => {
    const spans = [makeSpan("a", "success", 1000)];
    const transitions = getStateTransitions(spans, "a");
    expect(transitions).toHaveLength(1);
    expect(transitions[0].status).toBe("success");
  });

  it("only includes entries where status changes", () => {
    const spans = [
      makeSpan("a", "running", 1000),
      makeSpan("a", "running", 1500),
      makeSpan("a", "success", 2000),
      makeSpan("a", "success", 2500),
      makeSpan("a", "failed", 3000)
    ];
    const transitions = getStateTransitions(spans, "a");
    expect(transitions).toHaveLength(3);
    expect(transitions.map((t) => t.status)).toEqual([
      "running",
      "success",
      "failed"
    ]);
  });

  it("includes timestamps on transition entries", () => {
    const spans = [
      makeSpan("a", "running", 1000),
      makeSpan("a", "success", 2000)
    ];
    const transitions = getStateTransitions(spans, "a");
    expect(transitions[0].timestamp).toBe(1000);
    expect(transitions[1].timestamp).toBe(2000);
  });

  it("works across multiple nodes independently", () => {
    const spans = [
      makeSpan("a", "running", 1000),
      makeSpan("b", "running", 1000),
      makeSpan("a", "success", 2000)
    ];
    const aTransitions = getStateTransitions(spans, "a");
    const bTransitions = getStateTransitions(spans, "b");
    expect(aTransitions).toHaveLength(2);
    expect(bTransitions).toHaveLength(1);
  });
});
