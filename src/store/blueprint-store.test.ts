import { beforeEach, describe, expect, it } from "vitest";

import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

import { useBlueprintStore } from "@/store/blueprint-store";

const makeGraph = (): BlueprintGraph => ({
  projectName: "CodeFlow Workspace",
  mode: "essential",
  phase: "spec",
  generatedAt: new Date().toISOString(),
  nodes: [
    {
      id: "function:alpha",
      kind: "function",
      name: "alpha",
      summary: "alpha summary",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: [],
      status: "spec_only"
    }
  ],
  edges: [],
  workflows: [],
  warnings: []
});

describe("useBlueprintStore", () => {
  beforeEach(() => {
    useBlueprintStore.setState({ graph: null });
  });

  it("accepts direct graph replacement", () => {
    const graph = makeGraph();

    useBlueprintStore.getState().setGraph(graph);

    expect(useBlueprintStore.getState().graph).toEqual(graph);
  });

  it("accepts updater functions", () => {
    useBlueprintStore.getState().setGraph(makeGraph());

    useBlueprintStore.getState().setGraph((current) =>
      current
        ? {
            ...current,
            phase: "implementation"
          }
        : current
    );

    expect(useBlueprintStore.getState().graph?.phase).toBe("implementation");
  });

  it("updates an individual node without replacing the rest of the graph", () => {
    useBlueprintStore.getState().setGraph(makeGraph());

    useBlueprintStore.getState().updateNode("function:alpha", {
      summary: "updated summary"
    });

    expect(useBlueprintStore.getState().graph?.nodes[0]?.summary).toBe("updated summary");
    expect(useBlueprintStore.getState().graph?.projectName).toBe("CodeFlow Workspace");
  });
});
