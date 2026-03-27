import { beforeEach, describe, expect, it, vi } from "vitest";

const { runBlueprintMock, createRunPlanMock, upsertSessionMock } = vi.hoisted(() => ({
  runBlueprintMock: vi.fn(),
  createRunPlanMock: vi.fn(),
  upsertSessionMock: vi.fn()
}));

vi.mock("@/lib/blueprint/runner", () => ({
  runBlueprint: runBlueprintMock
}));

vi.mock("@/lib/blueprint/plan", () => ({
  createRunPlan: createRunPlanMock
}));

vi.mock("@/lib/blueprint/session-store", () => ({
  upsertSession: upsertSessionMock
}));

import { POST } from "@/app/api/executions/run/route";
import type { BlueprintGraph, RuntimeExecutionResult } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const baseGraph: BlueprintGraph = {
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
      contract: { ...emptyContract(), summary: "Save a record.", outputs: [{ name: "ok", type: "boolean" }] },
      status: "implemented",
      implementationDraft: "export function save(input: unknown) { return { ok: true, input }; }",
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  createRunPlanMock.mockReturnValue({
    generatedAt: "2026-03-14T00:00:00.000Z",
    tasks: [],
    batches: [],
    warnings: []
  });
  upsertSessionMock.mockResolvedValue({
    sessionId: "session-1",
    projectName: "Execution Route",
    updatedAt: "2026-03-14T00:00:00.000Z",
    graph: baseGraph,
    runPlan: {
      generatedAt: "2026-03-14T00:00:00.000Z",
      tasks: [],
      batches: [],
      warnings: []
    },
    approvalIds: []
  });
});

describe("POST /api/executions/run", () => {
  it("updates the graph from node-level execution steps and persists the updated verification state", async () => {
    const result = {
      success: true,
      stdout: '{"ok": true}',
      stderr: "",
      exitCode: 0,
      durationMs: 18,
      executedPath: "/tmp/runtime",
      error: undefined,
      runId: "run-1",
      entryNodeId: "function:save",
      executedNodeId: "function:save",
      steps: [
        {
          id: "step-node-save",
          runId: "run-1",
          kind: "node",
          nodeId: "function:save",
          status: "passed",
          startedAt: "2026-03-14T00:00:00.000Z",
          completedAt: "2026-03-14T00:00:00.018Z",
          durationMs: 18,
          stdout: '{"ok": true}',
          stderr: "",
          message: "save executed successfully.",
          artifactIds: [],
          contractChecks: []
        }
      ],
      artifacts: [],
      summary: {
        passed: 1,
        failed: 0,
        blocked: 0,
        skipped: 0,
        warning: 0
      },
      testCases: [],
      testResults: []
    } satisfies RuntimeExecutionResult & { executedNodeId: string };

    runBlueprintMock.mockResolvedValueOnce(result);

    const response = await POST(
      new Request("http://localhost/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph: baseGraph,
          targetNodeId: "function:save",
          input: "{}",
          includeGeneratedTests: false
        })
      })
    );

    const body = (await response.json()) as {
      result: RuntimeExecutionResult;
      graph: BlueprintGraph;
      executedNodeId: string;
    };

    expect(response.status).toBe(200);
    expect(body.executedNodeId).toBe("function:save");
    expect(body.result.steps).toHaveLength(1);
    expect(body.graph.nodes[0]?.status).toBe("verified");
    expect(body.graph.nodes[0]?.lastVerification?.status).toBe("success");
    expect(createRunPlanMock).toHaveBeenCalledWith(body.graph);
    expect(upsertSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [expect.objectContaining({ status: "verified" })]
        }),
        lastExecutionReport: expect.objectContaining({
          steps: result.steps,
          artifacts: result.artifacts,
          summary: result.summary
        })
      })
    );
  });

  it("keeps failure locality from result steps when graph runs integration-wide", async () => {
    const integrationGraph: BlueprintGraph = {
      ...baseGraph,
      phase: "integration",
      nodes: [
        {
          ...baseGraph.nodes[0]!,
          status: "spec_only",
          id: "function:save",
          name: "save",
          contract: { ...emptyContract(), summary: "Save a record.", outputs: [{ name: "ok", type: "boolean" }] }
        },
        {
          id: "function:load",
          kind: "function",
          name: "load",
          summary: "Load a record.",
          contract: { ...emptyContract(), summary: "Load a record.", inputs: [{ name: "ok", type: "boolean" }] },
          status: "spec_only",
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ],
      edges: [
        {
          from: "function:save",
          to: "function:load",
          kind: "calls",
          required: true,
          confidence: 1
        }
      ]
    };

    const result = {
      success: false,
      stdout: "",
      stderr: "blocked downstream node",
      exitCode: 1,
      durationMs: 22,
      executedPath: "/tmp/runtime",
      error: "blocked downstream node",
      runId: "run-2",
      entryNodeId: "function:save",
      executedNodeId: "function:save",
      steps: [
        {
          id: "step-node-save",
          runId: "run-2",
          kind: "node",
          nodeId: "function:save",
          status: "passed",
          startedAt: "2026-03-14T00:00:00.000Z",
          completedAt: "2026-03-14T00:00:00.010Z",
          durationMs: 10,
          stdout: "",
          stderr: "",
          message: "save executed successfully.",
          artifactIds: [],
          contractChecks: []
        },
        {
          id: "step-node-load",
          runId: "run-2",
          kind: "node",
          nodeId: "function:load",
          status: "blocked",
          startedAt: "2026-03-14T00:00:00.011Z",
          completedAt: "2026-03-14T00:00:00.022Z",
          durationMs: 11,
          stdout: "",
          stderr: "",
          message: "load was blocked by upstream validation.",
          blockedByStepId: "step-edge-save-load",
          artifactIds: [],
          contractChecks: []
        }
      ],
      artifacts: [],
      summary: {
        passed: 1,
        failed: 0,
        blocked: 1,
        skipped: 0,
        warning: 0
      },
      testCases: [],
      testResults: []
    } satisfies RuntimeExecutionResult & { executedNodeId: string };

    runBlueprintMock.mockResolvedValueOnce(result);

    const response = await POST(
      new Request("http://localhost/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph: integrationGraph,
          input: "{}",
          includeGeneratedTests: false
        })
      })
    );

    const body = (await response.json()) as { result: RuntimeExecutionResult; graph: BlueprintGraph };

    expect(response.status).toBe(200);
    expect(body.result.success).toBe(false);
    expect(body.graph.nodes.find((node) => node.id === "function:save")?.status).toBe("connected");
    expect(body.graph.nodes.find((node) => node.id === "function:load")?.status).toBe("spec_only");
    expect(upsertSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({ id: "function:save", status: "connected" }),
            expect.objectContaining({ id: "function:load", status: "spec_only" })
          ]
        })
      })
    );
  });
});
