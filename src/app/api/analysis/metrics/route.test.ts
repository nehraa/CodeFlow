import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/analysis/metrics/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const minimalNode = (id: string, kind: BlueprintGraph["nodes"][number]["kind"] = "function"): BlueprintGraph["nodes"][number] => ({
  id,
  kind,
  name: id,
  summary: "A node.",
  contract: emptyContract(),
  sourceRefs: [],
  generatedRefs: [],
  traceRefs: []
});

const baseGraph: BlueprintGraph = {
  projectName: "Metrics Route Test",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [],
  edges: []
};

describe("POST /api/analysis/metrics", () => {
  it("returns zero metrics for an empty graph", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseGraph)
      })
    );
    const body = (await response.json()) as {
      metrics: {
        nodeCount: number;
        edgeCount: number;
        density: number;
        connectedComponents: number;
        analyzedAt: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.metrics.nodeCount).toBe(0);
    expect(body.metrics.edgeCount).toBe(0);
    expect(body.metrics.density).toBe(0);
    expect(body.metrics.connectedComponents).toBe(0);
    expect(body.metrics.analyzedAt).toBeTruthy();
  });

  it("computes correct metrics for a graph with mixed node kinds and edges", async () => {
    const graph: BlueprintGraph = {
      ...baseGraph,
      nodes: [
        minimalNode("module:a", "module"),
        minimalNode("api:b", "api"),
        minimalNode("function:c", "function"),
        minimalNode("function:d", "function")
      ],
      edges: [
        { from: "module:a", to: "api:b", kind: "calls", required: true, confidence: 1 },
        { from: "api:b", to: "function:c", kind: "calls", required: true, confidence: 1 },
        { from: "api:b", to: "function:d", kind: "calls", required: true, confidence: 1 }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/analysis/metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph)
      })
    );
    const body = (await response.json()) as {
      metrics: {
        nodeCount: number;
        edgeCount: number;
        density: number;
        nodesByKind: Record<string, number>;
        edgesByKind: Record<string, number>;
        maxInDegreeNodeId?: string;
        connectedComponents: number;
        isolatedNodes: number;
        leafNodes: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.metrics.nodeCount).toBe(4);
    expect(body.metrics.edgeCount).toBe(3);
    expect(body.metrics.density).toBeGreaterThan(0);
    expect(body.metrics.nodesByKind["module"]).toBe(1);
    expect(body.metrics.nodesByKind["api"]).toBe(1);
    expect(body.metrics.nodesByKind["function"]).toBe(2);
    expect(body.metrics.edgesByKind["calls"]).toBe(3);
    expect(body.metrics.connectedComponents).toBe(1);
    expect(body.metrics.isolatedNodes).toBe(0);
    // "leaf" = total degree of 1 (source with out=1,in=0 or sink with out=0,in=1)
    // module:a has out=1, api:b has out=2 in=1, function:c has in=1, function:d has in=1
    expect(body.metrics.leafNodes).toBe(3);
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(42)
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
