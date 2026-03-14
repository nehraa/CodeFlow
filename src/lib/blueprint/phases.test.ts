import { describe, expect, it } from "vitest";

import {
  canEnterImplementationPhase,
  canEnterIntegrationPhase,
  markGraphConnected,
  markNodeImplemented,
  withSpecDrafts
} from "@/lib/blueprint/phases";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const baseGraph: BlueprintGraph = {
  projectName: "Phase Graph",
  mode: "essential",
  phase: "spec",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:save-task",
      kind: "function",
      name: "saveTask",
      summary: "Save a task.",
      contract: {
        ...emptyContract(),
        summary: "Save a task.",
        inputs: [{ name: "input", type: "TaskInput" }]
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

describe("blueprint phases", () => {
  it("hydrates spec drafts so phase 1 can be completed deterministically", () => {
    const graph = withSpecDrafts(baseGraph);

    expect(graph.nodes[0]?.specDraft).toContain("export function saveTask");
    expect(canEnterImplementationPhase(graph)).toBe(true);
  });

  it("advances into implementation and integration only when prerequisites are met", () => {
    const implementationGraph = markNodeImplemented(withSpecDrafts(baseGraph), "function:save-task", "export function saveTask() { return true; }");
    expect(implementationGraph.phase).toBe("implementation");
    expect(canEnterIntegrationPhase(implementationGraph)).toBe(false);

    const verifiedGraph: BlueprintGraph = {
      ...implementationGraph,
      nodes: implementationGraph.nodes.map((node) => ({
        ...node,
        status: "verified"
      }))
    };

    expect(canEnterIntegrationPhase(verifiedGraph)).toBe(true);

    const connectedGraph = markGraphConnected(verifiedGraph);
    expect(connectedGraph.nodes[0]?.status).toBe("connected");
  });
});
