import { describe, expect, it } from "vitest";

import { toMermaid, toMermaidClassDiagram } from "@/lib/blueprint/mermaid";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("toMermaid", () => {
  it("generates a mermaid flowchart with correct shapes", () => {
    const graph: BlueprintGraph = {
      projectName: "Shapes",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "mod1", kind: "module", name: "MyModule", summary: "A module", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "api1", kind: "api", name: "MyAPI", summary: "An API", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "fn1", kind: "function", name: "MyFunc", summary: "A function", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [],
    };

    const output = toMermaid(graph);

    expect(output).toContain("graph TD");
    expect(output).toContain("[MyModule]");
    expect(output).toContain("{{MyAPI}}");
    expect(output).toContain("([MyFunc])");
  });

  it("generates edges with labels", () => {
    const graph: BlueprintGraph = {
      projectName: "Edges",
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

    const output = toMermaid(graph);

    expect(output).toContain("-->");
    expect(output).toContain("calls");
  });
});

describe("toMermaidClassDiagram", () => {
  it("generates a class diagram for class nodes", () => {
    const classContract = {
      ...emptyContract(),
      summary: "A class",
      methods: [
        { name: "doWork", summary: "Does work", inputs: [], outputs: [], sideEffects: [], calls: [] },
        { name: "cleanup", summary: "Cleans up", inputs: [], outputs: [], sideEffects: [], calls: [] }
      ]
    };

    const graph: BlueprintGraph = {
      projectName: "ClassDiagram",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "cls1", kind: "class", name: "MyClass", summary: "A class", contract: classContract, sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: []
    };

    const output = toMermaidClassDiagram(graph);

    expect(output).toContain("classDiagram");
    expect(output).toContain("doWork");
    expect(output).toContain("cleanup");
  });
});
