"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo, useEffect } from "react";
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { buildExecutionProjection, buildFlowEdges, buildFlowNodes, buildGhostFlowNodes } from "../lib/flow-view.js";
const TRACE_STATUS_LABEL = {
    idle: "Ready",
    success: "Synced",
    warning: "Deploying",
    error: "Invalid"
};
const EXECUTION_STATUS_LABEL = {
    idle: "Idle",
    running: "Running",
    pending: "Pending",
    passed: "Passed",
    failed: "Failed",
    blocked: "Blocked",
    skipped: "Skipped",
    warning: "Warning"
};
const EXECUTION_STATUS_TONE = {
    running: "#2563eb",
    pending: "#64748b",
    passed: "#15803d",
    failed: "#dc2626",
    blocked: "#d97706",
    skipped: "#64748b",
    warning: "#c2410c"
};
const HEALTH_STATUS_LABEL = {
    neutral: "Stable",
    aligned: "Aligned",
    drift: "Drift",
    heal: "Heal",
    ghost: "Ghost"
};
const mergeClassNames = (...classNames) => classNames.filter(Boolean).join(" ").trim();
const getExecutionTone = (status) => {
    if (!status || status === "idle") {
        return undefined;
    }
    return EXECUTION_STATUS_TONE[status];
};
const resolveExecutionFromNode = (node, projection, graph) => {
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
const PolicyNode = memo(function PolicyNode({ data, selected }) {
    const executionStatus = data.execution?.status ?? "idle";
    const executionTone = getExecutionTone(executionStatus);
    return (_jsxs(_Fragment, { children: [_jsx(Handle, { className: "policy-node-handle", position: Position.Left, type: "target" }), _jsxs("div", { className: [
                    "policy-node-card",
                    `policy-node-${data.traceStatus}`,
                    `policy-node-health-${data.healthState}`,
                    executionStatus !== "idle" ? `policy-node-execution-${executionStatus}` : "",
                    data.isActiveBatch ? "is-batch-focus" : "",
                    data.isGhost ? "is-ghost" : "",
                    selected ? "is-selected" : ""
                ]
                    .filter(Boolean)
                    .join(" "), children: [_jsxs("div", { className: "policy-node-topline", children: [_jsx("span", { className: "policy-node-kind", children: data.kind }), _jsxs("div", { className: "policy-node-pills", children: [data.isActiveBatch ? _jsx("span", { className: "policy-node-badge policy-node-badge-batch", children: "Batch focus" }) : null, _jsx("span", { className: "policy-node-badge policy-node-badge-health", children: HEALTH_STATUS_LABEL[data.healthState] }), executionStatus !== "idle" ? (_jsx("span", { className: `policy-node-badge policy-node-badge-execution policy-node-badge-execution-${executionStatus}`, style: executionTone ? { borderColor: executionTone, color: executionTone } : undefined, children: EXECUTION_STATUS_LABEL[executionStatus] })) : null, _jsx("span", { className: "policy-node-status", children: TRACE_STATUS_LABEL[data.traceStatus] })] })] }), _jsx("h3", { children: data.label }), _jsx("p", { children: data.summary || "Select this node to inspect its policy contract, runtime, and generated implementation." }), data.execution?.message ? _jsx("p", { className: "policy-node-execution-message", children: data.execution.message }) : null, _jsxs("div", { className: "policy-node-footer", children: [_jsx("span", { children: data.drilldownNodeId ? "Double-click for internals" : "Click to inspect" }), data.selected ? _jsx("span", { children: "Focused" }) : null] })] }), _jsx(Handle, { className: "policy-node-handle", position: Position.Right, type: "source" })] }));
});
const nodeTypes = {
    policyNode: PolicyNode
};
function GraphViewportSync({ edgeCount, nodeCount }) {
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
export function GraphCanvas({ graph, selectedNodeId, onSelect, nodes, edges, onNodeDoubleClick, emptyMessage, ghostNodes, onGhostNodeClick, heatmapData, activeNodeIds, driftedNodeIds, executionResult, detailMode = false, theme = "light" }) {
    const executionProjection = graph ? buildExecutionProjection(graph, executionResult) : null;
    const baseFlowNodes = nodes ??
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
    const ghostFlowNodes = ghostNodes && ghostNodes.length > 0 ? buildGhostFlowNodes(ghostNodes, typedBaseFlowNodes) : [];
    const flowNodes = [...typedBaseFlowNodes, ...ghostFlowNodes];
    const flowEdges = edges ?? (graph ? buildFlowEdges(graph, activeNodeIds, executionResult) : []);
    const nodeMap = new Map(flowNodes.map((node) => [node.id, node]));
    const decoratedFlowEdges = flowEdges.map((edge) => {
        const execution = executionProjection?.edgeStates[edge.id];
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        const inferredStatus = execution?.status && execution.status !== "idle"
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
                strokeDasharray: inferredStatus === "blocked"
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
        return (_jsx("div", { className: "canvas-empty", children: _jsx("p", { children: emptyMessage ?? "Build a blueprint from an AI prompt, PRD text, or a JavaScript/TypeScript repo." }) }));
    }
    const handleNodeClick = (_, node) => {
        if (node.data.ghost && onGhostNodeClick) {
            const ghost = ghostNodes?.find((g) => g.id === node.id);
            if (ghost) {
                onGhostNodeClick(ghost);
                return;
            }
        }
        onSelect(node.id);
    };
    return (_jsx(ReactFlowProvider, { children: _jsx("div", { className: `canvas-shell ${detailMode ? "canvas-shell-detail" : ""}`, children: _jsxs(ReactFlow, { fitView: true, fitViewOptions: { padding: 0.18 }, minZoom: 0.35, maxZoom: 1.8, nodes: flowNodes, edges: decoratedFlowEdges, nodeTypes: nodeTypes, className: "graph-flow", defaultEdgeOptions: {
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: theme === "dark" ? "#6fe0d8" : "#15786f"
                    }
                }, onNodeClick: handleNodeClick, onNodeDoubleClick: (_, node) => onNodeDoubleClick?.(node.id), children: [_jsx(GraphViewportSync, { edgeCount: decoratedFlowEdges.length, nodeCount: flowNodes.length }), _jsx(MiniMap, { pannable: true, zoomable: true, nodeBorderRadius: 10, maskColor: theme === "dark" ? "rgba(5, 10, 20, 0.76)" : "rgba(255, 255, 255, 0.75)", nodeColor: (node) => {
                            const data = node.data;
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
                        }, nodeStrokeColor: (node) => {
                            const data = node.data;
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
                        }, nodeStrokeWidth: 2 }), _jsx(Controls, {}), _jsx(Background, { color: theme === "dark" ? "rgba(138, 173, 222, 0.12)" : "rgba(26, 42, 67, 0.08)", gap: 24, size: 1.2 })] }) }) }));
}
//# sourceMappingURL=graph-canvas.js.map