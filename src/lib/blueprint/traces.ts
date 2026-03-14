import type { BlueprintGraph, BlueprintNode, TraceSpan, TraceStatus } from "@/lib/blueprint/schema";
import { idleTraceState } from "@/lib/blueprint/schema";

const statusPriority: Record<TraceStatus, number> = {
  idle: 0,
  success: 1,
  warning: 2,
  error: 3
};

const resolveNodeId = (graph: BlueprintGraph, span: TraceSpan): string | null => {
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

const mergeNodeTrace = (node: BlueprintNode, span: TraceSpan): BlueprintNode => {
  const traceState = node.traceState ?? idleTraceState();
  const nextStatus =
    statusPriority[span.status] > statusPriority[traceState.status] ? span.status : traceState.status;

  return {
    ...node,
    traceRefs: [...new Set([...node.traceRefs, span.spanId])],
    traceState: {
      status: nextStatus,
      count: traceState.count + 1,
      errors: traceState.errors + (span.status === "error" ? 1 : 0),
      totalDurationMs: traceState.totalDurationMs + span.durationMs,
      lastSpanIds: [...new Set([span.spanId, ...traceState.lastSpanIds])].slice(0, 5)
    }
  };
};

export const applyTraceOverlay = (graph: BlueprintGraph, spans: TraceSpan[]): BlueprintGraph => {
  const nodeMap = new Map<string, BlueprintNode>(
    graph.nodes.map((node) => [
      node.id,
      {
        ...node,
        traceRefs: [] as string[],
        traceState: idleTraceState()
      }
    ])
  );

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
