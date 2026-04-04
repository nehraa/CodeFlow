import type {
  BlueprintGraph,
  TraceSpan,
  TraceState,
  VcrFrame,
  VcrRecording
} from "@/lib/blueprint/schema";
import { idleTraceState } from "@/lib/blueprint/schema";

// ── Span ordering ─────────────────────────────────────────────────────────────

/**
 * Sort spans into a stable playback order.
 * Spans with ISO timestamps are ordered chronologically; those without timestamps
 * are placed after timestamped spans in their original insertion order.
 */
const sortSpans = (spans: TraceSpan[]): TraceSpan[] =>
  [...spans].sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp.localeCompare(b.timestamp);
    }
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return 0; // preserve original order when neither has a timestamp
  });

// ── Node ID resolution ────────────────────────────────────────────────────────

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

// ── TraceState accumulation ───────────────────────────────────────────────────

const statusPriority: Record<TraceState["status"], number> = {
  idle: 0,
  success: 1,
  warning: 2,
  error: 3
};

const mergeSpanIntoState = (current: TraceState, span: TraceSpan): TraceState => {
  const nextStatus =
    statusPriority[span.status] > statusPriority[current.status] ? span.status : current.status;

  return {
    status: nextStatus,
    count: current.count + 1,
    errors: current.errors + (span.status === "error" ? 1 : 0),
    totalDurationMs: current.totalDurationMs + span.durationMs,
    lastSpanIds: [...new Set([span.spanId, ...current.lastSpanIds])].slice(0, 5)
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a VCR recording from the trace spans stored in an observability
 * snapshot.  Each span becomes one frame; frames are ordered chronologically
 * (by `timestamp` when available, otherwise by insertion order).
 *
 * The recording captures the **cumulative** node states at every frame so that
 * the scrub bar can jump to any position without replaying every preceding
 * frame.
 *
 * Spans that cannot be attributed to any graph node are still recorded as
 * frames — they just have no `nodeId` and do not mutate any node state.
 */
export const buildVcrRecording = (
  graph: BlueprintGraph,
  spans: TraceSpan[]
): VcrRecording => {
  const ordered = sortSpans(spans);

  // Accumulate node states as we step through spans
  const running = new Map<string, TraceState>();

  const frames: VcrFrame[] = ordered.map((span, index) => {
    const nodeId = resolveNodeId(graph, span);
    const nodeName = nodeId ? graph.nodes.find((n) => n.id === nodeId)?.name : undefined;

    if (nodeId) {
      running.set(nodeId, mergeSpanIntoState(running.get(nodeId) ?? idleTraceState(), span));
    }

    const nodeStates: Record<string, TraceState> = {};
    for (const node of graph.nodes) {
      nodeStates[node.id] = running.get(node.id) ?? idleTraceState();
    }

    return {
      frameIndex: index,
      spanId: span.spanId,
      label: span.name,
      timestamp: span.timestamp,
      nodeId: nodeId ?? undefined,
      nodeName,
      status: span.status,
      durationMs: span.durationMs,
      nodeStates
    };
  });

  return {
    projectName: graph.projectName,
    recordedAt: new Date().toISOString(),
    frames,
    totalSpans: ordered.length
  };
};

/**
 * Produce a copy of `graph` whose node `traceState` values reflect the
 * cumulative execution history **up to and including** `frameIndex`.
 *
 * This is the function the scrub bar calls on every position change to
 * re-colour the architecture canvas.
 */
export const replayAtFrame = (graph: BlueprintGraph, recording: VcrRecording, frameIndex: number): BlueprintGraph => {
  if (recording.frames.length === 0) {
    return graph;
  }

  const clampedIndex = Math.max(0, Math.min(frameIndex, recording.frames.length - 1));
  const frame = recording.frames[clampedIndex];

  if (!frame) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      traceState: frame.nodeStates[node.id] ?? idleTraceState()
    }))
  };
};

/**
 * Convert a 0–100 percentage position to the corresponding frame index.
 * Returns 0 for an empty recording.
 */
export const positionToFrameIndex = (recording: VcrRecording, position: number): number => {
  if (recording.frames.length === 0) return 0;
  const clamped = Math.max(0, Math.min(100, position));
  return Math.round((clamped / 100) * (recording.frames.length - 1));
};

/**
 * Convert a frame index back to a 0–100 position percentage.
 */
export const frameIndexToPosition = (recording: VcrRecording, frameIndex: number): number => {
  if (recording.frames.length <= 1) return 0;
  return Math.round((frameIndex / (recording.frames.length - 1)) * 100);
};
