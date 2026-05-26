import type { Edge, Node } from "@xyflow/react";
import type { HeatmapData } from "../lib/heatmap.js";
import type { BlueprintGraph, GhostNode } from "@abhinav2203/codeflow-core/schema";
import type { FlowNodeData } from "../lib/flow-view.js";
import type { RuntimeExecutionResult } from "@abhinav2203/codeflow-core/schema";
type GraphCanvasProps = {
    graph: BlueprintGraph | null;
    selectedNodeId: string | null;
    onSelect: (nodeId: string) => void;
    nodes?: Array<Node<FlowNodeData>>;
    edges?: Edge[];
    onNodeDoubleClick?: (nodeId: string) => void;
    emptyMessage?: string;
    ghostNodes?: GhostNode[];
    onGhostNodeClick?: (ghost: GhostNode) => void;
    heatmapData?: HeatmapData;
    activeNodeIds?: string[];
    driftedNodeIds?: string[];
    executionResult?: RuntimeExecutionResult | null;
    detailMode?: boolean;
    theme?: "light" | "dark";
};
export declare function GraphCanvas({ graph, selectedNodeId, onSelect, nodes, edges, onNodeDoubleClick, emptyMessage, ghostNodes, onGhostNodeClick, heatmapData, activeNodeIds, driftedNodeIds, executionResult, detailMode, theme }: GraphCanvasProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=graph-canvas.d.ts.map