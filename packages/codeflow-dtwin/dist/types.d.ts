import type { BlueprintGraph as BaseBlueprintGraph, BlueprintNode as BaseBlueprintNode, BlueprintEdge as BaseBlueprintEdge } from "@abhinav2203/codeflow-core/schema";
import type { TraceSpan as BaseTraceSpan, UserFlow as BaseUserFlow } from "@abhinav2203/codeflow-core/schema";
import type { CodeContract } from "@abhinav2203/codeflow-core/schema";
export type { TraceSpan, UserFlow } from "@abhinav2203/codeflow-core/schema";
export type BlueprintGraph = BaseBlueprintGraph;
export type BlueprintNode = BaseBlueprintNode;
export type BlueprintEdge = BaseBlueprintEdge;
export type OutputProvenance = "deterministic" | "ai" | "heuristic" | "simulated" | "observed";
export interface NodeTraceState {
    status: "idle" | "success" | "warning" | "error";
    count: number;
    errors: number;
    totalDurationMs: number;
    lastSpanIds: string[];
}
export interface DigitalTwinSnapshot {
    projectName: string;
    computedAt: string;
    maturity: "production" | "preview" | "experimental" | "scaffold";
    activeNodeIds: string[];
    flows: BaseUserFlow[];
    observedSpanCount: number;
    simulatedSpanCount: number;
    observedFlowCount: number;
    simulatedFlowCount: number;
    activeWindowSecs: number;
}
export interface SimulationConfig {
    iterations: number;
    activeWindowSecs?: number;
}
export interface SimulationResult {
    snapshot: DigitalTwinSnapshot;
    spans: BaseTraceSpan[];
    flows: BaseUserFlow[];
}
export declare const emptyContract: () => CodeContract;
export declare const idleTraceState: () => NodeTraceState;
//# sourceMappingURL=types.d.ts.map