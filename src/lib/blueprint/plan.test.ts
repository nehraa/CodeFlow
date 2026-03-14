import { describe, expect, it } from "vitest";

import { createRunPlan } from "@/lib/blueprint/plan";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("createRunPlan", () => {
  it("topologically batches nodes based on outbound dependencies", () => {
    const graph: BlueprintGraph = {
      projectName: "Planner",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        {
          id: "function:a",
          kind: "function",
          name: "A",
          summary: "A",
          contract: { ...emptyContract(), summary: "A" },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        },
        {
          id: "function:b",
          kind: "function",
          name: "B",
          summary: "B",
          contract: { ...emptyContract(), summary: "B" },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ],
      edges: [
        {
          from: "function:a",
          to: "function:b",
          kind: "calls",
          required: true,
          confidence: 1
        }
      ]
    };

    const plan = createRunPlan(graph);
    const taskA = plan.tasks.find((task) => task.nodeId === "function:a");
    const taskB = plan.tasks.find((task) => task.nodeId === "function:b");

    expect(plan.batches).toHaveLength(2);
    expect(taskB?.batchIndex).toBeLessThan(taskA?.batchIndex ?? 0);
    expect(taskA?.dependsOn).toContain("task:function:b");
  });

  it("emits a warning when a dependency cycle forces a serial break", () => {
    const graph: BlueprintGraph = {
      projectName: "Planner Cycle",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      nodes: [
        {
          id: "function:a",
          kind: "function",
          name: "A",
          summary: "A",
          contract: { ...emptyContract(), summary: "A" },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        },
        {
          id: "function:b",
          kind: "function",
          name: "B",
          summary: "B",
          contract: { ...emptyContract(), summary: "B" },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ],
      edges: [
        {
          from: "function:a",
          to: "function:b",
          kind: "calls",
          required: true,
          confidence: 1
        },
        {
          from: "function:b",
          to: "function:a",
          kind: "calls",
          required: true,
          confidence: 1
        }
      ]
    };

    const plan = createRunPlan(graph);

    expect(plan.warnings[0]).toContain("Cycle detected");
  });
});
