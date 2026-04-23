import { describe, it, expect } from "vitest";
import { createBranchId, createBranch, diffBranches } from "./index";
import type { BlueprintGraph, BlueprintNode, BlueprintEdge } from "@abhinav2203/codeflow-core/schema";

// Full contract shape to satisfy required fields
const makeContract = (overrides: Partial<BlueprintNode["contract"]> = {}) => ({
  summary: "",
  responsibilities: [] as string[],
  inputs: [] as { name: string; type: string; description?: string }[],
  outputs: [] as { name: string; type: string; description?: string }[],
  attributes: [] as { name: string; type: string; description?: string }[],
  methods: [],
  sideEffects: [],
  calls: [],
  events: [],
  errors: [],
  dependencies: [],
  notes: [],
  uiAccess: [] as string[],
  backendAccess: [] as string[],
  ...overrides,
});

// Minimal graph fixture factory — only id/kind/name/summary are required on a node
const makeGraph = (
  nodes: Array<{ id: string; kind: BlueprintNode["kind"]; name: string; summary: string }>,
  edges: Array<{ from: string; to: string; kind: BlueprintEdge["kind"] }>
): BlueprintGraph => ({
  projectName: "test-project",
  mode: "essential",
  phase: "spec" as const,
  generatedAt: new Date().toISOString(),
  nodes: nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    name: n.name,
    summary: n.summary,
    path: undefined,
    ownerId: undefined,
    signature: undefined,
    contract: makeContract(),
    status: "spec_only" as BlueprintNode["status"],
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
  })),
  edges: edges.map((e) => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
    required: true,
    confidence: 1.0,
  })),
  workflows: [],
  warnings: [],
});

describe("createBranchId", () => {
  it("returns a valid UUID v4 string", () => {
    const id = createBranchId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("returns unique ids on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createBranchId()));
    expect(ids.size).toBe(100);
  });
});

describe("createBranch", () => {
  it("creates a branch with the given name and graph", () => {
    const graph = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "A function" }], []);
    const branch = createBranch({ graph, name: "feature-xyz" });

    expect(branch.id).toBeDefined();
    expect(branch.name).toBe("feature-xyz");
    expect(branch.projectName).toBe("test-project");
    expect(branch.graph.nodes).toHaveLength(1);
    expect(branch.graph.nodes[0].id).toBe("n1");
  });

  it("applies blueprintGraphSchema.parse (normalizes defaults)", () => {
    const graph = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "" }], []);
    // phase is not set — schema default should be applied
    const branch = createBranch({ graph, name: "test" });
    expect(branch.graph.phase).toBe("spec");
  });

  it("stores description when provided", () => {
    const graph = makeGraph([], []);
    const branch = createBranch({ graph, name: "test", description: "A feature branch" });
    expect(branch.description).toBe("A feature branch");
  });

  it("uses trimmed name", () => {
    const graph = makeGraph([], []);
    const branch = createBranch({ graph, name: "  my-branch  " });
    expect(branch.name).toBe("my-branch");
  });

  it("throws when name is empty or whitespace only", () => {
    const graph = makeGraph([], []);
    expect(() => createBranch({ graph, name: "" })).toThrow("Branch name must not be empty.");
    expect(() => createBranch({ graph, name: "   " })).toThrow("Branch name must not be empty.");
  });

  it("sets parentBranchId when provided", () => {
    const graph = makeGraph([], []);
    const branch = createBranch({ graph, name: "child", parentBranchId: "parent-123" });
    expect(branch.parentBranchId).toBe("parent-123");
  });

  it("does not set parentBranchId when omitted", () => {
    const graph = makeGraph([], []);
    const branch = createBranch({ graph, name: "orphan" });
    expect(branch.parentBranchId).toBeUndefined();
  });

  it("sets createdAt to an ISO string", () => {
    const graph = makeGraph([], []);
    const branch = createBranch({ graph, name: "test" });
    expect(branch.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not mutate the original graph", () => {
    const graph = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "" }], []);
    createBranch({ graph, name: "test" });
    expect(graph.nodes[0].name).toBe("foo");
  });
});

