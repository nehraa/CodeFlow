import { describe, expect, it } from "vitest";

import { detectSmells } from "@/lib/blueprint/smells";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("detectSmells", () => {
  it("detects a god-node", () => {
    const godContract = {
      ...emptyContract(),
      summary: "Does everything",
      responsibilities: ["r1", "r2", "r3", "r4", "r5"],
      methods: [
        { name: "method1", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "method2", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "method3", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "method4", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "method5", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "method6", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "method7", summary: "Does something", inputs: [], outputs: [], sideEffects: [], calls: [] }
      ]
    };

    const graph: BlueprintGraph = {
      projectName: "GodNode",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "god", kind: "class", name: "GodClass", summary: "Does everything", contract: godContract, sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: []
    };

    const report = detectSmells(graph);

    expect(report.smells.some((s) => s.code === "god-node" && s.severity === "critical")).toBe(true);
  });

  it("detects orphan nodes", () => {
    const graph: BlueprintGraph = {
      projectName: "Orphan",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "lonely", kind: "module", name: "Lonely", summary: "No connections", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: []
    };

    const report = detectSmells(graph);

    expect(report.smells.some((s) => s.code === "orphan-node" && s.severity === "info")).toBe(true);
  });

  it("returns clean health score for a small clean graph", () => {
    const graph: BlueprintGraph = {
      projectName: "Clean",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "Module A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "function", name: "B", summary: "Function B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const report = detectSmells(graph);
    const infoPenalty = report.smells.filter((s) => s.severity === "info").length * 3;

    expect(report.healthScore).toBeCloseTo(100 - infoPenalty, 0);
  });

  it("detects tight coupling", () => {
    const graph: BlueprintGraph = {
      projectName: "TightCoupling",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "A", summary: "Module A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "Module B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1 },
        { from: "A", to: "B", kind: "imports", required: true, confidence: 1 },
        { from: "B", to: "A", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const report = detectSmells(graph);

    expect(report.smells.some((s) => s.code === "tight-coupling" && s.severity === "warning")).toBe(true);
  });
});
