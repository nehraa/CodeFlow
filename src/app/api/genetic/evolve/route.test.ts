import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/genetic/evolve/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const graph: BlueprintGraph = {
  projectName: "Evolution Route Test",
  mode: "essential",
  generatedAt: "2026-03-26T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "module:auth",
      kind: "module",
      name: "AuthModule",
      summary: "Auth module",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "api:users",
      kind: "api",
      name: "GET /users",
      summary: "Users API",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "ui:home",
      kind: "ui-screen",
      name: "Home",
      summary: "Home screen",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: [
    { from: "ui:home", to: "api:users", kind: "calls", required: true, confidence: 0.9 },
    { from: "api:users", to: "module:auth", kind: "calls", required: true, confidence: 0.8 }
  ]
};

describe("POST /api/genetic/evolve", () => {
  it("returns heuristic experimental tournament metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/genetic/evolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph, generations: 2, populationSize: 3 })
      })
    );
    const body = (await response.json()) as {
      result: { provenance: string; maturity: string; variants: Array<{ provenance: string; maturity: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.result.provenance).toBe("heuristic");
    expect(body.result.maturity).toBe("experimental");
    expect(body.result.variants.every((variant) => variant.provenance === "heuristic")).toBe(true);
    expect(body.result.variants.every((variant) => variant.maturity === "experimental")).toBe(true);
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/genetic/evolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ generations: 99 })
      })
    );

    expect(response.status).toBe(400);
  });
});
