import { create } from "zustand";

import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core/schema";

type GraphStateUpdater = BlueprintGraph | null | ((current: BlueprintGraph | null) => BlueprintGraph | null);
type NodeUpdater = Partial<BlueprintNode> | ((node: BlueprintNode) => BlueprintNode);

export interface BlueprintStore {
  graph: BlueprintGraph | null;
  setGraph: (next: GraphStateUpdater) => void;
  updateNode: (id: string, patch: NodeUpdater) => void;
  openFiles: string[];
  activeFile: string | null;
  setOpenFiles: (paths: string[]) => void;
  setActiveFile: (path: string | null) => void;
  closeFile: (path: string) => void;
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
    }),
  openFiles: [],
  activeFile: null,
  setOpenFiles: (paths) =>
    set(() => ({
      openFiles: paths
    })),
  setActiveFile: (path) =>
    set(() => ({
      activeFile: path
    })),
  closeFile: (path) =>
    set((state) => {
      const nextOpenFiles = state.openFiles.filter((f) => f !== path);
      const nextActiveFile =
        state.activeFile === path
          ? nextOpenFiles[nextOpenFiles.length - 1] ?? null
          : state.activeFile;

      return {
        openFiles: nextOpenFiles,
        activeFile: nextActiveFile
      };
    })
}));
