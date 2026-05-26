import { idleTraceState } from "@abhinav2203/codeflow-core/schema";
const getTraceState = (raw) => raw.traceState ?? idleTraceState();
export const computeHeatmap = (graph) => {
    const raw = graph.nodes.map((node) => {
        const state = getTraceState(node);
        const avgDurationMs = state.count > 0 ? state.totalDurationMs / state.count : 0;
        const errorRate = state.count > 0 ? state.errors / state.count : 0;
        return {
            nodeId: node.id,
            name: node.name,
            callCount: state.count,
            errorCount: state.errors,
            errorRate,
            totalDurationMs: state.totalDurationMs,
            avgDurationMs
        };
    });
    const maxCallCount = Math.max(...raw.map((m) => m.callCount), 1);
    const maxAvgDurationMs = Math.max(...raw.map((m) => m.avgDurationMs), 1);
    const maxErrorRate = Math.max(...raw.map((m) => m.errorRate), Number.EPSILON);
    const nodes = raw.map((m) => {
        const latencyIntensity = m.avgDurationMs / maxAvgDurationMs;
        const errorIntensity = m.errorRate / maxErrorRate;
        const activityIntensity = m.callCount / maxCallCount;
        const heatIntensity = Math.min(1, errorIntensity * 0.5 + latencyIntensity * 0.35 + activityIntensity * 0.15);
        return { ...m, latencyIntensity, errorIntensity, heatIntensity };
    });
    return { nodes, maxCallCount, maxAvgDurationMs, maxErrorRate };
};
/** Map a 0–1 heat intensity to a CSS rgba colour for heatmap backgrounds */
export const heatColor = (intensity) => {
    if (intensity <= 0) {
        return "rgba(240,253,244,0.0)";
    }
    if (intensity < 0.33) {
        const alpha = intensity / 0.33;
        return `rgba(34,197,94,${(alpha * 0.18).toFixed(3)})`;
    }
    if (intensity < 0.66) {
        const alpha = (intensity - 0.33) / 0.33;
        return `rgba(245,158,11,${(0.18 + alpha * 0.2).toFixed(3)})`;
    }
    const alpha = (intensity - 0.66) / 0.34;
    return `rgba(239,68,68,${(0.22 + alpha * 0.26).toFixed(3)})`;
};
/** Map a 0–1 heat intensity to a CSS box-shadow glow string */
export const heatGlow = (intensity) => {
    if (intensity <= 0) {
        return "none";
    }
    if (intensity < 0.33) {
        return `0 0 ${Math.round(8 + intensity * 24)}px rgba(34,197,94,${(intensity * 0.8).toFixed(3)})`;
    }
    if (intensity < 0.66) {
        const scaled = (intensity - 0.33) / 0.33;
        return `0 0 ${Math.round(16 + scaled * 28)}px rgba(245,158,11,${(0.5 + scaled * 0.4).toFixed(3)})`;
    }
    const scaled = (intensity - 0.66) / 0.34;
    return `0 0 ${Math.round(28 + scaled * 32)}px rgba(239,68,68,${(0.6 + scaled * 0.38).toFixed(3)})`;
};
//# sourceMappingURL=heatmap.js.map