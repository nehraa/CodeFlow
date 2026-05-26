/**
 * ghostnodes.ts
 *
 * Track proposed/intended execution paths — nodes that haven't run yet.
 */

import type { BlueprintGraph } from "@abhinav2203/codeflow-core";

// ── Types ────────────────────────────────────────────────────────────────────────

export type GhostState = "proposed" | "confirmed" | "skipped";

export interface GhostNodeState {
  nodeId: string;
  state: GhostState;
  confirmedAt?: number;
}

export class GhostNodeTracker {
  states = new Map<string, GhostNodeState>();
  private readonly _graph: BlueprintGraph;

  constructor(graph: BlueprintGraph) {
    this._graph = graph;
    for (const node of graph.nodes) {
      this.states.set(node.id, { nodeId: node.id, state: "proposed" });
    }
  }

  getState(nodeId: string): GhostNodeState | undefined {
    return this.states.get(nodeId);
  }

  getAllStates(): Map<string, GhostNodeState> {
    return new Map(this.states);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Creates a GhostNodeTracker and marks all graph nodes as 'proposed'.
 */
export const trackGhostNodes = (graph: BlueprintGraph): GhostNodeTracker => {
  return new GhostNodeTracker(graph);
};

// ── State mutation ───────────────────────────────────────────────────────────

/**
 * Updates a node's ghost state and sets confirmedAt when confirming.
 */
export const updateGhostState = (
  tracker: GhostNodeTracker,
  nodeId: string,
  newState: GhostState
): void => {
  const current = tracker.states.get(nodeId);
  if (!current) return;

  tracker.states.set(nodeId, {
    nodeId,
    state: newState,
    confirmedAt: newState === "confirmed" ? Date.now() : undefined
  });
};

// ── Path computation ────────────────────────────────────────────────────────────

/**
 * Returns proposed nodes in dependency order (topological sort).
 */
export const getProposedPath = (tracker: GhostNodeTracker): string[] => {
  const proposed: string[] = [];
  for (const [, state] of tracker.states) {
    if (state.state === "proposed") {
      proposed.push(state.nodeId);
    }
  }

  // Topological sort using Kahn's algorithm on the proposed subset
  const nodeIds = new Set(proposed);

  // Build in-degree map for proposed nodes only
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) inDegree.set(id, 0);

  for (const edge of tracker["_graph"].edges) {
    if (nodeIds.has(edge.to) && nodeIds.has(edge.from)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const id of nodeIds) {
    if (inDegree.get(id) === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const edge of tracker["_graph"].edges) {
      if (edge.from === current && nodeIds.has(edge.to)) {
        const newDegree = (inDegree.get(edge.to) ?? 0) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0) queue.push(edge.to);
      }
    }
  }

  return sorted.length === nodeIds.size ? sorted : proposed;
};
