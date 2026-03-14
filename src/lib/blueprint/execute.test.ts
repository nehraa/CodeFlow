import { describe, expect, it } from "vitest";

import { createExecutionReport } from "@/lib/blueprint/execute";
import { createRunPlan } from "@/lib/blueprint/plan";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("createExecutionReport", () => {
  it("creates completed task results and ownership records for generated artifacts", () => {
    const graph: BlueprintGraph = {
      projectName: "Executor",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [
        {
          id: "function:save",
          kind: "function",
          name: "save",
          summary: "Save a record.",
          contract: { ...emptyContract(), summary: "Save a record." },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const executionReport = createExecutionReport(graph, createRunPlan(graph));

    expect(executionReport.results[0].status).toBe("completed");
    expect(executionReport.results[0].outputPaths.some((outputPath) => outputPath.endsWith(".ts"))).toBe(true);
    expect(executionReport.ownership[0].nodeId).toBe("function:save");
  });
});
