import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/executions/run/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

describe("POST /api/executions/run", () => {
  it("executes a node and returns runtime output plus updated verification state", async () => {
    const graph: BlueprintGraph = {
      projectName: "Execution Route",
      mode: "essential",
      phase: "implementation",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [
        {
          id: "function:save",
          kind: "function",
          name: "save",
          summary: "Save a record.",
          contract: { ...emptyContract(), summary: "Save a record." },
          status: "implemented",
          implementationDraft: "export function save(input: unknown) { return { ok: true, input }; }",
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          targetNodeId: "function:save",
          input: '{"message":"hi"}'
        })
      })
    );
    const body = (await response.json()) as {
      result: { success: boolean; stdout: string };
      graph: BlueprintGraph;
      executedNodeId: string;
    };

    expect(response.status).toBe(200);
    expect(body.executedNodeId).toBe("function:save");
    expect(body.result.success).toBe(true);
    expect(body.result.stdout).toContain('"ok": true');
    expect(body.graph.nodes[0]?.status).toBe("verified");
  });

  it("runs the integration entrypoint and marks verified nodes as connected", async () => {
    const graph: BlueprintGraph = {
      projectName: "Integration Route",
      mode: "essential",
      phase: "integration",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [{ name: "Main Flow", steps: ["save"] }],
      edges: [],
      nodes: [
        {
          id: "function:save",
          kind: "function",
          name: "save",
          summary: "Save a record.",
          status: "verified",
          implementationDraft: "export function save(input: { message: string }) { return { output: input.message.toUpperCase() }; }",
          contract: { ...emptyContract(), summary: "Save a record." },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          input: '{"message":"hi"}'
        })
      })
    );

    const body = (await response.json()) as { result: { success: boolean; stdout: string }; graph: BlueprintGraph };
    expect(response.status).toBe(200);
    expect(body.result.success).toBe(true);
    expect(body.result.stdout).toContain('"output": "HI"');
    expect(body.graph.nodes[0]?.status).toBe("connected");
  });

  it("fails integration clearly when dependencies are missing", async () => {
    const graph: BlueprintGraph = {
      projectName: "Broken Integration Route",
      mode: "essential",
      phase: "integration",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [{ name: "Broken Flow", steps: ["save"] }],
      edges: [],
      nodes: [
        {
          id: "function:save",
          kind: "function",
          name: "save",
          summary: "Save a record.",
          status: "verified",
          implementationDraft: 'import { missingDep } from "./missing-dep"; export function save() { return missingDep(); }',
          contract: { ...emptyContract(), summary: "Save a record." },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          input: "{}"
        })
      })
    );

    const body = (await response.json()) as { result: { success: boolean; stdout: string; stderr: string }; graph: BlueprintGraph };
    expect(response.status).toBe(200);
    expect(body.result.success).toBe(false);
    expect(`${body.result.stdout}\n${body.result.stderr}`).toContain("missing-dep");
    expect(body.graph.nodes[0]?.status).toBe("verified");
  });
});
