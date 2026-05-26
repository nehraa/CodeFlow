import { describe, expect, it } from "vitest";
import {
  localizeError,
  getErrorContext,
  buildErrorReport,
  type LocalizedError
} from "./error-localization.js";
import { createExecutionSpan, attachStackTrace } from "./execution-span.js";

const span = (
  nodeId: string,
  status: "idle" | "running" | "success" | "failed" | "warning",
  duration: number,
  timestamp = 1000,
  stackTrace?: string
) => {
  let s = createExecutionSpan({ nodeId, status, duration, timestamp });
  if (stackTrace) s = attachStackTrace(s, stackTrace);
  return s;
};

// ── localizeError ───────────────────────────────────────────────────────────

describe("localizeError", () => {
  it("returns null nodeId when no spans provided", () => {
    const result = localizeError("some error", []);
    expect(result.nodeId).toBeNull();
  });

  it("returns null stepIndex when no spans", () => {
    const result = localizeError("some error", []);
    expect(result.stepIndex).toBeNull();
  });

  it("finds the node whose stack trace contains the error message", () => {
    const spans = [
      span("a", "failed", 10, 1000, "Error: connection refused\n  at a.ts:10"),
      span("b", "failed", 10, 2000, "Error: something else\n  at b.ts:5")
    ];
    const result = localizeError("connection refused", spans);
    expect(result.nodeId).toBe("a");
  });

  it("returns the stepIndex of the matching span", () => {
    const spans = [
      span("a", "failed", 10, 1000, "Error: boom\n  at a.ts:10"),
      span("b", "failed", 10, 2000, "Error: boom\n  at b.ts:5")
    ];
    const result = localizeError("boom", spans);
    expect(result.stepIndex).toBe(0);
  });

  it("returns the full error message in the result", () => {
    const spans = [span("a", "failed", 10, 1000)];
    const result = localizeError("my error message", spans);
    expect(result.message).toBe("my error message");
  });

  it("includes stack trace from the matching span", () => {
    const trace = "Error: boom\n  at a.ts:10";
    const spans = [span("a", "failed", 10, 1000, trace)];
    const result = localizeError("boom", spans);
    expect(result.stackTrace).toBe(trace);
  });

  it("returns first matching node when multiple spans could match", () => {
    const spans = [
      span("a", "failed", 10, 1000, "Error: issue\n  at a.ts:10"),
      span("b", "failed", 10, 2000, "Error: issue\n  at b.ts:5")
    ];
    const result = localizeError("issue", spans);
    expect(result.nodeId).toBe("a");
  });

  it("returns null nodeId when no span's stack trace matches", () => {
    const spans = [
      span("a", "failed", 10, 1000, "Error: boom\n  at a.ts:10")
    ];
    const result = localizeError("totally unrelated error", spans);
    expect(result.nodeId).toBeNull();
  });
});

// ── getErrorContext ────────────────────────────────────────────────────────

describe("getErrorContext", () => {
  it("returns null when no spans for given nodeId", () => {
    const spans = [span("a", "failed", 10, 1000)];
    expect(getErrorContext(spans, "unknown")).toBeNull();
  });

  it("returns the most recent (highest timestamp) span for the node", () => {
    const spans = [
      span("a", "failed", 10, 1000),
      span("a", "failed", 20, 2000)
    ];
    const result = getErrorContext(spans, "a");
    expect(result?.timestamp).toBe(2000);
    expect(result?.duration).toBe(20);
  });

  it("returns null when all spans for node are successful", () => {
    const spans = [span("a", "success", 10, 1000)];
    expect(getErrorContext(spans, "a")).toBeNull();
  });

  it("prefers a failed span over a successful one at same timestamp", () => {
    const spans = [
      span("a", "success", 10, 1000),
      span("a", "failed", 20, 1000)
    ];
    const result = getErrorContext(spans, "a");
    expect(result?.status).toBe("failed");
  });
});

// ── buildErrorReport ────────────────────────────────────────────────────────

describe("buildErrorReport", () => {
  it("returns a non-empty string", () => {
    const spans = [span("a", "failed", 10, 1000)];
    const report = buildErrorReport("error", spans);
    expect(report.length).toBeGreaterThan(0);
  });

  it("includes the error message", () => {
    const spans = [span("a", "failed", 10, 1000)];
    const report = buildErrorReport("my custom error", spans);
    expect(report).toContain("my custom error");
  });

  it("includes the nodeId when it can be localized", () => {
    const spans = [span("a", "failed", 10, 1000, "Error: boom\n  at a.ts:10")];
    const report = buildErrorReport("boom", spans);
    expect(report).toContain("a");
  });

  it("mentions when error cannot be localized", () => {
    const spans = [span("a", "failed", 10, 1000)];
    const report = buildErrorReport("unknown error xyz", spans);
    expect(report).toContain("unknown");
  });

  it("includes step index in the report", () => {
    const spans = [
      span("a", "failed", 10, 1000),
      span("b", "failed", 10, 2000, "Error: boom\n  at b.ts:5")
    ];
    const report = buildErrorReport("boom", spans);
    expect(report).toContain("Step:");
  });
});
