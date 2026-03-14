"use client";

import type { Edge, Node } from "@xyflow/react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";

import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { buildFlowEdges, buildFlowNodes } from "@/lib/blueprint/flow-view";
import type { FlowNodeData } from "@/lib/blueprint/flow-view";

type GraphCanvasProps = {
  graph: BlueprintGraph | null;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  nodes?: Array<Node<FlowNodeData>>;
  edges?: Edge[];
  onNodeDoubleClick?: (nodeId: string) => void;
  emptyMessage?: string;
};

export function GraphCanvas({
  graph,
  selectedNodeId,
  onSelect,
  nodes,
  edges,
  onNodeDoubleClick,
  emptyMessage
}: GraphCanvasProps) {
  const flowNodes = nodes ?? (graph ? buildFlowNodes(graph, selectedNodeId ?? undefined) : []);
  const flowEdges = edges ?? (graph ? buildFlowEdges(graph) : []);

  if (!graph && flowNodes.length === 0) {
    return (
      <div className="canvas-empty">
        <p>{emptyMessage ?? "Build a blueprint from an AI prompt, PRD text, or a JavaScript/TypeScript repo."}</p>
      </div>
    );
  }

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
          onNodeClick={(_, node) => onSelect(node.id)}
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
