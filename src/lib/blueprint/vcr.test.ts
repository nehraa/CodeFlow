import { describe, expect, it } from "vitest";

import {
  buildVcrRecording,
  frameIndexToPosition,
  positionToFrameIndex,
  replayAtFrame
} from "@/lib/blueprint/vcr";
import type { BlueprintGraph, TraceSpan } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeGraph = (nodeIds: string[]): BlueprintGraph => ({
  projectName: "Test",
  mode: "essential",
  generatedAt: new Date().toISOString(),
  warnings: [],
  workflows: [],
  edges: [],
  nodes: nodeIds.map((id) => ({
    id,
    kind: "function" as const,
    name: id,
    summary: id,
    contract: { ...emptyContract(), summary: id },
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: []
  }))
});

const makeSpan = (
  spanId: string,
  nodeId: string,
  status: "success" | "warning" | "error" = "success",
  durationMs = 10,
  timestamp?: string
): TraceSpan => ({
  spanId,
  traceId: "t1",
  name: nodeId,
  blueprintNodeId: nodeId,
  status,
  durationMs,
  runtime: "test",
  timestamp
});

// ── buildVcrRecording ─────────────────────────────────────────────────────────

describe("buildVcrRecording", () => {
  it("returns an empty recording when there are no spans", () => {
    const graph = makeGraph(["a", "b"]);
    const recording = buildVcrRecording(graph, []);

    expect(recording.frames).toHaveLength(0);
    expect(recording.totalSpans).toBe(0);
    expect(recording.projectName).toBe("Test");
  });

  it("creates one frame per span", () => {
    const graph = makeGraph(["a", "b"]);
    const spans = [makeSpan("s1", "a"), makeSpan("s2", "b"), makeSpan("s3", "a")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames).toHaveLength(3);
    expect(frames[0].spanId).toBe("s1");
    expect(frames[1].spanId).toBe("s2");
    expect(frames[2].spanId).toBe("s3");
  });

  it("assigns sequential frameIndex values", () => {
    const graph = makeGraph(["a"]);
    const spans = [makeSpan("s1", "a"), makeSpan("s2", "a")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].frameIndex).toBe(0);
    expect(frames[1].frameIndex).toBe(1);
  });

  it("resolves nodeId and nodeName for each frame", () => {
    const graph = makeGraph(["alpha"]);
    const spans = [makeSpan("s1", "alpha")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].nodeId).toBe("alpha");
    expect(frames[0].nodeName).toBe("alpha");
  });

  it("records idle state for unvisited nodes in each frame", () => {
    const graph = makeGraph(["a", "b"]);
    const spans = [makeSpan("s1", "a")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].nodeStates["b"]?.status).toBe("idle");
    expect(frames[0].nodeStates["b"]?.count).toBe(0);
  });

  it("accumulates call counts across frames for the same node", () => {
    const graph = makeGraph(["a"]);
    const spans = [makeSpan("s1", "a"), makeSpan("s2", "a"), makeSpan("s3", "a")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].nodeStates["a"]?.count).toBe(1);
    expect(frames[1].nodeStates["a"]?.count).toBe(2);
    expect(frames[2].nodeStates["a"]?.count).toBe(3);
  });

  it("accumulates error counts correctly", () => {
    const graph = makeGraph(["a"]);
    const spans = [makeSpan("s1", "a", "success"), makeSpan("s2", "a", "error")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].nodeStates["a"]?.errors).toBe(0);
    expect(frames[1].nodeStates["a"]?.errors).toBe(1);
  });

  it("accumulates totalDurationMs correctly", () => {
    const graph = makeGraph(["a"]);
    const spans = [makeSpan("s1", "a", "success", 100), makeSpan("s2", "a", "success", 200)];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].nodeStates["a"]?.totalDurationMs).toBe(100);
    expect(frames[1].nodeStates["a"]?.totalDurationMs).toBe(300);
  });

  it("escalates TraceState status to the highest seen", () => {
    const graph = makeGraph(["a"]);
    const spans = [
      makeSpan("s1", "a", "success"),
      makeSpan("s2", "a", "error"),
      makeSpan("s3", "a", "warning")
    ];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].nodeStates["a"]?.status).toBe("success");
    expect(frames[1].nodeStates["a"]?.status).toBe("error");
    expect(frames[2].nodeStates["a"]?.status).toBe("error"); // stays error
  });

  it("sorts spans with timestamps before those without", () => {
    const graph = makeGraph(["a"]);
    const spanNoTs = makeSpan("no-ts", "a", "success", 5);
    const spanWithTs = makeSpan("with-ts", "a", "success", 5, "2024-01-01T00:00:00.000Z");
    const { frames } = buildVcrRecording(graph, [spanNoTs, spanWithTs]);

    // The timestamped span must appear first
    expect(frames[0].spanId).toBe("with-ts");
    expect(frames[1].spanId).toBe("no-ts");
  });

  it("sorts multiple timestamped spans chronologically", () => {
    const graph = makeGraph(["a"]);
    const spans = [
      makeSpan("s-late", "a", "success", 5, "2024-06-01T00:00:00.000Z"),
      makeSpan("s-early", "a", "success", 5, "2024-01-01T00:00:00.000Z")
    ];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].spanId).toBe("s-early");
    expect(frames[1].spanId).toBe("s-late");
  });

  it("records the frame status from the triggering span", () => {
    const graph = makeGraph(["a"]);
    const spans = [makeSpan("s1", "a", "error")];
    const { frames } = buildVcrRecording(graph, spans);

    expect(frames[0].status).toBe("error");
    expect(frames[0].durationMs).toBe(10);
  });

  it("handles spans that cannot be resolved to a node", () => {
    const graph = makeGraph(["a"]);
    const unresolvable: TraceSpan = {
      spanId: "x1",
      traceId: "t1",
      name: "unknown-service",
      status: "success",
      durationMs: 5,
      runtime: "test"
    };
    const { frames } = buildVcrRecording(graph, [unresolvable]);

    expect(frames[0].nodeId).toBeUndefined();
    expect(frames[0].nodeStates["a"]?.count).toBe(0); // node "a" untouched
  });
});

