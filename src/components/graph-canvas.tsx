"use client";

import { memo, useEffect } from "react";

import type { Edge, Node, NodeProps } from "@xyflow/react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from "@xyflow/react";

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
  activeNodeIds?: string[];
  /** Node IDs that have detected architectural drift (rendered with shake + highlight). */
  driftedNodeIds?: string[];
  detailMode?: boolean;
  theme?: "light" | "dark";
};

const TRACE_STATUS_LABEL: Record<FlowNodeData["traceStatus"], string> = {
  idle: "Ready",
  success: "Synced",
  warning: "Deploying",
  error: "Invalid"
};

const HEALTH_STATUS_LABEL: Record<FlowNodeData["healthState"], string> = {
  neutral: "Stable",
  aligned: "Aligned",
  drift: "Drift",
  heal: "Heal",
  ghost: "Ghost"
};

const PolicyNode = memo(function PolicyNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <>
      <Handle className="policy-node-handle" position={Position.Left} type="target" />
      <div
        className={[
          "policy-node-card",
          `policy-node-${data.traceStatus}`,
          `policy-node-health-${data.healthState}`,
          data.isActiveBatch ? "is-batch-focus" : "",
          data.isGhost ? "is-ghost" : "",
          selected ? "is-selected" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="policy-node-topline">
          <span className="policy-node-kind">{data.kind}</span>
          <div className="policy-node-pills">
            {data.isActiveBatch ? <span className="policy-node-badge policy-node-badge-batch">Batch focus</span> : null}
            <span className="policy-node-badge policy-node-badge-health">{HEALTH_STATUS_LABEL[data.healthState]}</span>
            <span className="policy-node-status">{TRACE_STATUS_LABEL[data.traceStatus]}</span>
          </div>
        </div>
        <h3>{data.label}</h3>
        <p>{data.summary || "Select this node to inspect its policy contract, runtime, and generated implementation."}</p>
        <div className="policy-node-footer">
          <span>{data.drilldownNodeId ? "Double-click for internals" : "Click to inspect"}</span>
          {data.selected ? <span>Focused</span> : null}
        </div>
      </div>
      <Handle className="policy-node-handle" position={Position.Right} type="source" />
    </>
  );
});

const nodeTypes = {
  policyNode: PolicyNode
};

function GraphViewportSync({
  edgeCount,
  nodeCount
}: {
  edgeCount: number;
  nodeCount: number;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!nodeCount) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void fitView({ duration: 220, padding: 0.18 });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [edgeCount, fitView, nodeCount]);

  return null;
}

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
  heatmapData,
  activeNodeIds,
  driftedNodeIds,
  detailMode = false,
  theme = "light"
}: GraphCanvasProps) {
  const baseFlowNodes =
    nodes ?? (graph ? buildFlowNodes(graph, selectedNodeId ?? undefined, heatmapData, activeNodeIds, driftedNodeIds) : []);
  const typedBaseFlowNodes = baseFlowNodes.map((node) => ({
    ...node,
    type: node.type ?? "policyNode"
  }));
  const ghostFlowNodes =
    ghostNodes && ghostNodes.length > 0 ? buildGhostFlowNodes(ghostNodes, typedBaseFlowNodes) : [];
  const flowNodes = [...typedBaseFlowNodes, ...ghostFlowNodes];
  const flowEdges = edges ?? (graph ? buildFlowEdges(graph, activeNodeIds) : []);

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
      <div className={`canvas-shell ${detailMode ? "canvas-shell-detail" : ""}`}>
        <ReactFlow
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.35}
          maxZoom={1.8}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          className="graph-flow"
          onNodeClick={handleNodeClick}
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: theme === "dark" ? "#6fe0d8" : "#15786f"
            }
          }}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node.id)}
        >
          <GraphViewportSync edgeCount={flowEdges.length} nodeCount={flowNodes.length} />
          <MiniMap
            pannable
            zoomable
            nodeBorderRadius={10}
            maskColor={theme === "dark" ? "rgba(5, 10, 20, 0.76)" : "rgba(255, 255, 255, 0.75)"}
            nodeColor={(node) => {
              const data = (node as Node<FlowNodeData>).data;

              if (data?.isActiveBatch) {
                return theme === "dark" ? "#67e2db" : "#15786f";
              }

              switch (data?.healthState) {
                case "aligned":
                  return theme === "dark" ? "#4ade80" : "#15803d";
                case "drift":
                  return theme === "dark" ? "#fbbf24" : "#c67a00";
                case "heal":
                  return theme === "dark" ? "#fb7185" : "#cf3b57";
                case "ghost":
                  return theme === "dark" ? "#64748b" : "#94a3b8";
                default:
                  return theme === "dark" ? "#27456c" : "#d7e7fc";
              }
            }}
            nodeStrokeColor={(node) => {
              const data = (node as Node<FlowNodeData>).data;
              return data?.isActiveBatch
                ? theme === "dark"
                  ? "#a7fff8"
                  : "#0f766e"
                : theme === "dark"
                  ? "rgba(167, 194, 236, 0.45)"
                  : "rgba(44, 66, 101, 0.22)";
            }}
            nodeStrokeWidth={2}
          />
          <Controls />
          <Background
            color={theme === "dark" ? "rgba(138, 173, 222, 0.12)" : "rgba(26, 42, 67, 0.08)"}
            gap={24}
            size={1.2}
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
