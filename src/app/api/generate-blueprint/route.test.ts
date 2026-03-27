import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/generate-blueprint/route";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
  delete process.env.NVIDIA_API_KEY;
  vi.unstubAllGlobals();
});

describe("GET /api/generate-blueprint", () => {
  it("reports whether the server has an NVIDIA API key configured", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const response = await GET();
    const body = (await response.json()) as { serverApiKeyConfigured: boolean };

    expect(response.status).toBe(200);
    expect(body.serverApiKeyConfigured).toBe(true);
  });
});

describe("POST /api/generate-blueprint", () => {
  it("normalizes sparse AI responses into a valid blueprint graph", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-ai-build-store-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                nodes: [
                  {
                    kind: "api",
                    name: "POST /api/tasks",
                    summary: "Create tasks.",
                    contract: {
                      responsibilities: ["Accept a task create request"],
                      inputs: [{ name: "request", type: "TaskCreateRequest" }],
                      outputs: [{ name: "result", type: "TaskResponse" }],
                      calls: [{ target: "saveTask", kind: "calls", description: "Creates the task" }]
                    }
                  },
                  {
                    kind: "function",
                    name: "saveTask",
                    contract: {
                      summary: "Persist the new task.",
                      methods: [
                        {
                          name: "saveTask",
                          summary: "Persist the task",
                          inputs: [{ name: "input", type: "TaskCreateRequest" }],
                          outputs: [{ name: "result", type: "TaskResponse" }]
                        }
                      ]
                    }
                  }
                ],
                edges: [
                  {
                    from: "POST /api/tasks",
                    to: "saveTask"
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
      new Request("http://localhost/api/generate-blueprint", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectName: "AI Route Test",
          prompt: "A task API with a save function",
          mode: "essential"
        })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      graph: {
        phase: string;
        nodes: Array<{
          id: string;
          summary: string;
          status?: string;
          specDraft?: string;
          sourceRefs: Array<{ kind: string }>;
          generatedRefs: string[];
          traceRefs: string[];
          contract: {
            responsibilities: string[];
            attributes: Array<{ name: string; type: string }>;
            methods: Array<{ name: string; calls: Array<{ target: string }> }>;
            sideEffects: string[];
            errors: string[];
            dependencies: string[];
            calls: Array<{ target: string }>;
            uiAccess: string[];
            backendAccess: string[];
            notes: string[];
          };
        }>;
        edges: Array<{ from: string; to: string; kind: string; required: boolean; confidence: number }>;
      };
      runPlan: { tasks: Array<{ title: string }> };
      session: { sessionId: string };
    };

    expect(body.graph.nodes).toHaveLength(2);
    expect(body.graph.phase).toBe("spec");
    expect(body.graph.nodes[0]?.status).toBe("spec_only");
    expect(body.graph.nodes[0]?.specDraft).toContain("export async function");
    expect(body.graph.nodes[0].sourceRefs[0]?.kind).toBe("generated");
    expect(body.graph.nodes[0].generatedRefs).toEqual([]);
    expect(body.graph.nodes[0].contract.responsibilities).toEqual(["Accept a task create request"]);
    expect(body.graph.nodes[0].contract.calls[0]?.target).toBe("saveTask");
    expect(body.graph.nodes[1].traceRefs).toEqual([]);
    expect(body.graph.nodes[1].contract.attributes).toEqual([]);
    expect(body.graph.nodes[1].contract.methods[0]?.name).toBe("saveTask");
    expect(body.graph.nodes[1].contract.sideEffects).toEqual([]);
    expect(body.graph.nodes[1].contract.errors).toEqual([]);
    expect(body.graph.nodes[1].contract.dependencies).toEqual([]);
    expect(body.graph.nodes[1].contract.calls).toEqual([]);
    expect(body.graph.nodes[1].contract.uiAccess).toEqual([]);
    expect(body.graph.nodes[1].contract.backendAccess).toEqual([]);
    expect(body.graph.nodes[1].contract.notes).toEqual([]);
    expect(body.graph.edges[0]).toMatchObject({
      kind: "calls",
      required: true,
      confidence: 0.65
    });
    expect(body.runPlan.tasks.length).toBeGreaterThan(0);
    expect(body.session.sessionId).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.messages[0]?.content).toContain(
      "The following CodeFlow repository instructions are authoritative"
    );
    expect(payload.messages[0]?.content).toContain("Treat model output as untrusted input.");
  });

  it("extracts the first valid JSON object when the AI wraps it in markdown and trailing prose", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-ai-build-store-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                "Here is the blueprint:",
                "```json",
                JSON.stringify({
                  nodes: [
                    {
                      kind: "module",
                      name: "Sentinel Flow",
                      summary: "Coordinates the runtime graph."
                    }
                  ],
                  edges: [],
                  workflows: [],
                  warnings: []
                }),
                "```",
                "Validation note: all identifiers look good."
              ].join("\n")
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/generate-blueprint", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectName: "AI Route Test",
          prompt: "A runtime graph editor",
          mode: "essential"
        })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      graph: {
        nodes: Array<{ name: string; kind: string }>;
      };
    };

    expect(body.graph.nodes).toHaveLength(1);
    expect(body.graph.nodes[0]).toMatchObject({
      name: "Sentinel Flow",
      kind: "module"
    });
  });

  it("sanitizes control characters before JSON parsing", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-ai-build-store-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "{\n" +
                "\"nodes\":[{\"kind\":\"module\",\"name\":\"Sentinel\\u000bFlow\",\"summary\":\"Has control char\"}],\n" +
                "\"edges\":[],\"workflows\":[],\"warnings\":[]\n" +
                "}"
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/generate-blueprint", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectName: "AI Route Test",
          prompt: "A runtime graph editor",
          mode: "essential"
        })
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      graph: {
        nodes: Array<{ name: string }>;
      };
    };

    expect(body.graph.nodes[0]?.name).toContain("Sentinel");
  });
});
