import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/export/mermaid/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const baseGraph: BlueprintGraph = {
  projectName: "Mermaid Route Test",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "module:auth",
      kind: "module",
      name: "Auth Module",
      summary: "Handles authentication.",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "function:login",
      kind: "function",
      name: "login",
      summary: "Authenticate a user.",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: [
    { from: "module:auth", to: "function:login", kind: "calls", required: true, confidence: 1 }
  ]
};

describe("POST /api/export/mermaid", () => {
  it("generates a flowchart diagram by default", async () => {
    const response = await POST(
      new Request("http://localhost/api/export/mermaid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: baseGraph })
      })
    );
    const body = (await response.json()) as { diagram: string; format: string };

    expect(response.status).toBe(200);
    expect(body.format).toBe("flowchart");
    expect(body.diagram).toContain("graph TD");
    // Sanitized ID: "module:auth" → "module_auth"
    expect(body.diagram).toContain("module_auth");
    expect(body.diagram).toContain("Auth Module");
    expect(body.diagram).toContain("login");
    expect(body.diagram).toContain("-->");
  });

  it("generates a flowchart when format is explicitly 'flowchart'", async () => {
    const response = await POST(
      new Request("http://localhost/api/export/mermaid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: baseGraph, format: "flowchart" })
      })
    );
    const body = (await response.json()) as { diagram: string; format: string };

    expect(response.status).toBe(200);
    expect(body.format).toBe("flowchart");
    expect(body.diagram).toContain("graph TD");
  });

  it("generates a class diagram when format is 'class-diagram'", async () => {
    const classGraph: BlueprintGraph = {
      ...baseGraph,
      nodes: [
        {
          id: "class:user",
          kind: "class",
          name: "User",
          summary: "Represents a user.",
          contract: {
            ...emptyContract(),
            methods: [
              {
                name: "getFullName",
                summary: "Returns full name.",
                inputs: [],
                outputs: [],
                sideEffects: [],
                calls: []
              }
            ]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ],
      edges: []
    };

    const response = await POST(
      new Request("http://localhost/api/export/mermaid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: classGraph, format: "class-diagram" })
      })
    );
    const body = (await response.json()) as { diagram: string; format: string };

    expect(response.status).toBe(200);
    expect(body.format).toBe("class-diagram");
    expect(body.diagram).toContain("classDiagram");
    expect(body.diagram).toContain("User");
    expect(body.diagram).toContain("getFullName");
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/export/mermaid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: null })
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("returns 400 for an unsupported format value", async () => {
    const response = await POST(
      new Request("http://localhost/api/export/mermaid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: baseGraph, format: "svg" })
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
