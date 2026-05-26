import { describe, expect, it } from "vitest";
import {
  getNodeExecutionFrequency,
  getNodeTimingStats,
  getExecutionHotspots,
  buildHeatmap,
  type HeatmapEntry
} from "./heatmap.js";
import { createExecutionSpan } from "./execution-span.js";

const span = (nodeId: string, status: "idle" | "running" | "success" | "failed" | "warning", duration: number, timestamp = 1000) =>
  createExecutionSpan({ nodeId, status, duration, timestamp });

// ── getNodeExecutionFrequency ───────────────────────────────────────────────

describe("getNodeExecutionFrequency", () => {
  it("returns undefined for a node with no spans", () => {
    const spans = [span("a", "success", 10)];
    expect(getNodeExecutionFrequency(spans).get("unknown")).toBeUndefined();
  });

  it("counts one execution per span", () => {
    const spans = [
      span("a", "success", 10),
      span("a", "success", 20),
      span("a", "failed", 5)
    ];
    expect(getNodeExecutionFrequency(spans).get("a")).toBe(3);
  });

  it("tracks frequencies independently per node", () => {
    const spans = [
      span("a", "success", 10),
      span("b", "success", 10),
      span("b", "success", 10)
    ];
    const freq = getNodeExecutionFrequency(spans);
    expect(freq.get("a")).toBe(1);
    expect(freq.get("b")).toBe(2);
  });

  it("returns a Map instance", () => {
    expect(getNodeExecutionFrequency([])).toBeInstanceOf(Map);
  });
});

// ── getNodeTimingStats ───────────────────────────────────────────────────────

describe("getNodeTimingStats", () => {
  it("returns undefined for unknown node", () => {
    const spans = [span("a", "success", 10)];
    expect(getNodeTimingStats(spans).get("unknown")).toBeUndefined();
  });

  it("computes min, max, and avg for a single span", () => {
    const spans = [span("a", "success", 50)];
    const stats = getNodeTimingStats(spans).get("a");
    expect(stats).toMatchObject({ min: 50, max: 50, avg: 50 });
  });

  it("computes correct min/max/avg across multiple spans", () => {
    const spans = [
      span("a", "success", 10),
      span("a", "success", 30),
      span("a", "success", 50)
    ];
    const stats = getNodeTimingStats(spans).get("a");
    expect(stats).toMatchObject({ min: 10, max: 50, avg: 30 });
  });

  it("handles zero-duration spans in avg calculation", () => {
    const spans = [span("a", "idle", 0), span("a", "idle", 0)];
    const stats = getNodeTimingStats(spans).get("a");
    expect(stats).toMatchObject({ min: 0, max: 0, avg: 0 });
  });

  it("computes stats independently per node", () => {
    const spans = [span("a", "success", 10), span("b", "success", 100)];
    const aStats = getNodeTimingStats(spans).get("a");
    const bStats = getNodeTimingStats(spans).get("b");
    expect(aStats).toMatchObject({ min: 10, max: 10, avg: 10 });
    expect(bStats).toMatchObject({ min: 100, max: 100, avg: 100 });
  });

  it("returns a Map instance", () => {
    expect(getNodeTimingStats([])).toBeInstanceOf(Map);
  });
});

// ── getExecutionHotspots ────────────────────────────────────────────────────

describe("getExecutionHotspots", () => {
  it("returns empty array when no spans", () => {
    expect(getExecutionHotspots([])).toHaveLength(0);
  });

  it("returns single node sorted descending by totalDuration", () => {
    const spans = [
      span("a", "success", 100),
      span("a", "success", 200)
    ];
    const hotspots = getExecutionHotspots(spans);
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].nodeId).toBe("a");
    expect(hotspots[0].totalDuration).toBe(300);
  });

  it("sorts multiple nodes by totalDuration descending", () => {
    const spans = [
      span("a", "success", 50),
      span("b", "success", 500),
      span("c", "success", 150)
    ];
    const hotspots = getExecutionHotspots(spans);
    expect(hotspots[0].nodeId).toBe("b");
    expect(hotspots[1].nodeId).toBe("c");
    expect(hotspots[2].nodeId).toBe("a");
  });

  it("respects limit parameter", () => {
    const spans = [
      span("a", "success", 50),
      span("b", "success", 100),
      span("c", "success", 200)
    ];
    expect(getExecutionHotspots(spans, 2)).toHaveLength(2);
    expect(getExecutionHotspots(spans, 2)[0].nodeId).toBe("c");
    expect(getExecutionHotspots(spans, 2)[1].nodeId).toBe("b");
  });

  it("includes frequency in each hotspot entry", () => {
    const spans = [
      span("a", "success", 10),
      span("a", "success", 10),
      span("a", "success", 10)
    ];
    const hotspots = getExecutionHotspots(spans);
    expect(hotspots[0].frequency).toBe(3);
  });

  it("returns empty array for limit of 0", () => {
    const spans = [span("a", "success", 10)];
    expect(getExecutionHotspots(spans, 0)).toHaveLength(0);
  });
});

// ── buildHeatmap ─────────────────────────────────────────────────────────────

describe("buildHeatmap", () => {
  it("returns an empty array for empty spans", () => {
    expect(buildHeatmap([])).toHaveLength(0);
  });

  it("includes all nodes that have spans", () => {
    const spans = [
      span("a", "success", 10),
      span("b", "failed", 20),
      span("c", "warning", 30)
    ];
    const heatmap = buildHeatmap(spans);
    const ids = heatmap.map((e) => e.nodeId);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });

  it("computes frequency, minDuration, maxDuration, and avgDuration", () => {
    const spans = [
      span("a", "success", 10),
      span("a", "success", 30),
      span("a", "success", 50)
    ];
    const entry = buildHeatmap(spans).find((e) => e.nodeId === "a")!;
    expect(entry.frequency).toBe(3);
    expect(entry.minDuration).toBe(10);
    expect(entry.maxDuration).toBe(50);
    expect(entry.avgDuration).toBe(30);
  });

  it("computes totalDuration as sum of all spans", () => {
    const spans = [
      span("a", "success", 10),
      span("a", "success", 20),
      span("a", "success", 30)
    ];
    const entry = buildHeatmap(spans).find((e) => e.nodeId === "a")!;
    expect(entry.totalDuration).toBe(60);
  });

  it("does not include nodes without spans", () => {
    const spans = [span("a", "success", 10)];
    const heatmap = buildHeatmap(spans);
    expect(heatmap.map((e) => e.nodeId)).not.toContain("unknown");
  });

  it("returns an array (not a Map)", () => {
    expect(Array.isArray(buildHeatmap([]))).toBe(true);
  });
});
