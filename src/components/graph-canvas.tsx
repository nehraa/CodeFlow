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
import { buildExecutionProjection, buildFlowEdges, buildFlowNodes, buildGhostFlowNodes } from "@/lib/blueprint/flow-view";
import type {
  FlowExecutionProjection,
  FlowExecutionState,
  FlowExecutionStatus,
  FlowNodeData
} from "@/lib/blueprint/flow-view";
import type { RuntimeExecutionResult } from "@/lib/blueprint/schema";

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
  executionResult?: RuntimeExecutionResult | null;
  detailMode?: boolean;
  theme?: "light" | "dark";
};

const TRACE_STATUS_LABEL: Record<FlowNodeData["traceStatus"], string> = {
  idle: "Ready",
  success: "Synced",
  warning: "Deploying",
  error: "Invalid"
};

const EXECUTION_STATUS_LABEL: Record<FlowExecutionStatus, string> = {
  idle: "Idle",
  running: "Running",
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  skipped: "Skipped",
  warning: "Warning"
};

const EXECUTION_STATUS_TONE: Record<Exclude<FlowExecutionStatus, "idle">, string> = {
  running: "#2563eb",
  pending: "#64748b",
  passed: "#15803d",
  failed: "#dc2626",
  blocked: "#d97706",
  skipped: "#64748b",
  warning: "#c2410c"
};

const HEALTH_STATUS_LABEL: Record<FlowNodeData["healthState"], string> = {
  neutral: "Stable",
  aligned: "Aligned",
  drift: "Drift",
  heal: "Heal",
  ghost: "Ghost"
};

const mergeClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ").trim();

const getExecutionTone = (status?: FlowExecutionStatus): string | undefined => {
  if (!status || status === "idle") {
    return undefined;
  }

  return EXECUTION_STATUS_TONE[status];
};

const resolveExecutionFromNode = (
  node: Node<FlowNodeData>,
  projection: FlowExecutionProjection | null,
  graph?: BlueprintGraph | null
): FlowExecutionState | undefined => {
  if (node.data.execution && node.data.execution.status !== "idle") {
    return node.data.execution;
  }

  if (!projection) {
    return undefined;
  }

  if (node.data.drilldownNodeId && projection.nodeStates[node.data.drilldownNodeId]?.status) {
    return projection.nodeStates[node.data.drilldownNodeId];
  }

  if (projection.nodeStates[node.id]?.status) {
    return projection.nodeStates[node.id];
  }

  if (node.id.startsWith("detail:root:")) {
    const rootNodeId = node.id.slice("detail:root:".length);
    return projection.nodeStates[rootNodeId];
  }

  if (node.id.startsWith("detail:blueprint:")) {
    const blueprintNodeId = node.id.slice("detail:blueprint:".length);
    return projection.nodeStates[blueprintNodeId];
  }

  if (node.id.startsWith("detail:method:") && graph) {
    const suffix = node.id.slice("detail:method:".length);
    const lastSeparator = suffix.lastIndexOf(":");
    const rootNodeId = lastSeparator >= 0 ? suffix.slice(0, lastSeparator) : suffix;
    return projection.nodeStates[rootNodeId];
  }

  return undefined;
};

