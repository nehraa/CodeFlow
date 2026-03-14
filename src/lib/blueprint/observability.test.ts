import { describe, expect, it } from "vitest";

import { summarizeObservability } from "@/lib/blueprint/observability";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("summarizeObservability", () => {
  it("overlays spans and exposes recent spans/logs", () => {
    const graph: BlueprintGraph = {
      projectName: "Observed",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [
        {
          id: "function:save",
          kind: "function",
          name: "saveTask",
          summary: "Save a task.",
          contract: { ...emptyContract(), summary: "Save a task." },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const summary = summarizeObservability(graph, {
      spans: [
        {
          spanId: "span-1",
          traceId: "trace-1",
          name: "saveTask",
          status: "error",
          durationMs: 8,
          runtime: "node"
        }
      ],
      logs: [
        {
          id: "log-1",
          level: "error",
          message: "save failed",
          blueprintNodeId: "function:save",
          runtime: "node",
          timestamp: "2026-03-14T00:00:00.000Z"
        }
      ]
    });

    expect(summary.graph.nodes[0].traceState?.status).toBe("error");
    expect(summary.latestLogs[0].message).toBe("save failed");
  });
});
