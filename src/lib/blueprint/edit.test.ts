import { describe, expect, it } from "vitest";

import { addEdgeToGraph, addNodeToGraph, deleteNodeFromGraph } from "@/lib/blueprint/edit";
import type { BlueprintGraph } from "@/lib/blueprint/schema";

const graph: BlueprintGraph = {
  projectName: "Editable",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [],
  edges: []
};

describe("graph editing", () => {
  it("adds nodes and edges and deletes them cleanly", () => {
    const withNode = addNodeToGraph(graph, { kind: "function", name: "saveTask" });
    const withSecondNode = addNodeToGraph(withNode, { kind: "api", name: "POST /api/tasks" });
    const linked = addEdgeToGraph(withSecondNode, {
      from: withNode.nodes[0].id,
      to: withSecondNode.nodes[1].id,
      kind: "calls"
    });
    const removed = deleteNodeFromGraph(linked, withNode.nodes[0].id);

    expect(linked.nodes).toHaveLength(2);
    expect(linked.edges).toHaveLength(1);
    expect(removed.nodes).toHaveLength(1);
    expect(removed.edges).toHaveLength(0);
  });
});
