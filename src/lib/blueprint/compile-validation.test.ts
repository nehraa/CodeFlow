import { describe, expect, it } from "vitest";

import { validateNodeImplementation } from "@/lib/blueprint/compile-validation";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const graph: BlueprintGraph = {
  projectName: "Validation Test",
  mode: "essential",
  phase: "implementation",
  generatedAt: "2026-03-26T00:00:00.000Z",
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
        inputs: [{ name: "input", type: "string" }],
        outputs: [{ name: "result", type: "Task" }]
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

describe("validateNodeImplementation", () => {
  it("passes syntactically valid TypeScript using contract type shims", async () => {
    const result = await validateNodeImplementation({
      graph,
      nodeId: "function:save-task",
      code: "export function saveTask(input: string): Task { return { value: input } as Task; }"
    });

    expect(result.success).toBe(true);
  });

  it("fails invalid TypeScript", async () => {
    const result = await validateNodeImplementation({
      graph,
      nodeId: "function:save-task",
      code: "export function saveTask(input: string): Task { return input.; }"
    });

    expect(result.success).toBe(false);
    expect(`${result.stdout}\n${result.stderr}`).toContain("error");
  });
});
