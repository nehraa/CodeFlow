import type { BlueprintGraph as BaseBlueprintGraph, BlueprintNode as BaseBlueprintNode, BlueprintEdge as BaseBlueprintEdge } from "@abhinav2203/codeflow-core/schema";
import type { TraceSpan as BaseTraceSpan, UserFlow as BaseUserFlow } from "@abhinav2203/codeflow-core/schema";
import type { CodeContract } from "@abhinav2203/codeflow-core/schema";

// Re-export types from codeflow-core that we use directly
export type { TraceSpan, UserFlow } from "@abhinav2203/codeflow-core/schema";

// BlueprintGraph with optional traceState on nodes
export type BlueprintGraph = BaseBlueprintGraph;
export type BlueprintNode = BaseBlueprintNode;
export type BlueprintEdge = BaseBlueprintEdge;

// Types that need local definition due to not being in codeflow-core
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

// Empty contract factory (needed for test fixtures)
export const emptyContract = (): CodeContract => ({
  summary: "",
  responsibilities: [],
  inputs: [],
  outputs: [],
  attributes: [],
  methods: [],
  sideEffects: [],
  errors: [],
  dependencies: [],
  calls: [],
  uiAccess: [],
  backendAccess: [],
  notes: []
});

// Idle trace state factory
export const idleTraceState = (): NodeTraceState => ({
  status: "idle",
  count: 0,
  errors: 0,
  totalDurationMs: 0,
  lastSpanIds: []
});
