import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/analysis/cycles/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const minimalNode = (id: string): BlueprintGraph["nodes"][number] => ({
  id,
  kind: "function",
  name: id,
  summary: "A node.",
  contract: emptyContract(),
  sourceRefs: [],
  generatedRefs: [],
  traceRefs: []
});

const minimalEdge = (from: string, to: string): BlueprintGraph["edges"][number] => ({
  from,
  to,
  kind: "calls",
  required: true,
  confidence: 1
});

const baseGraph: BlueprintGraph = {
  projectName: "Cycles Route Test",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [],
  edges: []
};

describe("POST /api/analysis/cycles", () => {
  it("returns a cycle report with no cycles for a clean DAG", async () => {
    const graph: BlueprintGraph = {
      ...baseGraph,
      nodes: [minimalNode("function:a"), minimalNode("function:b"), minimalNode("function:c")],
      edges: [minimalEdge("function:a", "function:b"), minimalEdge("function:b", "function:c")]
    };

    const response = await POST(
      new Request("http://localhost/api/analysis/cycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph)
      })
    );
    const body = (await response.json()) as { report: { totalCycles: number; hasCycles: boolean } };

    expect(response.status).toBe(200);
    expect(body.report.totalCycles).toBe(0);
  });

  it("detects a cycle between two mutually dependent nodes", async () => {
    const graph: BlueprintGraph = {
      ...baseGraph,
      nodes: [minimalNode("function:a"), minimalNode("function:b")],
      edges: [minimalEdge("function:a", "function:b"), minimalEdge("function:b", "function:a")]
    };

    const response = await POST(
      new Request("http://localhost/api/analysis/cycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph)
      })
    );
    const body = (await response.json()) as {
      report: {
        totalCycles: number;
        cycles: Array<{ nodeIds: string[] }>;
        affectedNodeIds: string[];
        analyzedAt: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.report.totalCycles).toBe(1);
    expect(body.report.affectedNodeIds).toContain("function:a");
    expect(body.report.affectedNodeIds).toContain("function:b");
    expect(body.report.analyzedAt).toBeTruthy();
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/cycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invalid: true })
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
