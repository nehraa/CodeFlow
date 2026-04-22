import { create } from "zustand";

import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core/schema";

type GraphStateUpdater = BlueprintGraph | null | ((current: BlueprintGraph | null) => BlueprintGraph | null);
type NodeUpdater = Partial<BlueprintNode> | ((node: BlueprintNode) => BlueprintNode);

export type WorkbenchMode = "graph" | "ide";

export interface FloatingGraphPanel {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlueprintStore {
  graph: BlueprintGraph | null;
  setGraph: (next: GraphStateUpdater) => void;
  updateNode: (id: string, patch: NodeUpdater) => void;
  openFiles: string[];
  activeFile: string | null;
  setOpenFiles: (paths: string[]) => void;
  setActiveFile: (path: string | null) => void;
  closeFile: (path: string) => void;
  repoPath: string | null;
  setRepoPath: (path: string | null) => void;
  mode: WorkbenchMode;
  setMode: (mode: WorkbenchMode) => void;
  floatingGraph: FloatingGraphPanel;
  setFloatingGraph: (panel: Partial<FloatingGraphPanel>) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  dirtyFiles: Record<string, boolean>;
  setFileDirty: (path: string, dirty: boolean) => void;
  clearFileDirty: (path: string) => void;
}

const resolveGraphUpdate = (
  current: BlueprintGraph | null,
  next: GraphStateUpdater
): BlueprintGraph | null => (typeof next === "function" ? next(current) : next);

const resolveNodeUpdate = (node: BlueprintNode, patch: NodeUpdater): BlueprintNode =>
  typeof patch === "function" ? patch(node) : { ...node, ...patch };

/**
 * NOTE: useBlueprintStore is a React hook. It crashes in non-React environments
 * (e.g., Node.js servers) because React hook invariants require React to be present.
 * This export exists for backwards-compatibility with existing React consumers only.
 * Node.js callers should not use this — create a plain Zustand store directly.
 *
 * The `react` peerDependency is declared in package.json to enforce this constraint.
 */
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
    set((state) => ({
      activeFile: path,
      floatingGraph: {
        ...state.floatingGraph,
        visible: path !== null
      }
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
        activeFile: nextActiveFile,
        floatingGraph: {
          ...state.floatingGraph,
          visible: nextActiveFile !== null
        },
        dirtyFiles: { ...state.dirtyFiles, [path]: false }
      };
    }),
  repoPath: null,
  setRepoPath: (path) => set(() => ({ repoPath: path })),
  mode: "ide",
  setMode: (mode) =>
    set((state) => ({
      mode,
      floatingGraph: {
        ...state.floatingGraph,
        visible: state.activeFile !== null
      }
    })),
  floatingGraph: {
    visible: false,
    x: 0,
    y: 0,
    width: 400,
    height: 350
  },
  setFloatingGraph: (panel) =>
    set((state) => ({
      floatingGraph: { ...state.floatingGraph, ...panel }
    })),
  selectedNodeId: null,
  setSelectedNodeId: (id) => set(() => ({ selectedNodeId: id })),
  dirtyFiles: {},
  setFileDirty: (path, dirty) =>
    set((state) => ({
      dirtyFiles: { ...state.dirtyFiles, [path]: dirty }
    })),
  clearFileDirty: (path) =>
    set((state) => {
      const { [path]: _, ...rest } = state.dirtyFiles;
      return { dirtyFiles: rest };
    })
}));
