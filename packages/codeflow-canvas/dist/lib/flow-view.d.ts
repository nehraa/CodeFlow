import type { Edge, Node } from "@xyflow/react";
import type { HeatmapData } from "./heatmap.js";
import type { BlueprintGraph, ContractCheck, ExecutionArtifact, ExecutionStep, ExecutionStepKind, ExecutionStepStatus, GhostNode, RuntimeExecutionResult, RuntimeTestCase, RuntimeTestResult, ExecutionSummary, TraceStatus } from "@abhinav2203/codeflow-core/schema";
export type NodeHealthState = "neutral" | "aligned" | "drift" | "heal" | "ghost";
export type FlowExecutionStatus = ExecutionStepStatus | "idle";
export type FlowExecutionState = {
    status: FlowExecutionStatus;
    source: "direct" | "aggregated" | "inferred" | "fallback";
    kind?: ExecutionStepKind;
    stepId?: string;
    runId?: string;
    message?: string;
    durationMs?: number;
    blockedByStepId?: string;
    inputPreview?: string;
    outputPreview?: string;
    stdout?: string;
    stderr?: string;
    artifactIds?: string[];
    contractChecks?: ContractCheck[];
    childStepIds?: string[];
    stepCount?: number;
};
export type FlowExecutionIndex = {
    runId?: string;
    entryNodeId?: string;
    summary?: ExecutionSummary;
    stepsById: Record<string, ExecutionStep>;
    stepsByNodeId: Record<string, ExecutionStep[]>;
    stepsByEdgeId: Record<string, ExecutionStep[]>;
    testCasesByNodeId: Record<string, RuntimeTestCase[]>;
    testResultsByNodeId: Record<string, RuntimeTestResult[]>;
    artifactsById: Record<string, ExecutionArtifact>;
};
export type FlowExecutionProjection = {
    index: FlowExecutionIndex;
    nodeStates: Record<string, FlowExecutionState>;
    edgeStates: Record<string, FlowExecutionState>;
};
export type FlowNodeData = {
    label: string;
    summary: string;
    kind: string;
    traceStatus: TraceStatus;
    healthState: NodeHealthState;
    selected: boolean;
    isActiveBatch: boolean;
    isGhost: boolean;
    drilldownNodeId?: string;
    ghost?: boolean;
    ghostReason?: string;
    execution?: FlowExecutionState;
};
export type InspectorSection = {
    title: string;
    items: string[];
};
export type DetailFlowItem = {
    id: string;
    label: string;
    summary: string;
    kind: string;
    signature?: string;
    path?: string;
    drilldownNodeId?: string;
    execution?: FlowExecutionState;
    sections: InspectorSection[];
};
export type DetailFlowGraph = {
    items: DetailFlowItem[];
    nodes: Array<Node<FlowNodeData>>;
    edges: Edge[];
};
export declare const indexRuntimeExecutionResult: (result?: RuntimeExecutionResult | null) => FlowExecutionIndex | null;
export declare const buildExecutionProjection: (graph: BlueprintGraph, executionResult?: RuntimeExecutionResult | null) => FlowExecutionProjection | null;
export declare const buildFlowNodes: (graph: BlueprintGraph, selectedNodeId?: string, heatmapData?: HeatmapData, activeNodeIds?: string[], driftedNodeIds?: string[], executionResult?: RuntimeExecutionResult | null) => Array<Node<FlowNodeData>>;
export declare const buildFlowEdges: (graph: BlueprintGraph, activeNodeIds?: string[], executionResult?: RuntimeExecutionResult | null) => Edge[];
export declare const buildGhostFlowNodes: (ghostNodes: GhostNode[], existingNodes: Array<Node<FlowNodeData>>) => Array<Node<FlowNodeData>>;
export declare const buildDetailFlow: (graph: BlueprintGraph, rootNodeId: string, selectedItemId?: string, executionResult?: RuntimeExecutionResult | null) => DetailFlowGraph | null;
//# sourceMappingURL=flow-view.d.ts.map