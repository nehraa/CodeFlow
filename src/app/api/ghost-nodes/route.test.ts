import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ghost-nodes/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const baseGraph: BlueprintGraph = {
  projectName: "Ghost Test",
  mode: "essential",
  phase: "spec",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [
    {
      from: "ui-screen:home",
      to: "api:tasks",
      kind: "calls",
      required: true,
      confidence: 1
    }
  ],
  nodes: [
    {
      id: "ui-screen:home",
      kind: "ui-screen",
      name: "Home Screen",
      summary: "Main screen.",
      contract: { ...emptyContract(), summary: "Main screen." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "api:tasks",
      kind: "api",
      name: "Tasks API",
      summary: "Manage tasks.",
      contract: { ...emptyContract(), summary: "Manage tasks." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "function:save-task",
      kind: "function",
      name: "saveTask",
      summary: "Persist a task.",
      contract: { ...emptyContract(), summary: "Persist a task." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  vi.unstubAllGlobals();
});

describe("POST /api/ghost-nodes", () => {
  it("returns heuristic suggestions when no NVIDIA key is available", async () => {
    const request = new Request("http://localhost/api/ghost-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: baseGraph })
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      suggestions: Array<{ id: string; kind: string; name: string; reason: string; provenance: string; maturity: string }>;
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBeGreaterThan(0);
    // All ghost node IDs must be prefixed with "ghost:"
    for (const suggestion of body.suggestions) {
      expect(suggestion.id).toMatch(/^ghost:/);
      expect(suggestion.reason).toBeTruthy();
      expect(suggestion.provenance).toBe("heuristic");
      expect(suggestion.maturity).toBe("preview");
    }
  });

  it("returns AI suggestions when NVIDIA key is provided", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const aiSuggestions = [
      {
        id: "ghost:auth-service",
        kind: "class",
        name: "Auth Service",
        summary: "Handles authentication.",
        reason: "APIs typically require an auth service.",
        suggestedEdge: { from: "api:tasks", to: "ghost:auth-service", kind: "calls" }
      }
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ suggestions: aiSuggestions })
            }
          }
        ]
      }),
      text: async () => ""
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/ghost-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: baseGraph })
    });

    const response = await POST(request);
    const body = (await response.json()) as { suggestions: Array<{ id: string; kind: string; provenance: string; maturity: string }> };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions[0]?.id).toMatch(/^ghost:/);
    expect(body.suggestions[0]?.provenance).toBe("ai");
    expect(body.suggestions[0]?.maturity).toBe("preview");
  });

  it("falls back to heuristic suggestions when AI response cannot be parsed", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not valid json at all" } }]
      }),
      text: async () => ""
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/ghost-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: baseGraph })
    });

    const response = await POST(request);
    const body = (await response.json()) as { suggestions: unknown[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it("returns 400 for invalid request body", async () => {
    const request = new Request("http://localhost/api/ghost-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: null })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("heuristic suggests auth middleware for graphs with APIs but no auth node", async () => {
    const request = new Request("http://localhost/api/ghost-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: baseGraph })
    });

    const response = await POST(request);
    const body = (await response.json()) as { suggestions: Array<{ name: string; id: string }> };

    expect(response.status).toBe(200);
    const authSuggestion = body.suggestions.find((s) => s.name.toLowerCase().includes("auth"));
    expect(authSuggestion).toBeDefined();
  });
});
