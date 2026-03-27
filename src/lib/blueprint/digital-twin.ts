import type {
  BlueprintGraph,
  DigitalTwinSnapshot,
  OutputProvenance,
  TraceSpan,
  UserFlow
} from "@/lib/blueprint/schema";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Resolve the blueprint node ID for a span (by direct id, name, or path). */
const resolveNodeId = (graph: BlueprintGraph, span: TraceSpan): string | null => {
  if (span.blueprintNodeId && graph.nodes.some((n) => n.id === span.blueprintNodeId)) {
    return span.blueprintNodeId;
  }

  const byName = graph.nodes.find((n) => n.name === span.name);
  if (byName) return byName.id;

  if (span.path) {
    const byPath = graph.nodes.find((n) => n.path === span.path);
    if (byPath) return byPath.id;
  }

  return null;
};

const worstStatus = (
  a: TraceSpan["status"],
  b: TraceSpan["status"]
): TraceSpan["status"] => {
  const priority: Record<TraceSpan["status"], number> = {
    success: 1,
    warning: 2,
    error: 3
  };
  return priority[a] >= priority[b] ? a : b;
};

const resolveFlowProvenance = (traceSpans: TraceSpan[]): OutputProvenance => {
  const counts = new Map<OutputProvenance, number>();

  for (const span of traceSpans) {
    const provenance = span.provenance ?? "observed";
    counts.set(provenance, (counts.get(provenance) ?? 0) + 1);
  }

  let dominant: OutputProvenance = "observed";
  let dominantCount = -1;

  for (const provenance of ["observed", "simulated", "deterministic", "heuristic", "ai"] as const) {
    const count = counts.get(provenance) ?? 0;
    if (count > dominantCount) {
      dominant = provenance;
      dominantCount = count;
    }
  }

  return dominant;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Infer named user journeys from a set of trace spans.
 *
 * Spans are grouped by `traceId`; each group becomes one {@link UserFlow}.
 * Within a group the spans are ordered chronologically by timestamp (if
 * available) so that the `nodeIds` list reflects the actual traversal order.
 */
export const buildUserFlows = (
  graph: BlueprintGraph,
  spans: TraceSpan[]
): UserFlow[] => {
  const byTrace = new Map<string, TraceSpan[]>();

  for (const span of spans) {
    const bucket = byTrace.get(span.traceId) ?? [];
    bucket.push(span);
    byTrace.set(span.traceId, bucket);
  }

  const flows: UserFlow[] = [];

  for (const [traceId, traceSpans] of byTrace) {
    // Chronological ordering: timestamped spans first, then by insertion order.
    const ordered = [...traceSpans].sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
      if (a.timestamp) return -1;
      if (b.timestamp) return 1;
      return 0;
    });

    const nodeIds: string[] = [];
    let status: TraceSpan["status"] = "success";
    let totalDurationMs = 0;

    for (const span of ordered) {
      const nodeId = resolveNodeId(graph, span);
      if (nodeId && !nodeIds.includes(nodeId)) {
        nodeIds.push(nodeId);
      }
      status = worstStatus(status, span.status);
      totalDurationMs += span.durationMs;
    }

    flows.push({
      traceId,
      name: ordered[0]?.name ?? traceId,
      nodeIds,
      startedAt: ordered[0]?.timestamp,
      endedAt: ordered[ordered.length - 1]?.timestamp,
      status,
      provenance: resolveFlowProvenance(ordered),
      totalDurationMs,
      spanCount: ordered.length
    });
  }

  // Most recent flows first (by startedAt, then insertion order).
  flows.sort((a, b) => {
    if (a.startedAt && b.startedAt) return b.startedAt.localeCompare(a.startedAt);
    if (a.startedAt) return -1;
    if (b.startedAt) return 1;
    return 0;
  });

  return flows;
};

/**
 * Compute the current Digital Twin snapshot.
 *
 * - Infers all user flows from the stored spans.
 * - Identifies which nodes were touched within the `activeWindowSecs` window.
 *   When no spans have timestamps the entire span set is considered "active"
 *   (useful for testing environments where timestamps are omitted).
 */
export const computeDigitalTwinSnapshot = (
  graph: BlueprintGraph,
  spans: TraceSpan[],
  activeWindowSecs = 60
): DigitalTwinSnapshot => {
  const flows = buildUserFlows(graph, spans);
  const observedSpanCount = spans.filter((span) => (span.provenance ?? "observed") === "observed").length;
  const simulatedSpanCount = spans.filter((span) => (span.provenance ?? "observed") === "simulated").length;
  const observedFlowCount = flows.filter((flow) => flow.provenance === "observed").length;
  const simulatedFlowCount = flows.filter((flow) => flow.provenance === "simulated").length;

  const now = Date.now();
  const windowMs = activeWindowSecs * 1000;

  const activeNodeIds: string[] = [];

  for (const span of spans) {
    const isRecent = span.timestamp
      ? now - new Date(span.timestamp).getTime() <= windowMs
      : true; // no timestamp → treat as active

    if (!isRecent) continue;

    const nodeId = resolveNodeId(graph, span);
    if (nodeId && !activeNodeIds.includes(nodeId)) {
      activeNodeIds.push(nodeId);
    }
  }

  return {
    projectName: graph.projectName,
    computedAt: new Date().toISOString(),
    maturity: "preview",
    activeNodeIds,
    flows,
    observedSpanCount,
    simulatedSpanCount,
    observedFlowCount,
    simulatedFlowCount,
    activeWindowSecs
  };
};

/**
 * Generate synthetic {@link TraceSpan} objects that simulate a user touching
 * each node in `nodeIds` in order.
 *
 * All spans share the same synthetic `traceId` so they form a single
 * {@link UserFlow} when ingested via the observability pipeline.
 */
export const buildSimulationSpans = (
  graph: BlueprintGraph,
  nodeIds: string[],
  label = "Simulated flow",
  runtime = "simulation"
): TraceSpan[] => {
  const traceId = `sim-${Date.now()}`;
  const baseTime = Date.now();

  return nodeIds.flatMap((nodeId, index) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    const spanId = `${traceId}-${index}`;
    const timestamp = new Date(baseTime + index * 10).toISOString();

    return [
      {
        spanId,
        traceId,
        name: node.name,
        blueprintNodeId: node.id,
        path: node.path,
        status: "success" as const,
        durationMs: 1,
        runtime,
        provenance: "simulated" as const,
        timestamp
      }
    ];
  });
};

type NodeTraceState = NonNullable<BlueprintGraph["nodes"][number]["traceState"]>;

const idleTraceState = (): NodeTraceState => ({
  status: "idle" as const,
  count: 0,
  errors: 0,
  totalDurationMs: 0,
  lastSpanIds: []
});

/**
 * Overlay `activeNodeIds` onto a graph as a trace state so that the heatmap
 * and canvas can highlight currently live nodes.  Nodes not in the active set
 * retain their existing trace state.
 */
export const overlayActiveNodes = (
  graph: BlueprintGraph,
  activeNodeIds: string[]
): BlueprintGraph => {
  const activeSet = new Set(activeNodeIds);

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!activeSet.has(node.id)) return node;

      const existing = node.traceState ?? idleTraceState();

      return {
        ...node,
        traceState: {
          ...existing,
          // Bump the status to at least "success" so the node lights up.
          status:
            existing.status === "idle" ? ("success" as const) : existing.status
        }
      };
    })
  };
};
