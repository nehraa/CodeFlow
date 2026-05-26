import { describe, expect, it } from "vitest";
import {
  trackGhostNodes,
  updateGhostState,
  getProposedPath,
  GhostNodeTracker
} from "./ghostnodes.js";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core";
import { emptyContract } from "@abhinav2203/codeflow-core";

const makeGraph = (nodes: Array<{ id: string; name: string; kind: string }>): BlueprintGraph => ({
  projectName: "Test",
  mode: "essential",
  generatedAt: new Date().toISOString(),
  warnings: [],
  workflows: [],
  edges: [],
  nodes: nodes.map((n) => ({
    id: n.id,
    kind: n.kind as BlueprintGraph["nodes"][0]["kind"],
    name: n.name,
    summary: n.name,
    contract: { ...emptyContract(), summary: n.name },
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: []
  }))
});

// ── trackGhostNodes ─────────────────────────────────────────────────────────

describe("trackGhostNodes", () => {
  it("initializes all nodes as 'proposed'", () => {
    const graph = makeGraph([
      { id: "a", name: "A", kind: "function" },
      { id: "b", name: "B", kind: "function" }
    ]);
    const tracker = trackGhostNodes(graph);
    expect(tracker.getState("a")?.state).toBe("proposed");
    expect(tracker.getState("b")?.state).toBe("proposed");
  });

  it("returns a GhostNodeTracker instance", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    expect(trackGhostNodes(graph)).toBeInstanceOf(GhostNodeTracker);
  });
});

// ── GhostNodeTracker.getState / getAllStates ─────────────────────────────────

describe("GhostNodeTracker", () => {
  it("getState returns undefined for unknown nodeId", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    expect(tracker.getState("unknown")).toBeUndefined();
  });

  it("getState returns the current GhostNodeState", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    const state = tracker.getState("a");
    expect(state).toMatchObject({ nodeId: "a", state: "proposed" });
  });

  it("getAllStates returns a Map with all nodes", () => {
    const graph = makeGraph([
      { id: "a", name: "A", kind: "function" },
      { id: "b", name: "B", kind: "function" }
    ]);
    const tracker = trackGhostNodes(graph);
    expect(tracker.getAllStates().size).toBe(2);
  });
});

// ── updateGhostState ─────────────────────────────────────────────────────────

describe("updateGhostState", () => {
  it("updates a node from 'proposed' to 'confirmed'", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    updateGhostState(tracker, "a", "confirmed");
    expect(tracker.getState("a")?.state).toBe("confirmed");
  });

  it("updates a node to 'skipped'", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    updateGhostState(tracker, "a", "skipped");
    expect(tracker.getState("a")?.state).toBe("skipped");
  });

  it("sets confirmedAt timestamp when confirming", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    const before = Date.now();
    updateGhostState(tracker, "a", "confirmed");
    const after = Date.now();
    const state = tracker.getState("a");
    expect(state?.confirmedAt).toBeGreaterThanOrEqual(before);
    expect(state?.confirmedAt).toBeLessThanOrEqual(after);
  });

  it("removes confirmedAt when moving back to 'proposed'", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    updateGhostState(tracker, "a", "confirmed");
    updateGhostState(tracker, "a", "proposed");
    expect(tracker.getState("a")?.confirmedAt).toBeUndefined();
  });
});

// ── getProposedPath ─────────────────────────────────────────────────────────

describe("getProposedPath", () => {
  it("returns all proposed nodes in dependency order", () => {
    const graph = makeGraph([
      { id: "a", name: "A", kind: "function" },
      { id: "b", name: "B", kind: "function" },
      { id: "c", name: "C", kind: "function" }
    ]);
    const tracker = trackGhostNodes(graph);
    const path = getProposedPath(tracker);
    // All three should be proposed
    expect(path).toHaveLength(3);
    expect(path).toContain("a");
    expect(path).toContain("b");
    expect(path).toContain("c");
  });

  it("excludes confirmed nodes from the proposed path", () => {
    const graph = makeGraph([
      { id: "a", name: "A", kind: "function" },
      { id: "b", name: "B", kind: "function" }
    ]);
    const tracker = trackGhostNodes(graph);
    updateGhostState(tracker, "a", "confirmed");
    const path = getProposedPath(tracker);
    expect(path).not.toContain("a");
    expect(path).toContain("b");
  });

  it("excludes skipped nodes from the proposed path", () => {
    const graph = makeGraph([
      { id: "a", name: "A", kind: "function" },
      { id: "b", name: "B", kind: "function" }
    ]);
    const tracker = trackGhostNodes(graph);
    updateGhostState(tracker, "b", "skipped");
    const path = getProposedPath(tracker);
    expect(path).not.toContain("b");
  });

  it("returns proposed nodes in topological order based on edges", () => {
    // Graph with edges: a → b → c
    const graphWithEdges: BlueprintGraph = {
      projectName: "Test",
      mode: "essential",
      generatedAt: new Date().toISOString(),
      warnings: [],
      workflows: [],
      edges: [
        { id: "e1", from: "a", to: "b", kind: "dependency" },
        { id: "e2", from: "b", to: "c", kind: "dependency" }
      ],
      nodes: [
        { id: "a", kind: "function", name: "A", summary: "A", contract: { ...emptyContract(), summary: "A" }, sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "b", kind: "function", name: "B", summary: "B", contract: { ...emptyContract(), summary: "B" }, sourceRefs: [], generatedRefs: [], traceRefs: [] },
        { id: "c", kind: "function", name: "C", summary: "C", contract: { ...emptyContract(), summary: "C" }, sourceRefs: [], generatedRefs: [], traceRefs: [] }
      ]
    };
    const tracker = trackGhostNodes(graphWithEdges);
    const path = getProposedPath(tracker);
    // Topological: roots first (a), then b, then c
    expect(path.indexOf("a")).toBeLessThan(path.indexOf("b"));
    expect(path.indexOf("b")).toBeLessThan(path.indexOf("c"));
  });

  it("returns empty array when all nodes are confirmed or skipped", () => {
    const graph = makeGraph([{ id: "a", name: "A", kind: "function" }]);
    const tracker = trackGhostNodes(graph);
    updateGhostState(tracker, "a", "confirmed");
    expect(getProposedPath(tracker)).toHaveLength(0);
  });
});
