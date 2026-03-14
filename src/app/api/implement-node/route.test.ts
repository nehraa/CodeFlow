import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/implement-node/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("POST /api/implement-node", () => {
  it("updates only the selected node draft and leaves other nodes untouched", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Implemented saveTask",
                code: "export function saveTask(input: string) { return input.trim(); }",
                notes: ["Trims the input"]
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const graph: BlueprintGraph = {
      projectName: "Implement Route",
      mode: "essential",
      phase: "implementation",
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
          specDraft: "export function saveTask(input: string) { throw new Error('todo'); }",
          contract: {
            ...emptyContract(),
            summary: "Save a task.",
            inputs: [{ name: "input", type: "string" }]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        },
        {
          id: "function:list-tasks",
          kind: "function",
          name: "listTasks",
          summary: "List tasks.",
          specDraft: "export function listTasks() { throw new Error('todo'); }",
          contract: {
            ...emptyContract(),
            summary: "List tasks."
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/implement-node", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          nodeId: "function:save-task"
        })
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { graph: BlueprintGraph };
    expect(body.graph.phase).toBe("implementation");
    expect(body.graph.nodes[0]?.status).toBe("implemented");
    expect(body.graph.nodes[0]?.implementationDraft).toContain("return input.trim()");
    expect(body.graph.nodes[1]?.implementationDraft).toBeUndefined();
  });
});
