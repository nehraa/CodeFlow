import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/implement-node/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  delete process.env.CODEFLOW_STORE_ROOT;
  vi.unstubAllGlobals();
});

const assignStoreRoot = async (): Promise<void> => {
  process.env.CODEFLOW_STORE_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-implement-route-"));
};

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

describe("POST /api/implement-node", () => {
  it("updates only the selected node draft and leaves other nodes untouched", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    await assignStoreRoot();
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.messages[0]?.content).toContain("Green means observed pass, not optimism.");
    expect(payload.messages[0]?.content).toContain("No fake-pass tests.");
  });

  it("retries once when the first implementation fails local TypeScript validation", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    await assignStoreRoot();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Broken implementation",
                  code: "export function saveTask(input: string) { return input.; }",
                  notes: []
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Fixed implementation",
                  code: "export function saveTask(input: string) { return input.trim(); }",
                  notes: ["Trim whitespace"]
                })
              }
            }
          ]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

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
    const body = (await response.json()) as {
      implementation: { notes: string[]; code: string };
    };

    expect(response.status).toBe(200);
    expect(body.implementation.code).toContain("return input.trim()");
    expect(body.implementation.notes).toContain("Local TypeScript validation passed before acceptance.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns 400 when the implementation still fails validation after retry", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    await assignStoreRoot();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Broken implementation",
                code: "export function saveTask(input: string) { return input.; }",
                notes: []
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

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
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("TypeScript validation failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
