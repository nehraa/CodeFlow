import { describe, expect, it } from "vitest";

import { computeHeatmap, heatColor, heatGlow } from "@/lib/blueprint/heatmap";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const makeGraph = (
  nodes: Array<{
    id: string;
    name: string;
    count?: number;
    errors?: number;
    totalDurationMs?: number;
  }>
): BlueprintGraph => ({
  projectName: "Test",
  mode: "essential",
  generatedAt: new Date().toISOString(),
  warnings: [],
  workflows: [],
  edges: [],
  nodes: nodes.map(({ id, name, count = 0, errors = 0, totalDurationMs = 0 }) => ({
    id,
    kind: "function" as const,
    name,
    summary: name,
    contract: { ...emptyContract(), summary: name },
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
    traceState: {
      status: errors > 0 ? ("error" as const) : count > 0 ? ("success" as const) : ("idle" as const),
      count,
      errors,
      totalDurationMs,
      lastSpanIds: []
    }
  }))
});

describe("computeHeatmap", () => {
  it("returns zero intensities for a graph with no trace data", () => {
    const graph = makeGraph([{ id: "n1", name: "Alpha" }]);
    const { nodes } = computeHeatmap(graph);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].callCount).toBe(0);
    expect(nodes[0].errorRate).toBe(0);
    expect(nodes[0].heatIntensity).toBe(0);
  });

  it("normalises latency intensity so the slowest node gets 1", () => {
    const graph = makeGraph([
      { id: "fast", name: "Fast", count: 5, totalDurationMs: 50 },
      { id: "slow", name: "Slow", count: 5, totalDurationMs: 500 }
    ]);
    const { nodes } = computeHeatmap(graph);

    const fastNode = nodes.find((n) => n.nodeId === "fast")!;
    const slowNode = nodes.find((n) => n.nodeId === "slow")!;

    expect(slowNode.latencyIntensity).toBe(1);
    expect(fastNode.latencyIntensity).toBeCloseTo(0.1, 3);
  });

  it("normalises error intensity so the most error-prone node gets 1", () => {
    const graph = makeGraph([
      { id: "clean", name: "Clean", count: 10, errors: 0 },
      { id: "broken", name: "Broken", count: 10, errors: 10 }
    ]);
    const { nodes } = computeHeatmap(graph);

    const brokenNode = nodes.find((n) => n.nodeId === "broken")!;
    const cleanNode = nodes.find((n) => n.nodeId === "clean")!;

    expect(brokenNode.errorIntensity).toBe(1);
    expect(cleanNode.errorIntensity).toBe(0);
  });

  it("computes heatIntensity in the range [0, 1]", () => {
    const graph = makeGraph([
      { id: "a", name: "A", count: 100, errors: 50, totalDurationMs: 1000 },
      { id: "b", name: "B", count: 1, errors: 0, totalDurationMs: 5 }
    ]);
    const { nodes } = computeHeatmap(graph);

    for (const node of nodes) {
      expect(node.heatIntensity).toBeGreaterThanOrEqual(0);
      expect(node.heatIntensity).toBeLessThanOrEqual(1);
    }
  });

  it("exposes maxCallCount, maxAvgDurationMs, maxErrorRate", () => {
    const graph = makeGraph([
      { id: "x", name: "X", count: 20, errors: 4, totalDurationMs: 200 }
    ]);
    const data = computeHeatmap(graph);

    expect(data.maxCallCount).toBe(20);
    expect(data.maxAvgDurationMs).toBe(10);
    // maxErrorRate uses 1 as floor so it is max(0.2, 1) = 1
    expect(data.maxErrorRate).toBe(1);
  });
});

describe("heatColor", () => {
  it("returns a low-opacity green for low intensity", () => {
    const color = heatColor(0.1);
    expect(color).toMatch(/rgba\(34,197,94,/);
  });

  it("returns an amber tint for mid-range intensity", () => {
    const color = heatColor(0.5);
    expect(color).toMatch(/rgba\(245,158,11,/);
  });

  it("returns a red tint for high intensity", () => {
    const color = heatColor(0.9);
    expect(color).toMatch(/rgba\(239,68,68,/);
  });

  it("returns transparent for zero intensity", () => {
    const color = heatColor(0);
    expect(color).toContain("0.0");
  });
});

describe("heatGlow", () => {
  it("returns none for zero intensity", () => {
    expect(heatGlow(0)).toBe("none");
  });

  it("returns a green glow for low intensity", () => {
    expect(heatGlow(0.2)).toMatch(/rgba\(34,197,94,/);
  });

  it("returns a red glow for high intensity", () => {
    expect(heatGlow(0.95)).toMatch(/rgba\(239,68,68,/);
  });
});