const PolicyNode = memo(function PolicyNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const executionStatus = data.execution?.status ?? "idle";
  const executionTone = getExecutionTone(executionStatus);

  return (
    <>
      <Handle className="policy-node-handle" position={Position.Left} type="target" />
      <div
        className={[
          "policy-node-card",
          `policy-node-${data.traceStatus}`,
          `policy-node-health-${data.healthState}`,
          executionStatus !== "idle" ? `policy-node-execution-${executionStatus}` : "",
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
            {executionStatus !== "idle" ? (
              <span
                className={`policy-node-badge policy-node-badge-execution policy-node-badge-execution-${executionStatus}`}
                style={executionTone ? { borderColor: executionTone, color: executionTone } : undefined}
              >
                {EXECUTION_STATUS_LABEL[executionStatus]}
              </span>
            ) : null}
            <span className="policy-node-status">{TRACE_STATUS_LABEL[data.traceStatus]}</span>
          </div>
        </div>
        <h3>{data.label}</h3>
        <p>{data.summary || "Select this node to inspect its policy contract, runtime, and generated implementation."}</p>
        {data.execution?.message ? <p className="policy-node-execution-message">{data.execution.message}</p> : null}
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
  executionResult,
  detailMode = false,
  theme = "light"
}: GraphCanvasProps) {
  const executionProjection = graph ? buildExecutionProjection(graph, executionResult) : null;
  const baseFlowNodes =
    nodes ??
    (graph
      ? buildFlowNodes(graph, selectedNodeId ?? undefined, heatmapData, activeNodeIds, driftedNodeIds, executionResult)
      : []);
  const typedBaseFlowNodes = baseFlowNodes.map((node) => {
    const execution = executionProjection ? resolveExecutionFromNode(node, executionProjection, graph) : undefined;

    return {
      ...node,
      type: node.type ?? "policyNode",
      data: execution
        ? {
            ...node.data,
            execution: node.data.execution ?? execution
          }
        : node.data
    };
  });
  const ghostFlowNodes =
    ghostNodes && ghostNodes.length > 0 ? buildGhostFlowNodes(ghostNodes, typedBaseFlowNodes) : [];
  const flowNodes = [...typedBaseFlowNodes, ...ghostFlowNodes];
  const flowEdges = edges ?? (graph ? buildFlowEdges(graph, activeNodeIds, executionResult) : []);
  const decoratedFlowEdges = flowEdges.map((edge) => {
    const execution = executionProjection?.edgeStates[edge.id];
    const sourceNode = flowNodes.find((node) => node.id === edge.source);
    const targetNode = flowNodes.find((node) => node.id === edge.target);
    const inferredStatus =
      execution?.status && execution.status !== "idle"
        ? execution.status
        : sourceNode?.data.execution?.status === "failed" || targetNode?.data.execution?.status === "failed"
          ? "failed"
          : sourceNode?.data.execution?.status === "blocked" || targetNode?.data.execution?.status === "blocked"
            ? "blocked"
            : sourceNode?.data.execution?.status === "running" || targetNode?.data.execution?.status === "running"
              ? "running"
              : sourceNode?.data.execution?.status === "warning" || targetNode?.data.execution?.status === "warning"
                ? "warning"
                : sourceNode?.data.execution?.status === "passed" && targetNode?.data.execution?.status === "passed"
                  ? "passed"
                  : sourceNode?.data.execution?.status === "skipped" || targetNode?.data.execution?.status === "skipped"
                    ? "skipped"
                    : undefined;

    if (!inferredStatus) {
      return edge;
    }

    const executionTone = getExecutionTone(inferredStatus);

    return {
      ...edge,
      className: mergeClassNames(edge.className, `edge-flow-${inferredStatus}`),
      animated: edge.animated || inferredStatus === "running",
      style: {
        ...edge.style,
        stroke: executionTone ?? edge.style?.stroke,
        strokeDasharray:
          inferredStatus === "blocked"
            ? "6 5"
            : inferredStatus === "running"
              ? "4 4"
              : inferredStatus === "warning"
                ? "8 4"
                : inferredStatus === "skipped"
                  ? "10 6"
                  : edge.style?.strokeDasharray
      }
    };
  });

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
          edges={decoratedFlowEdges}
          nodeTypes={nodeTypes}
          className="graph-flow"
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: theme === "dark" ? "#6fe0d8" : "#15786f"
            }
          }}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node.id)}
        >
          <GraphViewportSync edgeCount={decoratedFlowEdges.length} nodeCount={flowNodes.length} />
          <MiniMap
            pannable
            zoomable
            nodeBorderRadius={10}
            maskColor={theme === "dark" ? "rgba(5, 10, 20, 0.76)" : "rgba(255, 255, 255, 0.75)"}
            nodeColor={(node) => {
              const data = (node as Node<FlowNodeData>).data;
              const executionColor = getExecutionTone(data?.execution?.status);

              if (executionColor) {
                return executionColor;
              }

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
              const executionColor = getExecutionTone(data?.execution?.status);

              if (executionColor) {
                return executionColor;
              }

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
