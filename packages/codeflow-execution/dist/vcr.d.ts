import type { BlueprintGraph, TraceSpan, VcrRecording } from "@abhinav2203/codeflow-core";
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
export declare const buildVcrRecording: (graph: BlueprintGraph, spans: TraceSpan[]) => VcrRecording;
/**
 * Produce a copy of `graph` whose node `traceState` values reflect the
 * cumulative execution history **up to and including** `frameIndex`.
 *
 * This is the function the scrub bar calls on every position change to
 * re-colour the architecture canvas.
 */
export declare const replayAtFrame: (graph: BlueprintGraph, recording: VcrRecording, frameIndex: number) => BlueprintGraph;
/**
 * Convert a 0–100 percentage position to the corresponding frame index.
 * Returns 0 for an empty recording.
 */
export declare const positionToFrameIndex: (recording: VcrRecording, position: number) => number;
/**
 * Convert a frame index back to a 0–100 position percentage.
 */
export declare const frameIndexToPosition: (recording: VcrRecording, frameIndex: number) => number;
//# sourceMappingURL=vcr.d.ts.map