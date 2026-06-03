/**
 * codeflow-canvas wrapper
 * React Flow graph canvas with Monaco code editors and IDE layout components
 */

// Re-export components and types
export {
  CodeflowCanvas,
  VCRControls,
  BlueprintNode,
  AgentNode,
  GhostNode,
  TwinNode,
  ExecutionNode,
} from '@/components/canvas';

export type {
  CanvasConfig,
  NodeData,
  EdgeData,
  CanvasState,
  CanvasEventHandlers,
  MiniMapConfig,
  ControlsConfig,
  CodeflowCanvasNode,
} from '@/types/codeflow-canvas';

import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { CanvasState } from '@/types/codeflow-canvas';

// Canvas state management store
interface ExtendedCanvasState extends CanvasState {
  history: { nodes: Node[]; edges: Edge[] }[];
  historyIndex: number;
  addToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useCanvasStore = create<ExtendedCanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  zoom: 1,
  history: [],
  historyIndex: -1,

  setNodes: (nodes: Node[]) => {
    set({ nodes });
    get().addToHistory();
  },

  setEdges: (edges: Edge[]) => {
    set({ edges });
    get().addToHistory();
  },

  selectNode: (id: string | null) => set({ selectedNode: id }),

  setZoom: (zoom: number) => set({ zoom }),

  addToHistory: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ nodes: state.nodes, edges: state.edges });

    // Limit history size
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const prevState = state.history[state.historyIndex - 1];
      set({
        nodes: prevState.nodes,
        edges: prevState.edges,
        historyIndex: state.historyIndex - 1,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const nextState = state.history[state.historyIndex + 1];
      set({
        nodes: nextState.nodes,
        edges: nextState.edges,
        historyIndex: state.historyIndex + 1,
      });
    }
  },

  canUndo: () => get().historyIndex > 0,

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },
}));

// Canvas action helpers
export function useCanvasActions() {
  const store = useCanvasStore();

  return {
    addNode: (node: Node) => {
      store.setNodes([...store.nodes, node]);
    },
    removeNode: (nodeId: string) => {
      store.setNodes(store.nodes.filter((n) => n.id !== nodeId));
    },
    updateNode: (nodeId: string, updates: Partial<Node>) => {
      store.setNodes(
        store.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...updates } : n
        )
      );
    },
    addEdge: (edge: Edge) => {
      store.setEdges([...store.edges, edge]);
    },
    removeEdge: (edgeId: string) => {
      store.setEdges(store.edges.filter((e) => e.id !== edgeId));
    },
    clearCanvas: () => {
      store.setNodes([]);
      store.setEdges([]);
    },
    fitView: () => {
      // This would typically call React Flow's fitView method
      console.log('[canvas] fitView called');
    },
  };
}