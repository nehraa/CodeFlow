import { describe, expect, it } from "vitest";

import { createBranch, diffBranches } from "@/lib/blueprint/branches";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const baseGraph: BlueprintGraph = {
  projectName: "Test Project",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "A",
      kind: "module",
      name: "A",
      summary: "Module A",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "B",
      kind: "module",
      name: "B",
      summary: "Module B",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: [{ from: "A", to: "B", kind: "calls", required: true, confidence: 1 }]
};

describe("createBranch", () => {
  it("creates a branch with the given name and graph", () => {
    const branch = createBranch({ graph: baseGraph, name: "my-branch" });

    expect(branch.name).toBe("my-branch");
    expect(branch.projectName).toBe("Test Project");
    expect(branch.graph.nodes).toHaveLength(2);
    expect(branch.id).toBeTruthy();
    expect(branch.createdAt).toBeTruthy();
  });

  it("trims branch name whitespace", () => {
    const branch = createBranch({ graph: baseGraph, name: "  trimmed  " });
    expect(branch.name).toBe("trimmed");
  });

  it("stores description and parentBranchId when provided", () => {
    const branch = createBranch({
      graph: baseGraph,
      name: "feature",
      description: "Try replacing PostgreSQL with MongoDB",
      parentBranchId: "parent-id"
    });

    expect(branch.description).toBe("Try replacing PostgreSQL with MongoDB");
    expect(branch.parentBranchId).toBe("parent-id");
  });

  it("creates a deep copy of the graph (mutations do not affect original)", () => {
    const branch = createBranch({ graph: baseGraph, name: "isolated" });
    branch.graph.nodes[0].name = "MUTATED";

    expect(baseGraph.nodes[0].name).toBe("A");
  });

  it("generates unique IDs for each branch", () => {
    const b1 = createBranch({ graph: baseGraph, name: "b1" });
    const b2 = createBranch({ graph: baseGraph, name: "b2" });
    expect(b1.id).not.toBe(b2.id);
  });
});

describe("diffBranches", () => {
  it("returns all unchanged when both graphs are identical", () => {
    const diff = diffBranches(baseGraph, baseGraph, "base", "compare");

    expect(diff.addedNodes).toBe(0);
    expect(diff.removedNodes).toBe(0);
    expect(diff.modifiedNodes).toBe(0);
    expect(diff.addedEdges).toBe(0);
    expect(diff.removedEdges).toBe(0);
    expect(diff.impactedNodeIds).toHaveLength(0);
  });

  it("detects added nodes in compare graph", () => {
    const compare: BlueprintGraph = {
      ...baseGraph,
      nodes: [
        ...baseGraph.nodes,
        {
          id: "C",
          kind: "module",
          name: "C",
          summary: "Module C",
          contract: emptyContract(),
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const diff = diffBranches(baseGraph, compare, "base", "compare");

    expect(diff.addedNodes).toBe(1);
    expect(diff.impactedNodeIds).toContain("C");
  });

  it("detects removed nodes in compare graph", () => {
    const compare: BlueprintGraph = {
      ...baseGraph,
      nodes: [baseGraph.nodes[0]],
      edges: []
    };

    const diff = diffBranches(baseGraph, compare, "base", "compare");

    expect(diff.removedNodes).toBe(1);
    expect(diff.impactedNodeIds).toContain("B");
  });

  it("detects modified nodes", () => {
    const compare: BlueprintGraph = {
      ...baseGraph,
      nodes: [
        baseGraph.nodes[0],
        {
          ...baseGraph.nodes[1],
          summary: "Modified summary for B"
        }
      ]
    };

    const diff = diffBranches(baseGraph, compare, "base", "compare");

    expect(diff.modifiedNodes).toBe(1);
    expect(diff.impactedNodeIds).toContain("B");
  });

  it("detects added edges in compare graph", () => {
    const compare: BlueprintGraph = {
      ...baseGraph,
      edges: [
        ...baseGraph.edges,
        { from: "B", to: "A", kind: "imports", required: false, confidence: 0.8 }
      ]
    };

    const diff = diffBranches(baseGraph, compare, "base", "compare");

    expect(diff.addedEdges).toBe(1);
    expect(diff.impactedNodeIds).toContain("A");
    expect(diff.impactedNodeIds).toContain("B");
  });

  it("detects removed edges in compare graph", () => {
    const compare: BlueprintGraph = {
      ...baseGraph,
      edges: []
    };

    const diff = diffBranches(baseGraph, compare, "base", "compare");

    expect(diff.removedEdges).toBe(1);
  });

  it("populates baseId and compareId from arguments", () => {
    const diff = diffBranches(baseGraph, baseGraph, "branch-001", "branch-002");
    expect(diff.baseId).toBe("branch-001");
    expect(diff.compareId).toBe("branch-002");
  });

  it("works on empty graphs", () => {
    const empty: BlueprintGraph = { ...baseGraph, nodes: [], edges: [] };
    const diff = diffBranches(empty, empty, "base", "compare");

    expect(diff.addedNodes).toBe(0);
    expect(diff.nodeDiffs).toHaveLength(0);
  });
});
