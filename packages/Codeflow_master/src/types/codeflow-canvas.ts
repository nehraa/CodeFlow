/**
 * Type definitions for @abhinav2203/codeflow-canvas
 * React Flow graph canvas with Monaco code editors and IDE layout components
 */

import type { Node, Edge, NodeTypes, EdgeTypes } from '@xyflow/react';

export interface CanvasConfig {
  nodes?: Node[];
  edges?: Edge[];
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
  defaultNodeType?: string;
  defaultEdgeType?: string;
  fitView?: boolean;
  fitViewOptions?: {
    padding?: number;
    includeHiddenNodes?: boolean;
  };
  minZoom?: number;
  maxZoom?: number;
  defaultEdgeOptions?: Partial<Edge>;
}

export interface NodeData {
  label: string;
  description?: string;
  selected?: boolean;
  status?: 'idle' | 'running' | 'completed' | 'error';
  [key: string]: any;
}

export interface EdgeData {
  animated?: boolean;
  label?: string;
  style?: Record<string, any>;
  [key: string]: any;
}

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: string | null;
  zoom: number;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  selectNode: (id: string | null) => void;
  setZoom: (zoom: number) => void;
}

export interface CanvasBlueprintNode extends Node {
  type: 'blueprint';
  data: NodeData & {
    label: string;
    description?: string;
  };
}

export interface CanvasAgentNode extends Node {
  type: 'agent';
  data: NodeData & {
    label: string;
    description?: string;
    status?: 'idle' | 'running' | 'completed' | 'error';
  };
}

export interface CanvasGhostNode extends Node {
  type: 'ghost';
  data: NodeData & {
    label: string;
    description?: string;
    fitness?: number;
  };
}

export interface CanvasTwinNode extends Node {
  type: 'twin';
  data: NodeData & {
    label: string;
    description?: string;
    syncStatus?: 'synced' | 'syncing' | 'error';
  };
}

export interface CanvasExecutionNode extends Node {
  type: 'execution';
  data: NodeData & {
    label: string;
    description?: string;
    output?: string;
    status?: 'idle' | 'running' | 'completed' | 'error';
  };
}

export type CodeflowCanvasNode = CanvasBlueprintNode | CanvasAgentNode | CanvasGhostNode | CanvasTwinNode | CanvasExecutionNode;

export interface CanvasEventHandlers {
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
  onNodeDragStart?: (event: React.MouseEvent, node: Node) => void;
  onNodeDrag?: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop?: (event: React.MouseEvent, node: Node) => void;
  onNodesChange?: (changes: any[]) => void;
  onEdgesChange?: (changes: any[]) => void;
  onConnect?: (connection: any) => void;
}

export interface MiniMapConfig {
  nodeColor?: (node: Node) => string;
  nodeStrokeColor?: (node: Node) => string;
  nodeIconColor?: (node: Node) => string;
  maskColor?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface ControlsConfig {
  showZoom?: boolean;
  showFitView?: boolean;
  showMiniMap?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}