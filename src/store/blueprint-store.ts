import { create } from "zustand";

import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core/schema";

type GraphStateUpdater = BlueprintGraph | null | ((current: BlueprintGraph | null) => BlueprintGraph | null);
type NodeUpdater = Partial<BlueprintNode> | ((node: BlueprintNode) => BlueprintNode);

export interface BlueprintStore {
  graph: BlueprintGraph | null;
  setGraph: (next: GraphStateUpdater) => void;
  updateNode: (id: string, patch: NodeUpdater) => void;
}

const resolveGraphUpdate = (
  current: BlueprintGraph | null,
  next: GraphStateUpdater
): BlueprintGraph | null => (typeof next === "function" ? next(current) : next);

const resolveNodeUpdate = (node: BlueprintNode, patch: NodeUpdater): BlueprintNode =>
  typeof patch === "function" ? patch(node) : { ...node, ...patch };

export const useBlueprintStore = create<BlueprintStore>((set) => ({
  graph: null,
  setGraph: (next) =>
    set((state) => ({
      graph: resolveGraphUpdate(state.graph, next)
    })),
  updateNode: (id, patch) =>
    set((state) => {
      if (!state.graph) {
        return state;
      }

      return {
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map((node) =>
            node.id === id ? resolveNodeUpdate(node, patch) : node
          )
        }
      };
    })
}));
