import type { BlueprintGraph, BlueprintNode, BlueprintPhase, NodeVerification, ExecutionStep, RuntimeExecutionResult } from "../schema/index.js";
export declare const getCodeBearingNodes: (graph: BlueprintGraph) => BlueprintNode[];
export declare const withSpecDrafts: (graph: BlueprintGraph) => BlueprintGraph;
export declare const canCompleteSpecPhase: (graph: BlueprintGraph) => boolean;
export declare const canEnterImplementationPhase: (graph: BlueprintGraph) => boolean;
export declare const canEnterIntegrationPhase: (graph: BlueprintGraph) => boolean;
export declare const setGraphPhase: (graph: BlueprintGraph, phase: BlueprintPhase) => BlueprintGraph;
export declare const updateNodeStatus: (graph: BlueprintGraph, nodeId: string, updater: (node: BlueprintNode) => BlueprintNode) => BlueprintGraph;
export declare const markNodeImplemented: (graph: BlueprintGraph, nodeId: string, implementationDraft: string) => BlueprintGraph;
export declare const createNodeVerification: (result: RuntimeExecutionResult, verifiedAt?: string) => NodeVerification;
export declare const createNodeVerificationFromStep: (step: Pick<ExecutionStep, "status" | "stdout" | "stderr" | "completedAt">, exitCode?: number | null) => NodeVerification;
export declare const markNodeVerified: (graph: BlueprintGraph, nodeId: string, result: RuntimeExecutionResult) => BlueprintGraph;
export declare const getDefaultExecutionTarget: (graph: BlueprintGraph) => BlueprintNode | null;
export declare const markGraphConnected: (graph: BlueprintGraph) => BlueprintGraph;
export declare const applyExecutionResultToGraph: (graph: BlueprintGraph, result: RuntimeExecutionResult, options: {
    integrationRun: boolean;
}) => BlueprintGraph;
