import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/code-suggestions/route";
import { emptyContract } from "@/lib/blueprint/schema";

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  vi.unstubAllGlobals();
});

describe("POST /api/code-suggestions", () => {
  it("returns a parsed AI code suggestion for a blueprint node", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Added validation and preserved the exported function signature.",
                code: "export function saveTask(input: TaskInput): Task {\n  if (!input.title) {\n    throw new Error(\"Task title is required\");\n  }\n\n  return { id: \"1\", ...input } as Task;\n}\n",
                notes: ["Covers the missing title edge case."]
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/code-suggestions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph: {
            projectName: "Suggestion Test",
            mode: "essential",
            generatedAt: "2026-03-14T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [],
            nodes: [
              {
                id: "function:save-task",
                kind: "function",
                name: "saveTask",
                summary: "Persist a task.",
                signature: "saveTask(input: TaskInput): Task",
                contract: {
                  ...emptyContract(),
                  summary: "Persist a task.",
                  responsibilities: ["Validate and persist the task"],
                  inputs: [{ name: "input", type: "TaskInput" }],
                  outputs: [{ name: "result", type: "Task" }],
                  errors: ["Task title is required"]
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          nodeId: "function:save-task",
          currentCode: "export function saveTask(input: TaskInput): Task {\n  throw new Error(\"todo\");\n}\n",
          instruction: "Add validation for missing titles."
        })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      summary: string;
      code: string;
      notes: string[];
    };

    expect(body.summary).toContain("validation");
    expect(body.code).toContain("export function saveTask");
    expect(body.notes).toEqual(["Covers the missing title edge case."]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
