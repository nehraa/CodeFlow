import { describe, expect, it } from "vitest";

import { detectCycles, hasCycles } from "@/lib/blueprint/cycles";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("detectCycles", () => {
  it("returns no cycles for a DAG", () => {
    const graph: BlueprintGraph = {
      projectName: "DAG",
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
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "B", to: "C", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const report = detectCycles(graph);

    expect(report.totalCycles).toBe(0);
    expect(report.affectedNodeIds).toHaveLength(0);
  });

  it("detects a simple two-node cycle", () => {
    const graph: BlueprintGraph = {
      projectName: "TwoNodeCycle",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "B", to: "A", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const report = detectCycles(graph);

    expect(report.totalCycles).toBe(1);
    expect(report.affectedNodeIds).toContain("A");
    expect(report.affectedNodeIds).toContain("B");
  });

  it("detects multiple independent cycles", () => {
    const graph: BlueprintGraph = {
      projectName: "MultiCycle",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "C", kind: "module", name: "C", summary: "C", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "D", kind: "module", name: "D", summary: "D", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "B", to: "A", kind: "calls", required: true, confidence: 1 },
        { from: "C", to: "D", kind: "calls", required: true, confidence: 1 },
        { from: "D", to: "C", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const report = detectCycles(graph);

    expect(report.totalCycles).toBe(2);
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

    const report = detectCycles(graph);

    expect(report.totalCycles).toBe(0);
  });
});

describe("hasCycles", () => {
  it("returns false for a DAG", () => {
    const graph: BlueprintGraph = {
      projectName: "DAG",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 }
      ]
    };

    expect(hasCycles(graph)).toBe(false);
  });

  it("returns true when cycles exist", () => {
    const graph: BlueprintGraph = {
      projectName: "Cyclic",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "B", to: "A", kind: "calls", required: true, confidence: 1 }
      ]
    };

    expect(hasCycles(graph)).toBe(true);
  });
});

describe("self-loop handling", () => {
  it("detects a self-loop edge as a cycle", () => {
    const graph: BlueprintGraph = {
      projectName: "SelfLoop",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "A", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const report = detectCycles(graph);

    expect(report.totalCycles).toBe(1);
    expect(report.affectedNodeIds).toContain("A");
    expect(hasCycles(graph)).toBe(true);
  });
});
