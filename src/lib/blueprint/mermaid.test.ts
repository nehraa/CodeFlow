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

  it("escapes Mermaid-special characters in node names and edge labels", () => {
    const graph: BlueprintGraph = {
      projectName: "Special",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "A", kind: "module", name: "Auth[Service]", summary: "A", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "B", kind: "module", name: "B", summary: "B", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: [
        { from: "A", to: "B", kind: "calls", required: true, confidence: 1, label: "pipe|label" }
      ]
    };

    const output = toMermaid(graph);

    // Raw `]` must not appear inside the node shape label
    expect(output).not.toContain("[Auth[Service]]");
    // The `|` in an edge label must be escaped
    expect(output).not.toContain("|pipe|label|");
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

  it("emits inheritance as Parent <|-- Child (not reversed)", () => {
    const graph: BlueprintGraph = {
      projectName: "Inheritance",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "class:Animal", kind: "class", name: "Animal", summary: "Base", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "class:Dog", kind: "class", name: "Dog", summary: "Child", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      // repo.ts creates inherits edges from=child, to=parent
      edges: [
        { from: "class:Dog", to: "class:Animal", kind: "inherits", required: true, confidence: 0.95 }
      ]
    };

    const output = toMermaidClassDiagram(graph);

    // Mermaid expects: Parent <|-- Child
    expect(output).toContain("class_Animal <|-- class_Dog");
    // The reversed form must not appear
    expect(output).not.toContain("class_Dog <|-- class_Animal");
  });

  it("escapes double quotes in class names inside the quoted label", () => {
    const graph: BlueprintGraph = {
      projectName: "QuoteTest",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        { id: "cls1", kind: "class", name: 'My"Class', summary: "A class", contract: emptyContract(), sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ],
      edges: []
    };

    const output = toMermaidClassDiagram(graph);

    // Raw unescaped `"` inside the class label would break Mermaid syntax
    expect(output).not.toContain('["My"Class"]');
    expect(output).toContain("#quot;");
  });
});
