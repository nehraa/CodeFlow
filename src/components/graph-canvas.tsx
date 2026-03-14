"use client";

import type { Edge, Node } from "@xyflow/react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";

import type { HeatmapData } from "@/lib/blueprint/heatmap";
import type { BlueprintGraph, GhostNode } from "@/lib/blueprint/schema";
import { buildFlowEdges, buildFlowNodes, buildGhostFlowNodes } from "@/lib/blueprint/flow-view";
import type { FlowNodeData } from "@/lib/blueprint/flow-view";

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
};

export function GraphCanvas({
  graph,
  selectedNodeId,
  onSelect,
  nodes,
  edges,
  onNodeDoubleClick,
  emptyMessage,
  ghostNodes,
  onGhostNodeClick,
  heatmapData
}: GraphCanvasProps) {
  const baseFlowNodes =
    nodes ?? (graph ? buildFlowNodes(graph, selectedNodeId ?? undefined, heatmapData) : []);
  const ghostFlowNodes =
    ghostNodes && ghostNodes.length > 0 ? buildGhostFlowNodes(ghostNodes, baseFlowNodes) : [];
  const flowNodes = [...baseFlowNodes, ...ghostFlowNodes];
  const flowEdges = edges ?? (graph ? buildFlowEdges(graph) : []);

  if (!graph && flowNodes.length === 0) {
    return (
      <div className="canvas-empty">
        <p>{emptyMessage ?? "Build a blueprint from an AI prompt, PRD text, or a JavaScript/TypeScript repo."}</p>
      </div>
    );
  }

  const handleNodeClick = (_: React.MouseEvent, node: Node<FlowNodeData>) => {
    if (node.data.ghost && onGhostNodeClick) {
      const ghost = ghostNodes?.find((g) => g.id === node.id);
      if (ghost) {
        onGhostNodeClick(ghost);
        return;
      }
    }

    onSelect(node.id);
  };

  return (
    <ReactFlowProvider>
      <div className="canvas-shell">
        <ReactFlow
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.35}
          maxZoom={1.8}
          nodes={flowNodes}
          edges={flowEdges}
          className="graph-flow"
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node.id)}
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background color="rgba(15, 23, 42, 0.10)" gap={24} size={1.2} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
