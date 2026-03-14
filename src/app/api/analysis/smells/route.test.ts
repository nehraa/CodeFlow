import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/analysis/smells/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const baseGraph: BlueprintGraph = {
  projectName: "Smells Route Test",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [],
  edges: []
};

const makeMethod = (name: string) => ({
  name,
  summary: `Does ${name}.`,
  inputs: [],
  outputs: [],
  sideEffects: [],
  calls: []
});

describe("POST /api/analysis/smells", () => {
  it("returns a clean smell report with health score 100 for an empty graph", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/smells", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseGraph)
      })
    );
    const body = (await response.json()) as {
      report: { totalSmells: number; healthScore: number; analyzedAt: string };
    };

    expect(response.status).toBe(200);
    expect(body.report.totalSmells).toBe(0);
    expect(body.report.healthScore).toBe(100);
    expect(body.report.analyzedAt).toBeTruthy();
  });

  it("detects a god-node with too many methods and responsibilities", async () => {
    const graph: BlueprintGraph = {
      ...baseGraph,
      nodes: [
        {
          id: "module:god",
          kind: "module",
          name: "GodModule",
          summary: "Does everything.",
          contract: {
            ...emptyContract(),
            methods: Array.from({ length: 8 }, (_, i) => makeMethod(`method${i}`)),
            responsibilities: ["r1", "r2", "r3", "r4", "r5", "r6"]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/analysis/smells", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph)
      })
    );
    const body = (await response.json()) as {
      report: {
        totalSmells: number;
        healthScore: number;
        smells: Array<{ code: string; severity: string; nodeId?: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.report.totalSmells).toBeGreaterThan(0);
    expect(body.report.healthScore).toBeLessThan(100);
    const godNodeSmell = body.report.smells.find((s) => s.code === "god-node");
    expect(godNodeSmell).toBeDefined();
    expect(godNodeSmell?.severity).toBe("critical");
    expect(godNodeSmell?.nodeId).toBe("module:god");
  });

  it("detects orphan nodes with no edges", async () => {
    const graph: BlueprintGraph = {
      ...baseGraph,
      nodes: [
        {
          id: "function:orphan",
          kind: "function",
          name: "orphanFn",
          summary: "Nobody calls this.",
          contract: emptyContract(),
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/analysis/smells", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph)
      })
    );
    const body = (await response.json()) as {
      report: { smells: Array<{ code: string; nodeId?: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.report.smells.some((s) => s.code === "orphan-node")).toBe(true);
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/smells", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ not: "a graph" })
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
