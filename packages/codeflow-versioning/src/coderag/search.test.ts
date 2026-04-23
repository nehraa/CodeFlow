import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BranchDiff, GraphBranch } from "@abhinav2203/codeflow-core/schema";
import { formatStructuralDiff, explainBranchDiff, searchBranches } from "./search.js";

// Mock getCodeRagInstance
vi.mock("./index.js", () => ({
  getCodeRagInstance: vi.fn()
}));

// Full contract shape to satisfy required fields
const makeContract = (overrides: Partial<{}> = {}) => ({
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

// Minimal graph fixture factory
const makeGraph = (
  nodes: Array<{ id: string; kind: "function" | "module" | "api" | "class" | "ui-screen"; name: string; summary: string }>,
  edges: Array<{ from: string; to: string; kind: "imports" | "calls" | "inherits" | "renders" | "emits" | "consumes" | "reads-state" | "writes-state" }>
) => ({
  projectName: "test-project",
  mode: "essential" as const,
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
    status: "spec_only" as const,
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

// Helper to make a minimal GraphBranch
const makeBranch = (
  id: string,
  name: string,
  graphNodes: Array<{ id: string; kind: "function" | "module" | "api" | "class" | "ui-screen"; name: string; summary: string }>,
  graphEdges: Array<{ from: string; to: string; kind: "imports" | "calls" | "inherits" | "renders" | "emits" | "consumes" | "reads-state" | "writes-state" }>,
  parentBranchId?: string
): GraphBranch => ({
  id,
  name,
  projectName: "test-project",
  createdAt: "2024-01-01T00:00:00Z",
  parentBranchId,
  graph: makeGraph(graphNodes, graphEdges),
});

describe("search.ts", () => {
  describe("formatStructuralDiff", () => {
    it("should format a diff with all changes", () => {
      const diff: BranchDiff = {
        baseId: "base-branch",
        compareId: "compare-branch",
        addedNodes: 2,
        removedNodes: 1,
        modifiedNodes: 1,
        addedEdges: 3,
        removedEdges: 2,
        impactedNodeIds: ["node-1", "node-2", "node-3"],
        nodeDiffs: [
          {
            nodeId: "node-1",
            name: "AddedNode",
            kind: "added",
            after: { id: "node-1", name: "AddedNode", kind: "function" as const, summary: "", path: undefined, ownerId: undefined, signature: undefined, contract: makeContract(), status: "spec_only" as const, sourceRefs: [], generatedRefs: [], traceRefs: [] },
            impactedEdgeCount: 1
          },
          {
            nodeId: "node-2",
            name: "RemovedNode",
            kind: "removed",
            before: { id: "node-2", name: "RemovedNode", kind: "function" as const, summary: "", path: undefined, ownerId: undefined, signature: undefined, contract: makeContract(), status: "spec_only" as const, sourceRefs: [], generatedRefs: [], traceRefs: [] },
            impactedEdgeCount: 2
          },
          {
            nodeId: "node-3",
            name: "ModifiedNode",
            kind: "modified",
            before: { id: "node-3", name: "ModifiedNode", kind: "function" as const, summary: "Before summary", path: undefined, ownerId: undefined, signature: undefined, contract: makeContract(), status: "spec_only" as const, sourceRefs: [], generatedRefs: [], traceRefs: [] },
            after: { id: "node-3", name: "ModifiedNode", kind: "function" as const, summary: "After summary", path: undefined, ownerId: undefined, signature: undefined, contract: makeContract(), status: "spec_only" as const, sourceRefs: [], generatedRefs: [], traceRefs: [] },
            impactedEdgeCount: 0
          }
        ],
        edgeDiffs: [
          { from: "a", to: "b", edgeKind: "calls" as const, diffKind: "added" },
          { from: "b", to: "c", edgeKind: "calls" as const, diffKind: "removed" },
          { from: "c", to: "d", edgeKind: "calls" as const, diffKind: "unchanged" }
        ]
      };

      const result = formatStructuralDiff(diff, "all");

      expect(result).toContain("## Branch Diff: base-branch → compare-branch");
      expect(result).toContain("Added: 2 node(s), 3 edge(s)");
      expect(result).toContain("Removed: 1 node(s), 2 edge(s)");
      expect(result).toContain("Modified: 1 node(s)");
      expect(result).toContain("**AddedNode** (ADDED)");
      expect(result).toContain("**RemovedNode** (REMOVED)");
      expect(result).toContain("**ModifiedNode** (MODIFIED)");
      expect(result).toContain("Before: \"Before summary\"");
      expect(result).toContain("After: \"After summary\"");
      expect(result).toContain("+ a → b (calls)");
      expect(result).toContain("- b → c (calls)");
      expect(result).toContain("Impacted Nodes");
    });

    it("should filter to nodes only when focusOn is nodes", () => {
      const diff: BranchDiff = {
        baseId: "base",
        compareId: "compare",
        addedNodes: 1,
        removedNodes: 0,
        modifiedNodes: 0,
        addedEdges: 5,
        removedEdges: 3,
        impactedNodeIds: [],
        nodeDiffs: [
          {
            nodeId: "n1",
            name: "TestNode",
            kind: "added",
            after: { id: "n1", name: "TestNode", kind: "function" as const, summary: "", path: undefined, ownerId: undefined, signature: undefined, contract: makeContract(), status: "spec_only" as const, sourceRefs: [], generatedRefs: [], traceRefs: [] },
            impactedEdgeCount: 0
          }
        ],
        edgeDiffs: [
          { from: "a", to: "b", edgeKind: "calls" as const, diffKind: "added" }
        ]
      };

      const result = formatStructuralDiff(diff, "nodes");

      expect(result).toContain("### Nodes");
      expect(result).not.toContain("### Edges");
      expect(result).toContain("**TestNode** (ADDED)");
    });

    it("should filter to edges only when focusOn is edges", () => {
      const diff: BranchDiff = {
        baseId: "base",
        compareId: "compare",
        addedNodes: 1,
        removedNodes: 0,
        modifiedNodes: 0,
        addedEdges: 1,
        removedEdges: 0,
        impactedNodeIds: [],
        nodeDiffs: [],
        edgeDiffs: [
          { from: "x", to: "y", edgeKind: "calls" as const, diffKind: "added" }
        ]
      };

      const result = formatStructuralDiff(diff, "edges");

      expect(result).toContain("### Edges");
      expect(result).not.toContain("### Nodes");
      expect(result).toContain("+ x → y (calls)");
    });

    it("should handle empty diff", () => {
      const diff: BranchDiff = {
        baseId: "empty-base",
        compareId: "empty-compare",
        addedNodes: 0,
        removedNodes: 0,
        modifiedNodes: 0,
        addedEdges: 0,
        removedEdges: 0,
        impactedNodeIds: [],
        nodeDiffs: [],
        edgeDiffs: []
      };

      const result = formatStructuralDiff(diff, "all");

      expect(result).toContain("Added: 0 node(s), 0 edge(s)");
      expect(result).toContain("Removed: 0 node(s), 0 edge(s)");
    });
  });

  describe("searchBranches", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return empty array when CodeRAG is not initialized", async () => {
      const { getCodeRagInstance } = await import("./index.js");
      vi.mocked(getCodeRagInstance).mockReturnValue(null);

      const result = await searchBranches({
        projectName: "test-project",
        query: "authentication"
      });

      expect(result).toEqual([]);
    });

    it("should return empty array when query returns no answer", async () => {
      const mockCodeRag = {
        query: vi.fn().mockResolvedValue({ answer: "", context: { primaryNode: null, relatedNodes: [], warnings: [], graphSummary: "" } })
      };
      const { getCodeRagInstance } = await import("./index.js");
      vi.mocked(getCodeRagInstance).mockReturnValue(mockCodeRag as any);

      const result = await searchBranches({
        projectName: "test-project",
        query: "test query"
      });

      expect(result).toEqual([]);
    });
  });

  describe("explainBranchDiff", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return structured diff when CodeRAG is not available", async () => {
      const { getCodeRagInstance } = await import("./index.js");
      vi.mocked(getCodeRagInstance).mockReturnValue(null);

      const baseBranch = makeBranch("base-1", "base-branch", [
        { id: "n1", kind: "function", name: "Node1", summary: "A function" }
      ], []);

      const compareBranch = makeBranch("compare-1", "compare-branch", [
        { id: "n1", kind: "function", name: "Node1", summary: "A function" },
        { id: "n2", kind: "function", name: "Node2", summary: "Another function" }
      ], [], "base-1");

      const result = await explainBranchDiff({
        baseBranch,
        compareBranch,
        focusOn: "nodes"
      });

      expect(result).toContain("## Branch Diff");
      expect(result).toContain("Added: 1 node(s)");
    });

    it("should enhance with CodeRAG answer when available", async () => {
      const mockCodeRag = {
        query: vi.fn().mockResolvedValue({
          answer: "This branch adds user authentication functionality.",
          context: { primaryNode: null, relatedNodes: [], warnings: [], graphSummary: "" }
        })
      };
      const { getCodeRagInstance } = await import("./index.js");
      vi.mocked(getCodeRagInstance).mockReturnValue(mockCodeRag as any);

      const baseBranch = makeBranch("base-1", "main", [], []);
      const compareBranch = makeBranch("compare-1", "feature-auth", [
        { id: "n1", kind: "class", name: "AuthService", summary: "Authentication service" }
      ], [], "base-1");

      const result = await explainBranchDiff({
        baseBranch,
        compareBranch,
        focusOn: "all"
      });

      expect(result).toBe("This branch adds user authentication functionality.");
    });
  });
});