describe("diffBranches", () => {
  it("returns unchanged diff for identical graphs", () => {
    const graph = makeGraph(
      [{ id: "n1", kind: "function", name: "foo", summary: "Does a thing" }],
      [{ from: "n1", to: "n2", kind: "calls" }]
    );
    const diff = diffBranches(graph, graph, "branch-a", "branch-b");

    expect(diff.baseId).toBe("branch-a");
    expect(diff.compareId).toBe("branch-b");
    expect(diff.addedNodes).toBe(0);
    expect(diff.removedNodes).toBe(0);
    expect(diff.modifiedNodes).toBe(0);
    expect(diff.addedEdges).toBe(0);
    expect(diff.removedEdges).toBe(0);

    const n1Diff = diff.nodeDiffs.find((d) => d.nodeId === "n1");
    expect(n1Diff?.kind).toBe("unchanged");
    const edgeDiff = diff.edgeDiffs.find((d) => d.from === "n1");
    expect(edgeDiff?.diffKind).toBe("unchanged");
  });

  it("detects added nodes", () => {
    const base = makeGraph([{ id: "n1", kind: "function", name: "existing", summary: "" }], []);
    const compare = makeGraph(
      [
        { id: "n1", kind: "function", name: "existing", summary: "" },
        { id: "n2", kind: "function", name: "new", summary: "" },
      ],
      []
    );
    const diff = diffBranches(base, compare);

    expect(diff.addedNodes).toBe(1);
    const n2Diff = diff.nodeDiffs.find((d) => d.nodeId === "n2");
    expect(n2Diff?.kind).toBe("added");
    expect(n2Diff?.after).toBeDefined();
  });

  it("detects removed nodes", () => {
    const base = makeGraph(
      [
        { id: "n1", kind: "function", name: "existing", summary: "" },
        { id: "n2", kind: "function", name: "deleted", summary: "" },
      ],
      []
    );
    const compare = makeGraph([{ id: "n1", kind: "function", name: "existing", summary: "" }], []);
    const diff = diffBranches(base, compare);

    expect(diff.removedNodes).toBe(1);
    const n2Diff = diff.nodeDiffs.find((d) => d.nodeId === "n2");
    expect(n2Diff?.kind).toBe("removed");
    expect(n2Diff?.before).toBeDefined();
  });

  it("detects modified nodes", () => {
    const base = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "Original" }], []);
    const compare = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "Updated" }], []);
    const diff = diffBranches(base, compare);

    expect(diff.modifiedNodes).toBe(1);
    const n1Diff = diff.nodeDiffs.find((d) => d.nodeId === "n1");
    expect(n1Diff?.kind).toBe("modified");
    expect(n1Diff?.before).toBeDefined();
    expect(n1Diff?.after).toBeDefined();
  });

  it("detects added edges", () => {
    const base = makeGraph([], [{ from: "n1", to: "n2", kind: "calls" }]);
    const compare = makeGraph(
      [],
      [
        { from: "n1", to: "n2", kind: "calls" },
        { from: "n2", to: "n3", kind: "imports" },
      ]
    );
    const diff = diffBranches(base, compare);

    expect(diff.addedEdges).toBe(1);
    const newEdgeDiff = diff.edgeDiffs.find(
      (e) => e.from === "n2" && e.to === "n3" && e.diffKind === "added"
    );
    expect(newEdgeDiff).toBeDefined();
  });

  it("detects removed edges", () => {
    const base = makeGraph(
      [],
      [
        { from: "n1", to: "n2", kind: "calls" },
        { from: "n2", to: "n3", kind: "imports" },
      ]
    );
    const compare = makeGraph([], [{ from: "n1", to: "n2", kind: "calls" }]);
    const diff = diffBranches(base, compare);

    expect(diff.removedEdges).toBe(1);
    const removedEdgeDiff = diff.edgeDiffs.find(
      (e) => e.from === "n2" && e.to === "n3" && e.diffKind === "removed"
    );
    expect(removedEdgeDiff).toBeDefined();
  });

  it("populates impactedNodeIds for removed nodes", () => {
    const base = makeGraph(
      [
        { id: "n1", kind: "function", name: "foo", summary: "" },
        { id: "n2", kind: "function", name: "bar", summary: "" },
      ],
      [{ from: "n1", to: "n2", kind: "calls" }]
    );
    const compare = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "" }], []);
    const diff = diffBranches(base, compare);

    expect(diff.impactedNodeIds).toContain("n1");
    expect(diff.impactedNodeIds).toContain("n2");
  });

  it("reports impactedEdgeCount for removed nodes", () => {
    const base = makeGraph(
      [
        { id: "n1", kind: "function", name: "foo", summary: "" },
        { id: "n2", kind: "function", name: "bar", summary: "" },
        { id: "n3", kind: "function", name: "baz", summary: "" },
      ],
      [
        { from: "n1", to: "n2", kind: "calls" },
        { from: "n2", to: "n3", kind: "calls" },
      ]
    );
    const compare = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "" }], []);
    const diff = diffBranches(base, compare);

    const removedDiff = diff.nodeDiffs.find((d) => d.nodeId === "n2");
    expect(removedDiff?.impactedEdgeCount).toBe(2); // edges n1→n2 and n2→n3
  });

  it("uses default branch ids when not provided", () => {
    const graph = makeGraph([], []);
    const diff = diffBranches(graph, graph);
    expect(diff.baseId).toBe("base");
    expect(diff.compareId).toBe("compare");
  });

  it("normalizes graphs through blueprintGraphSchema.parse", () => {
    // Send graphs missing default status — schema should normalize
    const graph = makeGraph([{ id: "n1", kind: "function", name: "foo", summary: "" }], []);
    const diff = diffBranches(graph, graph);
    expect(diff.nodeDiffs[0].before?.status).toBe("spec_only");
  });
});