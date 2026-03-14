import { describe, expect, it } from "vitest";

import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";
import { applyTraceOverlay } from "@/lib/blueprint/traces";

const graph: BlueprintGraph = {
  projectName: "Traceable Product",
  mode: "essential",
  generatedAt: "2026-03-13T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:save-task",
      kind: "function",
      name: "saveTask",
      summary: "Persist a task.",
      signature: "saveTask(input: TaskInput): Promise<Task>",
      contract: {
        ...emptyContract(),
        summary: "Persist a task."
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

describe("applyTraceOverlay", () => {
  it("attaches spans to matching nodes and aggregates status", () => {
    const overlay = applyTraceOverlay(graph, [
      {
        spanId: "span-1",
        traceId: "trace-1",
        name: "saveTask",
        status: "success",
        durationMs: 12,
        runtime: "node"
      },
      {
        spanId: "span-2",
        traceId: "trace-1",
        name: "saveTask",
        status: "error",
        durationMs: 3,
        runtime: "node"
      }
    ]);

    expect(overlay.nodes[0].traceState?.count).toBe(2);
    expect(overlay.nodes[0].traceState?.errors).toBe(1);
    expect(overlay.nodes[0].traceState?.status).toBe("error");
  });
});
