import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/refactor/heal/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

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
        calls: [{ target: "GET /users", kind: "calls" }]
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "api:users",
      kind: "api",
      name: "GET /users",
      summary: "Users API.",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: []
};

describe("POST /api/refactor/heal", () => {
  it("heals graph drift and returns truthfulness metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/refactor/heal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph)
      })
    );
    const body = (await response.json()) as {
      result: { issuesFixed: number; provenance: string; maturity: string; scope: string; graph: BlueprintGraph };
    };

    expect(response.status).toBe(200);
    expect(body.result.issuesFixed).toBeGreaterThan(0);
    expect(body.result.provenance).toBe("deterministic");
    expect(body.result.maturity).toBe("preview");
    expect(body.result.scope).toBe("graph");
    expect(
      body.result.graph.edges.some((edge) => edge.from === "function:auth" && edge.to === "api:users")
    ).toBe(true);
  });
});
