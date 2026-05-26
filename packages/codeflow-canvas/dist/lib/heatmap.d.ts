import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
export type HeatmapNodeMetric = {
    nodeId: string;
    name: string;
    callCount: number;
    errorCount: number;
    errorRate: number;
    totalDurationMs: number;
    avgDurationMs: number;
    /** 0–1: normalized across all nodes by avg latency */
    latencyIntensity: number;
    /** 0–1: normalized across all nodes by error rate */
    errorIntensity: number;
    /** 0–1: combined heat score (errors weighted most heavily, then latency, then activity) */
    heatIntensity: number;
};
export type HeatmapData = {
    nodes: HeatmapNodeMetric[];
    maxCallCount: number;
    maxAvgDurationMs: number;
    maxErrorRate: number;
};
export declare const computeHeatmap: (graph: BlueprintGraph) => HeatmapData;
/** Map a 0–1 heat intensity to a CSS rgba colour for heatmap backgrounds */
export declare const heatColor: (intensity: number) => string;
/** Map a 0–1 heat intensity to a CSS box-shadow glow string */
export declare const heatGlow: (intensity: number) => string;
//# sourceMappingURL=heatmap.d.ts.map