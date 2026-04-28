import { describe, expect, it } from "vitest";

import { POST } from "../../../../handlers/refactor-heal";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

const graph: BlueprintGraph = {
  projectName: "Refactor Heal Route",
  mode: "essential",
  generatedAt: "2026-03-26T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "function:auth",
      kind: "function",
      name: "authenticate",
      summary: "Authenticate a user.",
      contract: {
        ...emptyContract(),
        calls: [{ target: "GET /users", kind: "calls", description: undefined }],
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: [],
    },
    {
      id: "api:users",
      kind: "api",
      name: "GET /users",
      summary: "Users API.",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: [],
    },
  ],
  edges: [],
};

describe("POST /api/refactor/heal", () => {
  it("heals graph drift and returns truthfulness metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/refactor/heal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph),
      })
    );
    const body = await response.json() as {
      result: {
        issuesFixed: number;
        provenance: string;
        maturity: string;
        scope: string;
        graph: BlueprintGraph;
      };
    };

    expect(response.status).toBe(200);
    expect(body.result.issuesFixed).toBeGreaterThan(0);
    expect(body.result.provenance).toBe("deterministic");
    expect(body.result.maturity).toBe("preview");
    expect(body.result.scope).toBe("graph");
    expect(
      body.result.graph.edges.some(
        (edge: { from: string; to: string }) => edge.from === "function:auth" && edge.to === "api:users"
      )
    ).toBe(true);
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/refactor/heal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invalid: true }),
      })
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
