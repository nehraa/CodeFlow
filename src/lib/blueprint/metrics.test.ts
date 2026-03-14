import { describe, expect, it } from "vitest";

import { computeGraphMetrics } from "@/lib/blueprint/metrics";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("computeGraphMetrics", () => {
  it("computes basic metrics for a simple graph", () => {
    const graph: BlueprintGraph = {
      projectName: "Simple",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "Module A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "api", name: "B", summary: "API B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "C", kind: "function", name: "C", summary: "Function C", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "B", to: "C", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const metrics = computeGraphMetrics(graph);

    expect(metrics.nodeCount).toBe(3);
    expect(metrics.edgeCount).toBe(2);
    expect(metrics.nodesByKind["module"]).toBe(1);
    expect(metrics.nodesByKind["api"]).toBe(1);
    expect(metrics.nodesByKind["function"]).toBe(1);
    expect(metrics.density).toBeGreaterThan(0);
    expect(metrics.connectedComponents).toBe(1);
  });

  it("handles empty graph", () => {
    const graph: BlueprintGraph = {
      projectName: "Empty",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [],
      edges: []
    };

    const metrics = computeGraphMetrics(graph);

    expect(metrics.nodeCount).toBe(0);
    expect(metrics.edgeCount).toBe(0);
    expect(metrics.density).toBe(0);
    expect(metrics.connectedComponents).toBe(0);
  });

  it("counts isolated and leaf nodes", () => {
    const graph: BlueprintGraph = {
      projectName: "IsolatedLeaf",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "C", kind: "module", name: "C", summary: "C", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const metrics = computeGraphMetrics(graph);

    expect(metrics.isolatedNodes).toBe(1);
    expect(metrics.leafNodes).toBe(2);
  });

  it("density stays <= 1 when parallel edges exist between the same node pair", () => {
    const graph: BlueprintGraph = {
      projectName: "ParallelEdges",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      // Two parallel edges A→B (max unique pairs = 2 for 2 nodes, density max = 1)
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "A", to: "B", kind: "imports", required: false, confidence: 0.9 }
      ]
    };

    const metrics = computeGraphMetrics(graph);

    expect(metrics.density).toBeLessThanOrEqual(1);
    // One unique (A,B) pair out of 2 possible directed pairs → 0.5
    expect(metrics.density).toBeCloseTo(0.5);
  });
});
