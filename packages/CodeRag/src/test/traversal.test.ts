import { describe, expect, it } from "vitest";

import { traverseDependencies } from "../retrieval/traversal.js";
import type { GraphSnapshot } from "../types.js";

const snapshot: GraphSnapshot = {
  provider: "test",
  repoPath: "/repo",
  generatedAt: "2026-04-01T00:00:00.000Z",
  graph: {
    projectName: "repo",
    mode: "essential",
    generatedAt: "2026-04-01T00:00:00.000Z",
    phase: "spec",
    workflows: [],
    warnings: [],
    nodes: [
      { id: "a", name: "a", kind: "function", path: "a.ts", summary: "", signature: "", contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] }, sourceRefs: [] },
      { id: "b", name: "b", kind: "function", path: "b.ts", summary: "", signature: "", contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] }, sourceRefs: [] },
      { id: "c", name: "c", kind: "function", path: "c.ts", summary: "", signature: "", contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] }, sourceRefs: [] }
    ],
    edges: [
      { kind: "calls", from: "a", to: "b" },
      { kind: "calls", from: "b", to: "c" }
    ]
  },
  sourceSpans: {},
  callSites: {}
};

describe("graph traversal", () => {
  it("walks dependencies and dependents up to the requested depth", () => {
    expect(traverseDependencies(snapshot, "a", 0)).toEqual({ dependencies: [], dependents: [] });
    expect(traverseDependencies(snapshot, "a", 2).dependencies.map((node) => node.name)).toEqual(["b", "c"]);
    expect(traverseDependencies(snapshot, "c", 2).dependents.map((node) => node.name)).toEqual(["b", "a"]);
  });

  it("does not revisit nodes that were already collected", () => {
    const cyclicSnapshot: GraphSnapshot = {
      ...snapshot,
      graph: {
        ...snapshot.graph,
        edges: [
          { kind: "calls", from: "a", to: "b" },
          { kind: "calls", from: "b", to: "a" }
        ]
      }
    };

    expect(traverseDependencies(cyclicSnapshot, "a", 3).dependencies.map((node) => node.name)).toEqual(["b"]);
  });

  it("does not add the origin node as a dependent during cyclic upward traversal", () => {
    const cyclicSnapshot: GraphSnapshot = {
      ...snapshot,
      graph: {
        ...snapshot.graph,
        edges: [
          { kind: "calls", from: "b", to: "a" },
          { kind: "calls", from: "a", to: "b" }
        ]
      }
    };

    expect(traverseDependencies(cyclicSnapshot, "a", 3).dependents.map((node) => node.name)).toEqual(["b"]);
  });

  it("skips edges that point at nodes missing from the snapshot", () => {
    const brokenSnapshot: GraphSnapshot = {
      ...snapshot,
      graph: {
        ...snapshot.graph,
        edges: [{ kind: "calls", from: "a", to: "missing" }]
      }
    };

    expect(traverseDependencies(brokenSnapshot, "a", 2)).toEqual({
      dependencies: [],
      dependents: []
    });
  });
});
