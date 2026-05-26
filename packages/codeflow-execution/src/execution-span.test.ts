import { describe, expect, it } from "vitest";
import {
  attachStackTrace,
  createExecutionSpan,
  aggregateSpanStats,
  spanToTraceEvent,
  type ExecutionSpan,
  type SpanStats,
  type TraceEvent
} from "./execution-span.js";

const makeSpan = (
  nodeId: string,
  status: ExecutionSpan["status"] = "success",
  duration = 100,
  timestamp = 1000
): ExecutionSpan =>
  createExecutionSpan({ nodeId, status, duration, timestamp });

// ── createExecutionSpan ─────────────────────────────────────────────────────────

describe("createExecutionSpan", () => {
  it("creates a span with required fields", () => {
    const span = createExecutionSpan({ nodeId: "a", timestamp: 1000 });
    expect(span.nodeId).toBe("a");
    expect(span.timestamp).toBe(1000);
  });

  it("defaults status to idle", () => {
    const span = createExecutionSpan({ nodeId: "a", timestamp: 1000 });
    expect(span.status).toBe("idle");
  });

  it("defaults duration to 0", () => {
    const span = createExecutionSpan({ nodeId: "a", timestamp: 1000 });
    expect(span.duration).toBe(0);
  });

  it("accepts all status values", () => {
    const statuses: ExecutionSpan["status"][] = [
      "idle",
      "running",
      "success",
      "failed",
      "warning"
    ];
    for (const status of statuses) {
      const span = createExecutionSpan({ nodeId: "a", status, timestamp: 1 });
      expect(span.status).toBe(status);
    }
  });

  it("does not attach stackTrace by default", () => {
    const span = createExecutionSpan({ nodeId: "a", timestamp: 1 });
    expect(span.stackTrace).toBeUndefined();
  });

  it("accepts metadata", () => {
    const meta = { foo: "bar", count: 42 };
    const span = createExecutionSpan({ nodeId: "a", timestamp: 1, metadata: meta });
    expect(span.metadata).toEqual(meta);
  });
});

// ── attachStackTrace ─────────────────────────────────────────────────────────

describe("attachStackTrace", () => {
  it("attaches a stack trace string to the span", () => {
    const span = makeSpan("a");
    const trace = "Error: boom\n  at app.js:10";
    const result = attachStackTrace(span, trace);
    expect(result.stackTrace).toBe(trace);
    expect(result.nodeId).toBe("a"); // original fields preserved
  });

  it("returns a new object without mutating the original", () => {
    const span = makeSpan("a");
    const result = attachStackTrace(span, "stack");
    expect(span.stackTrace).toBeUndefined();
    expect(result).not.toBe(span);
  });

  it("overwrites an existing stack trace", () => {
    const span = makeSpan("a");
    const withTrace = attachStackTrace(span, "first");
    const result = attachStackTrace(withTrace, "second");
    expect(result.stackTrace).toBe("second");
  });
});

// ── spanToTraceEvent ─────────────────────────────────────────────────────────

describe("spanToTraceEvent", () => {
  it("converts a span to a TraceEvent with name from nodeId", () => {
    const span = makeSpan("my-node", "success", 50, 1000);
    const event = spanToTraceEvent(span);
    expect(event.name).toBe("my-node");
    expect(event.timestamp).toBe(1000);
    expect(event.duration).toBe(50);
    expect(event.nodeId).toBe("my-node");
  });

  it("omits duration when undefined", () => {
    const span = createExecutionSpan({ nodeId: "a", timestamp: 1 });
    span.duration = 0;
    const event = spanToTraceEvent(span);
    expect(event.duration).toBeUndefined();
  });

  it("omits nodeId when span has no nodeId", () => {
    const span = createExecutionSpan({ nodeId: "", timestamp: 1 });
    const event = spanToTraceEvent(span);
    expect(event.nodeId).toBeUndefined();
  });

  it("includes all span fields in trace event", () => {
    const span = makeSpan("b", "failed", 33, 2000);
    const event = spanToTraceEvent(span);
    expect(event.name).toBe("b");
    expect(event.duration).toBe(33);
    expect(event.timestamp).toBe(2000);
    expect(event.nodeId).toBe("b");
  });
});

// ── aggregateSpanStats ───────────────────────────────────────────────────────

describe("aggregateSpanStats", () => {
  it("returns an empty map for empty array", () => {
    const result = aggregateSpanStats([]);
    expect(result.size).toBe(0);
  });

  it("aggregates a single span", () => {
    const spans = [makeSpan("a", "success", 10, 1000)];
    const result = aggregateSpanStats(spans);
    const stats = result.get("a");
    expect(stats).toMatchObject({
      nodeId: "a",
      count: 1,
      totalDuration: 10,
      successCount: 1,
      failedCount: 0
    });
  });

  it("counts multiple spans for the same node", () => {
    const spans = [
      makeSpan("a", "success", 10, 1000),
      makeSpan("a", "success", 20, 2000),
      makeSpan("a", "failed", 5, 3000)
    ];
    const result = aggregateSpanStats(spans);
    const stats = result.get("a");
    expect(stats).toMatchObject({
      nodeId: "a",
      count: 3,
      totalDuration: 35,
      successCount: 2,
      failedCount: 1
    });
  });

  it("tracks stats independently per node", () => {
    const spans = [
      makeSpan("a", "success", 10, 1000),
      makeSpan("b", "failed", 5, 2000)
    ];
    const result = aggregateSpanStats(spans);
    expect(result.get("a")).toMatchObject({ nodeId: "a", count: 1, totalDuration: 10 });
    expect(result.get("b")).toMatchObject({ nodeId: "b", count: 1, totalDuration: 5, failedCount: 1 });
  });

  it("increments failedCount for warning status", () => {
    const spans = [
      makeSpan("a", "warning", 10, 1000),
      makeSpan("a", "failed", 5, 2000)
    ];
    const result = aggregateSpanStats(spans);
    expect(result.get("a")).toMatchObject({ failedCount: 2 });
  });

  it("returns a Map instance", () => {
    const result = aggregateSpanStats([]);
    expect(result).toBeInstanceOf(Map);
  });
});