// ── replayAtFrame ─────────────────────────────────────────────────────────────

describe("replayAtFrame", () => {
  it("returns the original graph unchanged when the recording has no frames", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, []);
    const result = replayAtFrame(graph, recording, 0);

    expect(result.nodes[0].traceState?.status).toBe(graph.nodes[0].traceState?.status);
  });

  it("replays node states at a specific frame", () => {
    const graph = makeGraph(["a", "b"]);
    const spans = [makeSpan("s1", "a", "success", 50), makeSpan("s2", "b", "error", 20)];
    const recording = buildVcrRecording(graph, spans);

    // Frame 0: only node a has been called
    const atFrame0 = replayAtFrame(graph, recording, 0);
    expect(atFrame0.nodes.find((n) => n.id === "a")?.traceState?.count).toBe(1);
    expect(atFrame0.nodes.find((n) => n.id === "b")?.traceState?.count).toBe(0);

    // Frame 1: both nodes have been called
    const atFrame1 = replayAtFrame(graph, recording, 1);
    expect(atFrame1.nodes.find((n) => n.id === "a")?.traceState?.count).toBe(1);
    expect(atFrame1.nodes.find((n) => n.id === "b")?.traceState?.count).toBe(1);
    expect(atFrame1.nodes.find((n) => n.id === "b")?.traceState?.status).toBe("error");
  });

  it("clamps frame index to valid range", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a")]);

    // -1 should clamp to 0
    const atNeg = replayAtFrame(graph, recording, -1);
    expect(atNeg.nodes[0].traceState?.count).toBe(1);

    // 999 should clamp to last frame
    const atHigh = replayAtFrame(graph, recording, 999);
    expect(atHigh.nodes[0].traceState?.count).toBe(1);
  });

  it("does not mutate the original graph", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a", "error")]);
    replayAtFrame(graph, recording, 0);

    // Original node should be untouched (traceState was not set)
    expect(graph.nodes[0].traceState).toBeUndefined();
  });
});

// ── positionToFrameIndex / frameIndexToPosition ───────────────────────────────

describe("positionToFrameIndex", () => {
  it("maps 0% to frame 0", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a"), makeSpan("s2", "a")]);
    expect(positionToFrameIndex(recording, 0)).toBe(0);
  });

  it("maps 100% to the last frame", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a"), makeSpan("s2", "a")]);
    expect(positionToFrameIndex(recording, 100)).toBe(1);
  });

  it("maps 50% to the middle frame", () => {
    const graph = makeGraph(["a"]);
    const spans = [makeSpan("s1", "a"), makeSpan("s2", "a"), makeSpan("s3", "a")];
    const recording = buildVcrRecording(graph, spans);
    expect(positionToFrameIndex(recording, 50)).toBe(1);
  });

  it("returns 0 for an empty recording", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, []);
    expect(positionToFrameIndex(recording, 50)).toBe(0);
  });

  it("clamps positions outside [0, 100]", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a"), makeSpan("s2", "a")]);
    expect(positionToFrameIndex(recording, -10)).toBe(0);
    expect(positionToFrameIndex(recording, 200)).toBe(1);
  });
});

describe("frameIndexToPosition", () => {
  it("maps frame 0 to position 0", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a"), makeSpan("s2", "a")]);
    expect(frameIndexToPosition(recording, 0)).toBe(0);
  });

  it("maps last frame to position 100", () => {
    const graph = makeGraph(["a"]);
    const recording = buildVcrRecording(graph, [makeSpan("s1", "a"), makeSpan("s2", "a")]);
    expect(frameIndexToPosition(recording, 1)).toBe(100);
  });

  it("returns 0 for a single-frame or empty recording", () => {
    const graph = makeGraph(["a"]);
    const oneFrame = buildVcrRecording(graph, [makeSpan("s1", "a")]);
    expect(frameIndexToPosition(oneFrame, 0)).toBe(0);

    const empty = buildVcrRecording(graph, []);
    expect(frameIndexToPosition(empty, 0)).toBe(0);
  });

  it("round-trips through positionToFrameIndex", () => {
    const graph = makeGraph(["a"]);
    const spans = Array.from({ length: 11 }, (_, i) => makeSpan(`s${i}`, "a"));
    const recording = buildVcrRecording(graph, spans);

    for (let pos = 0; pos <= 100; pos += 10) {
      const frameIdx = positionToFrameIndex(recording, pos);
      const backToPos = frameIndexToPosition(recording, frameIdx);
      expect(backToPos).toBe(pos);
    }
  });
});
