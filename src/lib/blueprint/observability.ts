import type {
  BlueprintGraph,
  ObservabilityLog,
  ObservabilitySnapshot,
  TraceSpan
} from "@/lib/blueprint/schema";
import { applyTraceOverlay } from "@/lib/blueprint/traces";

const pickLatest = <T extends { timestamp?: string; spanId?: string }>(items: T[], limit: number): T[] =>
  [...items]
    .sort((left, right) =>
      `${right.timestamp ?? right.spanId ?? ""}`.localeCompare(`${left.timestamp ?? left.spanId ?? ""}`)
    )
    .slice(0, limit);

export const overlayObservability = (
  graph: BlueprintGraph,
  snapshot: Pick<ObservabilitySnapshot, "spans" | "logs">
): BlueprintGraph => {
  const tracedGraph = applyTraceOverlay(graph, snapshot.spans);
  const nodeLogCounts = new Map<string, number>();

  for (const log of snapshot.logs) {
    if (!log.blueprintNodeId) {
      continue;
    }

    nodeLogCounts.set(log.blueprintNodeId, (nodeLogCounts.get(log.blueprintNodeId) ?? 0) + 1);
  }

  return {
    ...tracedGraph,
    nodes: tracedGraph.nodes.map((node) => ({
      ...node,
      contract: {
        ...node.contract,
        notes:
          nodeLogCounts.get(node.id) && !node.contract.notes.some((note) => note.startsWith("Logs observed:"))
            ? [...node.contract.notes, `Logs observed: ${nodeLogCounts.get(node.id)}`]
            : node.contract.notes
      }
    }))
  };
};

export const summarizeObservability = (
  graph: BlueprintGraph,
  snapshot: Pick<ObservabilitySnapshot, "spans" | "logs">
): {
  graph: BlueprintGraph;
  latestSpans: TraceSpan[];
  latestLogs: ObservabilityLog[];
} => ({
  graph: overlayObservability(graph, snapshot),
  latestSpans: pickLatest(snapshot.spans, 10),
  latestLogs: pickLatest(snapshot.logs, 10)
});
