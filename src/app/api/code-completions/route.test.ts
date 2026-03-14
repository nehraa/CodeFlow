import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/code-completions/route";
import { emptyContract } from "@/lib/blueprint/schema";

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  vi.unstubAllGlobals();
});

describe("POST /api/code-completions", () => {
  it("returns inline completion items for the active blueprint node", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    label: "persistTask(input)",
                    insertText: "persistTask(input)",
                    detail: "Call the task repository",
                    documentation: "Persists the validated task payload.",
                    kind: "function"
                  },
                  {
                    label: "if (!input.title)",
                    insertText: "if (!input.title) {\n  throw new Error(\"Task title is required\");\n}",
                    detail: "Guard clause",
                    documentation: "Reject empty task titles before persisting.",
                    kind: "snippet"
                  }
                ]
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/code-completions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph: {
            projectName: "Completion Test",
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
                  calls: [{ target: "persistTask", kind: "calls", description: "Writes the task record" }]
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          nodeId: "function:save-task",
          currentCode: "export function saveTask(input: TaskInput): Task {\n  return \n}\n",
          cursorOffset: 58,
          linePrefix: "  return ",
          lineSuffix: "",
          triggerCharacter: "("
        })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      suggestions: Array<{ label: string; insertText: string; kind?: string }>;
    };

    expect(body.suggestions).toHaveLength(2);
    expect(body.suggestions[0]?.label).toBe("persistTask(input)");
    expect(body.suggestions[1]?.kind).toBe("snippet");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
