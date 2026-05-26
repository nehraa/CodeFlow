import { idleTraceState } from "@abhinav2203/codeflow-core/schema";
const statusPriority = {
    idle: 0,
    success: 1,
    warning: 2,
    error: 3
};
const resolveNodeId = (graph, span) => {
    if (span.blueprintNodeId && graph.nodes.some((node) => node.id === span.blueprintNodeId)) {
        return span.blueprintNodeId;
    }
    const byName = graph.nodes.find((node) => node.name === span.name);
    if (byName) {
        return byName.id;
    }
    if (span.path) {
        const byPath = graph.nodes.find((node) => node.path === span.path);
        if (byPath) {
            return byPath.id;
        }
    }
    return null;
};
const mergeNodeTrace = (node, span) => {
    const traceState = node.traceState ?? idleTraceState();
    const nextStatus = statusPriority[span.status] > statusPriority[traceState.status] ? span.status : traceState.status;
    return {
        ...node,
        traceRefs: [...new Set([...(node.traceRefs ?? []), span.spanId])],
        traceState: {
            status: nextStatus,
            count: traceState.count + 1,
            errors: traceState.errors + (span.status === "error" ? 1 : 0),
            totalDurationMs: traceState.totalDurationMs + span.durationMs,
            lastSpanIds: [...new Set([span.spanId, ...traceState.lastSpanIds])].slice(0, 5)
        }
    };
};
export const applyTraceOverlay = (graph, spans) => {
    const nodeMap = new Map(graph.nodes.map((node) => [
        node.id,
        {
            ...node,
            traceRefs: [],
            traceState: idleTraceState()
        }
    ]));
    for (const span of spans) {
        const nodeId = resolveNodeId(graph, span);
        if (!nodeId) {
            continue;
        }
        const current = nodeMap.get(nodeId);
        if (!current) {
            continue;
        }
        nodeMap.set(nodeId, mergeNodeTrace(current, span));
    }
    return {
        ...graph,
        nodes: [...nodeMap.values()]
    };
};
//# sourceMappingURL=traces.js.map