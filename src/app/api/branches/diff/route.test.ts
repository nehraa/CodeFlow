import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/branches/diff/route";
import type { BlueprintGraph, BranchDiff } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const makeGraph = (overrides: Partial<BlueprintGraph> = {}): BlueprintGraph => ({
  projectName: "Diff Test",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "A",
      kind: "module",
      name: "A",
      summary: "Module A",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "B",
      kind: "module",
      name: "B",
      summary: "Module B",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: [{ from: "A", to: "B", kind: "calls", required: true, confidence: 1 }],
  ...overrides
});

describe("POST /api/branches/diff", () => {
  it("returns no changes for identical graphs", async () => {
    const graph = makeGraph();
    const response = await POST(
      new Request("http://localhost/api/branches/diff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseGraph: graph,
          compareGraph: graph,
          baseId: "base",
          compareId: "compare"
        })
      })
    );
    const body = (await response.json()) as { diff: BranchDiff };

    expect(response.status).toBe(200);
    expect(body.diff.addedNodes).toBe(0);
    expect(body.diff.removedNodes).toBe(0);
    expect(body.diff.modifiedNodes).toBe(0);
  });

  it("detects an added node in compare graph", async () => {
    const baseGraph = makeGraph();
    const compareGraph = makeGraph({
      nodes: [
        ...makeGraph().nodes,
        {
          id: "C",
          kind: "module" as const,
          name: "C",
          summary: "New node C",
          contract: emptyContract(),
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    });

    const response = await POST(
      new Request("http://localhost/api/branches/diff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseGraph, compareGraph })
      })
    );
    const body = (await response.json()) as { diff: BranchDiff };

    expect(response.status).toBe(200);
    expect(body.diff.addedNodes).toBe(1);
    expect(body.diff.impactedNodeIds).toContain("C");
  });

  it("detects a removed node in compare graph", async () => {
    const baseGraph = makeGraph();
    const compareGraph = makeGraph({ nodes: [makeGraph().nodes[0]], edges: [] });

    const response = await POST(
      new Request("http://localhost/api/branches/diff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseGraph, compareGraph })
      })
    );
    const body = (await response.json()) as { diff: BranchDiff };

    expect(response.status).toBe(200);
    expect(body.diff.removedNodes).toBe(1);
    expect(body.diff.impactedNodeIds).toContain("B");
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/branches/diff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ not: "valid" })
      })
    );

    expect(response.status).toBe(400);
  });
});
