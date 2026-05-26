import type { BlueprintGraph, DigitalTwinSnapshot, TraceSpan, UserFlow } from "./types.js";
export { idleTraceState } from "./types.js";
/**
 * Infer named user journeys from a set of trace spans.
 *
 * Spans are grouped by `traceId`; each group becomes one {@link UserFlow}.
 * Within a group the spans are ordered chronologically by timestamp (if
 * available) so that the `nodeIds` list reflects the actual traversal order.
 */
export declare const buildUserFlows: (graph: BlueprintGraph, spans: TraceSpan[]) => UserFlow[];
/**
 * Compute the current Digital Twin snapshot.
 *
 * - Infers all user flows from the stored spans.
 * - Identifies which nodes were touched within the `activeWindowSecs` window.
 *   When no spans have timestamps the entire span set is considered "active"
 *   (useful for testing environments where timestamps are omitted).
 */
export declare const computeDigitalTwinSnapshot: (graph: BlueprintGraph, spans: TraceSpan[], activeWindowSecs?: number) => DigitalTwinSnapshot;
/**
 * Generate synthetic {@link TraceSpan} objects that simulate a user touching
 * each node in `nodeIds` in order.
 *
 * All spans share the same synthetic `traceId` so they form a single
 * {@link UserFlow} when ingested via the observability pipeline.
 */
export declare const buildSimulationSpans: (graph: BlueprintGraph, nodeIds: string[], label?: string, runtime?: string) => TraceSpan[];
/**
 * Overlay `activeNodeIds` onto a graph as a trace state so that the heatmap
 * and canvas can highlight currently live nodes.  Nodes not in the active set
 * retain their existing trace state.
 */
export declare const overlayActiveNodes: (graph: BlueprintGraph, activeNodeIds: string[]) => BlueprintGraph;
//# sourceMappingURL=digital-twin.d.ts.map