import { afterEach, describe, expect, it, vi } from "vitest";

const { codeRagQueryMock, getCodeRagMock } = vi.hoisted(() => ({
  codeRagQueryMock: vi.fn(),
  getCodeRagMock: vi.fn()
}));

vi.mock("@/lib/coderag", () => ({
  getCodeRag: getCodeRagMock
}));

import { POST } from "@/app/api/code-suggestions/route";
import { emptyContract } from "@/lib/blueprint/schema";

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  vi.unstubAllGlobals();
  codeRagQueryMock.mockReset();
  getCodeRagMock.mockReset();
});

describe("POST /api/code-suggestions", () => {
  it("returns a parsed AI code suggestion for a blueprint node", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    codeRagQueryMock.mockResolvedValue({
      question: "Where is task validation enforced?",
      answerMode: "context-only",
      answer: "saveTask validates titles before persisting.",
      context: {
        graphSummary: "saveTask handles validation",
        warnings: [],
        primaryNode: {
          nodeId: "function:save-task",
          name: "saveTask",
          kind: "function",
          filePath: "src/tasks.ts",
          fullFileContent:
            "export function saveTask(input: TaskInput): Task {\n  if (!input.title) {\n    throw new Error(\"Task title is required\");\n  }\n}\n",
          startLine: 1,
          endLine: 5,
          callSiteLines: [1],
          doc: "Validates and persists a task.",
          relationship: "primary"
        },
        relatedNodes: []
      }
    });
    getCodeRagMock.mockReturnValue({
      query: codeRagQueryMock
    });

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
          instruction: "Add validation for missing titles.",
          retrievalQuery: "Where is task validation enforced?"
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
    expect(body.notes).toContain("Covers the missing title edge case.");
    expect(body.notes.some((note) => note.includes("CodeRAG context attached"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(codeRagQueryMock).toHaveBeenCalledWith("Where is task validation enforced?", { depth: 2 });
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.messages[1]?.content).toContain("CodeRAG retrieval context");
    expect(payload.messages[1]?.content).toContain("Primary node: saveTask");
  });
});
